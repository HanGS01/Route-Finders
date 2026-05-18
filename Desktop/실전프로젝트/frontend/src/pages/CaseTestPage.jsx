import { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

function CaseTestPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await axiosInstance.get('/cases');
        setCases(response.data.cases);
      } catch (error) {
        console.error('케이스 목록 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  if (loading) {
    return <div>불러오는 중...</div>;
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>DB 케이스 목록 테스트</h1>

      <p>총 {cases.length}개 조회됨</p>

      {cases.map((item) => (
        <div
          key={item.case_idx}
          style={{
            border: '1px solid #ddd',
            padding: '16px',
            marginBottom: '12px',
            borderRadius: '8px',
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