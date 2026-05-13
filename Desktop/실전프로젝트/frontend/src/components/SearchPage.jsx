import { useState } from "react";

const CATEGORIES = ["성장", "고객", "효율", "혁신"];

const EXAMPLE_QUERIES = [
  "매출은 나오는데 수익성이 계속 악화되고 있어요",
  "브랜드 인지도는 높은데 구매 전환이 안 돼요",
  "조직 내 실행력이 너무 떨어지는데 어떻게 개선할 수 있을까요",
  "신규 고객 유입은 늘었는데 재구매율이 계속 떨어지고 있어요",
  "신사업 진입 전략을 세워야 하는데 어디서부터 시작해야 할지 모르겠어요",
];

const DUMMY_CASES = [
  { rank: 1, title: "롯데 '슬롯'의 성공 전략", company: "수년 중심으로 점진적 변화", industry: "유통", date: "2024년 11월", tags: ["브랜드전략", "리테일혁신"], summary: "롯데가 슬롯 기반의 고객 락인 전략으로 장기 성장 기반을 마련한 사례 연구", similarity: 92 },
  { rank: 2, title: "동원 '빙글레' 브랜드명 변경 전략", company: "세대 간 브랜드 인지도 극복 전략", industry: "식품", date: "2024년 12월", tags: ["브랜드전략", "세대마케팅"], summary: "40년 역사의 빙그레가 '빙글레'로 브랜드명을 변경하며 MZ세대에게 다가간 전략 사례", similarity: 88 },
  { rank: 3, title: "샐러드랄랄라 당품 AI 플랫폼의 성장 전략", company: "1000개 가구가 선택한 이유", industry: "플랫폼", date: "2025년 2월", tags: ["AI전략", "플랫폼성장"], summary: "AI 기반 맞춤형 식단 추천으로 1000가구 이상의 충성 고객을 확보한 스타트업 성장 사례", similarity: 83 },
  { rank: 4, title: "카카오 역대 3위 '솔라의맥' 성공 전략", company: "웹툰에서 시작된 IP 확장 사례", industry: "콘텐츠", date: "2025년 1월", tags: ["IP전략", "콘텐츠마케팅"], summary: "카카오가 웹툰 IP를 활용하여 다양한 비즈니스 모델로 확장한 성공 사례 연구", similarity: 79 },
  { rank: 5, title: "21년 연속 1000만 관중 오리온 KBO의 경영 혁신", company: "스포츠 비즈니스 모델 혁신", industry: "스포츠", date: "2025년 3월", tags: ["스포츠마케팅", "팬경험"], summary: "KBO 오리온이 21년간 1000만 관중을 유지한 경영 혁신 및 팬 경험 설계 전략", similarity: 74 },
];

const SYSTEM_PROMPT = `당신은 DBR(동아비즈니스리뷰) 케이스 아틀라스 서비스의 AI 분석 엔진입니다.
사용자가 비즈니스 고민을 입력하면 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

{
  "problem_summary": "문제를 2문장으로 요약. 사용자 상황을 공감하며 핵심 구조를 짚어주는 톤.",
  "problem_types": ["문제 유형 태그 2~3개"],
  "kpis": ["핵심 KPI 2~3개"],
  "causes": ["예상 원인 2~3개. 짧은 명사구로"],
  "cases": [
    {
      "rank": 1,
      "title": "케이스 제목 (실제 DBR 케이스 스타일로)",
      "company": "기업명",
      "industry": "산업 분야",
      "date": "2024년 12월",
      "tags": ["전략태그1", "전략태그2"],
      "summary": "케이스 요약 1~2문장",
      "similarity": 87
    }
  ]
}

cases는 정확히 5개를 생성하세요. similarity는 65~95 사이 정수.
국내외 다양한 기업 사례를 섞어서, 사용자 문제와 전략적으로 유사한 케이스를 우선순위로 정렬하세요.`;

