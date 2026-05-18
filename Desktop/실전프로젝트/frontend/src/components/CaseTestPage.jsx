import { useEffect, useState } from "react";
import axios from "axios";

function CaseTestPage({ onBack }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await axios.get("http://localhost:3000/api/cases");
        setCases(response.data.cases);
      } catch (error) {
        console.error("케이스 목록 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40 }}>
        <p>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: 24,
          padding: "8px 14px",
          border: "1px solid #ddd",
          background: "#fff",
          cursor: "pointer",
        }}
      >
        뒤로가기
      </button>

      <h1>DB 케이스 목록 테스트</h1>
      <p>총 {cases.length}개 조회됨</p>

      {cases.map((item) => (
        <div
          key={item.case_idx}
          style={{
            border: "1px solid #ddd",
            padding: 16,
            marginBottom: 12,
            borderRadius: 8,
            background: "#fff",
          }}
        >
          <h3>
            {item.case_idx}. {item.title}
          </h3>
          <p>{item.summary}</p>
          <small>산업군: {item.industry}</small>
        </div>
      ))}
    </div>
  );
}

export default CaseTestPage;