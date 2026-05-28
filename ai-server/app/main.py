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

    # 검색어 기준 동적 좌표 맵용 필드
    dynamic_x: Optional[int] = None
    dynamic_y: Optional[int] = None
    map_distance: Optional[float] = None
    map_group: Optional[str] = None
    map_rank: Optional[int] = None
    map_angle: Optional[float] = None

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


class DynamicMapItem(BaseModel):
    """검색 결과 맵에 표시할 후보 케이스.

    recommendations는 최종 TOP5만 담고, map_candidates는 동적 좌표 맵에
    배경 점으로 함께 표시할 관련 후보군까지 담는다.
    """
    case_idx: int
    ranking: Optional[int] = None

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
    dynamic_x: Optional[int] = None
    dynamic_y: Optional[int] = None

    map_distance: Optional[float] = None
    map_angle: Optional[float] = None
    map_group: str = "candidate"
    map_rank: Optional[int] = None
    is_recommended: bool = False

    meta_sim: Optional[float] = None
    summary_sim: Optional[float] = None
    metadata_bonus: Optional[float] = None
    base_score: Optional[float] = None
    gpt_relevance_score: Optional[float] = None
    raw_final_score: Optional[float] = None
    final_score: Optional[float] = None
    condition_match: Optional[str] = None
    reco_reason: Optional[str] = None
    reason_check: Optional[str] = None


class RecommendResponse(BaseModel):
    query: str
    e5_query: str
    query_meta: Dict[str, Any]
    result_status: ResultStatus
    recommendations: List[RecommendationItem]
    map_candidates: List[DynamicMapItem] = Field(default_factory=list)


class PersonalStrategyCase(BaseModel):
    case_idx: int

    title: Optional[str] = None
    summary: Optional[str] = None
    comp_name: Optional[str] = None
    industry: Optional[str] = None

    prob_main: Optional[str] = None
    prob_keyword: Optional[str] = None
    prob_def: Optional[str] = None
    sol_type: Optional[str] = None
    sol_detail: Optional[str] = None
    perf_type: Optional[str] = None
    perf_dir: Optional[str] = None

    reco_reason: Optional[str] = None
    condition_match: Optional[str] = None
    final_score: Optional[float] = None


class PersonalStrategiesRequest(BaseModel):
    user_context: str = Field(..., description="사용자가 자유롭게 입력한 현재 상황")
    cases: List[PersonalStrategyCase] = Field(..., description="개인화 전략을 생성할 추천 케이스 목록")


class PersonalStrategyItem(BaseModel):
    case_idx: int
    personal_strategy: str
    strategy_status: str
    based_on_case_title: Optional[str] = None


class PersonalStrategiesResponse(BaseModel):
    success: bool
    strategies: List[PersonalStrategyItem]


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


class PersonalContextValidationError(ValueError):
    """사용자 상황 입력값 검증 실패 예외"""
    pass


BLOCKED_INPUT_PATTERN = re.compile(
    r"(시발|씨발|ㅅㅂ|병신|새끼|개새|좆|존나|ㅈㄴ|꺼져|죽어|"
    r"대머리새끼|미친|개빡|짜증|혐오|죽이고|죽여|fuck|shit)",
    re.IGNORECASE
)

MEANINGLESS_INPUT_PATTERN = re.compile(
    r"^(test|asdf|qwer|zxcv|ㅋㅋ+|ㅎㅎ+|ㅠㅠ+|ㅜㅜ+|아무거나|몰라|모름|안녕|뭐해|해줘|알아서\s*해줘)$",
    re.IGNORECASE
)

PROMPT_INJECTION_PATTERN = re.compile(
    r"(ignore\s+previous|ignore\s+all|system\s*prompt|developer\s*message|"
    r"프롬프트|시스템\s*지시|이전\s*지시|무시하고|규칙\s*무시|"
    r"api[_\s-]*key|비밀번호|password|\.env|환경변수|json만|관리자\s*권한)",
    re.IGNORECASE
)

BUSINESS_CONTEXT_KEYWORDS = [
    "고객", "이탈", "재방문", "전환", "구매", "가입", "유입", "유저", "사용자",
    "마케팅", "CRM", "브랜드", "캠페인", "광고", "콘텐츠", "리텐션",
    "매출", "수익", "비용", "예산", "인력", "리소스", "개발", "운영", "효율",
    "서비스", "제품", "앱", "플랫폼", "커머스", "리테일", "스타트업", "신사업", "시장",
    "데이터", "분석", "실험", "개선", "문제", "전략", "방향", "제약", "성과", "만족도", "UX"
]


def normalize_user_context_text(user_context: str) -> str:
    """상황 입력값의 공백과 제어문자를 정리한다."""
    text = safe_str(user_context)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t\x00-\x08\x0b\x0c\x0e-\x1f]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ ]{2,}", " ", text)
    return text.strip()


