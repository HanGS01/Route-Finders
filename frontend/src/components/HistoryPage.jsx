import { useMemo, useState, useEffect } from "react";

export default function HistoryPage({ onBack }) {
  const [history, setHistory] = useState([]);
  const [summaryCase, setSummaryCase] = useState(null);
  const [detailCase, setDetailCase] = useState(null);
  const [activeTab, setActiveTab] = useState("search");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("caseHistory") || "[]");
    setHistory(saved);
  }, []);

  const getCaseKey = (item) => String(item?.case_idx ?? item?.id ?? item?.title ?? "");

  const getHistoryItemKey = (item) => {
    const caseKey = getCaseKey(item);
    const viewSource = item?.view_source || item?._view_source || "unknown";
    const queryText = item?.query_text || item?._query_text || "";
    const queryIdx = item?.query_idx || item?._query_idx || "";
    const viewedAt = item?.viewed_at || item?.viewedAt || "";

    return [caseKey, viewSource, queryIdx || queryText || "no-query", viewedAt].join("__");
  };

  const getQueryText = (item) => {
    const value =
      item?.query_text ||
      item?._query_text ||
      item?.raw_query_text ||
      item?.search_query ||
      item?._search_query ||
      "";

    return String(value).trim();
  };

  const getSearchDateText = (item) => {
    const raw = item?.searched_at || item?._searched_at || item?.created_at || item?.viewed_at;

    if (raw) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) {
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      }
    }

    return item?.viewedAt || "";
  };

  const getViewSource = (item) => item?.view_source || item?._view_source || "unknown";

  const isSearchBasedItem = (item) => {
    const source = getViewSource(item);
    const queryText = getQueryText(item);

    // 검색어가 없는 과거 기록은 검색 기반으로 묶지 않는다.
    // 새로 저장되는 추천/케이스맵 기록부터 검색어 기준으로 그룹화된다.
    return ["recommend", "map"].includes(source) && Boolean(queryText);
  };

  const getSourceLabel = (source) => {
    const labelMap = {
      recommend: "추천 결과",
      map: "케이스맵",
      popular: "많이 저장한 케이스",
      archive: "전체 케이스",
      bookmark: "북마크",
      unknown: "일반 탐색",
    };

    return labelMap[source] || "일반 탐색";
  };

  const getSourceStyle = (source) => {
    if (["recommend", "map"].includes(source)) return styles.sourceBadgeSearch;
    if (source === "popular") return styles.sourceBadgePopular;
    return styles.sourceBadgeDefault;
  };

  const searchHistory = useMemo(() => {
    return history.filter(isSearchBasedItem);
  }, [history]);

  const generalHistory = useMemo(() => {
    return history.filter((item) => !isSearchBasedItem(item));
  }, [history]);

  const searchGroups = useMemo(() => {
    const groupMap = new Map();

    searchHistory.forEach((item) => {
      const queryText = getQueryText(item);
      const queryIdx = item.query_idx || item._query_idx || "";
      const groupKey = queryIdx ? `query:${queryIdx}` : `text:${queryText}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          queryText,
          searchDate: getSearchDateText(item),
          items: [],
        });
      }

      groupMap.get(groupKey).items.push(item);
    });

    return Array.from(groupMap.values());
  }, [searchHistory]);

  const displayedHistory = activeTab === "search" ? searchHistory : generalHistory;

  const clearHistory = () => {
    localStorage.removeItem("caseHistory");
    setHistory([]);
    setSummaryCase(null);
    setDetailCase(null);
  };

  const removeItem = (targetItem) => {
    const targetKey = getHistoryItemKey(targetItem);
    const updated = history.filter((item) => getHistoryItemKey(item) !== targetKey);

    localStorage.setItem("caseHistory", JSON.stringify(updated));
    setHistory(updated);

    if (summaryCase && getHistoryItemKey(summaryCase) === targetKey) {
      setSummaryCase(null);
    }

    if (detailCase && getHistoryItemKey(detailCase) === targetKey) {
      setDetailCase(null);
    }
  };

  const openOriginalArticle = (item) => {
    if (!item.src_url) {
      alert("원문 링크가 등록되지 않은 케이스입니다.");
      return;
    }
    window.open(item.src_url, "_blank", "noopener,noreferrer");
  };

  const renderSourceBadge = (item) => {
    const source = getViewSource(item);

    return (
      <span style={{ ...styles.sourceBadge, ...getSourceStyle(source) }}>
        {getSourceLabel(source)}
      </span>
    );
  };

  const renderSearchGroup = (group) => (
    <div key={group.key} style={styles.searchGroupCard}>
      <div style={styles.searchGroupHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.searchGroupLabel}>검색어</p>
          <h3 style={styles.searchGroupTitle}>{group.queryText}</h3>
        </div>
        {group.searchDate && <span style={styles.searchGroupDate}>{group.searchDate}</span>}
      </div>

      <div style={styles.searchCaseList}>
        {group.items.map((item) => (
          <div
            key={getHistoryItemKey(item)}
            style={styles.searchCaseRow}
            onClick={() => setDetailCase(item)}
          >
            <div style={styles.searchCaseMain}>
              <div style={styles.searchCaseTitleLine}>
                {renderSourceBadge(item)}
                <p style={styles.searchCaseTitle}>{item.title}</p>
              </div>
              <p style={styles.searchCaseMeta}>{item.company || item.comp_name || "기업명 미등록"}</p>
            </div>

            <div style={styles.searchCaseRight}>
              <span style={styles.viewedAt}>{item.viewedAt}</span>
              <button
                style={styles.rowSummaryBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setSummaryCase(item);
                }}
              >
                요약
              </button>
              <button
                style={styles.rowArticleBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  openOriginalArticle(item);
                }}
              >
                원문
              </button>
              <button
                style={styles.rowRemoveBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item);
                }}
                title="기록 삭제"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGeneralCard = (item) => (
    <div
      key={getHistoryItemKey(item)}
      style={styles.card}
      onClick={() => setDetailCase(item)}
    >
      <div style={styles.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 8 }}>{renderSourceBadge(item)}</div>
          <p style={styles.cardTitle}>{item.title}</p>
          <p style={styles.cardMeta}>{item.company || item.comp_name || "기업명 미등록"}</p>
        </div>
        <button
          style={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            removeItem(item);
          }}
          title="기록 삭제"
        >
          ✕
        </button>
      </div>

      <div style={styles.cardInfoRow}>
        <div style={styles.tags}>
          <span style={styles.tag}>케이스스터디</span>
          {item.industry && <span style={styles.tag}>{item.industry}</span>}
          {item.date && <span style={styles.tag}>{item.date}</span>}
        </div>
        <span style={styles.viewedAt}>{item.viewedAt}</span>
      </div>

      <div style={styles.cardBottom}>
        <button
          style={styles.summaryBtn}
          onClick={(e) => {
            e.stopPropagation();
            setSummaryCase(item);
          }}
        >
          요약문 바로보기
        </button>
        <button
          style={styles.articleBtn}
          onClick={(e) => {
            e.stopPropagation();
            openOriginalArticle(item);
          }}
        >
          DBR 원문 바로가기 →
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={styles.pageTitle}>최근 본 케이스</h2>
          <span style={styles.count}>{history.length}개</span>
        </div>
        <button style={styles.backBtn} onClick={onBack}>
          ← 탐색으로 돌아가기
        </button>
      </div>

      {history.length === 0 ? (
        <div style={styles.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p style={styles.emptyText}>최근 본 케이스가 없어요</p>
          <p style={styles.emptySubText}>케이스를 클릭하면 여기에 기록이 남아요</p>
          <button style={styles.goSearchBtn} onClick={onBack}>
            케이스 탐색하러 가기
          </button>
        </div>
      ) : (
        <>
          <div style={styles.historyToolbar}>
            <div style={styles.tabGroup}>
              <button
                style={activeTab === "search" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("search")}
              >
                검색 기반 <span style={styles.tabCount}>{searchHistory.length}</span>
              </button>
              <button
                style={activeTab === "general" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("general")}
              >
                일반 탐색 <span style={styles.tabCount}>{generalHistory.length}</span>
              </button>
            </div>

            <button onClick={clearHistory} style={styles.clearBtn}>
              전체 삭제
            </button>
          </div>

          {displayedHistory.length === 0 ? (
            <div style={styles.emptySmall}>
              <p style={styles.emptyTextSmall}>
                {activeTab === "search"
                  ? "검색 결과에서 본 케이스가 없어요"
                  : "일반 탐색으로 본 케이스가 없어요"}
              </p>
            </div>
          ) : activeTab === "search" ? (
            <div style={styles.searchGroupList}>
              {searchGroups.map(renderSearchGroup)}
            </div>
          ) : (
            <div style={styles.grid}>
              {generalHistory.map(renderGeneralCard)}
            </div>
          )}
        </>
      )}

      {detailCase && (
        <HistoryDetailPanel
          caseData={detailCase}
          sourceLabel={getSourceLabel(getViewSource(detailCase))}
          queryText={getQueryText(detailCase)}
          searchDate={getSearchDateText(detailCase)}
          onClose={() => setDetailCase(null)}
          onOpenSummary={() => setSummaryCase(detailCase)}
          onOpenOriginal={() => openOriginalArticle(detailCase)}
        />
      )}

      {summaryCase && (
        <SummaryModal
          caseData={summaryCase}
          onClose={() => setSummaryCase(null)}
          onOpenOriginal={() => openOriginalArticle(summaryCase)}
        />
      )}
    </div>
  );
}

function formatSummaryParagraphs(summary) {
  if (!summary) return ["등록된 요약문이 없습니다."];
  const normalized = String(summary).replace(/\s+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?。！？]|다\.|요\.|음\.|됨\.|했다\.|였다\.|한다\.|있다\.|됐다\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [normalized];
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }
  return paragraphs;
}

function HistoryDetailPanel({
  caseData,
  sourceLabel,
  queryText,
  searchDate,
  onClose,
  onOpenSummary,
  onOpenOriginal,
}) {
  const recommendationReason = caseData.reco_reason || caseData.reason || "";
  const personalStrategy = caseData.personal_strategy || "";

  return (
    <aside style={styles.detailPanel}>
      <div style={styles.detailHeader}>
        <div style={{ minWidth: 0 }}>
          <p style={styles.detailLabel}>최근 본 케이스 상세</p>
          <h3 style={styles.detailTitle}>{caseData.title}</h3>
          <p style={styles.detailMeta}>
            {caseData.company || caseData.comp_name || "기업명 미등록"}
            {caseData.industry ? ` · ${caseData.industry}` : ""}
            {caseData.date ? ` · ${caseData.date}` : ""}
          </p>
        </div>
        <button style={styles.detailCloseBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.detailBody}>
        <div style={styles.detailBadgeRow}>
          <span style={styles.detailSourceBadge}>{sourceLabel}</span>
          {caseData.viewedAt && <span style={styles.detailViewedAt}>최근 열람 {caseData.viewedAt}</span>}
        </div>

        {queryText && (
          <section style={styles.detailSectionSoft}>
            <p style={styles.detailSectionLabel}>당시 검색어</p>
            <p style={styles.detailQueryText}>{queryText}</p>
            {searchDate && <p style={styles.detailSearchDate}>{searchDate} 검색</p>}
          </section>
        )}

        <section style={styles.detailSection}>
          <p style={styles.detailSectionTitle}>문제 상황</p>
          <p style={caseData.prob_def ? styles.detailParagraph : styles.detailEmptyText}>
            {caseData.prob_def || "등록된 문제 상황이 없습니다."}
          </p>
        </section>

        <section style={styles.detailSection}>
          <p style={styles.detailSectionTitle}>해결 전략</p>
          <p style={caseData.sol_detail ? styles.detailParagraph : styles.detailEmptyText}>
            {caseData.sol_detail || "등록된 해결 전략이 없습니다."}
          </p>
        </section>

        <section style={styles.detailSection}>
          <p style={styles.detailSectionTitle}>당시 추천 이유</p>
          <p style={recommendationReason ? styles.detailParagraph : styles.detailEmptyText}>
            {recommendationReason || "저장된 추천 이유가 없습니다. 추천 결과나 케이스맵에서 새로 열람한 기록부터 추천 이유가 함께 저장됩니다."}
          </p>
        </section>

        <section style={styles.detailSection}>
          <p style={styles.detailSectionTitle}>당시 맞춤 전략</p>
          <p style={personalStrategy ? styles.detailStrategyText : styles.detailEmptyText}>
            {personalStrategy || "저장된 맞춤 전략이 없습니다. ‘내 상황에 적용하기’로 생성된 추천 케이스를 열람하면 맞춤 전략이 함께 저장됩니다."}
          </p>
        </section>
      </div>

      <div style={styles.detailFooter}>
        <button style={styles.modalSubBtn} onClick={onOpenSummary}>요약문 보기</button>
        <button style={styles.modalMainBtn} onClick={onOpenOriginal}>DBR 원문 바로가기 →</button>
      </div>
    </aside>
  );
}

function SummaryModal({ caseData, onClose, onOpenOriginal }) {
  return (
    <>
      <div style={styles.modalOverlay} onClick={onClose} />
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <div>
            <p style={styles.modalLabel}>케이스 요약</p>
            <h3 style={styles.modalTitle}>{caseData.title}</h3>
            <p style={styles.modalMeta}>
              {caseData.company || caseData.comp_name || "기업명 미등록"}
              {caseData.industry ? ` · ${caseData.industry}` : ""}
              {caseData.date ? ` · ${caseData.date}` : ""}
            </p>
          </div>
          <button style={styles.modalCloseBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.modalBody}>
          {formatSummaryParagraphs(caseData.summary).map((paragraph, index) => (
            <p key={index} style={styles.summaryParagraph}>{paragraph}</p>
          ))}
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.modalSubBtn} onClick={onClose}>닫기</button>
          <button style={styles.modalMainBtn} onClick={onOpenOriginal}>DBR 원문 바로가기 →</button>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "2.5rem 2rem",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2rem",
    paddingBottom: "1.25rem",
    borderBottom: "2px solid #E86F00",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#1a1a1a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  count: {
    fontSize: 14,
    color: "#E86F00",
    fontWeight: 700,
    background: "#FEF0E9",
    padding: "4px 11px",
    borderRadius: 20,
  },
  backBtn: {
    fontSize: 14,
    color: "#777",
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 20,
    padding: "8px 14px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  historyToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  tabGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  tab: {
    padding: "9px 15px",
    borderRadius: 999,
    border: "1px solid #e7e7e7",
    background: "#fff",
    color: "#777",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabActive: {
    padding: "9px 15px",
    borderRadius: 999,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#E86F00",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  tabCount: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: 900,
  },
  clearBtn: {
    fontSize: 13,
    color: "#999",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "6rem 2rem",
    border: "1px dashed #e5e5e5",
    borderRadius: 16,
    background: "#fff",
  },
  emptySmall: {
    padding: "4rem 2rem",
    border: "1px dashed #e5e5e5",
    borderRadius: 16,
    background: "#fff",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 17,
    fontWeight: 700,
    color: "#777",
    margin: 0,
    textAlign: "center",
  },
  emptyTextSmall: {
    fontSize: 15,
    fontWeight: 700,
    color: "#999",
    margin: 0,
  },
  emptySubText: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 1.6,
    margin: 0,
  },
  goSearchBtn: {
    marginTop: 8,
    padding: "11px 22px",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    background: "#E86F00",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  searchGroupList: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  searchGroupCard: {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 14,
    padding: "1.25rem 1.45rem",
    boxShadow: "0 3px 12px rgba(0,0,0,0.03)",
  },
  searchGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 16,
    borderBottom: "1px solid #f0f0f0",
  },
  searchGroupLabel: {
    fontSize: 12,
    color: "#E86F00",
    fontWeight: 900,
    margin: "0 0 8px",
  },
  searchGroupTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#111",
    lineHeight: 1.45,
    letterSpacing: "-0.03em",
    margin: 0,
    wordBreak: "keep-all",
  },
  searchGroupDate: {
    fontSize: 12,
    color: "#aaa",
    flexShrink: 0,
    marginTop: 4,
  },
  searchCaseList: {
    display: "flex",
    flexDirection: "column",
  },
  searchCaseRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "16px 0",
    borderBottom: "1px solid #f5f5f5",
    cursor: "pointer",
  },
  searchCaseMain: {
    flex: 1,
    minWidth: 0,
  },
  searchCaseTitleLine: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  searchCaseTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#111",
    lineHeight: 1.45,
    margin: 0,
    letterSpacing: "-0.02em",
    wordBreak: "keep-all",
  },
  searchCaseMeta: {
    fontSize: 13,
    color: "#aaa",
    margin: "8px 0 0 0",
  },
  searchCaseRight: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  sourceBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  sourceBadgeSearch: {
    background: "#FEF0E9",
    color: "#E86F00",
  },
  sourceBadgePopular: {
    background: "#fff7ed",
    color: "#C45E00",
  },
  sourceBadgeDefault: {
    background: "#f3f3f3",
    color: "#666",
  },
  rowSummaryBtn: {
    padding: "8px 12px",
    border: "1px solid #ddd",
    background: "#fff",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  rowArticleBtn: {
    padding: "8px 12px",
    border: "none",
    background: "#FEF0E9",
    color: "#E86F00",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  rowRemoveBtn: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "none",
    background: "#f7f7f7",
    color: "#aaa",
    fontSize: 14,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
    gap: 18,
  },
  card: {
    background: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 14,
    padding: "1.3rem",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "0 3px 12px rgba(0,0,0,0.03)",
    cursor: "pointer",
  },
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#1a1a1a",
    lineHeight: 1.45,
    margin: "0 0 7px",
    letterSpacing: "-0.02em",
  },
  cardMeta: {
    fontSize: 13,
    color: "#999",
    margin: 0,
  },
  removeBtn: {
    background: "#f7f7f7",
    border: "none",
    borderRadius: "50%",
    cursor: "pointer",
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 14,
    color: "#aaa",
  },
  cardInfoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  tag: {
    padding: "5px 10px",
    fontSize: 12,
    color: "#666",
    background: "#f3f3f3",
    borderRadius: 4,
    fontWeight: 600,
  },
  viewedAt: {
    fontSize: 12,
    color: "#bbb",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  cardBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  summaryBtn: {
    fontSize: 13,
    fontWeight: 800,
    color: "#333",
    background: "#fff",
    border: "1px solid #d9d9d9",
    borderRadius: 4,
    padding: "8px 13px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  articleBtn: {
    fontSize: 13,
    fontWeight: 800,
    color: "#E86F00",
    background: "#FEF0E9",
    border: "none",
    borderRadius: 4,
    padding: "8px 13px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  detailPanel: {
    position: "fixed",
    top: 72,
    right: 0,
    bottom: 0,
    width: 390,
    background: "#fff",
    borderLeft: "1px solid #e8e8e8",
    boxShadow: "-12px 0 30px rgba(0,0,0,0.08)",
    zIndex: 900,
    display: "flex",
    flexDirection: "column",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "24px 24px 18px",
    borderBottom: "1px solid #f0f0f0",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#E86F00",
    margin: "0 0 8px",
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#111",
    lineHeight: 1.45,
    letterSpacing: "-0.03em",
    margin: "0 0 8px",
    wordBreak: "keep-all",
  },
  detailMeta: {
    fontSize: 13,
    color: "#999",
    margin: 0,
    lineHeight: 1.5,
  },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "none",
    background: "#f7f7f7",
    color: "#999",
    cursor: "pointer",
    fontSize: 15,
    flexShrink: 0,
  },
  detailBody: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 24px",
  },
  detailBadgeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  detailSourceBadge: {
    padding: "6px 10px",
    background: "#FEF0E9",
    color: "#E86F00",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 900,
  },
  detailViewedAt: {
    fontSize: 12,
    color: "#aaa",
  },
  detailSectionSoft: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 12,
    padding: "14px 15px",
    marginBottom: 18,
  },
  detailSection: {
    padding: "18px 0",
    borderTop: "1px solid #f0f0f0",
  },
  detailSectionLabel: {
    fontSize: 12,
    color: "#E86F00",
    fontWeight: 900,
    margin: "0 0 8px",
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "#111",
    margin: "0 0 10px",
  },
  detailQueryText: {
    fontSize: 14,
    color: "#333",
    fontWeight: 800,
    lineHeight: 1.6,
    margin: 0,
    wordBreak: "keep-all",
  },
  detailSearchDate: {
    fontSize: 12,
    color: "#b87839",
    margin: "8px 0 0",
  },
  detailParagraph: {
    fontSize: 14,
    color: "#333",
    lineHeight: 1.8,
    margin: 0,
    whiteSpace: "pre-line",
    wordBreak: "keep-all",
  },
  detailStrategyText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 1.85,
    margin: 0,
    whiteSpace: "pre-line",
    wordBreak: "keep-all",
  },
  detailEmptyText: {
    fontSize: 13,
    color: "#999",
    lineHeight: 1.7,
    margin: 0,
    wordBreak: "keep-all",
  },
  detailFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "16px 20px",
    borderTop: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  modalOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 1000,
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(620px, calc(100vw - 40px))",
    maxHeight: "78vh",
    background: "#fff",
    borderRadius: 16,
    zIndex: 1100,
    boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "22px 24px 18px",
    borderBottom: "1px solid #f0f0f0",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "#E86F00",
    margin: "0 0 8px",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#1a1a1a",
    lineHeight: 1.45,
    margin: "0 0 8px",
    letterSpacing: "-0.03em",
  },
  modalMeta: {
    fontSize: 13,
    color: "#999",
    margin: 0,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    background: "#f7f7f7",
    color: "#999",
    cursor: "pointer",
    fontSize: 16,
    flexShrink: 0,
  },
  modalBody: {
    padding: "22px 24px",
    overflowY: "auto",
  },
  summaryParagraph: {
    fontSize: 15,
    color: "#333",
    lineHeight: 1.9,
    margin: "0 0 18px",
    letterSpacing: "-0.01em",
    wordBreak: "keep-all",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "16px 24px",
    borderTop: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  modalSubBtn: {
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 700,
    color: "#666",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  modalMainBtn: {
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 800,
    color: "#fff",
    background: "#E86F00",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
