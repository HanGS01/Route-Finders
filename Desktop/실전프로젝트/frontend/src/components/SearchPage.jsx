import { useState, useEffect } from "react";
import CaseMap from "./CaseMap";

const INDUSTRIES = ["IT·플랫폼", "커머스", "리테일", "식음료", "금융", "물류·운송", "제조", "콘텐츠·미디어", "헬스케어", "부동산·공간", "기타"];
const CATEGORIES = ["고객", "성장", "혁신", "효율"];
const KEYWORDS = {
  "고객": ["만족도", "개인화", "UX", "참여도", "이탈률", "접근성"],
  "성장": ["신규시장", "수익성", "확장성", "글로벌진출", "경쟁심화", "사용자변화"],
  "혁신": ["디지털전환", "기술전환필요", "서비스노후화", "경쟁심화", "사용자변화"],
  "효율": ["생산성", "비용", "운영복잡도", "물류", "공급망"]
};

const DUMMY_CASES = [
  { rank: 1, title: "롯데 '슬롯'의 성공 전략", company: "수년 중심으로 점진적 변화", industry: "유통", date: "2024년 11월", tags: ["브랜드전략", "리테일혁신"], summary: "롯데가 슬롯 기반의 고객 락인 전략으로 장기 성장 기반을 마련한 사례 연구", similarity: 92 },
  { rank: 2, title: "동원 '빙글레' 브랜드명 변경 전략", company: "세대 간 브랜드 인지도 극복 전략", industry: "식품", date: "2024년 12월", tags: ["브랜드전략", "세대마케팅"], summary: "40년 역사의 빙그레가 '빙글레'로 브랜드명을 변경하며 MZ세대에게 다가간 전략 사례", similarity: 88 },
  { rank: 3, title: "샐러드랄랄라 당품 AI 플랫폼의 성장 전략", company: "1000개 가구가 선택한 이유", industry: "플랫폼", date: "2025년 2월", tags: ["AI전략", "플랫폼성장"], summary: "AI 기반 맞춤형 식단 추천으로 1000가구 이상의 충성 고객을 확보한 스타트업 성장 사례", similarity: 83 },
  { rank: 4, title: "카카오 역대 3위 '솔라의맥' 성공 전략", company: "웹툰에서 시작된 IP 확장 사례", industry: "콘텐츠", date: "2025년 1월", tags: ["IP전략", "콘텐츠마케팅"], summary: "카카오가 웹툰 IP를 활용하여 다양한 비즈니스 모델로 확장한 성공 사례 연구", similarity: 79 },
  { rank: 5, title: "21년 연속 1000만 관중 오리온 KBO의 경영 혁신", company: "스포츠 비즈니스 모델 혁신", industry: "스포츠", date: "2025년 3월", tags: ["스포츠마케팅", "팬경험"], summary: "KBO 오리온이 21년간 1000만 관중을 유지한 경영 혁신 및 팬 경험 설계 전략", similarity: 74 },
];

const ALL_DATABASE_CASES = Array.from({ length: 120 }, (_, i) => ({
  id: `all-${i + 1}`,
  rank: i + 1,
  title: `[전체 DB] 비즈니스 혁신 사례 연구 아티클 제 ${i + 1}탄`,
  company: `연구 기업 ${String.fromCharCode(65 + (i % 26))}`,
  industry: INDUSTRIES[i % INDUSTRIES.length],
  date: `2024년 ${((i % 12) + 1)}월`,
  tags: ["케이스스터디", "전략기획"],
  summary: `DBR 메타데이터 전수조사에 따른 비즈니스 혁신 사례 분석 아티클입니다. 산업별 벤치마킹을 위한 기초 자료를 제공합니다.`
}));

const SYSTEM_PROMPT = `당신은 DBR(동아비즈니스리뷰) 케이스 아틀라스 서비스의 AI 분석 엔진입니다.`;