def validate_personal_context(user_context: str) -> str:
    """
    추천 케이스 적용 전략 입력창 전용 검증.
    검색창은 '케이스 탐색 의도'를 보지만, 이 입력창은 '현재 상황 설명으로 쓸 수 있는지'를 본다.
    """
    text = normalize_user_context_text(user_context)
    compact = re.sub(r"\s+", "", text)

    if not text:
        raise PersonalContextValidationError("현재 상황을 먼저 입력해주세요.")

    if len(compact) < 10:
        raise PersonalContextValidationError(
            "현재 상황을 조금 더 구체적으로 입력해주세요. 맡은 역할, 해결해야 할 문제, 예산·인력 같은 제약 조건을 함께 적으면 좋아요."
        )

    if len(text) > 1200:
        raise PersonalContextValidationError("입력 내용이 너무 깁니다. 현재 역할, 문제 상황, 제약 조건 중심으로 1~5문장 정도로 줄여주세요.")

    if BLOCKED_INPUT_PATTERN.search(text):
        raise PersonalContextValidationError("현재 상황을 비즈니스 문제 중심으로 다시 작성해주세요. 비속어나 공격적인 표현은 사용할 수 없습니다.")

    if PROMPT_INJECTION_PATTERN.search(text):
        raise PersonalContextValidationError("현재 상황 입력에는 역할, 문제 상황, 제약 조건만 적어주세요. 시스템 지시나 프롬프트 변경 요청은 사용할 수 없습니다.")

    normalized_lower = compact.lower()
    if MEANINGLESS_INPUT_PATTERN.match(normalized_lower):
        raise PersonalContextValidationError("현재 상황을 비즈니스 문제 중심으로 다시 작성해주세요. 예: 맡은 역할, 해결해야 할 문제, 예산·인력 같은 제약 조건")

    # 같은 글자나 기호 반복 입력 방지: ㅋㅋㅋㅋ, ㅎㅎㅎㅎ, aaaaa, 11111 등
    if re.fullmatch(r"(.)\1{4,}", compact):
        raise PersonalContextValidationError("현재 상황을 비즈니스 문제 중심으로 다시 작성해주세요.")

    # 한글/영문/숫자 없이 기호만 있는 입력 방지
    if not re.search(r"[가-힣a-zA-Z0-9]", text):
        raise PersonalContextValidationError("현재 상황을 문장으로 입력해주세요.")

    has_business_context = any(keyword.lower() in text.lower() for keyword in BUSINESS_CONTEXT_KEYWORDS)

    # 충분히 긴 문장은 자유 서술로 허용하되, 너무 짧고 비즈니스 맥락이 없으면 안내한다.
    if not has_business_context and len(compact) < 25:
        raise PersonalContextValidationError(
            "현재 상황을 비즈니스 문제 중심으로 입력해주세요. 예: 맡은 역할, 해결해야 할 문제, 예산·인력 같은 제약 조건"
        )

    return text


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
  "is_valid_business_query": true,
  "invalid_reason": null,
  "prob_main": "성장|고객|효율|혁신|null",
  "prob_keyword": ["키워드1", "키워드2"],
  "expected_cause": "사용자가 이런 사례를 찾는 이유",
  "perf_type": "기대 성과 유형",
  "sol_type": "마케팅·브랜딩|기술 도입|제품·서비스 개선|플랫폼 활용|운영 효율화|수익화|null",
  "industry": "산업군 또는 null",
  "display_keyword": "사용자 화면에 보여줄 짧은 정제 문구",
  "keyword_group": "인기 검색어 순위 집계에 사용할 표준 대표 키워드",
  "expanded_query": "검색에 사용할 확장 질의 또는 null",
  "must_have": ["핵심 조건1", "핵심 조건2"],
  "nice_to_have": ["있으면 좋은 조건1"],
  "exclude": ["제외해야 할 조건1"]
}

입력 유효성 판단 규칙:
- 사용자의 입력이 비즈니스 문제, 경영 고민, 마케팅/브랜딩/운영/고객/성장/혁신 관련 케이스 탐색 의도라면 is_valid_business_query를 true로 한다.
- 감정 표현만 있거나 의미 없는 테스트 입력이면 is_valid_business_query를 false로 한다.
- 인사, 잡담, 욕설, 단순 불만, 무의미한 반복문자, 서비스 범위 밖 질문이면 is_valid_business_query를 false로 한다.
- 예: "아 짜증나네", "안녕", "뭐해", "test", "asdf", "ㅋㅋㅋㅋ", "도와줘"처럼 비즈니스 문제를 특정할 수 없는 입력은 false다.
- 단, "마케팅", "AI", "성장"처럼 짧더라도 산업군/문제유형 필터가 함께 제공되어 케이스 탐색 의도가 확인되면 true로 볼 수 있다.
- false일 때는 invalid_reason에 이유를 짧게 작성한다.
- false일 때는 prob_main, perf_type, sol_type, industry, display_keyword, expanded_query를 null로 둔다.
- false일 때는 prob_keyword, must_have, nice_to_have, exclude를 빈 배열로 둔다.
- false일 때 display_keyword를 절대 만들지 않는다.
- "검색 의도 확인 필요", "기타", "일반 문의", "분류 불가", "확인 필요" 같은 문구를 display_keyword로 만들지 않는다.

display_keyword 작성 규칙:
- is_valid_business_query가 true일 때만 작성한다.
- 사용자 원문을 그대로 복사하지 않는다.
- 비속어, 감정 표현, 개인정보, 회사명, 인명은 제거한다.
- 10~20자 안팎의 자연스러운 문제 해결형 문구로 작성한다.
- 너무 추상적인 대분류 단어만 쓰지 않는다.
- "성장", "고객", "효율", "혁신" 같은 단어만 단독으로 쓰지 않는다.
- 사용자가 해결하고 싶은 문제 형태로 작성한다.
- 명사형 또는 문제 해결형 표현으로 작성한다.
- 사용자가 명확히 입력한 핵심 키워드는 가능하면 유지한다.
- 의미를 과도하게 확장하거나 좁히지 않는다.
- 사용자가 말하지 않은 세부 실행 방식은 추가하지 않는다.
- 예: 사용자가 "AI 마케팅"이라고만 입력했다면 "AI 마케팅 자동화"보다 "AI 기반 마케팅"처럼 넓게 표현한다.
- 예: 사용자가 "리브랜딩"이라고 입력했다면 "브랜드 재정비"로 바꾸기보다 "리브랜딩 전략"을 유지한다.
- 좋은 예: "수익성 악화 개선", "고객 이탈률 낮추기", "구매 전환율 높이기", "AI 기반 마케팅", "조직 실행력 개선", "물류 비용 절감", "리브랜딩 전략", "신시장 진입 전략"
- 나쁜 예: "성장", "고객", "효율", "디지털전환", "마케팅", 사용자 원문 그대로, 사용자 의도보다 좁아진 표현

