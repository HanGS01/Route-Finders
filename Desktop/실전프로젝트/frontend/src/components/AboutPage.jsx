import { Search, Map, Bookmark, Files } from "lucide-react";
import { useState } from "react";

const ORANGE = "#E86F00";
const ORANGE_LIGHT = "#FEF0E0";
const ORANGE_BORDER = "#f5b85a";

const styles = {
  page: {
    width: 1000,
    margin: "0 auto",
    padding: "2.5rem 2rem",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    boxSizing: "border-box",
  },
  section: {
    paddingBottom: "2.5rem",
    marginBottom: "2.5rem",
    borderBottom: "0.5px solid #ede8e2",
  },
  lastSection: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottom: "none",
  },
  label: {
    fontSize: 16,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: ORANGE,
    marginBottom: 10,
    fontWeight: 600,
  },
  title: {
    fontSize: 28,
    fontWeight: 400,
    color: "#1a1a1a",
    marginBottom: 10,
    fontFamily: "Georgia, 'Times New Roman', serif",
    letterSpacing: "-1px",
  },
  desc: {
    fontSize: 16,
    color: "#6b6258",
    lineHeight: 1.75,
    maxWidth: 800,
  },
  featGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
    marginTop: 20,
  },
  featCard: {
    border: "0.5px solid #ede8e2",
    borderRadius: 2,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  featIcon: {
    width: 38,
    height: 38,
    borderRadius: 2,
    background: ORANGE_LIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: ORANGE,
  },
  featTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a1a",
    marginBottom: 5,
  },
  featDesc: {
    fontSize: 14,
    color: "#8a7e74",
    lineHeight: 1.65,
  },
  showcaseGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 20,
  },
  showcaseCard: {
    border: "0.5px solid #ede8e2",
    borderRadius: 2,
    overflow: "hidden",
  },
  showcaseInput: {
    background: "#f5f5f5",
    padding: "12px 16px",
    borderBottom: "0.5px solid #ede8e2",
  },
  showcaseInputBadge: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: 600,
    letterSpacing: "0.5px",
    marginBottom: 6,
  },
  showcaseInputText: {
    fontSize: 15,
    color: "#6b6258",
    lineHeight: 1.55,
  },
  showcaseResult: { padding: "12px 16px" },
  showcaseResultBadge: {
    fontSize: 12,
    color: "#aaa",
    marginBottom: 8,
    letterSpacing: "0.5px",
  },
  caseChip: {
    display: "inline-block",
    padding: "4px 12px",
    margin: "2px 3px 2px 0",
    background: ORANGE_LIGHT,
    color: "#C44010",
    borderRadius: 2,
    fontSize: 14,
  },
  tipGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 20,
  },
  tipCardGood: {
    background: "#f0faf5",
    border: "0.5px solid #9FE1CB",
    borderRadius: 2,
    padding: "16px 18px",
  },
  tipCardBad: {
    background: "#fef5f5",
    border: "0.5px solid #F7C1C1",
    borderRadius: 2,
    padding: "16px 18px",
  },
  tipBadgeGood: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 2,
    background: "#9FE1CB",
    color: "#085041",
    marginBottom: 12,
    letterSpacing: "0.3px",
  },
  tipBadgeBad: {
    display: "inline-block",
    fontSize: 13,
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 2,
    background: "#F7C1C1",
    color: "#791F1F",
    marginBottom: 12,
    letterSpacing: "0.3px",
  },
  tipItem: {
    fontSize: 15,
    color: "#6b6258",
    lineHeight: 1.65,
    marginBottom: 6,
  },
  faqCard: {
    border: "0.5px solid #ede8e2",
    borderRadius: 2,
    padding: "4px 20px",
    marginTop: 20,
  },
  faqItem: {
    padding: "16px 0",
    borderBottom: "0.5px solid #ede8e2",
  },
  faqItemLast: { padding: "16px 0" },
  
  faqQ: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a1a",
    marginBottom: 6,
  },
  faqA: {
    fontSize: 15,
    color: "#8a7e74",
    lineHeight: 1.65,
  },
  ctaBox: {
    background: "#ffffff",
    border: `0.5px solid #E86F00`,
    borderRadius: 2,
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#1a1a1a",
    marginBottom: 4,
  },
  btn: {
    padding: "11px 24px",
    background: ORANGE,
    color: "#fff",
    border: "none",
    borderRadius: 2,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

// ── SVG 플로우 다이어그램 ──
// 레이아웃 상수
const SW = 200;   // 창 너비
const SH = 160;   // 창 높이
const GAP = 70;   // 창 사이 간격
const ROW_GAP = 80; // 행 간격
const ARROW_GAP = 36; // ← 이걸로 길이 컨트롤
const LABEL_H = 60; // 라벨 영역 높이

// Row1: 3개, Row2: 2개 (오른쪽 정렬)
const R1_COUNT = 3;
const R2_COUNT = 3;
const R1_W = R1_COUNT * SW + (R1_COUNT - 1) * GAP;
const R2_W = R2_COUNT * SW + (R2_COUNT - 1) * GAP;

// Row1 시작 x (중앙 기준, SVG 총 너비 = R1_W)
const r1x = (i) => i * (SW + GAP);
// Row2 중앙 정렬
const r2x = (i) => i * (SW + GAP);

const SVG_W = R1_W + 40;
const ROW2_Y = SH + LABEL_H + 70;
const SVG_H = ROW2_Y + SH + LABEL_H;

function MiniHeader({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={SW} height={18} rx={0}
        fill="#ffffff" stroke="#ede8e2" strokeWidth={0.5} />
      <line x1={x} y1={y+18} x2={x+SW} y2={y+18} stroke="#f2f2f2" strokeWidth={1} />
      <text x={x+12} y={y+13} fontSize={9} fontWeight={700}
        fill="#1a1a1a" fontFamily="Georgia, serif">DBR</text>
      <line x1={x+37} y1={y+4} x2={x+37} y2={y+14} stroke="#e5e5e5" strokeWidth={1} />
      <text x={x+40} y={y+13} fontSize={5.5} fontWeight={600}
        fill="#F05A28" fontFamily="Pretendard, sans-serif">Case Atlas</text>
    </g>
  );
}

function ScreenContent({ type, x, y }) {
  const TOP = y + 14; // 내부 시작 기준선 통일
  const bar = { fill: "#ede8e2" };

  const line = (lx, ly, w, orange = false) => (
    <rect
      x={lx}
      y={ly}
      width={w}
      height={6}
      rx={2}
      fill={orange ? ORANGE : "#ede8e2"}
      opacity={orange ? 0.6 : 1}
    />
  );

  // 공통 상단 dots
  const dots = (
    <>
    </>
  );

  if (type === "search") return (
    <g>
      {/* 제목 두 줄 */}
      {line(x + 8, TOP + 8, SW * 0.8)}
      {line(x + 8, TOP + 20, SW * 0.5, true)}

      {/* 문제 유형 선택 라벨 */}
      {line(x + 8, TOP + 36, SW * 0.3)}

      {/* 칩 4개 */}
      {[0,1,2,3].map(i => (
        <rect key={i} x={x + 8 + i * 34} y={TOP + 48} width={28} height={12} rx={6}
          fill="none" stroke="#ede8e2" strokeWidth={0.8} />
      ))}

      {/* textarea */}
      <rect x={x + 8} y={TOP + 68} width={SW - 16} height={36} rx={3}
        fill="none" stroke="#ede8e2" strokeWidth={0.8} />

      {/* 초기화 버튼 */}
      <rect x={x + SW - 80} y={TOP + 112} width={30} height={12} rx={2}
        fill="none" stroke="#ede8e2" strokeWidth={0.8} />

      {/* 케이스 탐색 버튼 */}
      <rect x={x + SW - 46} y={TOP + 112} width={38} height={12} rx={2}
        fill={ORANGE} opacity={0.85} />
    </g>
  );

  if (type === "result")
    return (
      <g>
        {dots}
        {line(x + 8, TOP + 20, SW * 0.72, true)}
        {line(x + 8, TOP + 34, SW * 0.55)}
        {line(x + 8, TOP + 48, SW * 0.72)}
        {line(x + 8, TOP + 62, SW * 0.55)}
        {line(x + 8, TOP + 76, SW * 0.62)}
      </g>
    );

  if (type === "map")
    return (
      <g>
        {dots}
        <ellipse
          cx={x + SW / 2}
          cy={TOP + 72}
          rx={42}
          ry={30}
          fill="#ede8e2"
        />
        <circle
          cx={x + SW / 2 - 16}
          cy={TOP + 66}
          r={7}
          fill={ORANGE}
          opacity={0.85}
        />
        <circle
          cx={x + SW / 2 + 14}
          cy={TOP + 84}
          r={5}
          fill={ORANGE}
          opacity={0.55}
        />
        <circle
          cx={x + SW / 2 + 10}
          cy={TOP + 52}
          r={4}
          fill="#a09488"
          opacity={0.45}
        />
      </g>
    );

  if (type === "detail")
    return (
      <g>
        {dots}
        {line(x + 8, TOP + 20, SW * 0.72)}
        {line(x + 8, TOP + 34, SW * 0.55)}

        <rect
          x={x + 8}
          y={TOP + 58}
          width={SW - 16}
          height={30}
          rx={4}
          fill="none"
          stroke={ORANGE}
          strokeWidth={1}
          opacity={0.7}
        />

        {line(x + 16, TOP + 69, SW * 0.55, true)}
      </g>
    );

  if (type === "compare")
    return (
      <g>
        {dots}

        <rect
          x={x + 8}
          y={TOP + 18}
          width={(SW - 28) / 3}
          height={SH - 40}
          rx={3}
          fill="#ede8e2"
        />
        <rect
          x={x + 8 + (SW - 28) / 3 + 6}
          y={TOP + 18}
          width={(SW - 28) / 3}
          height={SH - 40}
          rx={3}
          fill="#ede8e2"
        />
        <rect
          x={x + 8 + 2 * ((SW - 28) / 3 + 6)}
          y={TOP + 18}
          width={(SW - 28) / 3}
          height={SH - 40}
          rx={3}
          fill="#ede8e2"
        />
      </g>
    );

  if (type === "table") return (
    <g>
      {/* 헤더 행 */}
      <rect x={x + 8} y={TOP + 8} width={SW - 16} height={10} rx={2} fill="#ede8e2" />
      {/* 3열 데이터 행 5개 */}
      {[0,1,2,3,4].map(row => (
        <g key={row}>
          {[0,1,2].map(col => (
            <rect key={col}
              x={x + 8 + col * ((SW - 22) / 3 + 3)}
              y={TOP + 24 + row * 16}
              width={(SW - 22) / 3}
              height={10} rx={2} fill="#ede8e2" opacity={0.6} />
          ))}
        </g>
      ))}
    </g>
  );

  return null;
}

function FlowDiagram() {
  const steps = [
    { num: 1, title: "검색 화면",   action: "고민 입력 후 클릭",         type: "search"  },
    { num: 2, title: "추천 케이스", action: "케이스 항목 클릭",           type: "result"  },
    { num: 3, title: "클러스터 맵", action: "케이스 선택",               type: "map"     },
    { num: 4, title: "케이스 상세", action: "비교에 추가 클릭 (최대 3개)", type: "detail"  },
    { num: 5, title: "케이스 비교", action: "비교하기 클릭",             type: "compare" },
    { num: 6, title: "케이스 비교표", action: "",                        type: "table"   },
  ];

  const row1 = steps.slice(0, 3);
  const row2 = steps.slice(3, 6);

  return (
    <div style={{ marginTop: 24, overflowX: "auto" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M2 1L8 5L2 9"
              fill="none"
              stroke="#f5c4a8"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {/* Row 1 */}
        {row1.map((step, i) => {
          const x = r1x(i);

          return (
            <g key={step.num}>
              <rect x={x} y={0} width={SW} height={SH} rx={0} fill="#faf7f4" stroke="#ede8e2" strokeWidth={0.5} />

              <MiniHeader x={x} y={0} />

              <ScreenContent type={step.type} x={x + 8} y={8} />

              {step.action && (
                <g>
                  <rect
                    x={x + SW / 2 - 52}
                    y={SH + 8}
                    width={104}
                    height={18}
                    rx={4}
                    fill={ORANGE_LIGHT}
                  />
                  <text
                    x={x + SW / 2}
                    y={SH + 20}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#C44010"
                    fontFamily="Pretendard, sans-serif"
                    fontWeight={500}
                  >
                    {step.action}
                  </text>
                </g>
              )}

              <text
                x={x + SW / 2}
                y={SH + 40}
                textAnchor="middle"
                fontSize={12}
                fontFamily="Pretendard, sans-serif"
                fontWeight={600}
                fill="#1a1a1a"
              >
                <tspan fill={ORANGE}>{"0" + step.num} </tspan>
                {step.title}
              </text>

              {/* row1 horizontal arrows */}
              {i < row1.length - 1 && (
                <line
                  x1={x + SW + (GAP - ARROW_GAP) / 2}
                  x2={x + SW + (GAP + ARROW_GAP) / 2}
                  y1={SH / 2}
                  y2={SH / 2}
                  stroke="#f5c4a8"
                  strokeWidth={1.5}
                  markerEnd="url(#arr)"
                />
              )}
            </g>
          );
        })}

        {/* row2 시작 화살표 - row1과 동일 길이 */}
        {/* 행 연결 L자 화살표 (03 → 04) */}
        <path
          d={`M ${r1x(2) + SW / 2} ${SH + LABEL_H} V ${ROW2_Y - 20} H ${r2x(0) + SW / 2} V ${ROW2_Y - 4}`}
          fill="none" stroke="#f5c4a8" strokeWidth={1.5} markerEnd="url(#arr)"
        />
        {/* Row 2 */}
        {row2.map((step, i) => {
          const x = r2x(i);
          const y = ROW2_Y;

          return (
            <g key={step.num}>
              <rect x={x} y={y} width={SW} height={SH} rx={0} fill="#faf7f4" stroke="#ede8e2" strokeWidth={0.5} />

              <MiniHeader x={x} y={y} />

              <ScreenContent type={step.type} x={x + 8} y={y + 8} />

              {step.action && (
                <g>
                  <rect
                    x={x + SW / 2 - 60}
                    y={y + SH + 8}
                    width={120}
                    height={18}
                    rx={4}
                    fill={ORANGE_LIGHT}
                  />
                  <text
                    x={x + SW / 2}
                    y={y + SH + 20}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#C44010"
                    fontFamily="Pretendard, sans-serif"
                    fontWeight={500}
                  >
                    {step.action}
                  </text>
                </g>
              )}

              <text
                x={x + SW / 2}
                y={y + SH + 40}
                textAnchor="middle"
                fontSize={12}
                fontFamily="Pretendard, sans-serif"
                fontWeight={600}
                fill="#1a1a1a"
              >
                <tspan fill={ORANGE}>{"0" + step.num} </tspan>
                {step.title}
              </text>

              {/* row2 horizontal arrows */}
              {i < row2.length - 1 && (
                <line
                  x1={x + SW + (GAP - ARROW_GAP) / 2}
                  x2={x + SW + (GAP + ARROW_GAP) / 2}
                  y1={y + SH / 2}
                  y2={y + SH / 2}
                  stroke="#f5c4a8"
                  strokeWidth={1.5}
                  markerEnd="url(#arr)"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const FEATURES = [
  { icon: <Search size={18} />, title: "자연어 검색", desc: "지금 겪고 있는 상황을 그대로 적어주세요. 키워드 없이도 딱 맞는 케이스를 찾아드려요." },
  { icon: <Map size={18} />, title: "클러스터 맵", desc: "비슷한 케이스끼리 묶어 한눈에 보여드려요. 생각지 못한 케이스를 발견할 수도 있어요." },
  { icon: <Files size={18} />, title: "케이스 비교", desc: "마음에 드는 케이스를 최대 3개 골라 나란히 비교해보세요. 공통점과 차이점이 한눈에 보여요." },
  { icon: <Bookmark size={18} />, title: "맞춤 추천", desc: "전략·마케팅·신사업 등 내 고민과 가장 가까운 케이스를 추천합니다." },
];

const SHOWCASES = [
  { input: "브랜드 인지도는 높은데 구매 전환이 안 돼요", cases: ["동원 빙글레 브랜드 전략", "롯데 슬롯 성공 전략"] },
  { input: "신사업 진입 전략, 어디서부터 시작해야 할지 모르겠어요", cases: ["카카오 IP 확장 전략", "샐러드랄랄라 AI 플랫폼"] },
];

const TIPS_GOOD = [
  "상황과 맥락을 구체적으로 설명해주세요",
  "숫자나 지표를 함께 언급하면 더 정확해요",
  "문장으로 자유롭게 적어주세요",
];

const TIPS_BAD = [
  "단어 하나만 입력하면 결과가 부정확해요",
  "특정 기업명만 검색하면 매칭이 어려워요",
  "너무 광범위한 주제는 좁혀주세요",
];

const FAQS = [
  { q: "어떤 케이스가 포함되어 있나요?", a: "DBR(동아비즈니스리뷰) 2021–2026년 케이스 스터디와 Voice from the Field 아티클이 포함되어 있습니다." },
  { q: "검색 결과가 마음에 안 들면 어떻게 하나요?", a: "입력 내용을 더 구체적으로 바꿔서 다시 시도해보세요. 상황과 맥락을 추가할수록 정확도가 높아집니다." },
  { q: "클러스터 맵은 어떻게 활용하나요?", a: "검색 결과를 시각화한 맵에서 케이스 간 관계를 탐색할 수 있습니다. 유사한 케이스끼리 묶여 표시됩니다." },
];

export default function AboutPage({ onStart }) {
  const [btnHover, setBtnHover] = useState(false);
  return (
    <div style={styles.page}>

      {/* 서비스 소개 */}
      <div style={styles.section}>
        <div style={styles.label}>서비스 소개</div>
        <div style={{ ...styles.title, fontSize:34 }}>DBR Case Atlas란?</div>
        <p style={styles.desc}>
          바쁜 실무자를 위한 AI 기반 케이스 탐색 서비스입니다. 키워드 대신 자연어로 비즈니스 고민을 입력하면,<br/>
          DBR 아카이브(2021–2026)에서 가장 유사한 케이스를 찾아드립니다.
        </p>
      </div>

      {/* 사용 방법 */}
      <div style={styles.section}>
        <div style={styles.label}>사용 방법</div>
        <div style={styles.title}>이렇게 사용하세요</div>
        <FlowDiagram />
      </div>

      {/* 핵심 기능 */}
      <div style={styles.section}>
        <div style={styles.label}>핵심 기능</div>
        <div style={styles.title}>이런 기능을 제공합니다</div>
        <div style={styles.featGrid}>
          {FEATURES.map((f, i) => (
            <div key={i} style={styles.featCard}>
              <div style={styles.featIcon}>{f.icon}</div>
              <div>
                <div style={styles.featTitle}>{f.title}</div>
                <div style={styles.featDesc}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 예시 쇼케이스 */}
      <div style={styles.section}>
        <div style={styles.label}>예시</div>
        <div style={styles.title}>이런 고민을 입력해보세요</div>
        <div style={styles.showcaseGrid}>
          {SHOWCASES.map((s, i) => (
            <div key={i} style={styles.showcaseCard}>
              <div style={styles.showcaseInput}>
                <div style={styles.showcaseInputBadge}>입력 예시</div>
                <div style={styles.showcaseInputText}>{s.input}</div>
              </div>
              <div style={styles.showcaseResult}>
                <div style={styles.showcaseResultBadge}>추천 케이스</div>
                <div>{s.cases.map((c, j) => <span key={j} style={styles.caseChip}>{c}</span>)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 탐색 팁 */}
      <div style={styles.section}>
        <div style={styles.label}>탐색 팁</div>
        <div style={styles.title}>이렇게 입력하면 더 잘 찾아요</div>
        <div style={styles.tipGrid}>
          <div style={styles.tipCardGood}>
            <div style={styles.tipBadgeGood}>이렇게 입력하세요</div>
            {TIPS_GOOD.map((t, i) => <div key={i} style={styles.tipItem}>✓ {t}</div>)}
          </div>
          <div style={styles.tipCardBad}>
            <div style={styles.tipBadgeBad}>이런 입력은 피해주세요</div>
            {TIPS_BAD.map((t, i) => <div key={i} style={styles.tipItem}>✕ {t}</div>)}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={styles.section}>
        <div style={styles.label}>FAQ</div>
        <div style={styles.title}>자주 묻는 질문</div>
        <div style={styles.faqCard}>
          {FAQS.map((f, i) => (
            <div key={i} style={i === FAQS.length - 1 ? styles.faqItemLast : styles.faqItem}>
              <div style={styles.faqQ}>Q. {f.q}</div>
              <div style={styles.faqA}>{f.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={styles.lastSection}>
        <div style={styles.ctaBox}>
          <div>
            <div style={styles.ctaTitle}>지금 바로 케이스를 탐색해보세요</div>
          </div>
          <button
            style={{ ...styles.btn, background: btnHover ? "#C45E00" : "#E86F00" }}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            onClick={() => { window.scrollTo(0, 0); onStart(); }}
          >
            케이스 탐색 시작
          </button>
        </div>
      </div>

    </div>
  );
}
