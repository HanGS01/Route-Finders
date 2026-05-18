import { useState, useEffect } from "react";

export default function BookmarkPage({ onBack }) {
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    setBookmarks(JSON.parse(localStorage.getItem("bookmarks") || "[]"));
    const handleUpdate = () => setBookmarks(JSON.parse(localStorage.getItem("bookmarks") || "[]"));
    window.addEventListener("bookmarkUpdated", handleUpdate);
    return () => window.removeEventListener("bookmarkUpdated", handleUpdate);
  }, []);

  const removeBookmark = (rank) => {
    const updated = bookmarks.filter((b) => b.rank !== rank);
    localStorage.setItem("bookmarks", JSON.stringify(updated));
    setBookmarks(updated);
  };

  return (
    <div style={styles.page}>
      {/* 헤더 */}
      <div style={styles.pageHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={styles.pageTitle}>북마크</h2>
          <span style={styles.count}>{bookmarks.length}개</span>
        </div>
        <button style={styles.backBtn} onClick={onBack}>← 탐색으로 돌아가기</button>
      </div>

      {/* 빈 상태 */}
      {bookmarks.length === 0 ? (
        <div style={styles.empty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <p style={styles.emptyText}>저장된 케이스가 없어요</p>
          <p style={styles.emptySubText}>케이스 카드의 북마크 아이콘을 눌러 저장해보세요</p>
          <button style={styles.goSearchBtn} onClick={onBack}>케이스 탐색하러 가기</button>
        </div>
      ) : (
        <div style={styles.grid}>
          {bookmarks.map((b) => (
            <div key={b.rank} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={{ flex: 1 }}>
                  <p style={styles.cardTitle}>{b.title}</p>
                  <p style={styles.cardMeta}>{b.company}</p>
                </div>
                <button style={styles.bookmarkBtn} onClick={() => removeBookmark(b.rank)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#E86F00" stroke="#E86F00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              </div>
              <div style={styles.tags}>
                <span style={styles.tag}>케이스스터디</span>
                <span style={styles.tag}>{b.industry}</span>
                {b.date && <span style={styles.tag}>{b.date}</span>}
              </div>
              {b.summary && <p style={styles.summary}>{b.summary}</p>}
              <div style={styles.cardBottom}>
                {b.similarity && (
                  <div style={styles.similarity}>
                    <span style={styles.similarityLabel}>유사도</span>
                    <span style={styles.similarityValue}>{b.similarity}%</span>
                  </div>
                )}
                <button style={styles.articleBtn}>DBR 아티클 보기 →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { maxWidth: 930, margin: "0 auto", padding: "2.5rem 2rem", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  pageHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem", paddingBottom: "1.25rem", borderBottom: "2px solid #E86F00" },
  pageTitle: { fontSize: 24, fontWeight: 700, color: "#1a1a1a" },
  count: { fontSize: 14, color: "#E86F00", fontWeight: 500, background: "#FEF0E9", padding: "2px 10px", borderRadius: 20 },
  backBtn: { fontSize: 14, color: "#999", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "6rem 2rem" },
  emptyText: { fontSize: 16, fontWeight: 500, color: "#999" },
  emptySubText: { fontSize: 13, color: "#bbb", textAlign: "center", lineHeight: 1.6 },
  goSearchBtn: { marginTop: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: { background: "#fff", border: "0.5px solid #e8e8e8", borderRadius: 12, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10 },
  cardTop: { display: "flex", alignItems: "flex-start", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.4, marginBottom: 4 },
  cardMeta: { fontSize: 12, color: "#999" },
  bookmarkBtn: { background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 },
  tags: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: { padding: "3px 10px", fontSize: 12, color: "#555", background: "#f0f0f0", borderRadius: 2 },
  summary: { fontSize: 13, color: "#555", lineHeight: 1.6 },
  cardBottom: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  similarity: { display: "flex", alignItems: "center", gap: 6 },
  similarityLabel: { fontSize: 12, color: "#999" },
  similarityValue: { fontSize: 13, color: "#E86F00", fontWeight: 500 },
  articleBtn: { fontSize: 13, fontWeight: 500, color: "#E86F00", background: "#FEF0E9", border: "none", borderRadius: 2, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" },
};