keyword_group 작성 규칙:
- keyword_group은 인기 검색어 순위 집계를 위한 표준 대표 키워드다.
- display_keyword보다 더 표준화된 표현으로 작성한다.
- 의미가 비슷한 검색어는 반드시 같은 keyword_group으로 묶는다.
- 사용자 원문을 그대로 복사하지 않는다.
- 너무 넓은 대분류 단어만 쓰지 않는다.
- 8~20자 안팎의 명사형 또는 문제 해결형 표현으로 작성한다.
- 사용자가 말하지 않은 세부 실행 방식은 추가하지 않는다.
- 비즈니스 의도가 유효하지 않으면 keyword_group은 null로 둔다.

대표 묶음 예시:
- 리브랜딩, 브랜드 재정비, 브랜드 이미지 개선, 브랜드 포지셔닝 전환 → "리브랜딩 전략"
- AI 마케팅, AI 활용 마케팅, AI 기반 캠페인, 마케팅 AI 도입 → "AI 기반 마케팅"
- 매출은 나는데 돈이 안 남음, 수익성 저하, 이익률 악화, 비용 부담 → "수익성 악화 개선"
- 고객 이탈, 이탈률 증가, 재방문 감소, 충성도 하락 → "고객 이탈률 낮추기"
- 구매 전환 저하, 전환율 하락, 인지도는 높은데 구매 안 됨 → "구매 전환율 높이기"
- 조직 실행력 저하, 내부 실행 부족, 전략 실행이 안 됨 → "조직 실행력 개선"
- 신사업 진입, 신규 시장 진출, 시장 확장 전략 → "신시장 진입 전략"

display_keyword와 keyword_group의 차이:
- display_keyword는 사용자의 의도를 자연스럽게 보여주는 화면용 문구다.
- keyword_group은 비슷한 검색어를 하나로 묶기 위한 집계용 표준 문구다.
- 예: 사용자가 "신사업 확장과 리브랜딩 전략"이라고 입력하면
  display_keyword는 "신사업 확장과 리브랜딩",
  keyword_group은 "리브랜딩 전략" 또는 핵심 의도에 따라 "신시장 진입 전략"으로 정리한다.
- 복합 의도일 때는 사용자의 핵심 목적에 더 가까운 하나의 대표 그룹을 선택한다.

주의:
- JSON만 반환한다.
- 사용자가 명시하지 않은 산업군은 null로 둔다.
- must_have는 질의의 핵심 조건만 넣는다.
- nice_to_have는 참고 조건이다.
- is_valid_business_query가 false이면 추천 검색을 위한 억지 메타데이터를 만들지 않는다.

비정상 입력 규칙:
- false일 때 display_keyword와 keyword_group을 절대 만들지 않는다.
- 사용자 입력에 욕설, 비하 표현, 혐오 표현, 모욕적 표현이 포함되어 있으면 일부 비즈니스 키워드가 있더라도 is_valid_business_query를 false로 한다.
- 예: "대머리새끼 마케팅", "시발 마케팅", "병신 같은 고객관리"처럼 부적절한 표현이 포함된 경우 false로 한다.
- false일 때 display_keyword와 keyword_group을 절대 생성하지 않는다.
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
                y,
                meta_embedding::text AS meta_embedding_text,
                summary_embedding::text AS summary_embedding_text
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


def get_final_score_cap(condition_match: str) -> float:
    """condition_match별 final_score 상한값을 반환한다.

    final_score 계산부에서 raw_final_score가 과도하게 높아지는 것을 막기 위한
    상한값이다. 추천 점수 로직 자체는 유지하고, 조건 일치 수준별로 화면에
    표시될 수 있는 최대 유사도를 제한한다.
    """
    condition = normalize_condition(condition_match)

    cap_map = {
        "full": 1.00,
        "mostly": 0.82,
        "partial": 0.60,
        "weak": 0.45,
        "none": 0.25,
        "not_reranked": 0.20,
    }

    return cap_map.get(condition, 0.60)


def make_result_status(results: List[Dict[str, Any]]) -> Dict[str, str]:
    """최종 추천 결과의 전체 상태 메시지를 만든다."""
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
너는 DBR 케이스스터디 탐색 서비스의 추천 설명 작성자이자 후보 재평가 reranker다.

역할:
E5 임베딩 검색으로 뽑힌 후보 케이스가 사용자 질의 의도와 얼마나 맞는지 평가하고,
서비스 화면에 바로 보여줄 수 있는 자연스러운 추천 이유를 생성한다.

가장 중요한 원칙:
1. 추천 이유는 반드시 제공된 후보 케이스의 title, summary, prob_def, sol_detail, prob_main, prob_keyword, sol_type, industry에 있는 내용만 근거로 작성한다.
2. 제공된 케이스 정보에 없는 기업 유형, 서비스 유형, 산업, 기술, 성과, 수치, 기능을 절대 지어내지 않는다.
3. 다른 후보 케이스의 내용과 섞어서 설명하지 않는다.
4. case_idx별로 해당 케이스 하나만 보고 추천 이유를 작성한다.
5. 사용자가 입력한 질의의 핵심 조건과 케이스가 연결되는 지점을 설명한다.
6. 정확히 맞지 않는 경우에도 비난하거나 딱 잘라 부정하지 말고, 어떤 관점에서 참고할 수 있는지 부드럽게 설명한다.
7. 반드시 JSON만 반환한다.

