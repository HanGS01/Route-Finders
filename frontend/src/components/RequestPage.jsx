import { useState, useEffect } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const INDUSTRIES = ["IT·플랫폼", "커머스", "리테일", "식음료", "금융", "물류·운송", "제조", "콘텐츠·미디어", "헬스케어", "부동산·공간", "기타"];

export default function RequestPage({ onBack }) {
  const [topic, setTopic] = useState("");
  const [industry, setIndustry] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("likes"); // 정렬 및 필터 상태 관리
  const [requests, setRequests] = useState([]);

  const member = JSON.parse(localStorage.getItem("member"));
  const isAdmin = member && Number(member.member_idx) === 6;

  const fetchRequests = async () => {
    try {
      const url = `${API_BASE_URL}/api/requests?member_idx=${member?.member_idx}&isAdmin=${isAdmin}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setRequests(data.data);
    } catch (err) { console.error("데이터 로드 실패:", err); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!member) return alert("로그인 후 이용 가능합니다.");
    if (!topic.trim() || !content.trim()) return alert("내용을 입력해주세요.");

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic, industry, content, 
          is_private: isPrivate, 
          member_idx: member.member_idx 
        })
      });

      if (res.ok) {
        alert("등록되었습니다.");
        setTopic(""); setIndustry(""); setContent(""); setIsPrivate(false);
        fetchRequests();
      }
    } catch (err) { alert("서버 오류"); } finally { setIsSubmitting(false); }
  };

  const handleLike = async (idx) => {
    if (!member) return alert("로그인 필요");
    try {
      await fetch(`${API_BASE_URL}/api/requests/${idx}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_idx: member.member_idx })
      });
      fetchRequests();
    } catch (err) { console.error("좋아요 실패:", err); }
  };

  const handleDelete = async (idx) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/requests/${idx}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_idx: member.member_idx, isAdmin })
      });
      if (res.ok) fetchRequests();
      else alert("삭제 권한이 없습니다.");
    } catch (err) { console.error("삭제 실패:", err); }
  };

  // 필터링 및 정렬 로직
  const processedRequests = [...requests]
    .filter(req => {
      const matchesSearch = req.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            req.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            req.industry.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPrivateOnly = sortBy === "private_only" ? req.is_private : true;
      const matchesMyPosts = sortBy === "my_posts" ? (member && Number(req.member_idx) === Number(member.member_idx)) : true;
      
      return matchesSearch && matchesPrivateOnly && matchesMyPosts;
    })
    .sort((a, b) => {
      if (sortBy === "likes") return b.likes - a.likes;
      // 기본은 최신순 (공감순이 아닐 때)
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return (
    <div style={styles.page}>
      <div style={styles.layout}>
        <div style={styles.leftSection}>
          <h2 style={styles.title}>신규 케이스 요청</h2>
          <form onSubmit={handleSubmit} style={styles.form}>
            <input style={styles.input} placeholder="예: 토스의 초기 고객 확보 전략" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <select style={styles.select} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">산업군 선택</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <textarea style={styles.textarea} placeholder="상세 내용" value={content} onChange={(e) => setContent(e.target.value)} />
            <div style={styles.toggleWrapper} onClick={() => setIsPrivate(!isPrivate)}>
              <div style={{ ...styles.toggleBg, background: isPrivate ? "#ccc" : "#E86F00" }}>
                <div style={{ ...styles.toggleKnob, left: isPrivate ? 22 : 2 }} />
              </div>
              <span style={styles.toggleText}>{isPrivate ? "비공개 (관리자만 보기)" : "공개"}</span>
            </div>
            <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "접수 중..." : "케이스 요청하기"}
            </button>
          </form>
        </div>

        <div style={styles.rightSection}>
          <div style={styles.controls}>
            <input style={{...styles.searchInput, flex: 1}} placeholder="검색" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <select style={styles.sortSelect} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="likes">공감순</option>
              <option value="date">최신순</option>
              {member && <option value="my_posts">내 요청글 보기</option>}
              {isAdmin && <option value="private_only">비공개만 보기</option>}
            </select>
          </div>

          <div style={styles.feedList}>
            {processedRequests.map(req => (
              <div key={req.request_idx} style={styles.feedCard}>
                <h4>{req.is_private && "🔒 "} {req.topic}</h4>
                <p style={styles.feedContent}>{req.content}</p>
                <div style={styles.feedCardBottom}>
                  {(isAdmin || (member && Number(member.member_idx) === Number(req.member_idx))) && (
                    <button onClick={() => handleDelete(req.request_idx)} style={styles.deleteBtn}>삭제</button>
                  )}
                  <button 
                    onClick={() => handleLike(req.request_idx)}
                    style={{ 
                      ...styles.likeBtn,
                      backgroundColor: req.is_liked ? "#E86F00" : "#fff",
                      borderColor: "#E86F00",
                      color: req.is_liked ? "#fff" : "#E86F00"
                    }}
                  >
                    공감 {req.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#f9f9f9", padding: "40px 20px", display: "flex", justifyContent: "center" },
  layout: { display: "flex", gap: 32, width: "100%", maxWidth: 1040, alignItems: "flex-start" },
  leftSection: { flex: "1 1 45%", background: "#fff", padding: "40px", borderRadius: 4, border: "1px solid #ede8e2" },
  title: { fontSize: 24, fontWeight: 800, marginBottom: 20 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  input: { padding: "12px", border: "1px solid #e0e0e0", borderRadius: 6 },
  select: { padding: "12px", border: "1px solid #e0e0e0", borderRadius: 6 },
  textarea: { padding: "12px", border: "1px solid #e0e0e0", borderRadius: 6, minHeight: 100 },
  toggleWrapper: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  toggleBg: { position: "relative", width: 44, height: 24, borderRadius: 12 },
  toggleKnob: { position: "absolute", top: 2, width: 20, height: 20, borderRadius: "50%", background: "#fff" },
  toggleText: { fontSize: 14, fontWeight: 600 },
  submitBtn: { padding: "14px", background: "#E86F00", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" },
  rightSection: { flex: "1 1 55%", display: "flex", flexDirection: "column", gap: 16 },
  controls: { display: "flex", gap: 8 },
  searchInput: { padding: "12px", border: "1px solid #e0e0e0", borderRadius: 4 },
  sortSelect: { padding: "12px", border: "1px solid #e0e0e0", borderRadius: 4 },
  feedList: { display: "flex", flexDirection: "column", gap: 16 },
  feedCard: { background: "#fff", padding: "20px", borderRadius: 12, border: "1px solid #ede8e2" },
  feedCardBottom: { display: "flex", justifyContent: "flex-end", marginTop: 16 },
  feedContent: { fontSize: 14, color: "#555", lineHeight: 1.6 },
  deleteBtn: { background: "#fff", border: "1px solid #ff4d4f", color: "#ff4d4f", borderRadius: 6, padding: "6px 12px", cursor: "pointer", marginRight: 8 },
  likeBtn: { border: "1px solid", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }
};