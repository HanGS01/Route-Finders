import { useState, useEffect } from "react";
import { Search, Map, Bookmark } from "lucide-react";

const ORANGE = "#E86F00";
const ORANGE_LIGHT = "#FEF0E0";
const ORANGE_BORDER = "#f5b85a";
const ORANGE_DARK = "#C45E00";
const ORANGE_TEXT = "#A85200";

const styles = {
  landing: {
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
    background: "#ffffff",
    color: "#1a1a1a",
    minHeight: "100vh",
    overflow: "hidden",
    width: 1000,
    margin: "0 auto",
    boxSizing: "border-box",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 36px",
    borderBottom: "0.5px solid #ede8e2",
  },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: ORANGE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.3px" },
  logoSub: { fontSize: 11, color: ORANGE, letterSpacing: "1.5px", textTransform: "uppercase" },
  navBadge: {
    fontSize: 11,
    padding: "4px 10px",
    background: ORANGE_LIGHT,
    border: `0.5px solid ${ORANGE_BORDER}`,
    borderRadius: 20,
    color: ORANGE_TEXT,
    letterSpacing: "0.3px",
  },
  hero: { padding: "56px 36px 44px", textAlign: "center" },
  heroEyebrow: {
    fontSize: 15,
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: ORANGE,
    marginBottom: 20,
  },
  heroTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: 42,
    fontWeight: 600,
    lineHeight: 1.2,
    color: "#111111",
    marginBottom: 16,
    letterSpacing: "-0.5px",
  },
  heroDesc: {
    fontSize: 16,
    color: "#6b6258",
    lineHeight: 1.75,
    maxWidth: 480,
    margin: "0 auto 32px",
  },
  heroActions: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },

  btnPrimary: {
    padding: "11px 24px",
    background: ORANGE,
    color: "#fff",
    border: "none",
    borderRadius: 2,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "11px 24px",
    background: "transparent",
    color: "#1a1a1a",
    border: "0.5px solid #d0c8bf",
    borderRadius: 2,
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
  },
  statsRow: {
    display: "flex",
    justifyContent: "center",
    padding: "0 36px",
    marginBottom: 40,
    borderTop: "0.5px solid #ede8e2",
    borderBottom: "0.5px solid #ede8e2",
  },
  statItem: {
    padding: "18px 28px",
    textAlign: "center",
    borderRight: "0.5px solid #ede8e2",
    flex: 1,
  },
  statNum: { fontSize: 24, fontWeight: 600, color: ORANGE, marginBottom: 4, letterSpacing: "-0.5px" },

  statLabel: { fontSize: 13, color: "#a09488", letterSpacing: "0.5px" },

  features: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    padding: "0 36px 40px",
  },
  featureCard: {
    background: "#f5f5f5",
    border: "0.5px solid #ede8e2",
    borderRadius: 2,
    padding: 20,
    transition: "border-color 0.2s",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 2,
    background: ORANGE_LIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    fontSize: 18,
    color: ORANGE,
  },
  featureTitle: { fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8, letterSpacing: "-0.2px" },

  featureDesc: { fontSize: 14, color: "#8a7e74", lineHeight: 1.65 },

  ctaBar: {
    margin: "0 36px 36px",
    padding: "20px 24px",
    background: ORANGE_LIGHT,
    border: `0.5px solid ${ORANGE_BORDER}`,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  ctaText: { fontSize: 13, color: "#7a5a48" },
};

const STATS = [
  { num: "96+", label: "DBR 케이스 스터디" },
  { num: "2021–26", label: "DBR 아카이브" },
  { num: "3 클릭", label: "목표 탐색 뎁스" },
  { num: "상위 5건", label: "추천 케이스 수" },
];

const FEATURES = [
  {
    icon: <Search size={18} color={ORANGE} />,
    title: "자연어 검색",
    desc: "키워드 없이도 상황을 설명하면 관련 케이스를 찾아드립니다.",
  },
  {
    icon: <Map size={18} color={ORANGE} />,
    title: "클러스터 맵",
    desc: "케이스 간의 관계를 시각적으로 탐색할 수 있습니다.",
  },
  {
    icon: <Bookmark size={18} color={ORANGE} />,
    title: "맞춤 추천",
    desc: "전략, 마케팅, 신사업 등 실무 목적에 맞는 케이스를 추천합니다.",
  },
];

function LogoIcon() {
  return (
    <div style={styles.logoIcon}>
      <svg viewBox="0 0 18 18" fill="none" width={18} height={18}>
        <circle cx="9" cy="9" r="3" fill="white" opacity="0.9" />
        <path
          d="M9 3 L9 1M9 17 L9 15M3 9 L1 9M17 9 L15 9M4.5 4.5 L3 3M15 15 L13.5 13.5M13.5 4.5 L15 3M3 15 L4.5 13.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

export default function LandingPage({ onStart, onAbout }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [primaryHover, setPrimaryHover] = useState(false);
  const [secondaryHover, setSecondaryHover] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div style={styles.landing}>
      {/* Nav
      <nav style={styles.nav}>
        <div style={styles.logo}>
          <LogoIcon />
          <div>
            <div style={styles.logoText}>DBR Case Atlas</div>
            <div style={styles.logoSub}>Route Finders</div>
          </div>
        </div>
        <div style={styles.navBadge}>Beta v0.1</div>
      </nav> */}

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroEyebrow}>AI 기반 케이스 스터디 탐색 서비스</div>
        <h1 style={styles.heroTitle}>
          원하는 케이스를<br />
          <span style={{ color: ORANGE }}>3번의 클릭</span>으로
        </h1>
        <p style={styles.heroDesc}>
          자연어로 상황을 입력하면 DBR 아카이브에서<br />
          관련 케이스 스터디를 찾아드립니다.
        </p>
        <div style={styles.heroActions}>
          <button
            style={{ ...styles.btnPrimary, background: primaryHover ? ORANGE_DARK : ORANGE }}
            onMouseEnter={() => setPrimaryHover(true)}
            onMouseLeave={() => setPrimaryHover(false)}
            onClick={onStart}
          >
            케이스 탐색 시작
          </button>
          <button
            style={{
              ...styles.btnSecondary,
              background: secondaryHover ? "#faf7f4" : "transparent",
            }}
            onMouseEnter={() => setSecondaryHover(true)}
            onMouseLeave={() => setSecondaryHover(false)}
            onClick={onAbout}
          >
            서비스 소개 보기
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {STATS.map((s, i) => (
          <div
            key={i}
            style={{
              ...styles.statItem,
              ...(i === STATS.length - 1 ? { borderRight: "none" } : {}),
            }}
          >
            <div style={styles.statNum}>{s.num}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <div style={styles.features}>
        {FEATURES.map((f, i) => (
          <div
            key={i}
            style={{
              ...styles.featureCard,
              borderColor: hoveredCard === i ? "#f5a882" : "#ede8e2",
            }}
            onMouseEnter={() => setHoveredCard(i)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={styles.featureIcon}>{f.icon}</div>
            <div style={styles.featureTitle}>{f.title}</div>
            <div style={styles.featureDesc}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* CTA bar
      <div style={styles.ctaBar}>
        <div style={styles.ctaText}>
          <strong style={{ color: "#1a1a1a" }}>DBR 아카이브 기반</strong>
          {" — Voice from the Field 포함, 2021–2026 콘텐츠 전체 커버"}
        </div>
        <button
          style={{ ...styles.btnPrimary, background: primaryHover ? ORANGE_DARK : ORANGE }}
          onClick={onStart}
        >
          다음 화면 만들기 ↗
        </button>
      </div> */}
    </div>
  );
}