평가 원칙:
1. 사용자의 핵심 조건을 먼저 파악한다.
2. 핵심 조건을 모두 만족하는 케이스만 높은 점수를 준다.
3. 단어가 비슷하거나 주변 주제가 비슷하다는 이유만으로 높은 점수를 주지 않는다.
4. 복합 질의는 모든 핵심 조건을 함께 만족해야 높은 점수를 준다.
5. 후보가 핵심 조건 중 하나만 만족하면 mostly 또는 full로 평가하지 않는다.
6. 정확히 일치하는 사례가 없으면 가장 가까운 대체 사례를 추천하되, 점수는 낮게 준다.
7. 사용자 질의에 명시되지 않은 산업군, 기업규모, 특정 기술을 임의의 필수 조건으로 추가하지 않는다.
8. query_meta의 must_have는 핵심 평가 기준이고, nice_to_have는 참고 조건이다.
9. exclude 조건에 해당하는 후보는 mostly 이상으로 평가하지 않는다.

condition_match 기준:
- full: 사용자 질의의 핵심 조건을 모두 직접적으로 만족
- mostly: 핵심 조건 대부분을 만족하지만 일부 조건이 약함
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
- 사용자가 A와 B를 동시에 요구하면, A만 만족하거나 B만 만족하는 케이스는 partial 이하로 평가한다.
- 사용자의 must_have 조건이 2개 이상이면, 모든 must_have를 직접 만족해야 mostly 이상을 줄 수 있다.
- 정확한 사례가 없다고 판단되면 억지로 full 또는 mostly를 만들지 않는다.
- 단, 특정 산업이나 특정 기업 사례라는 이유만으로 감점하지 않는다.
- 케이스스터디는 원래 특정 산업과 기업의 사례이므로, 사용자의 문제 상황이나 해결 전략과 맞으면 충분히 추천할 수 있다.
- 사용자가 범용 사례, 모든 산업에 적용 가능한 사례라고 명시하지 않았다면 업종 특수성을 이유로 감점하지 않는다.

추천 이유 작성 규칙:
1. 추천 이유는 서비스 사용자에게 보여줄 자연스러운 한국어 문장으로 작성한다.
2. 말투는 부드럽고 친근하되, 과장하지 않는다.
3. 한 케이스당 1~2문장으로 작성한다.
4. 문장은 너무 길게 쓰지 말고, 사용자가 바로 이해할 수 있게 쓴다.
5. “~합니다”체를 사용하되 너무 딱딱한 보고서 문체는 피한다.
6. “참고할 만합니다”, “살펴볼 만합니다”, “가까운 사례입니다”, “도움이 될 수 있습니다” 같은 서비스형 표현을 사용한다.
7. partial 또는 weak인 경우에도 “틀렸다”, “부합하지 않는다”, “완전하지 않다”처럼 차갑게 쓰지 않는다.
8. 대신 “다만 ~에 더 가깝습니다”, “직접적인 사례라기보다는 ~ 관점에서 참고할 수 있습니다”처럼 부드럽게 표현한다.
9. “맞지만”, “아님”, “무관”, “보기 어렵습니다”, “완전하지 않습니다”, “중심은 아님” 같은 내부 평가식 표현은 사용하지 않는다.
10. “AI 활용은 맞지만”, “마케팅 사례로는 완전하지 않다” 같은 심사평 문체를 피한다.
11. 추천 이유에는 반드시 사용자의 질의와 케이스 사이의 연결점을 포함한다.
12. 한계가 있는 경우에도 사용자에게 도움이 되는 방향으로 설명한다.
13. 케이스 요약에 없는 CRM, SaaS, 자동화, AI, 플랫폼, 커머스 같은 단어를 임의로 추가하지 않는다.
14. 후보 케이스의 title, summary, prob_def, sol_detail에 없는 세부 기능명이나 성과를 만들지 않는다.
15. 기업명이나 서비스 성격을 추측하지 않는다.
16. 같은 추천 이유 안에서 서로 다른 케이스의 내용이 섞이지 않도록 한다.

좋은 추천 이유 예시:
- "이 사례는 데이터 기반 개인화와 고객 접점 개선을 함께 다룬다는 점에서 참고할 만합니다. 다만 마케팅 캠페인 자체보다는 서비스 경험 개선에 더 가까운 사례입니다."
- "브랜드 인지도와 고객 반응을 높이기 위한 콘텐츠 전략을 다룬 사례라서, 마케팅 관점에서 살펴볼 만합니다. 다만 AI 활용보다는 브랜딩과 콘텐츠 운영에 초점이 있습니다."
- "운영 효율을 높이기 위해 데이터 기반 의사결정을 적용한 사례라는 점에서 유사합니다. 직접적인 마케팅 사례는 아니지만, 데이터 활용 방식은 참고할 수 있습니다."

피해야 할 추천 이유 예시:
- "AI 활용은 맞지만 마케팅 사례로는 완전하지 않다."
- "중심은 중고거래 플랫폼 운영과 업무 효율화다."
- "사용자 질의와 직접적으로 부합하지 않는다."
- "마케팅보다는 기술 도입에 가까워 관련성이 낮다."
- "해당 케이스는 조건을 만족하지 않는다."

