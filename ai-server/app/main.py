import os
import json
import re
import time
from typing import Any, Dict, List, Optional

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from openai import OpenAI


# ============================================================
# 1. 환경변수 / 전역 객체
# ============================================================

load_dotenv(override=True)

DB_CONFIG = {
    "host": os.getenv("DB_HOST"),
    "port": os.getenv("DB_PORT"),
    "dbname": os.getenv("DB_NAME"),
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GPT_MODEL = os.getenv("GPT_MODEL", "gpt-5.4-mini")
E5_MODEL_NAME = os.getenv("E5_MODEL_NAME", "intfloat/multilingual-e5-base")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY가 .env에 없습니다.")

missing_db = [k for k, v in DB_CONFIG.items() if not v]
if missing_db:
    raise RuntimeError(f"DB 환경변수 누락: {missing_db}")

client = OpenAI(api_key=OPENAI_API_KEY)

print("E5 모델 로딩 중...")
e5_model = SentenceTransformer(E5_MODEL_NAME)
print("E5 모델 로딩 완료:", E5_MODEL_NAME)


# ============================================================
# 2. FastAPI 앱 설정
# ============================================================

app = FastAPI(
    title="DBR Case Atlas Recommendation API",
    description="DBR 케이스 추천 API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 3. Request / Response Schema
# ============================================================

class RecommendRequest(BaseModel):
    query: str = Field(..., description="사용자 자연어 질의")
    top_k: int = Field(80, description="DB 벡터 검색 후보 수")
    rerank_k: int = Field(20, description="GPT rerank 후보 수")
    final_k: int = Field(5, description="최종 추천 개수")


class ResultStatus(BaseModel):
    status: str
    message: str


class RecommendationItem(BaseModel):
    ranking: int
    case_idx: int

    chapter_title: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    src_url: Optional[str] = None
    issue_no: Optional[str] = None
    pub_year: Optional[int] = None
    comp_name: Optional[str] = None
    comp_size: Optional[str] = None
    industry: Optional[str] = None

    prob_main: Optional[str] = None
    prob_keyword: Optional[str] = None
    prob_def: Optional[str] = None
    sol_type: Optional[str] = None
    sol_detail: Optional[str] = None
    perf_type: Optional[str] = None
    perf_dir: Optional[str] = None

    x: Optional[int] = None
    y: Optional[int] = None

    meta_sim: float
    summary_sim: float
    metadata_bonus: float
    base_score: float
    gpt_relevance_score: float
    condition_match: str
    raw_final_score: float
    final_score: float
    reco_reason: str
    reason_check: str


class RecommendResponse(BaseModel):
    query: str
    e5_query: str
    query_meta: Dict[str, Any]
    result_status: ResultStatus
    recommendations: List[RecommendationItem]


# ============================================================
# 4. 공통 유틸
# ============================================================

def get_db_conn():
    return psycopg2.connect(**DB_CONFIG)


def safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def vector_to_pgvector_str(vec: np.ndarray) -> str:
    return "[" + ",".join([str(float(x)) for x in vec.tolist()]) + "]"


def extract_json_from_text(text: str) -> Dict[str, Any]:
    text = str(text).strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())

    raise ValueError("GPT 응답에서 JSON을 찾지 못했습니다.")


def call_gpt_json(
    system_prompt: str,
    user_prompt: str,
    max_completion_tokens: int = 2000,
    temperature: float = 0.0
) -> Dict[str, Any]:
    response = client.chat.completions.create(
        model=GPT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": user_prompt.strip()}
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
        max_completion_tokens=max_completion_tokens
    )

    content = response.choices[0].message.content
    return extract_json_from_text(content)


def normalize_condition(value: Any) -> str:
    value = safe_str(value).lower().strip()
    allowed = ["full", "mostly", "partial", "weak", "none", "not_reranked"]
    return value if value in allowed else "partial"


# ============================================================
# 5. 사용자 질의 분석
# ============================================================

def analyze_query_with_gpt_mini(query_text: str) -> Dict[str, Any]:
    system_prompt = """
너는 DBR 케이스스터디 추천 시스템의 사용자 질의 분석기다.

역할:
사용자의 자연어 질의를 추천 검색에 활용할 수 있도록 구조화한다.

반환 형식:
{
  "prob_main": "성장|고객|효율|혁신|null",
  "prob_keyword": ["키워드1", "키워드2"],
  "expected_cause": "사용자가 이런 사례를 찾는 이유",
  "perf_type": "기대 성과 유형",
  "sol_type": "마케팅·브랜딩|기술 도입|제품·서비스 개선|플랫폼 활용|운영 효율화|수익화|null",
  "industry": "산업군 또는 null",
  "expanded_query": "검색에 사용할 확장 질의",
  "must_have": ["핵심 조건1", "핵심 조건2"],
  "nice_to_have": ["있으면 좋은 조건1"],
  "exclude": ["제외해야 할 조건1"]
}

주의:
- JSON만 반환한다.
- 사용자가 명시하지 않은 산업군은 null로 둔다.
- must_have는 질의의 핵심 조건만 넣는다.
- nice_to_have는 참고 조건이다.
"""

    user_prompt = f"""
사용자 질의:
{query_text}

위 질의를 DBR 케이스 추천용 메타데이터로 분석하라.
JSON 외 설명은 출력하지 마라.
"""

    return call_gpt_json(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_completion_tokens=1200,
        temperature=0.0
    )


# ============================================================
# 6. DB 벡터 검색
# ============================================================

def search_candidates_from_db(query_embedding: np.ndarray, top_k: int = 80) -> List[Dict[str, Any]]:
    query_vec = vector_to_pgvector_str(query_embedding)

    conn = get_db_conn()

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            meta_sql = """
            SELECT
                case_idx,
                1 - (meta_embedding <=> %s::vector) AS meta_sim
            FROM t_case
            WHERE meta_embedding IS NOT NULL
            ORDER BY meta_embedding <=> %s::vector
            LIMIT %s;
            """

            summary_sql = """
            SELECT
                case_idx,
                1 - (summary_embedding <=> %s::vector) AS summary_sim
            FROM t_case
            WHERE summary_embedding IS NOT NULL
            ORDER BY summary_embedding <=> %s::vector
            LIMIT %s;
            """

            cur.execute(meta_sql, (query_vec, query_vec, top_k))
            meta_rows = cur.fetchall()

            cur.execute(summary_sql, (query_vec, query_vec, top_k))
            summary_rows = cur.fetchall()

            candidate_map: Dict[int, Dict[str, Any]] = {}

            for row in meta_rows:
                case_idx = int(row["case_idx"])
                candidate_map.setdefault(case_idx, {"case_idx": case_idx})
                candidate_map[case_idx]["meta_sim"] = float(row["meta_sim"])

            for row in summary_rows:
                case_idx = int(row["case_idx"])
                candidate_map.setdefault(case_idx, {"case_idx": case_idx})
                candidate_map[case_idx]["summary_sim"] = float(row["summary_sim"])

            case_ids = list(candidate_map.keys())

            if not case_ids:
                return []

            detail_sql = """
            SELECT
                case_idx,
                chapter_title,
                title,
                summary,
                src_url,
                issue_no,
                pub_year,
                comp_name,
                comp_size,
                industry,
                prob_main,
                prob_keyword,
                prob_def,
                sol_type,
                sol_detail,
                perf_type,
                perf_dir,
                x,
                y
            FROM t_case
            WHERE case_idx = ANY(%s::bigint[]);
            """

            cur.execute(detail_sql, (case_ids,))
            detail_rows = cur.fetchall()

            for row in detail_rows:
                case_idx = int(row["case_idx"])
                if case_idx in candidate_map:
                    candidate_map[case_idx].update(dict(row))

            candidates = []

            for _, row in candidate_map.items():
                row["meta_sim"] = float(row.get("meta_sim", 0.0) or 0.0)
                row["summary_sim"] = float(row.get("summary_sim", 0.0) or 0.0)
                candidates.append(row)

            return candidates

    finally:
        conn.close()


# ============================================================
# 7. 메타데이터 보너스
# ============================================================

def calc_metadata_bonus(row: Dict[str, Any], query_meta: Dict[str, Any]) -> float:
    bonus = 0.0

    row_prob_main = safe_str(row.get("prob_main"))
    row_prob_keyword = safe_str(row.get("prob_keyword"))
    row_sol_type = safe_str(row.get("sol_type"))
    row_industry = safe_str(row.get("industry"))

    row_text = " ".join([
        safe_str(row.get("title")),
        safe_str(row.get("summary")),
        safe_str(row.get("prob_def")),
        safe_str(row.get("sol_detail")),
        row_prob_keyword,
        row_sol_type,
        row_industry
    ])

    query_prob_main = safe_str(query_meta.get("prob_main"))
    query_sol_type = safe_str(query_meta.get("sol_type"))
    query_industry = safe_str(query_meta.get("industry"))
    query_keywords = query_meta.get("prob_keyword", []) or []
    must_have = query_meta.get("must_have", []) or []
    exclude = query_meta.get("exclude", []) or []

    if query_prob_main and query_prob_main != "null" and row_prob_main == query_prob_main:
        bonus += 0.08

    if query_sol_type and query_sol_type != "null" and row_sol_type == query_sol_type:
        bonus += 0.12

    if query_industry and query_industry != "null" and row_industry == query_industry:
        bonus += 0.05

    for kw in query_keywords:
        kw = safe_str(kw)
        if kw and kw in row_text:
            bonus += 0.04

    for cond in must_have:
        cond = safe_str(cond)
        if cond and cond in row_text:
            bonus += 0.03

    for ex in exclude:
        ex = safe_str(ex)
        if ex and ex in row_text:
            bonus -= 0.08

    return round(bonus, 4)


# ============================================================
# 8. GPT reranker
# ============================================================

def build_case_brief(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "case_idx": int(row["case_idx"]),
        "title": safe_str(row.get("title"))[:180],
        "prob_main": safe_str(row.get("prob_main")),
        "prob_keyword": safe_str(row.get("prob_keyword")),
        "sol_type": safe_str(row.get("sol_type")),
        "industry": safe_str(row.get("industry")),
        "prob_def": safe_str(row.get("prob_def"))[:200],
        "sol_detail": safe_str(row.get("sol_detail"))[:200],
        "summary": safe_str(row.get("summary"))[:360],
        "base_score": round(float(row.get("base_score", 0)), 4)
    }


def build_diverse_rerank_pool(
    candidates: List[Dict[str, Any]],
    query_meta: Dict[str, Any],
    rerank_k: int = 20
) -> List[Dict[str, Any]]:
    query_sol_type = safe_str(query_meta.get("sol_type"))
    query_prob_main = safe_str(query_meta.get("prob_main"))

    selected: Dict[int, Dict[str, Any]] = {}

    def add_rows(rows: List[Dict[str, Any]], n: int):
        for row in rows[:n]:
            selected[int(row["case_idx"])] = row

    by_base = sorted(candidates, key=lambda x: x.get("base_score", 0), reverse=True)
    by_meta = sorted(candidates, key=lambda x: x.get("meta_sim", 0), reverse=True)
    by_summary = sorted(candidates, key=lambda x: x.get("summary_sim", 0), reverse=True)
    by_bonus = sorted(candidates, key=lambda x: x.get("metadata_bonus", 0), reverse=True)

    add_rows(by_base, max(8, rerank_k // 2))
    add_rows(by_meta, 6)
    add_rows(by_summary, 6)
    add_rows(by_bonus, 6)

    if query_sol_type and query_sol_type != "null":
        sol_match = [r for r in candidates if safe_str(r.get("sol_type")) == query_sol_type]
        sol_match = sorted(sol_match, key=lambda x: x.get("base_score", 0), reverse=True)
        add_rows(sol_match, 8)

    if query_prob_main and query_prob_main != "null":
        prob_match = [r for r in candidates if safe_str(r.get("prob_main")) == query_prob_main]
        prob_match = sorted(prob_match, key=lambda x: x.get("base_score", 0), reverse=True)
        add_rows(prob_match, 8)

    pool = list(selected.values())
    pool = sorted(pool, key=lambda x: x.get("base_score", 0), reverse=True)

    if len(pool) < rerank_k:
        existing = {int(r["case_idx"]) for r in pool}
        for row in by_base:
            if int(row["case_idx"]) not in existing:
                pool.append(row)
                existing.add(int(row["case_idx"]))
            if len(pool) >= rerank_k:
                break

    return pool[:rerank_k]


def cap_gpt_score_by_condition(condition_match: str, score: float) -> float:
    condition = normalize_condition(condition_match)
    score = float(score)

    if condition == "full":
        return min(max(score, 0.80), 1.00)
    if condition == "mostly":
        return min(max(score, 0.60), 0.79)
    if condition == "partial":
        return min(max(score, 0.30), 0.49)
    if condition == "weak":
        return min(max(score, 0.10), 0.29)
    if condition == "none":
        return min(max(score, 0.00), 0.09)

    return 0.0


def validate_reco_reason(condition_match: str, reco_reason: str) -> str:
    condition = normalize_condition(condition_match)
    reason = safe_str(reco_reason)

    if not reason.strip():
        return "WARN: 추천 이유 없음"

    negative_terms = [
        "약함", "부족", "아님", "없음", "거리가", "직접적이지",
        "주변적", "일부", "무관", "낮음", "중심은 아님",
        "보기 어렵", "한계"
    ]

    strong_positive_terms = [
        "매우 적합", "직접적으로 부합", "핵심적으로 부합",
        "완전히 부합", "가장 적합", "정확히 부합"
    ]

    if condition == "full":
        if any(term in reason for term in negative_terms):
            return "CHECK: full인데 추천 이유에 부정 표현 있음"
        return "OK"

    if condition == "mostly":
        if "전혀" in reason or "무관" in reason:
            return "CHECK: mostly인데 무관 표현 있음"
        return "OK"

    if condition in ["partial", "weak", "none"]:
        if any(term in reason for term in strong_positive_terms):
            return "CHECK: 낮은 condition인데 과도하게 긍정적"
        return "OK"

    return "OK"


def rerank_candidates_with_gpt(
    query_text: str,
    query_meta: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    rerank_k: int = 20,
    max_retries: int = 2
) -> List[Dict[str, Any]]:
    pool = build_diverse_rerank_pool(candidates, query_meta, rerank_k)
    cases = [build_case_brief(row) for row in pool]
    valid_case_ids = {int(c["case_idx"]) for c in cases}

    system_prompt = """
너는 DBR 케이스스터디 추천 시스템의 엄격한 후보 재평가 reranker다.

역할:
E5 임베딩 검색으로 뽑힌 후보 케이스가 사용자 질의 의도와 얼마나 맞는지 평가하고,
최종 추천 이유를 생성한다.

평가 원칙:
1. 사용자의 핵심 조건을 먼저 파악한다.
2. 핵심 조건을 모두 만족하는 케이스만 높은 점수를 준다.
3. 단어가 비슷하거나 주변 주제가 비슷하다는 이유만으로 높은 점수를 주지 않는다.
4. 복합 질의는 모든 핵심 조건을 함께 만족해야 높은 점수를 준다.
5. 후보가 핵심 조건 중 하나만 만족하면 절대 mostly 또는 full로 평가하지 않는다.
6. 정확히 일치하는 사례가 없으면 가장 가까운 대체 사례를 추천하되, 점수는 낮게 준다.
7. 추천 이유는 사용자 질의와 케이스의 연결점을 근거 중심으로 설명한다.
8. 추천 이유에서 케이스에 없는 내용을 지어내지 않는다.
9. 반드시 JSON만 반환한다.

condition_match 기준:
- full: 핵심 조건을 모두 직접적으로 만족
- mostly: 핵심 조건 대부분을 직접 만족하지만 일부 조건이 약함
- partial: 핵심 조건 중 일부만 만족
- weak: 주변적으로만 관련
- none: 관련성 낮음

점수 범위:
- full: 0.80~1.00
- mostly: 0.60~0.79
- partial: 0.30~0.49
- weak: 0.10~0.29
- none: 0.00~0.09

중요한 판정 규칙:
- "일부만 부합", "직접 관련은 약함", "중심은 아님", "마케팅보다는 기술 도입에 가까움", "AI보다는 브랜딩 중심"이라고 판단되면 condition_match는 partial 이하로 설정한다.
- 사용자가 A와 B를 동시에 요구하면, A만 만족하거나 B만 만족하는 케이스는 partial 이하로 평가한다.
- 사용자의 must_have 조건이 2개 이상이면, 모든 must_have를 직접 만족해야 mostly 이상을 줄 수 있다.
- exclude 조건에 해당하는 후보는 mostly 이상을 줄 수 없다.
- 정확한 사례가 없다고 판단되면 억지로 full/mostly를 만들지 말고 partial/weak로 정직하게 평가한다.
- 사용자 질의에 명시되지 않은 조건을 임의로 필수 조건으로 추가하지 마라.
- query_meta의 nice_to_have는 참고 조건일 뿐, 감점의 핵심 기준으로 사용하지 마라.
- 특정 산업이나 특정 기업 사례라는 이유만으로 감점하지 마라.
- 케이스스터디는 원래 특정 산업/기업 사례일 수 있으며, 사용자의 질의와 핵심 전략이 맞으면 높은 점수를 줄 수 있다.
- 사용자가 범용 사례, 모든 산업에 적용 가능한 사례, 일반화 가능한 사례라고 명시하지 않았다면 업종 특수성을 이유로 감점하지 마라.

추천 이유 작성 규칙:
- 한 문장 또는 두 문장으로 작성한다.
- 왜 추천됐는지와 어떤 한계가 있는지를 함께 쓴다.
- full/mostly일 때는 적합한 이유를 중심으로 쓴다.
- partial/weak일 때는 부분적으로만 맞는 이유와 한계를 명확히 쓴다.
- 과장 금지.
- 케이스 요약에 없는 AI, 성과, 산업, 수치를 임의로 추가하지 않는다.

반환 형식:
{
  "query_core_conditions": ["핵심 조건 1", "핵심 조건 2"],
  "results": [
    {
      "case_idx": 1,
      "condition_match": "full|mostly|partial|weak|none",
      "gpt_relevance_score": 0.82,
      "reco_reason": "추천 이유"
    }
  ]
}
"""

    user_prompt = f"""
사용자 질의:
{query_text}

사용자 입력 쿼리 분석 query_meta:
{json.dumps(query_meta, ensure_ascii=False, indent=2)}

후보 케이스:
{json.dumps(cases, ensure_ascii=False, indent=2)}

작업:
1. 사용자 질의의 핵심 조건을 추출하라.
2. 각 후보가 핵심 조건을 얼마나 만족하는지 평가하라.
3. condition_match와 gpt_relevance_score가 서로 모순되지 않게 하라.
4. reco_reason에는 추천 근거와 한계를 함께 작성하라.
5. 반드시 제공된 case_idx만 사용하라.
6. JSON 외 설명은 출력하지 마라.
"""

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            parsed = call_gpt_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_completion_tokens=2600,
                temperature=0.0
            )

            results = parsed.get("results", [])
            cleaned = []

            for item in results:
                case_idx = int(item.get("case_idx"))
                if case_idx not in valid_case_ids:
                    continue

                condition = normalize_condition(item.get("condition_match", "partial"))
                gpt_score = float(item.get("gpt_relevance_score", 0.0))
                gpt_score = cap_gpt_score_by_condition(condition, gpt_score)
                reco_reason = safe_str(item.get("reco_reason", ""))

                cleaned.append({
                    "case_idx": case_idx,
                    "condition_match": condition,
                    "gpt_relevance_score": gpt_score,
                    "reco_reason": reco_reason,
                    "reason_check": validate_reco_reason(condition, reco_reason)
                })

            if not cleaned:
                raise ValueError("GPT reranker 결과에 유효한 case_idx가 없습니다.")

            return cleaned

        except Exception as e:
            last_error = e
            print(f"GPT reranker 호출 실패 {attempt + 1}/{max_retries + 1}: {e}")
            time.sleep(1)

    raise RuntimeError(f"GPT reranker 최종 실패: {last_error}")


# ============================================================
# 9. 최종 점수 / 추천 상태
# ============================================================

def get_final_score_cap(condition_match: str) -> float:
    condition = normalize_condition(condition_match)

    cap_map = {
        "full": 1.00,
        "mostly": 0.82,
        "partial": 0.60,
        "weak": 0.45,
        "none": 0.25,
        "not_reranked": 0.20
    }

    return cap_map.get(condition, 0.20)


def make_result_status(results: List[Dict[str, Any]]) -> Dict[str, str]:
    if not results:
        return {
            "status": "NO_RESULT",
            "message": "추천 결과가 없습니다."
        }

    conditions = [normalize_condition(r.get("condition_match")) for r in results]

    if "full" in conditions:
        return {
            "status": "DIRECT_MATCH",
            "message": "사용자 질의와 직접적으로 부합하는 케이스가 포함되어 있습니다."
        }

    if "mostly" in conditions:
        return {
            "status": "CLOSE_MATCH",
            "message": "사용자 질의와 대부분 부합하는 케이스가 포함되어 있습니다. 일부 조건은 약할 수 있습니다."
        }

    if "partial" in conditions or "weak" in conditions:
        return {
            "status": "ALTERNATIVE_MATCH",
            "message": "정확히 일치하는 케이스는 부족합니다. 아래 결과는 핵심 조건 중 일부와 관련된 대체 참고 사례입니다."
        }

    return {
        "status": "LOW_MATCH",
        "message": "사용자 질의와 직접적으로 맞는 케이스를 찾기 어렵습니다. 검색어를 더 구체화하는 것이 좋습니다."
    }


# ============================================================
# 10. 추천 메인 함수
# ============================================================

def recommend_cases_service(
    query_text: str,
    top_k: int = 80,
    rerank_k: int = 20,
    final_k: int = 5
) -> Dict[str, Any]:
    query_meta = analyze_query_with_gpt_mini(query_text)
    expanded_query = query_meta.get("expanded_query", query_text)

    if expanded_query and expanded_query != query_text:
        e5_query = "query: " + query_text + " " + expanded_query
    else:
        e5_query = "query: " + query_text

    query_embedding = e5_model.encode(
        [e5_query],
        normalize_embeddings=True
    ).astype("float32")[0]

    candidates = search_candidates_from_db(query_embedding, top_k=top_k)

    if not candidates:
        raise ValueError("DB 검색 결과가 없습니다.")

    for row in candidates:
        row["metadata_bonus"] = calc_metadata_bonus(row, query_meta)
        row["base_score"] = (
            float(row.get("meta_sim", 0)) * 0.55
            + float(row.get("summary_sim", 0)) * 0.30
            + float(row.get("metadata_bonus", 0)) * 0.15
        )

    rerank_results = rerank_candidates_with_gpt(
        query_text=query_text,
        query_meta=query_meta,
        candidates=candidates,
        rerank_k=min(rerank_k, len(candidates))
    )

    rerank_map = {int(r["case_idx"]): r for r in rerank_results}

    for row in candidates:
        case_idx = int(row["case_idx"])
        gpt_info = rerank_map.get(case_idx, {})

        row["gpt_relevance_score"] = float(gpt_info.get("gpt_relevance_score", 0.0))
        row["condition_match"] = normalize_condition(gpt_info.get("condition_match", "not_reranked"))
        row["reco_reason"] = safe_str(gpt_info.get("reco_reason", "GPT rerank 대상 외 후보"))
        row["reason_check"] = safe_str(gpt_info.get("reason_check", "NOT_CHECKED"))

        row["raw_final_score"] = (
            float(row.get("base_score", 0)) * 0.55
            + float(row.get("gpt_relevance_score", 0)) * 0.45
        )

        row["final_score"] = min(
            row["raw_final_score"],
            get_final_score_cap(row["condition_match"])
        )

    candidates = sorted(candidates, key=lambda x: x.get("final_score", 0), reverse=True)
    final_results = candidates[:final_k]

    for idx, row in enumerate(final_results, start=1):
        row["ranking"] = idx

    result_status = make_result_status(final_results)

    recommendations = []

    for row in final_results:
        recommendations.append({
            "ranking": int(row["ranking"]),
            "case_idx": int(row["case_idx"]),
            "chapter_title": row.get("chapter_title"),
            "title": row.get("title"),
            "summary": row.get("summary"),
            "src_url": row.get("src_url"),
            "issue_no": row.get("issue_no"),
            "pub_year": row.get("pub_year"),
            "comp_name": row.get("comp_name"),
            "comp_size": row.get("comp_size"),
            "industry": row.get("industry"),
            "prob_main": row.get("prob_main"),
            "prob_keyword": row.get("prob_keyword"),
            "prob_def": row.get("prob_def"),
            "sol_type": row.get("sol_type"),
            "sol_detail": row.get("sol_detail"),
            "perf_type": row.get("perf_type"),
            "perf_dir": row.get("perf_dir"),
            "x": row.get("x"),
            "y": row.get("y"),
            "meta_sim": round(float(row.get("meta_sim", 0)), 4),
            "summary_sim": round(float(row.get("summary_sim", 0)), 4),
            "metadata_bonus": round(float(row.get("metadata_bonus", 0)), 4),
            "base_score": round(float(row.get("base_score", 0)), 4),
            "gpt_relevance_score": round(float(row.get("gpt_relevance_score", 0)), 4),
            "condition_match": row.get("condition_match"),
            "raw_final_score": round(float(row.get("raw_final_score", 0)), 4),
            "final_score": round(float(row.get("final_score", 0)), 4),
            "reco_reason": row.get("reco_reason"),
            "reason_check": row.get("reason_check"),
        })

    return {
        "query": query_text,
        "e5_query": e5_query,
        "query_meta": query_meta,
        "result_status": result_status,
        "recommendations": recommendations
    }


# ============================================================
# 11. API Router
# ============================================================

@app.get("/")
def root():
    return {
        "message": "DBR Case Atlas Recommendation API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }


@app.post("/recommend", response_model=RecommendResponse)
def recommend_api(request: RecommendRequest):
    try:
        result = recommend_cases_service(
            query_text=request.query,
            top_k=request.top_k,
            rerank_k=request.rerank_k,
            final_k=request.final_k
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))