export default function SearchPage({ onSearch, searchedCases = [] }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const [showAllList, setShowAllList] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [clearBtnHover, setClearBtnHover] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    const filters = [selectedIndustry, selectedCategory, selectedKeyword]
      .filter(val => val && val !== "상관없음") 
      .join(", ");
    
    if (!query.trim() && !filters) return;
    
    const searchQuery = query.trim() ? `[필터조건: ${filters}] ${query.trim()}` : filters;
    
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500)); 
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
      
      if (!res.ok) throw new Error("API 연동 필요");
      const data = await res.json();
      const text = data.content.map((i) => i.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      
    } catch (e) {
      setResult({
        problem_summary: "선택하신 조건과 입력하신 고민을 분석한 결과, 기존 비즈니스 모델의 노후화와 새로운 고객층 발굴 사이의 전략적 딜레마로 파악됩니다.",
        problem_types: [selectedCategory || "성장 전략", "비즈니스 모델"],
        kpis: ["매출 증대", "신규 유입률"],
        causes: ["시장 트렌드 변화", "내부 실행력 부족"],
        cases: DUMMY_CASES.map(c => ({ ...c, similarity: Math.floor(Math.random() * (95 - 75) + 75) }))
      });
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setSelectedCase(null);
    setSelectedCases([]);
    setSelectedIndustry(null);
    setSelectedCategory(null);
    setSelectedKeyword(null);
    setShowAnalysisModal(false);
    setShowAllList(false);
    setVisibleCount(10);
    setHasSearched(false);
  };

  const toggleSelectCase = (c) => {
    setSelectedCases((prev) =>
      prev.find((s) => s.title === c.title)
        ? prev.filter((s) => s.title !== c.title)
        : prev.length < 3 ? [...prev, c] : prev
    );
  };

  const cases = result ? result.cases : DUMMY_CASES;
  const isSearchDisabled = loading || (!query.trim() && !selectedIndustry && !selectedCategory);

  return (
    <>
      <div style={styles.page}>
        <div style={styles.logoArea}>
          <h1 style={styles.logoTitle}>
            어떤 비즈니스 문제를{" "}
            <span style={{ color: "#E86F00" }}>해결하려 하시나요?</span>
          </h1>
        </div>

        <div style={styles.filterWrapper}>
          <div style={styles.filterSection}>
            <p style={styles.filterLabel}>1. 산업군</p>
            <div style={styles.chipGroup}>
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  style={selectedIndustry === ind ? styles.chipActive : styles.chip}
                  onClick={() => {
                    setSelectedIndustry(ind === selectedIndustry ? null : ind);
                    setSelectedCategory(null);
                    setSelectedKeyword(null);
                  }}
                >{ind}</button>
              ))}
            </div>
          </div>

          {selectedIndustry && (
            <div style={styles.filterSection}>
              <p style={styles.filterLabel}>2. 문제 유형</p>
              <div style={styles.chipGroup}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    style={selectedCategory === cat ? styles.chipActive : styles.chip}
                    onClick={() => {
                      setSelectedCategory(cat === selectedCategory ? null : cat);
                      setSelectedKeyword(null);
                    }}
                  >{cat}</button>
                ))}
                <button
                  style={selectedCategory === "상관없음" ? styles.chipActiveNone : styles.chipNone}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === "상관없음" ? null : "상관없음");
                    setSelectedKeyword(null);
                  }}
                >상관없음</button>
              </div>
            </div>
          )}

          {selectedCategory && selectedCategory !== "상관없음" && (
            <div style={styles.filterSection}>
              <p style={styles.filterLabel}>3. 핵심 키워드</p>
              <div style={styles.chipGroup}>
                {KEYWORDS[selectedCategory].map((kw) => (
                  <button
                    key={kw}
                    style={selectedKeyword === kw ? styles.chipActive : styles.chip}
                    onClick={() => setSelectedKeyword(kw === selectedKeyword ? null : kw)}
                  >{kw}</button>
                ))}
                <button
                  style={selectedKeyword === "상관없음" ? styles.chipActiveNone : styles.chipNone}
                  onClick={() => setSelectedKeyword(selectedKeyword === "상관없음" ? null : "상관없음")}
                >상관없음</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <textarea
            style={{
              ...styles.textarea,
              background: textareaFocused ? "#fff" : "#f5f5f5",
              border: textareaFocused ? "1.5px solid #E86F00" : "1px solid #e0e0e0",
            }}
            placeholder="비즈니스 고민을 자유롭게 입력해주세요. (선택한 칩의 내용과 함께 분석됩니다)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setTextareaFocused(true)}
            onBlur={() => { if (!query.trim()) setTextareaFocused(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch(); }}
          />
          <div style={styles.btnRow}>
            <button
              style={{ ...styles.btnClear, background: clearBtnHover ? "#e8e8e8" : "transparent", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setClearBtnHover(true)}
              onMouseLeave={() => setClearBtnHover(false)}
              onClick={handleClear}
              disabled={isSearchDisabled && selectedIndustry === null}
            >초기화</button>
            <button
              style={{ ...styles.btnSearch, background: btnHover ? "#C45E00" : "#E86F00", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={handleSearch}
              disabled={isSearchDisabled}
            >케이스 탐색 시작</button>
          </div>
        </div>

        <div style={styles.exampleArea}>
          <p style={styles.chipsLabel}>예시 고민</p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6 }}>
            <button style={styles.exampleChip} onClick={() => setQuery("매출은 나오는데 수익성이 계속 악화되고 있어요")}>매출은 나오는데 수익성이 계속 악화되고 있어요</button>
            <button style={styles.exampleChip} onClick={() => setQuery("브랜드 인지도는 높은데 구매 전환이 안 돼요")}>브랜드 인지도는 높은데 구매 전환이 안 돼요</button>
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            <button style={styles.exampleChip} onClick={() => setQuery("조직 내 실행력이 너무 떨어지는데 어떻게 개선할 수 있을까요")}>조직 내 실행력이 너무 떨어지는데 어떻게 개선할 수 있을까요</button>
          </div>
        </div>

        {loading && (
          <div style={styles.loadingRow}>
            <LoadingDots />
            <span style={styles.loadingText}>문제 분석 및 케이스 매칭 중...</span>
          </div>
        )}
        {error && <p style={styles.errorText}>{error}</p>}
      </div>

      <div style={styles.splitRow}>
        <div style={styles.caseListCol}>
          <div style={styles.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={styles.cardLabel}>
                {result ? "유사 케이스 추천 " : "추천 케이스 TOP 5"}
                {result && <span style={{ color: "#E86F00" }}>5</span>}
              </p>
              
              {result && (
                <button 
                  style={styles.infoBtn} 
                  onClick={() => setShowAnalysisModal(true)}
                  title="AI 문제 분석 결과 보기"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>AI 분석 결과</span>
                </button>
              )}
            </div>

            <hr style={{ border: "none", borderTop: "2px solid #E86F00", margin: "0 0 12px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cases.map((c) => (
                <CaseItem
                  key={c.rank}
                  item={c}
                  isSelected={!!selectedCases.find((s) => s.title === c.title)}
                  isViewing={selectedCase?.title === c.title}
                  onClick={() => setSelectedCase(c)} 
                />
              ))}
            </div>
          </div>
        </div>
        <div style={styles.mapCol}>
          <CaseMap cases={searchedCases.length > 0 ? searchedCases : undefined} />
        </div>
      </div>

      <div style={styles.bottomBrowseSection}>
        {!showAllList ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button 
              style={styles.btnBrowseAll} 
              onClick={() => setShowAllList(true)}
            >
              DBR 전체 케이스 120개 펼쳐보기 ↓
            </button>
          </div>
        ) : (
          <div style={styles.allListWrapper}>
            <div style={styles.allListHeader}>
              <h2 style={styles.allListTitle}>DBR 전체 케이스 아카이브 (총 120개)</h2>
              <button style={styles.btnCloseAll} onClick={() => { setShowAllList(false); setVisibleCount(10); }}>접기 ✕</button>
            </div>
            
            <div style={styles.allListGrid}>
              {ALL_DATABASE_CASES.slice(0, visibleCount).map((c) => (
                <div 
                  key={c.id} 
                  style={{
                    ...styles.archiveCard,
                    borderColor: selectedCases.find((s) => s.title === c.title) ? "#E86F00" : (selectedCase?.title === c.title ? "#f5b85a" : "#e8e8e8"),
                    background: selectedCases.find((s) => s.title === c.title) ? "#FEF0E9" : "#fff"
                  }}
                  onClick={() => setSelectedCase(c)}
                >
                  <div style={styles.archiveHeader}>
                    <span style={styles.archiveIndustry}>{c.industry}</span>
                    <span style={styles.archiveDate}>{c.date}</span>
                  </div>
                  <div style={styles.archiveTitle}>{c.title}</div>
                  <div style={styles.archiveCompany}>{c.company}</div>
                  <p style={styles.archiveSummary}>{c.summary}</p>
                </div>
              ))}
            </div>

            {visibleCount < ALL_DATABASE_CASES.length && (
              <div style={{ textAlign: "center", marginTop: 30 }}>
                <button 
                  style={styles.btnLoadMore} 
                  onClick={() => setVisibleCount(prev => prev + 10)}
                >
                  케이스 10개 더보기 (+{ALL_DATABASE_CASES.length - visibleCount}개 남음)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showAnalysisModal && result && (
        <AnalysisModal 
          result={result} 
          onClose={() => setShowAnalysisModal(false)} 
        />
      )}

      {selectedCase && (
        <CasePanel
          caseData={selectedCase}
          selectedCases={selectedCases}
          onToggleSelect={() => toggleSelectCase(selectedCase)}
          isSelected={!!selectedCases.find((s) => s.title === selectedCase.title)}
          onClose={() => setSelectedCase(null)}
        />
      )}
      {showCompare && (
        <CompareSidebar
          cases={selectedCases}
          onRemove={(title) => setSelectedCases((prev) => prev.filter((s) => s.title !== title))}
          onClose={() => setShowCompare(false)}
        />
      )}
      {selectedCases.length > 0 && (
        <div style={styles.bottomBar}>
          <span style={styles.bottomBarText}>
            {selectedCases.length}개의 케이스가 선택되었습니다 ({selectedCases.length}/3)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.bottomBarBtnOutline} onClick={() => { setShowCompare(true); setSelectedCase(null); }}>케이스 비교하기</button>
            <button style={styles.bottomBarBtnFill}>내보내기</button>
          </div>
        </div>
      )}
    </>
  );
}

function AnalysisModal({ result, onClose }) {
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "#fff", borderRadius: 16, zIndex: 1100, padding: 32, boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>AI 문제 구조화</h2>
          <button style={{ background: "none", border: "none", fontSize: 24, color: "#999", cursor: "pointer", lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>
        <p style={styles.problemSummary}>{result.problem_summary}</p>
        <hr style={styles.divider} />
        <TagSection label="문제 유형" tags={result.problem_types} color="type" />
        <TagSection label="핵심 KPI" tags={result.kpis} color="kpi" />
        <TagSection label="예상 원인" tags={result.causes} color="cause" />
        <button style={{ ...styles.btnSearch, width: "100%", marginTop: 24 }} onClick={onClose}>확인</button>
      </div>
    </>
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
    <div style={{ marginBottom: 12 }}>
      <p style={styles.tagSectionLabel}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map((t) => (
          <span key={t} style={{ ...styles.tag, background: bg, color: text }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function CaseItem({ item, isSelected, isViewing, onClick }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const checkBookmark = () => {
      const prev = JSON.parse(localStorage.getItem("bookmarks") || "[]");
      setBookmarked(prev.some((b) => b.title === item.title));
    };
    checkBookmark();
    window.addEventListener("bookmarkUpdated", checkBookmark);
    return () => window.removeEventListener("bookmarkUpdated", checkBookmark);
  }, [item.title]);

  const toggleBookmark = (e) => {
    e.stopPropagation();
    const prev = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    const isAlreadyBookmarked = prev.some((b) => b.title === item.title);
    
    const updated = isAlreadyBookmarked 
      ? prev.filter((b) => b.title !== item.title) 
      : [...prev, item];
      
    localStorage.setItem("bookmarks", JSON.stringify(updated));
    setBookmarked(!isAlreadyBookmarked);
    window.dispatchEvent(new Event("bookmarkUpdated"));
  };

  return (
    <div style={{ ...styles.caseItem, borderColor: isSelected ? "#E86F00" : (isViewing ? "#f5b85a" : "#e8e8e8"), background: isSelected ? "#FEF0E9" : "#fff" }} onClick={onClick}>
      <div style={{ ...styles.caseRank, color: item.rank <= 3 ? "#E86F00" : "#aaaaaa" }}>{item.rank}</div>
      <div style={{ flex: 1 }}>
        <p style={styles.caseTitle}>{item.title}</p>
        <p style={styles.caseMeta}>{item.company}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <span style={{ ...styles.caseTag, background: isSelected ? "#FAD5C3" : "#f0f0f0", color: isSelected ? "#E86F00" : "#555" }}>케이스스터디</span>
          <span style={{ ...styles.caseTag, background: isSelected ? "#FAD5C3" : "#f0f0f0", color: isSelected ? "#E86F00" : "#555" }}>{item.industry}</span>
        </div>
      </div>
      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }} onClick={toggleBookmark}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? "#E86F00" : "none"} stroke="#E86F00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
}

function CasePanel({ caseData, selectedCases, isSelected, onToggleSelect, onClose }) {
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const checkBookmark = () => {
      const prev = JSON.parse(localStorage.getItem("bookmarks") || "[]");
      setBookmarked(prev.some((b) => b.title === caseData.title));
    };
    checkBookmark();
    window.addEventListener("bookmarkUpdated", checkBookmark);
    return () => window.removeEventListener("bookmarkUpdated", checkBookmark);
  }, [caseData.title]);

  const toggleBookmark = (e) => {
    e.stopPropagation();
    const prev = JSON.parse(localStorage.getItem("bookmarks") || "[]");
    const isAlreadyBookmarked = prev.some((b) => b.title === caseData.title);
    
    const updated = isAlreadyBookmarked 
      ? prev.filter((b) => b.title !== caseData.title) 
      : [...prev, caseData];
      
    localStorage.setItem("bookmarks", JSON.stringify(updated));
    setBookmarked(!isAlreadyBookmarked);
    window.dispatchEvent(new Event("bookmarkUpdated"));
  };

  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>{caseData.title}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }} onClick={toggleBookmark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={bookmarked ? "#E86F00" : "none"} stroke="#E86F00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button style={{ border: "none", background: "none", fontSize: 20, color: "#ccc", cursor: "pointer" }} onClick={onClose}>✕</button>
        </div>
      </div>
      <p style={styles.panelMeta}>{caseData.company}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <span style={styles.caseTag}>케이스스터디</span>
        <span style={styles.caseTag}>{caseData.industry}</span>
        {caseData.date && <span style={styles.caseTag}>{caseData.date}</span>}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={styles.reasonBox}>
          <p style={styles.reasonTitle}>상세 요약 및 전략</p>
          <p style={styles.reasonItem}>→ {caseData.summary}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
        <button style={styles.panelLink}>
          DBR 원문 아티클 읽기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <button
          style={{ 
            width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, 
            color: "#fff", background: isSelected ? "#1a1a1a" : selectedCases.length >= 3 && !isSelected ? "#ccc" : "#E86F00", 
            border: "none", borderRadius: 8, cursor: isSelected || selectedCases.length < 3 ? "pointer" : "not-allowed", 
            fontFamily: "inherit", transition: "all 0.2s" 
          }}
          onClick={onToggleSelect}
          disabled={!isSelected && selectedCases.length >= 3}
        >
          {isSelected ? "비교에서 제거" : "＋ 비교에 추가"}
        </button>
      </div>
    </div>
  );
}

function CompareSidebar({ cases, onRemove, onClose }) {
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "90%", maxWidth: 1100, maxHeight: "85vh", background: "#fff", borderRadius: 16, zIndex: 600, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#e0e0e0", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>케이스 비교</h2>
              <p style={{ fontSize: 15, color: "#666" }}>선택한 {cases.length}개 케이스의 공통점과 차이점을 확인하세요</p>
            </div>
            <button style={{ background: "rgba(232, 90, 24, 0.1)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 16, color: "#E86F00", cursor: "pointer" }} onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e8e8e8" }}>
                <th style={{ padding: "14px 16px", fontSize: 13, color: "#999", fontWeight: 500, textAlign: "left", width: 100, background: "#fafafa" }}>비교 항목</th>
                {cases.map((c, i) => (
                  <th key={c.title || c.rank} style={{ padding: "14px 16px", textAlign: "left", background: "#fafafa", borderLeft: "1px solid #e8e8e8" }}>
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
                { label: "산업 분야", key: "industry", values: cases.map((c) => c.industry) },
                { label: "발행일", key: "date", values: cases.map((c) => c.date ?? "-") },
                { label: "분석 요약", key: "summary", values: cases.map((c) => <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>{c.summary}</p>) },
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
        <div style={{ padding: "1rem 2rem", borderTop: "1px solid #e8e8e8", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={{ padding: "10px 20px", fontSize: 13, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: { width: 1000, margin: "0 auto", padding: "2.5rem 2rem 0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", boxSizing: "border-box" },
  splitRow: { display: "flex", gap: 16, alignItems: "flex-start", maxWidth: 1400, margin: "0 auto", padding: "0 2rem 2rem" },
  caseListCol: { width: 420, flexShrink: 0, borderRight: "1px solid #e0e0e0", paddingRight: 16 },
  mapCol: { flex: 1, minWidth: 0 },
  logoArea: { marginBottom: "2.5rem" },
  logoTitle: { fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: "#1a1a1a" },
  
  filterWrapper: { marginBottom: "1.5rem", background: "#fff", border: "1px solid #ede8e2", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" },
  filterSection: { marginBottom: 16, paddingBottom: 16, borderBottom: "1px dashed #f0f0f0" },
  filterLabel: { fontSize: 14, fontWeight: 600, color: "#666", marginBottom: 10 },
  chipGroup: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "7px 18px", fontSize: 14, fontWeight: 500, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActive: { padding: "7px 18px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(232, 111, 0, 0.2)" },
  chipNone: { padding: "7px 18px", fontSize: 14, fontWeight: 500, color: "#888", background: "#f9f9f9", border: "1px dashed #d0d0d0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActiveNone: { padding: "7px 18px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#666", border: "1px solid #666", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)" },

  textarea: { width: "100%", minHeight: 100, padding: "14px 16px", fontSize: 16, fontFamily: "inherit", color: "#1a1a1a", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 2, lineHeight: 1.6, outline: "none", boxSizing: "border-box", resize: "none", maxHeight: 180 },
  btnRow: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, marginBottom: "2rem" },
  btnClear: { padding: "8px 16px", fontSize: 15, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" },
  btnSearch: { padding: "8px 20px", fontSize: 15, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, fontFamily: "inherit" },
  exampleArea: { marginBottom: "1.5rem" },
  chipsLabel: { fontSize: 17, color: "#999", marginBottom: 8, textAlign: "center" },
  exampleChip: { padding: "5px 12px", fontSize: 15, color: "#E86F00", background: "#fef0e9", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  loadingRow: { display: "flex", alignItems: "center", gap: 8, padding: "1rem 0" },
  loadingText: { fontSize: 14, color: "#999" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#E86F00", animation: "pulse 1.2s ease-in-out infinite" },
  errorText: { fontSize: 14, color: "#A32D2D", padding: "0.5rem 0" },

  infoBtn: { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#E86F00", background: "#FEF0E0", border: "none", borderRadius: 20, cursor: "pointer", transition: "background 0.2s" },
  card: { background: "#fff", border: "0.5px solid #fff", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 },
  cardLabel: { fontSize: 21, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1a1a1a", margin: 0, textAlign: "left" },
  problemSummary: { fontSize: 15, color: "#333", lineHeight: 1.7, marginBottom: 16 },
  divider: { border: "none", borderTop: "1px solid #f0f0f0", margin: "16px 0" },
  tagSectionLabel: { fontSize: 12, color: "#999", marginBottom: 8, fontWeight: 500 },
  tag: { padding: "4px 10px", fontSize: 13, borderRadius: 4, fontWeight: 500 },
  
  caseItem: { display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 12px", border: "none", borderBottom: "1px solid #f0f0f0", borderRadius: 0, cursor: "pointer", transition: "all 0.2s" },
  caseRank: { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0, color: "#1a1a1a" },
  caseTitle: { fontSize: 16, fontWeight: 500, color: "#1a1a1a", marginBottom: 3 },
  caseMeta: { fontSize: 14, color: "#999" },
  caseTag: { padding: "4px 10px", fontSize: 14, color: "#555", background: "#f0f0f0", borderRadius: 2 },

  bottomBrowseSection: { width: 1000, margin: "0 auto 5rem", padding: "0 2rem", boxSizing: "border-box" },
  btnBrowseAll: { width: "100%", padding: "14px", fontSize: 16, fontWeight: 600, color: "#E86F00", background: "#FEF0E0", border: "1px dashed #E86F00", borderRadius: 8, cursor: "pointer", transition: "all 0.2s" },
  allListWrapper: { background: "#fff", border: "1px solid #ede8e2", borderRadius: 12, padding: 24, marginTop: 10 },
  allListHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  allListTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  btnCloseAll: { background: "none", border: "none", fontSize: 14, color: "#888", cursor: "pointer", fontWeight: 500 },
  allListGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  
  archiveCard: { padding: 18, background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, cursor: "pointer", transition: "all 0.2s" },
  archiveHeader: { display: "flex", justifyContent: "space-between", fontSize: 12, color: "#999", marginBottom: 6 },
  archiveIndustry: { fontWeight: 600, color: "#E86F00" },
  archiveDate: {},
  archiveTitle: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 },
  archiveCompany: { fontSize: 13, color: "#666", marginBottom: 8 },
  archiveSummary: { fontSize: 13, color: "#666", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  btnLoadMore: { padding: "12px 30px", fontSize: 14, fontWeight: 600, color: "#fff", background: "#1a1a1a", border: "none", borderRadius: 6, cursor: "pointer", transition: "background 0.2s" },

  // 💡 여백이 추가된 panel 스타일 부분
  panel: { position: "fixed", top: 0, right: 0, width: 400, height: "100vh", background: "#fff", borderLeft: "1px solid #e8e8e8", padding: "1.5rem", paddingBottom: 100, overflowY: "auto", zIndex: 200, boxSizing: "border-box", boxShadow: "-4px 0 20px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column" },
  
  panelHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  panelTitle: { fontSize: 17, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, flex: 1, marginRight: 8 },
  panelMeta: { fontSize: 14, color: "#999", marginBottom: 10 },
  reasonBox: { background: "#FEF0E9", borderRadius: 2, padding: "12px 14px", marginBottom: 14 },
  reasonTitle: { fontSize: 15, fontWeight: 500, color: "#E86F00", marginBottom: 6 },
  reasonItem: { fontSize: 14, color: "#666", marginBottom: 3 },
  
  panelLink: { 
    width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, 
    color: "#E86F00", background: "#fff", border: "1px solid #E86F00", 
    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all 0.2s"
  },
  
  bottomBar: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a1a", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 300 },
  bottomBarText: { fontSize: 15, color: "#fff" },
  bottomBarBtnOutline: { padding: "8px 16px", fontSize: 14, color: "#fff", background: "transparent", border: "1px solid #fff", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" },
  bottomBarBtnFill: { padding: "8px 16px", fontSize: 14, color: "#1a1a1a", background: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
};