반환 형식:
{
  "query_core_conditions": ["핵심 조건 1", "핵심 조건 2"],
  "results": [
    {
      "case_idx": 1,
      "condition_match": "full|mostly|partial|weak|none",
      "gpt_relevance_score": 0.82,
      "reco_reason": "서비스 화면에 보여줄 자연스러운 추천 이유"
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
4. reco_reason은 서비스 화면에 바로 보여줄 수 있는 부드럽고 자연스러운 한국어 문장으로 작성하라.
5. reco_reason은 반드시 해당 case_idx의 후보 정보만 근거로 작성하라.
6. reco_reason에서 다른 후보 케이스의 내용과 섞지 마라.
7. reco_reason에서 제공되지 않은 기술, 산업, 서비스 유형, 성과, 수치를 추측하지 마라.
8. 부분적으로만 맞는 경우에도 차갑게 부정하지 말고, 어떤 관점에서 참고할 수 있는지 설명하라.
9. 반드시 제공된 case_idx만 사용하라.
10. JSON 외 설명은 출력하지 마라.
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
# 9. 검색어 기준 동적 좌표 맵
# ============================================================

def pgvector_text_to_np(value: Any) -> Optional[np.ndarray]:
    """PostgreSQL pgvector의 text 표현('[0.1,0.2,...]')을 numpy 배열로 변환한다."""
    if value is None:
        return None

    if isinstance(value, np.ndarray):
        return value.astype("float32")

    text = safe_str(value).strip()
    if not text:
        return None

    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]

    try:
        arr = np.fromstring(text, sep=",", dtype=np.float32)
        if arr.size == 0:
            return None
        return arr
    except Exception:
        return None


def choose_map_embedding(row: Dict[str, Any]) -> Optional[np.ndarray]:
    """동적 좌표 계산에는 케이스 내용성이 강한 summary_embedding을 우선 사용한다."""
    summary_vec = pgvector_text_to_np(row.get("summary_embedding_text"))
    if summary_vec is not None:
        return summary_vec

    meta_vec = pgvector_text_to_np(row.get("meta_embedding_text"))
    if meta_vec is not None:
        return meta_vec

    return None


PROBLEM_BASE_ANGLES = {
    "고객": 2.35,      # 왼쪽 위
    "성장": 0.78,      # 오른쪽 위
    "효율": -0.78,     # 오른쪽 아래
    "혁신": -2.35,     # 왼쪽 아래
    "기타": 3.14,
}

SOLUTION_ANGLE_OFFSETS = {
    "마케팅·브랜딩": -0.34,
    "기술 도입": 0.34,
    "제품·서비스 개선": -0.12,
    "플랫폼 활용": 0.22,
    "운영 효율화": 0.42,
    "수익화": -0.42,
    "사용자 유지": 0.04,
    "기타": 0.0,
}


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def normalize_angle(angle: float) -> float:
    return float(np.arctan2(np.sin(angle), np.cos(angle)))


def blend_angles(meta_angle: float, embedding_angle: Optional[float], meta_weight: float = 0.72) -> float:
    """두 각도를 원형 평균으로 섞는다. embedding_angle이 없으면 메타 각도를 그대로 쓴다."""
    if embedding_angle is None or not np.isfinite(embedding_angle):
        return normalize_angle(meta_angle)

    embed_weight = 1.0 - meta_weight
    x = np.cos(meta_angle) * meta_weight + np.cos(embedding_angle) * embed_weight
    y = np.sin(meta_angle) * meta_weight + np.sin(embedding_angle) * embed_weight

    if abs(x) + abs(y) < 1e-8:
        return normalize_angle(meta_angle)

    return normalize_angle(float(np.arctan2(y, x)))


def get_meta_angle(row: Dict[str, Any]) -> float:
    """문제유형과 해결유형을 이용해 기본 방향을 만든다.

    같은 문제유형은 같은 큰 방향에 모이고, 해결유형은 그 안에서 약간 벌어지도록 한다.
    """
    prob_main = safe_str(row.get("prob_main")) or "기타"
    sol_type = safe_str(row.get("sol_type")) or "기타"

    base_angle = PROBLEM_BASE_ANGLES.get(prob_main, PROBLEM_BASE_ANGLES["기타"])
    sol_offset = SOLUTION_ANGLE_OFFSETS.get(sol_type, SOLUTION_ANGLE_OFFSETS["기타"])

    # case_idx 기반의 아주 작은 고정 보정값. 랜덤이 아니므로 같은 검색 결과에서는 항상 같은 위치가 나온다.
    try:
        case_idx = int(row.get("case_idx", 0))
    except Exception:
        case_idx = 0

    deterministic_offset = ((case_idx % 9) - 4) * 0.018
    return normalize_angle(base_angle + sol_offset + deterministic_offset)


def get_embedding_angles(
    query_embedding: np.ndarray,
    rows: List[Dict[str, Any]]
) -> Dict[int, float]:
    """임베딩 기반 방향을 계산한다.

    PCA를 화면 좌표로 직접 쓰지 않고, 방향 보정값으로만 사용한다.
    이렇게 하면 한쪽 쏠림은 줄이고, 임베딩 의미는 일부 반영할 수 있다.
    """
    usable_rows: List[Dict[str, Any]] = []
    vectors: List[np.ndarray] = []

    for row in rows:
        vec = choose_map_embedding(row)
        if vec is None:
            continue
        if vec.shape[0] != query_embedding.shape[0]:
            continue
        usable_rows.append(row)
        vectors.append(vec.astype("float32"))

    if len(usable_rows) < 2:
        return {}

    try:
        matrix = np.vstack([query_embedding.astype("float32")] + vectors)
        centered = matrix - matrix.mean(axis=0, keepdims=True)
        _, _, vt = np.linalg.svd(centered, full_matrices=False)
        components = vt[:2].T
        coords_2d = centered @ components

        if coords_2d.shape[1] < 2:
            return {}

        query_coord = coords_2d[0]
        case_coords = coords_2d[1:]
        relative = case_coords - query_coord.reshape(1, 2)

        result: Dict[int, float] = {}
        for row, coord in zip(usable_rows, relative):
            x, y = float(coord[0]), float(coord[1])
            if abs(x) + abs(y) < 1e-8:
                continue
            result[int(row["case_idx"])] = normalize_angle(float(np.arctan2(y, x)))

        return result
    except Exception as e:
        print(f"임베딩 방향 계산 실패, 메타정보 방향만 사용: {e}")
        return {}


def get_radius_by_rank_and_score(row: Dict[str, Any], rank: int) -> float:
    """중심 거리는 추천 순위와 final_score를 함께 사용한다.

    순위가 높을수록 중심에 가까워야 하며, 같은 구간 안에서는 final_score가 높을수록 더 안쪽에 둔다.
    """
    try:
        final_score = float(row.get("final_score", row.get("base_score", 0)) or 0)
    except Exception:
        final_score = 0.0

    final_score = clamp(final_score, 0.0, 1.0)

    if rank == 1:
        base = 64
    elif rank <= 5:
        base = 104 + (rank - 2) * 24
    elif rank <= 20:
        base = 220 + (rank - 6) * 9
    else:
        base = 360 + min(rank - 21, 30) * 4

    score_bonus = (1.0 - final_score) * 42
    return clamp(base + score_bonus, 62, 455)


def spread_angles_deterministically(rows: List[Dict[str, Any]], angles: List[float]) -> List[float]:
    """비슷한 각도에 점이 몰릴 때 최소 간격을 보정한다.

    랜덤을 쓰지 않고 rank/case_idx 순서로 고정 보정한다.
    """
    if not rows:
        return []

    indexed = list(enumerate(zip(rows, angles)))
    indexed.sort(key=lambda item: item[1][1])

    min_gap = 0.115  # 약 6.6도
    adjusted = [0.0] * len(rows)
    previous_angle: Optional[float] = None
    cluster_offset = 0

    for original_index, (row, angle) in indexed:
        next_angle = normalize_angle(angle)

        if previous_angle is not None:
            diff = abs(normalize_angle(next_angle - previous_angle))
            if diff < min_gap:
                cluster_offset += 1
                # 양쪽으로 조금씩 벌린다. case_idx 기반이라 결과가 안정적이다.
                try:
                    case_idx = int(row.get("case_idx", 0))
                except Exception:
                    case_idx = 0
                direction = -1 if case_idx % 2 == 0 else 1
                next_angle = normalize_angle(previous_angle + direction * min_gap * (1 + cluster_offset * 0.35))
            else:
                cluster_offset = 0

        adjusted[original_index] = next_angle
        previous_angle = next_angle

    return adjusted


def fallback_radial_coordinates(rows: List[Dict[str, Any]]) -> None:
    """후보군에 동적 좌표를 안정적으로 부여한다.

    이 fallback도 랜덤을 쓰지 않고 메타정보+순위 기반으로 배치한다.
    """
    if not rows:
        return

    raw_angles = [get_meta_angle(row) for row in rows]
    angles = spread_angles_deterministically(rows, raw_angles)

    for index, row in enumerate(rows):
        rank = index + 1
        radius = get_radius_by_rank_and_score(row, rank)
        angle = angles[index]

        row["dynamic_x"] = int(round(clamp(500 + np.cos(angle) * radius, 58, 942)))
        row["dynamic_y"] = int(round(clamp(500 - np.sin(angle) * radius, 58, 942)))
        row["map_distance"] = round(float(radius / 455), 4)
        row["map_angle"] = round(float(angle), 4)


def add_dynamic_map_coordinates(
    query_embedding: np.ndarray,
    sorted_candidates: List[Dict[str, Any]],
    final_results: List[Dict[str, Any]],
    map_k: int = 50
) -> List[Dict[str, Any]]:
    """검색어 기준 동적 좌표를 후보군에 추가한다.

    설계 원칙:
    - 기존 DB 좌표 x/y는 전체 산점도용으로 그대로 둔다.
    - dynamic_x/dynamic_y만 새로 추가한다.
    - TOP5는 무조건 표시한다.
    - 그 외 후보는 final_score 0.40 이상만 검색 결과 맵에 표시한다.
    - 거리 = final_score/ranking 기준, 방향 = prob_main + sol_type + 임베딩 PCA 보정.
    - 랜덤을 쓰지 않아 같은 검색어/같은 후보군이면 동일한 맵이 나온다.
    """
    recommended_ids = {int(row["case_idx"]) for row in final_results}
    rank_map = {int(row["case_idx"]): int(row.get("ranking", idx + 1)) for idx, row in enumerate(final_results)}

    filtered_rows: List[Dict[str, Any]] = []
    seen_ids = set()

    for row in sorted_candidates:
        case_idx = int(row["case_idx"])
        try:
            final_score = float(row.get("final_score", 0) or 0)
        except Exception:
            final_score = 0.0

        if case_idx in recommended_ids or final_score >= 0.40:
            if case_idx not in seen_ids:
                filtered_rows.append(row)
                seen_ids.add(case_idx)

        if len(filtered_rows) >= map_k:
            break

    # 40% 이상 후보가 너무 적더라도 TOP5는 반드시 포함한다.
    for row in final_results:
        case_idx = int(row["case_idx"])
        if case_idx not in seen_ids:
            filtered_rows.append(row)
            seen_ids.add(case_idx)

    filtered_rows = sorted(filtered_rows, key=lambda x: x.get("final_score", 0), reverse=True)[:map_k]

    embedding_angle_map = get_embedding_angles(query_embedding, filtered_rows)

    raw_angles: List[float] = []
    for row in filtered_rows:
        case_idx = int(row["case_idx"])
        meta_angle = get_meta_angle(row)
        embedding_angle = embedding_angle_map.get(case_idx)
        raw_angles.append(blend_angles(meta_angle, embedding_angle, meta_weight=0.72))

    angles = spread_angles_deterministically(filtered_rows, raw_angles)

    for index, row in enumerate(filtered_rows, start=1):
        case_idx = int(row["case_idx"])
        row["map_rank"] = index
        row["map_group"] = "recommended" if case_idx in recommended_ids else "candidate"
        row["is_recommended"] = case_idx in recommended_ids

        if case_idx in rank_map:
            row["ranking"] = rank_map[case_idx]

        radius = get_radius_by_rank_and_score(row, index)
        angle = angles[index - 1]

        row["dynamic_x"] = int(round(clamp(500 + np.cos(angle) * radius, 58, 942)))
        row["dynamic_y"] = int(round(clamp(500 - np.sin(angle) * radius, 58, 942)))
        row["map_distance"] = round(float(radius / 455), 4)
        row["map_angle"] = round(float(angle), 4)

    return filtered_rows

def build_dynamic_map_item(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "case_idx": int(row["case_idx"]),
        "ranking": row.get("ranking"),
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
        "dynamic_x": row.get("dynamic_x"),
        "dynamic_y": row.get("dynamic_y"),
        "map_distance": row.get("map_distance"),
        "map_angle": row.get("map_angle"),
        "map_group": row.get("map_group", "candidate"),
        "map_rank": row.get("map_rank"),
        "is_recommended": bool(row.get("is_recommended", False)),
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

    is_valid_business_query = query_meta.get("is_valid_business_query", True)

    if isinstance(is_valid_business_query, str):
        is_valid_business_query = is_valid_business_query.strip().lower() not in [
            "false", "no", "0", "null", "none"
        ]

    if is_valid_business_query is False:
        query_meta["is_valid_business_query"] = False
        query_meta["display_keyword"] = None
        query_meta["expanded_query"] = None

        return {
            "query": query_text,
            "e5_query": "",
            "query_meta": query_meta,
            "result_status": {
                "status": "NO_RESULT",
                "message": "입력하신 내용만으로는 비즈니스 문제나 케이스 탐색 의도를 확인하기 어려워요. 해결하고 싶은 상황을 조금 더 구체적으로 적어주세요."
            },
            "recommendations": [],
            "map_candidates": []
        }

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

    # 검색 결과 맵용 동적 좌표 생성
    # 기존 x/y는 전체 산점도용으로 유지하고, dynamic_x/dynamic_y만 추가한다.
    map_candidates = add_dynamic_map_coordinates(
        query_embedding=query_embedding,
        sorted_candidates=candidates,
        final_results=final_results,
        map_k=max(30, min(top_k, 50))
    )

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
            "dynamic_x": row.get("dynamic_x"),
            "dynamic_y": row.get("dynamic_y"),
            "map_distance": row.get("map_distance"),
            "map_group": row.get("map_group"),
            "map_rank": row.get("map_rank"),
            "map_angle": row.get("map_angle"),
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
        "recommendations": recommendations,
        "map_candidates": [build_dynamic_map_item(row) for row in map_candidates]
    }



# ============================================================
# 11. 케이스 기반 개인화 전략
# ============================================================

def get_personal_strategy_status(case_item: Dict[str, Any]) -> str:
    condition = normalize_condition(case_item.get("condition_match", "partial"))

    try:
        final_score = float(case_item.get("final_score", 0.0) or 0.0)
    except Exception:
        final_score = 0.0

    if condition in ["full", "mostly"] or final_score >= 0.65:
        return "generated"

    if condition == "partial" or (0.45 <= final_score < 0.65):
        return "reference"

    return "limited"


def make_limited_personal_strategy(case_item: Dict[str, Any]) -> str:
    title = safe_str(case_item.get("title")) or "이 케이스"

    return (
        f"{title}는 현재 사용자 상황과 직접적으로 연결되는 근거가 충분하지 않아 "
        "케이스 기반 개인화 전략을 생성하지 않았습니다. "
        "더 설득력 있는 전략을 얻으려면 해결하고 싶은 문제 상황이나 적용하고 싶은 맥락을 조금 더 구체적으로 입력하는 것이 좋습니다."
    )


def build_personal_strategy_case_brief(case_item: Dict[str, Any], strategy_status: str) -> Dict[str, Any]:
    return {
        "case_idx": int(case_item.get("case_idx")),
        "strategy_status": strategy_status,
        "title": safe_str(case_item.get("title"))[:180],
        "comp_name": safe_str(case_item.get("comp_name"))[:80],
        "industry": safe_str(case_item.get("industry"))[:80],
        "prob_main": safe_str(case_item.get("prob_main"))[:50],
        "prob_keyword": safe_str(case_item.get("prob_keyword"))[:80],
        "sol_type": safe_str(case_item.get("sol_type"))[:80],
        "prob_def": safe_str(case_item.get("prob_def"))[:420],
        "sol_detail": safe_str(case_item.get("sol_detail"))[:520],
        "summary": safe_str(case_item.get("summary"))[:900],
        "reco_reason": safe_str(case_item.get("reco_reason"))[:420],
        "condition_match": normalize_condition(case_item.get("condition_match", "partial")),
        "final_score": float(case_item.get("final_score", 0.0) or 0.0),
    }


def generate_personal_strategies_with_gpt(
    user_context: str,
    cases: List[Dict[str, Any]],
    max_retries: int = 2
) -> Dict[int, str]:
    case_briefs = [
        build_personal_strategy_case_brief(
            case_item=case_item,
            strategy_status=get_personal_strategy_status(case_item)
        )
        for case_item in cases
    ]

    valid_case_ids = {int(case_item["case_idx"]) for case_item in case_briefs}

    system_prompt = """
너는 DBR Case Atlas 서비스의 '케이스 기반 개인화 전략' 작성자다.

역할:
사용자의 현재 상황을 바탕으로, 제공된 DBR 추천 케이스 각각을 어떻게 참고할 수 있는지 개인화된 전략 문장으로 작성한다.

가장 중요한 원칙:
1. 반드시 제공된 케이스 정보 안에서만 작성한다.
2. 제공된 케이스의 summary, prob_def, sol_detail, reco_reason에 없는 전략, 채널, 도구, 수치, 성과를 새로 만들지 않는다.
3. 사용자의 현재 상황은 전략의 표현 수준과 적용 방향을 조정하는 데만 사용한다.
4. 사용자가 입력하지 않은 직무, 연차, 예산, 조직 상황을 추측하지 않는다.
5. 각 case_idx는 해당 케이스 하나만 근거로 작성한다. 다른 케이스의 내용을 섞지 않는다.
6. 케이스와 사용자 상황의 연결이 약하면 억지로 직접 적용 전략처럼 쓰지 않는다.
7. 반드시 JSON만 반환한다.

strategy_status별 작성 규칙:
- generated:
  사용자 상황과 케이스의 문제 정의/해결 전략이 충분히 연결된다. 이 경우 "사용자의 상황에서는 이 케이스에서처럼..." 형태로 적용 방향을 제안한다.
- reference:
  직접 적용보다는 참고 관점이다. 이 경우 반드시 "직접 적용보다는 참고 관점에서" 또는 "완전히 같은 상황은 아니지만"처럼 한계를 부드럽게 먼저 밝힌다.
- limited:
  원칙적으로 입력되지 않는다. 만약 포함되면 개인화 전략을 만들지 말고 적용 한계를 안내한다.

문장 작성 규칙:
1. 각 personal_strategy는 하나의 자연스러운 문단으로 작성한다.
2. 3~5문장으로 작성한다.
3. "~합니다"체를 사용한다.
4. 너무 보고서처럼 딱딱하게 쓰지 않는다.
5. 사용자가 바로 이해할 수 있게 구체적으로 쓰되, 케이스에 없는 실행 수단을 만들지 않는다.
6. "추천 케이스를 기준으로 보면", "이 케이스의 해결 방식에 비춰보면", "제공된 사례를 바탕으로 보면" 같은 근거 표현을 사용한다.
7. 낮은 관련성을 억지로 포장하지 않는다.
8. "반드시", "무조건", "성공할 수 있다"처럼 과도한 단정은 피한다.

반환 형식:
{
  "strategies": [
    {
      "case_idx": 1,
      "personal_strategy": "케이스 기반 개인화 전략 문단"
    }
  ]
}
"""

    user_prompt = f"""
사용자 현재 상황:
{user_context}

추천 케이스 목록:
{json.dumps(case_briefs, ensure_ascii=False, indent=2)}

작업:
1. 각 케이스의 summary, prob_def, sol_detail, reco_reason만 근거로 개인화 전략을 작성하라.
2. 사용자의 현재 상황을 반영하되, 케이스에 없는 전략은 만들지 마라.
3. strategy_status가 reference인 케이스는 직접 적용이 아니라 참고 관점임을 문장 안에 밝혀라.
4. 각 case_idx별로 3~5문장짜리 하나의 문단을 작성하라.
5. 제공된 case_idx만 사용하라.
6. JSON 외 설명은 출력하지 마라.
"""

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            parsed = call_gpt_json(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_completion_tokens=3000,
                temperature=0.0
            )

            strategies = parsed.get("strategies", [])
            result_map: Dict[int, str] = {}

            for item in strategies:
                case_idx = int(item.get("case_idx"))
                if case_idx not in valid_case_ids:
                    continue

                personal_strategy = safe_str(item.get("personal_strategy", "")).strip()
                if not personal_strategy:
                    continue

                result_map[case_idx] = personal_strategy

            if not result_map:
                raise ValueError("GPT 개인화 전략 결과에 유효한 case_idx가 없습니다.")

            return result_map

        except Exception as e:
            last_error = e
            print(f"개인화 전략 GPT 호출 실패 {attempt + 1}/{max_retries + 1}: {e}")
            time.sleep(1)

    raise RuntimeError(f"개인화 전략 GPT 최종 실패: {last_error}")


def personal_strategies_service(user_context: str, cases: List[PersonalStrategyCase]) -> Dict[str, Any]:
    user_context = validate_personal_context(user_context)

    if not cases:
        raise ValueError("적용 방향을 생성할 추천 케이스가 없습니다.")

    case_dicts = [case_item.model_dump() for case_item in cases]

    limited_results: List[Dict[str, Any]] = []
    gpt_target_cases: List[Dict[str, Any]] = []

    for case_item in case_dicts:
        strategy_status = get_personal_strategy_status(case_item)

        if strategy_status == "limited":
            limited_results.append({
                "case_idx": int(case_item.get("case_idx")),
                "personal_strategy": make_limited_personal_strategy(case_item),
                "strategy_status": "limited",
                "based_on_case_title": case_item.get("title")
            })
        else:
            case_item["strategy_status"] = strategy_status
            gpt_target_cases.append(case_item)

    gpt_strategy_map: Dict[int, str] = {}

    if gpt_target_cases:
        gpt_strategy_map = generate_personal_strategies_with_gpt(
            user_context=user_context,
            cases=gpt_target_cases
        )

    generated_results: List[Dict[str, Any]] = []

    for case_item in gpt_target_cases:
        case_idx = int(case_item.get("case_idx"))
        strategy_status = get_personal_strategy_status(case_item)

        generated_results.append({
            "case_idx": case_idx,
            "personal_strategy": gpt_strategy_map.get(
                case_idx,
                make_limited_personal_strategy(case_item)
            ),
            "strategy_status": strategy_status if case_idx in gpt_strategy_map else "limited",
            "based_on_case_title": case_item.get("title")
        })

    order_map = {
        int(case_item.get("case_idx")): index
        for index, case_item in enumerate(case_dicts)
    }

    strategies = generated_results + limited_results
    strategies = sorted(
        strategies,
        key=lambda item: order_map.get(int(item["case_idx"]), 9999)
    )

    return {
        "success": True,
        "strategies": strategies
    }

# ============================================================
# 12. API Router
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


@app.post("/personal-strategies", response_model=PersonalStrategiesResponse)
def personal_strategies_api(request: PersonalStrategiesRequest):
    try:
        result = personal_strategies_service(
            user_context=request.user_context,
            cases=request.cases
        )
        return result

    except PersonalContextValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