export default function SearchPage({ onSearch }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [clearBtnHover, setClearBtnHover] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() && selectedCategory.length === 0) return;
    const searchQuery = query.trim() || selectedCategory.join(", ");
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: searchQuery }],
        }),
      });

      const data = await res.json();
      const text = data.content.map((i) => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      onSearch?.(parsed.cases.map((c, i) => ({
        id: `case-${i + 1}`,
        title: c.title,
        company: c.company,
        industry: c.industry,
        similarity: c.similarity,
        x: Math.random(),
        y: Math.random(),
        cluster: i % 6,
        clusterLabel: ["고객 확보 · 전환", "수익성 · 원가", "신사업 · 피보팅", "브랜드 · 마케팅", "조직 · 실행력", "디지털 전환"][i % 6],
      })));
    } catch (e) {
      setError("분석 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setSelectedCase(null);
    setSelectedCases([]);
  };

  const handleCaseClick = (c) => {
    setSelectedCase(c);
  };

  const toggleSelectCase = (c) => {
    setSelectedCases((prev) =>
      prev.find((s) => s.rank === c.rank)
        ? prev.filter((s) => s.rank !== c.rank)
        : prev.length < 3 ? [...prev, c] : prev
    );
  };

  const cases = result ? result.cases : DUMMY_CASES;

  return (
    <div style={styles.page}>
      {/* 헤더 */}
      <div style={styles.logoArea}>
        <h1 style={styles.logoTitle}>
          어떤 비즈니스 문제를{" "}
          <span style={{ color: "#E86F00" }}>해결하려 하시나요?</span>
        </h1>
      </div>

      {/* 카테고리 */}
      <div style={styles.categoryArea}>
        <p style={styles.categoryLabel}>문제 유형 선택</p>
        <div style={styles.categoryChips}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              style={{
                ...styles.categoryChip,
                background: selectedCategory.includes(cat) ? "#E86F00" : "#fff",
                color: selectedCategory.includes(cat) ? "#fff" : "#444",
                borderColor: selectedCategory.includes(cat) ? "#E86F00" : "#e0e0e0",
              }}
              onClick={() => {
                setSelectedCategory((prev) =>
                  prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                );
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 영역 + 버튼 */}
      <div style={{ maxWidth: 1000 }}>
        <textarea
          style={{
            ...styles.textarea,
            background: textareaFocused ? "#fff" : "#f5f5f5",
            border: textareaFocused ? "1.5px solid #E86F00" : "1px solid #e0e0e0",
          }}
          placeholder="비즈니스 고민을 자유롭게 입력해주세요."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => { if (!query.trim()) setTextareaFocused(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch();
          }}
        />

        {/* 버튼 */}
        <div style={styles.btnRow}>
          <button
            style={{
              ...styles.btnClear,
              background: clearBtnHover ? "#e8e8e8" : "transparent",
              opacity: (!query.trim() && selectedCategory.length === 0) ? 0.5 : 1,
              cursor: (!query.trim() && selectedCategory.length === 0) ? "not-allowed" : "pointer",
            }}
            onMouseEnter={() => setClearBtnHover(true)}
            onMouseLeave={() => setClearBtnHover(false)}
            onClick={handleClear}
            disabled={!query.trim() && selectedCategory.length === 0}
          >
            초기화
          </button>
          <button
            style={{
              ...styles.btnSearch,
              background: btnHover ? "#C45E00" : "#E86F00",
              opacity: loading || (!query.trim() && selectedCategory.length === 0) ? 0.5 : 1,
              cursor: loading || (!query.trim() && selectedCategory.length === 0) ? "not-allowed" : "pointer",
            }}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            onClick={handleSearch}
            disabled={loading || (!query.trim() && selectedCategory.length === 0)}
          >
            케이스 탐색
          </button>
        </div>
      </div>

      {/* 예시 칩 */}
      <div style={styles.exampleArea}>
        <p style={styles.chipsLabel}>예시 고민</p>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6 }}>
          <button style={styles.chip} onClick={() => setQuery("매출은 나오는데 수익성이 계속 악화되고 있어요")}>매출은 나오는데 수익성이 계속 악화되고 있어요</button>
          <button style={styles.chip} onClick={() => setQuery("브랜드 인지도는 높은데 구매 전환이 안 돼요")}>브랜드 인지도는 높은데 구매 전환이 안 돼요</button>
          <button style={styles.chip} onClick={() => setQuery("신규 고객 유입은 늘었는데 재구매율이 계속 떨어지고 있어요")}>신규 고객 유입은 늘었는데 재구매율이 계속 떨어지고 있어요</button>
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <button style={styles.chip} onClick={() => setQuery("조직 내 실행력이 너무 떨어지는데 어떻게 개선할 수 있을까요")}>조직 내 실행력이 너무 떨어지는데 어떻게 개선할 수 있을까요</button>
          <button style={styles.chip} onClick={() => setQuery("신사업 진입 전략을 세워야 하는데 어디서부터 시작해야 할지 모르겠어요")}>신사업 진입 전략을 세워야 하는데 어디서부터 시작해야 할지 모르겠어요</button>
        </div>
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={styles.loadingRow}>
          <LoadingDots />
          <span style={styles.loadingText}>문제 분석 중...</span>
        </div>
      )}

      {/* 에러 */}
      {error && <p style={styles.errorText}>{error}</p>}

      {/* 문제 구조화 (검색 후) */}
      {result && (
        <div style={styles.card}>
          <p style={styles.cardLabel}>문제 구조화</p>
          <p style={styles.problemSummary}>{result.problem_summary}</p>
          <hr style={styles.divider} />
          <TagSection label="문제 유형" tags={result.problem_types} color="type" />
          <TagSection label="핵심 KPI" tags={result.kpis} color="kpi" />
          <TagSection label="예상 원인" tags={result.causes} color="cause" />
        </div>
      )}

      {/* 케이스 리스트 */}
      <div style={styles.card}>
        <p style={styles.cardLabel}>
          {result ? "유사 케이스 추천 " : "추천 케이스 TOP5"}
          {result && <span style={{ color: "#E86F00" }}>5</span>}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cases.map((c) => (
            <CaseItem
              key={c.rank}
              item={c}
              isSelected={!!selectedCases.find((s) => s.rank === c.rank)}
              onClick={() => {
                setSelectedCase(c);
                toggleSelectCase(c);
              }}
            />
          ))}
        </div>
      </div>

      {/* 슬라이드 패널 */}
      {selectedCase && (
        <CasePanel
          caseData={selectedCase}
          selectedCases={selectedCases}
          onToggleSelect={() => toggleSelectCase(selectedCase)}
          isSelected={!!selectedCases.find((s) => s.rank === selectedCase.rank)}
          onClose={() => setSelectedCase(null)}
        />
      )}

      {/* 비교 사이드바 */}
      {showCompare && (
        <CompareSidebar
          cases={selectedCases}
          onRemove={(rank) => setSelectedCases((prev) => prev.filter((s) => s.rank !== rank))}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* 선택한 케이스 하단 바 */}
      {selectedCases.length > 0 && (
        <div style={styles.bottomBar}>
          <span style={styles.bottomBarText}>
            {selectedCases.length}개의 케이스가 선택되었습니다 ({selectedCases.length}/3)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.bottomBarBtnOutline} onClick={() => { setShowCompare(true); setSelectedCase(null); }}>
              케이스 비교하기
            </button>
            <button style={styles.bottomBarBtnFill}>내보내기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function TagSection({ label, tags, color }) {
  const colorMap = {
    type: { bg: "#E6F1FB", text: "#0C447C" },
    kpi: { bg: "#E1F5EE", text: "#085041" },
    cause: { bg: "#FAEEDA", text: "#633806" },
  };
  const { bg, text } = colorMap[color];
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={styles.tagSectionLabel}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map((t) => (
          <span key={t} style={{ ...styles.tag, background: bg, color: text }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function CaseItem({ item, isSelected, onClick }) {
  return (
    <div style={{ 
      ...styles.caseItem, 
      borderColor: isSelected ? "#E86F00" : "#e8e8e8", 
      background: isSelected ? "#FEF0E9" : "#fff",
    }} onClick={onClick}>
      <div style={{
        ...styles.caseRank,
        color: item.rank <= 3 ? "#E86F00" : "#aaaaaa",
      }}>
        {item.rank}
      </div>
      <div style={{ flex: 1 }}>
        <p style={styles.caseTitle}>{item.title}</p>
        <p style={styles.caseMeta}>{item.company}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <span style={{
            ...styles.caseTag,
            background: isSelected ? "#FAD5C3" : "#f0f0f0",
            color: isSelected ? "#E86F00" : "#555",
          }}>케이스스터디</span>
          <span style={{
            ...styles.caseTag,
            background: isSelected ? "#FAD5C3" : "#f0f0f0",
            color: isSelected ? "#E86F00" : "#555",
          }}>{item.industry}</span>
        </div>
      </div>
    </div>
  );
}

function CasePanel({ caseData, selectedCases, isSelected, onToggleSelect, onClose }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>{caseData.title}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ ...styles.panelClose, border: "none", background: "none", fontSize: 18, color: "#ccc", cursor: "pointer" }} onClick={onClose}>✕</button>
        </div>
      </div>
      <p style={styles.panelMeta}>{caseData.company}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <span style={styles.caseTag}>케이스스터디</span>
        <span style={styles.caseTag}>{caseData.industry}</span>
        {caseData.date && <span style={styles.caseTag}>{caseData.date}</span>}
        {caseData.tags?.map((t) => (
          <span key={t} style={{ ...styles.caseTag, background: "#FEF0E9", color: "#E86F00" }}>{t}</span>
        ))}
      </div>
      <div style={styles.reasonBox}>
        <p style={styles.reasonTitle}>추천 이유</p>
        <p style={styles.reasonItem}>→ 문제 해결 접근 방식이 매우 유사합니다</p>
        <p style={styles.reasonItem}>→ 텍스트 유사도: {caseData.similarity}% (매우 높음)</p>
      </div>
      <p style={styles.panelSummary}>{caseData.summary}</p>
      <button style={styles.panelLink}>DBR 아티클 보기 →</button>
      <button
        style={{
          width: "100%", padding: "10px", fontSize: 13, fontWeight: 500,
          color: "#fff",
          background: isSelected ? "#1a1a1a" : selectedCases.length >= 3 && !isSelected ? "#ccc" : "#E86F00",
          border: "none", borderRadius: 2,
          cursor: isSelected || selectedCases.length < 3 ? "pointer" : "not-allowed",
          fontFamily: "inherit", marginTop: 8,
        }}
        onClick={onToggleSelect}
        disabled={!isSelected && selectedCases.length >= 3}
      >
        {isSelected ? "비교에서 제거" : "＋ 비교에 추가"}
      </button>

      {/* 하단 선택 안내 */}
      {selectedCases.length > 0 && (
        <div style={styles.panelBottomHint}>
          케이스를 비교하여 공통점과 차이점을 확인해보세요
        </div>
      )}
    </div>
  );
}

function CompareSidebar({ cases, onRemove, onClose }) {
  return (
    <>
      {/* 배경 오버레이 */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} onClick={onClose} />

      {/* 모달 */}
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: 1100, maxHeight: "85vh", background: "#fff", borderRadius: 16, zIndex: 600, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* 헤더 */}
        <div style={{ background: "#e0e0e0", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>케이스 비교</h2>
              <p style={{ fontSize: 15, color: "#666" }}>선택한 {cases.length}개 케이스의 공통점과 차이점을 확인하세요</p>
            </div>
            <button style={{ background: "rgba(232, 90, 24, 0.1)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, color: "#E86F00", cursor: "pointer" }} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* 테이블 */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "14px 16px", fontSize: 13, color: "#999", fontWeight: 500, textAlign: "left", width: 100, background: "#fafafa" }}>비교 항목</th>
                {cases.map((c, i) => (
                  <th key={c.rank} style={{ padding: "14px 16px", textAlign: "left", background: "#fafafa", borderLeft: "1px solid #e8e8e8" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#E86F00" }}>{i + 1}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{c.title}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "문제 유형", key: "problemType", values: cases.map((c) => c.tags?.[0] ?? "-") },
                { label: "산업", key: "industry", values: cases.map((c) => c.industry) },
                { label: "카테고리", key: "category", values: cases.map(() => "케이스스터디") },
                { label: "발행일", key: "date", values: cases.map((c) => c.date ?? "-") },
                {
                  label: "주요 키워드", key: "tags",
                  values: cases.map((c) => (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {c.tags?.map((t) => <span key={t} style={{ padding: "2px 8px", fontSize: 11, background: "#FEF0E9", color: "#E86F00", borderRadius: 4 }}>{t}</span>)}
                    </div>
                  ))
                },
                {
                  label: "유사도", key: "similarity",
                  values: cases.map((c) => (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999", marginBottom: 4 }}>
                        <span></span><span style={{ color: "#E86F00", fontWeight: 500 }}>{c.similarity}%</span>
                      </div>
                      <div style={{ height: 4, background: "#f0f0f0", borderRadius: 2 }}>
                        <div style={{ height: "100%", background: "#E86F00", borderRadius: 2, width: `${c.similarity}%` }} />
                      </div>
                    </div>
                  ))
                },
                { label: "요약", key: "summary", values: cases.map((c) => <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{c.summary}</p>) },
              ].map((row) => (
                <tr key={row.key} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "14px 16px", fontSize: 13, color: "#666", fontWeight: 500, background: "#fafafa", verticalAlign: "top" }}>{row.label}</td>
                  {row.values.map((val, i) => (
                    <td key={i} style={{ padding: "14px 16px", fontSize: 13, color: "#1a1a1a", borderLeft: "1px solid #f0f0f0", verticalAlign: "top" }}>{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: "1rem 2rem", borderTop: "1px solid #e8e8e8", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={{ padding: "10px 20px", fontSize: 13, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }} onClick={onClose}>닫기</button>
          <button style={{ padding: "10px 20px", fontSize: 13, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>선택한 케이스 PDF로 내보내기</button>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    width:"100%",
    width: 1000,
    margin: "0 auto",
    padding: "2.5rem 2rem",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    boxSizing: "border-box"
  },
  logoArea: { marginBottom: "2.5rem" },
  logoTitle: { fontSize: 30, fontWeight: 500, lineHeight: 1.4, color: "#1a1a1a" },
  categoryArea: { marginBottom: "1.5rem" },
  categoryLabel: { fontSize: 16, fontWeight: 500, color: "#1a1a1a", marginBottom: 10 },
  categoryChips: { display: "flex", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    padding: "7px 18px", fontSize: 14, fontWeight: 500,
    border: "1px solid #e0e0e0", borderRadius: 20,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
  },
  textarea: {
    width: "100%", maxWidth: 1000, minHeight: 100, padding: "14px 16px",
    fontSize: 15, fontFamily: "inherit", color: "#1a1a1a",
    background: "#f5f5f5", border: "1px solid #e0e0e0",
    borderRadius: 2, resize: "vertical", lineHeight: 1.6,
    outline: "none", boxSizing: "border-box", resize: "none", maxHeight: 180
  },
  btnRow: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, marginBottom: "2rem" },

  btnClear: {
    padding: "8px 16px", fontSize: 14, color: "#666",
    background: "transparent", border: "1px solid #e0e0e0",
    borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
  },
  btnSearch: {
    padding: "8px 20px", fontSize: 14, fontWeight: 500,
    color: "#fff", background: "#E86F00", border: "none",
    borderRadius: 2, fontFamily: "inherit",
  },
  exampleArea: { marginBottom: "2rem" },
  chipsLabel: { fontSize: 16, color: "#999", marginBottom: 8, textAlign: "center"},
  chips: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" , maxWidth: 900, margin: "0 auto" },
  chip: {
    padding: "5px 12px", fontSize: 14, color: "#E86F00",
    background: "#fef0e9", border: "none", borderRadius: 20,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap"
  },
  loadingRow: { display: "flex", alignItems: "center", gap: 8, padding: "1rem 0" },
  loadingText: { fontSize: 14, color: "#999" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#E86F00", animation: "pulse 1.2s ease-in-out infinite" },
  errorText: { fontSize: 14, color: "#A32D2D", padding: "0.5rem 0" },
  card: {
    background: "#fff", border: "0.5px solid #fff",
    borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12,
  },
  cardLabel: {
    fontSize: 18, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#999", marginBottom: 10, textAlign: "left",
  },
  problemSummary: { fontSize: 14, color: "#1a1a1a", lineHeight: 1.7, marginBottom: 10 },
  divider: { border: "none", borderTop: "0.5px solid #e8e8e8", margin: "10px 0" },
  tagSectionLabel: { fontSize: 11, color: "#999", marginBottom: 5 },
  tag: { padding: "4px 10px", fontSize: 12, borderRadius: 2 },
  caseItem: {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "14px 12px", border: "0.5px solid #e8e8e8",
    borderRadius: 2, cursor: "pointer",
  },
  caseRank: {
    width: 28, height: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 700, flexShrink: 0,
    color: "#1a1a1a",
  },
  caseTitle: { fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 3 },
  caseMeta: { fontSize: 12, color: "#999" },
  caseTag: { padding: "3px 8px", fontSize: 13, color: "#555", background: "#f0f0f0", borderRadius: 2 },
  bookmarkBtn: {
    background: "none", border: "none", fontSize: 16,
    cursor: "pointer", padding: 4, flexShrink: 0,
  },

  // 슬라이드 패널
  panel: {
    position: "fixed", top: 0, right: 0, width: 400, height: "100vh",
    background: "#fff", borderLeft: "1px solid #e8e8e8",
    padding: "1.5rem", overflowY: "auto", zIndex: 200,
    boxSizing: "border-box", boxShadow: "-4px 0 20px rgba(0,0,0,0.08)",
  },
  panelHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  panelTitle: { fontSize: 16, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, flex: 1, marginRight: 8 },
  panelMeta: { fontSize: 12, color: "#999", marginBottom: 10 },
  reasonBox: { background: "#FEF0E9", borderRadius: 8, padding: "12px 14px", marginBottom: 14 },
  reasonTitle: { fontSize: 14, fontWeight: 500, color: "#E86F00", marginBottom: 6 },
  reasonItem: { fontSize: 13, color: "#666", marginBottom: 3 },
  panelSummary: { fontSize: 14, color: "#444", lineHeight: 1.7, marginBottom: 16 },
  panelLink: {
    width: "100%", padding: "10px", fontSize: 13, fontWeight: 500,
    color: "#E86F00", background: "#FEF0E9", border: "none",
    borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
  },
  panelBottomHint: {
    fontSize: 12, color: "#999", textAlign: "center",
    padding: "12px", background: "#f9f9f9", borderRadius: 8,
  },

  // 하단 바
  bottomBar: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "#1a1a1a", padding: "14px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    zIndex: 300,
  },
  bottomBarText: { fontSize: 13, color: "#fff" },
  bottomBarBtnOutline: {
    padding: "8px 16px", fontSize: 13, color: "#fff",
    background: "transparent", border: "1px solid #fff",
    borderRadius: 2, cursor: "pointer", fontFamily: "inherit",
  },
  bottomBarBtnFill: {
    padding: "8px 16px", fontSize: 13, color: "#1a1a1a",
    background: "#fff", border: "none",
    borderRadius: 2, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
  },
};
