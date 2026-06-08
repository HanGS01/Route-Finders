import { Search, Target, Map, PanelRightOpen, GitCompare, Bookmark, TrendingUp, History } from "lucide-react";
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
    borderRadius: 12,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
  },
  featIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
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
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
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
  showcaseApplyBox: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: "6px 10px",
    fontSize: 14,
    color: "#6b6258",
    lineHeight: 1.55,
  },
  showcaseApplyLabel: {
    color: "#a09488",
    fontWeight: 600,
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
    borderRadius: 12,
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
    borderRadius: 12,
    padding: "16px 18px",
  },
  tipCardBad: {
    background: "#fef5f5",
    border: "0.5px solid #F7C1C1",
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 12,
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

// Row1: 3개, Row2: 3개
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

  const smallBadge = (lx, ly, w, orange = false) => (
    <rect
      x={lx}
      y={ly}
      width={w}
      height={12}
      rx={6}
      fill={orange ? ORANGE_LIGHT : "#f4f1ee"}
      stroke={orange ? "#fed7aa" : "#ede8e2"}
      strokeWidth={0.6}
    />
  );

  if (type === "search") return (
    <g>
      {/* 검색 모드 탭 */}
      {smallBadge(x + 8, TOP + 8, 54, true)}
      {smallBadge(x + 68, TOP + 8, 68)}

      {/* 제목 두 줄 */}
      {line(x + 8, TOP + 30, SW * 0.75)}
      {line(x + 8, TOP + 42, SW * 0.52, true)}

      {/* 필터 칩 */}
      {[0,1,2,3].map(i => (
        <rect key={i} x={x + 8 + i * 34} y={TOP + 60} width={28} height={12} rx={6}
          fill="none" stroke="#ede8e2" strokeWidth={0.8} />
      ))}

      {/* textarea */}
      <rect x={x + 8} y={TOP + 80} width={SW - 16} height={34} rx={3}
        fill="none" stroke="#ede8e2" strokeWidth={0.8} />

      {/* 버튼 */}
      <rect x={x + SW - 80} y={TOP + 122} width={30} height={12} rx={2}
        fill="none" stroke="#ede8e2" strokeWidth={0.8} />
      <rect x={x + SW - 46} y={TOP + 122} width={38} height={12} rx={2}
        fill={ORANGE} opacity={0.85} />
    </g>
  );

  if (type === "result")
    return (
      <g>
        {/* 추천 결과 리스트 */}
        {line(x + 8, TOP + 12, SW * 0.42, true)}
        {[0,1,2].map((i) => (
          <g key={i}>
            <rect
              x={x + 8}
              y={TOP + 30 + i * 32}
              width={SW - 16}
              height={24}
              rx={5}
              fill={i === 0 ? "#fff7ed" : "#f8f6f4"}
              stroke={i === 0 ? "#fed7aa" : "#ede8e2"}
              strokeWidth={0.6}
            />
            <circle cx={x + 18} cy={TOP + 42 + i * 32} r={3.2} fill={i === 0 ? ORANGE : "#d7d1cb"} />
            {line(x + 28, TOP + 38 + i * 32, SW * 0.55, i === 0)}
            {line(x + 28, TOP + 48 + i * 32, SW * 0.38)}
          </g>
        ))}
      </g>
    );

  if (type === "map")
    return (
      <g>
        {/* 케이스맵 링/후보 구조 */}
        <ellipse
          cx={x + SW / 2}
          cy={TOP + 72}
          rx={52}
          ry={34}
          fill="#f1ede9"
        />
        <ellipse
          cx={x + SW / 2}
          cy={TOP + 72}
          rx={34}
          ry={22}
          fill="none"
          stroke="#e5ddd5"
          strokeWidth={1}
        />
        <circle
          cx={x + SW / 2 - 18}
          cy={TOP + 66}
          r={7}
          fill={ORANGE}
          opacity={0.9}
        />
        <circle
          cx={x + SW / 2 + 18}
          cy={TOP + 84}
          r={5}
          fill={ORANGE}
          opacity={0.55}
        />
        <circle
          cx={x + SW / 2 + 12}
          cy={TOP + 52}
          r={4}
          fill="#a09488"
          opacity={0.45}
        />
        <circle
          cx={x + SW / 2 - 34}
          cy={TOP + 88}
          r={3.8}
          fill="#a09488"
          opacity={0.35}
        />
        <rect x={x + 14} y={TOP + 116} width={54} height={12} rx={6} fill={ORANGE_LIGHT} />
        {line(x + 74, TOP + 119, SW * 0.42)}
      </g>
    );

  if (type === "detail")
    return (
      <g>
        {/* 우측 상세 패널 */}
        {line(x + 8, TOP + 12, SW * 0.6)}
        {line(x + 8, TOP + 26, SW * 0.38)}

        <rect
          x={x + 8}
          y={TOP + 48}
          width={SW - 16}
          height={28}
          rx={4}
          fill="#fff7ed"
          stroke="#fed7aa"
          strokeWidth={0.8}
        />
        {line(x + 18, TOP + 58, SW * 0.54, true)}

        <rect
          x={x + 8}
          y={TOP + 86}
          width={SW - 16}
          height={30}
          rx={4}
          fill="none"
          stroke={ORANGE}
          strokeWidth={1}
          opacity={0.7}
        />
        {line(x + 18, TOP + 98, SW * 0.62, true)}

        <rect x={x + SW - 78} y={TOP + 128} width={32} height={12} rx={3} fill="#fff" stroke="#ede8e2" strokeWidth={0.8} />
        <rect x={x + SW - 42} y={TOP + 128} width={34} height={12} rx={3} fill={ORANGE_LIGHT} />
      </g>
    );

  if (type === "compare")
    return (
      <g>
        {/* 비교/저장 카드 */}
        {[0,1,2].map((i) => (
          <g key={i}>
            <rect
              x={x + 8 + i * ((SW - 28) / 3 + 6)}
              y={TOP + 20}
              width={(SW - 28) / 3}
              height={84}
              rx={4}
              fill="#f1ede9"
            />
            <rect
              x={x + 14 + i * ((SW - 28) / 3 + 6)}
              y={TOP + 30}
              width={(SW - 52) / 3}
              height={6}
              rx={2}
              fill={i === 0 ? ORANGE : "#d7d1cb"}
              opacity={i === 0 ? 0.65 : 1}
            />
            <rect
              x={x + 14 + i * ((SW - 28) / 3 + 6)}
              y={TOP + 44}
              width={(SW - 58) / 3}
              height={6}
              rx={2}
              fill="#d7d1cb"
            />
          </g>
        ))}
        <rect x={x + 72} y={TOP + 120} width={56} height={14} rx={3} fill={ORANGE} opacity={0.85} />
      </g>
    );

  if (type === "history") return (
    <g>
      {/* 최근 본 케이스 히스토리 */}
      {smallBadge(x + 8, TOP + 10, 52, true)}
      {smallBadge(x + 66, TOP + 10, 52)}

      <rect
        x={x + 8}
        y={TOP + 34}
        width={SW - 16}
        height={20}
        rx={4}
        fill="#fff7ed"
        stroke="#fed7aa"
        strokeWidth={0.7}
      />
      {line(x + 18, TOP + 41, SW * 0.52, true)}

      {[0,1,2,3].map((i) => (
        <g key={i}>
          <circle cx={x + 18} cy={TOP + 72 + i * 16} r={3} fill={i < 2 ? ORANGE : "#cfc7bf"} opacity={i < 2 ? 0.7 : 0.55} />
          {line(x + 28, TOP + 69 + i * 16, SW * (i === 0 ? 0.58 : 0.44))}
        </g>
      ))}
    </g>
  );

  return null;
}

function FlowDiagram() {
  const steps = [
    { num: 1, title: "고민 입력", action: "상황을 문장으로 적어요", type: "search" },
    { num: 2, title: "추천 결과", action: "추천 이유를 확인해요", type: "result" },
    { num: 3, title: "케이스맵 탐색", action: "관련 후보까지 둘러봐요", type: "map" },
    { num: 4, title: "상세 패널", action: "문제·해결 전략을 살펴봐요", type: "detail" },
    { num: 5, title: "비교·저장", action: "필요한 케이스를 모아요", type: "compare" },
    { num: 6, title: "히스토리 복기", action: "봤던 흐름을 다시 확인해요", type: "history" },
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
                    x={x + SW / 2 - 60}
                    y={SH + 8}
                    width={120}
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
                    x={x + SW / 2 - 64}
                    y={y + SH + 8}
                    width={128}
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
  {
    icon: <Search size={18} />,
    title: "관련 케이스 찾기",
    desc: "지금 겪고 있는 고민을 문장으로 적으면, 비슷한 문제를 다룬 DBR 케이스를 추천해드려요.",
  },
  {
    icon: <Target size={18} />,
    title: "내 상황에 적용하기",
    desc: "직무, 문제 상황, 제약 조건을 함께 입력하면 추천 케이스를 내 상황에 맞는 실행 방향으로 정리해드려요.",
  },
  {
    icon: <Map size={18} />,
    title: "케이스맵 탐색",
    desc: "추천 TOP5뿐 아니라 관련 후보 케이스까지 지도처럼 둘러볼 수 있어요.",
  },
  {
    icon: <PanelRightOpen size={18} />,
    title: "우측 상세 패널",
    desc: "케이스를 누르면 문제 상황, 해결 전략, 추천 이유, 맞춤 전략을 한 화면에서 확인할 수 있어요.",
  },
  {
    icon: <GitCompare size={18} />,
    title: "케이스 비교",
    desc: "마음에 드는 케이스를 최대 3개까지 골라 공통점과 차이점을 나란히 비교할 수 있어요.",
  },
  {
    icon: <Bookmark size={18} />,
    title: "북마크 저장",
    desc: "나중에 다시 보고 싶은 케이스는 북마크로 저장해두고 따로 모아볼 수 있어요.",
  },
  {
    icon: <TrendingUp size={18} />,
    title: "인기 케이스·검색어",
    desc: "다른 사용자가 많이 본 케이스와 자주 찾는 검색어를 참고해서 탐색을 시작할 수 있어요.",
  },
  {
    icon: <History size={18} />,
    title: "최근 본 케이스 히스토리",
    desc: "검색어별로 봤던 케이스를 다시 확인하고, 당시 흐름과 상세 내용을 복기할 수 있어요.",
  },
];

const SHOWCASES = [
  {
    type: "case",
    badge: "관련 케이스 찾기",
    input: "브랜드 인지도는 높은데 구매 전환이 낮아요.",
    cases: ["구매 전환 개선 사례", "브랜드 리포지셔닝 사례", "고객 경험 개선 사례"],
  },
  {
    type: "apply",
    badge: "내 상황에 적용하기",
    role: "마케팅 실무자",
    situation: "신규 서비스 유입은 늘었지만 실제 구매 전환이 낮아요.",
    constraint: "큰 예산 없이 고객 반응을 빠르게 확인하고 싶어요.",
    cases: ["실행 우선순위 정리", "고객 반응 검증 방향", "적용 시 주의점"],
  },
];

const TIPS_GOOD = [
  "현재 겪는 문제 상황을 문장으로 적어주세요",
  "산업, 고객, 목표, 제약 조건을 함께 적으면 더 좋아요",
  "내 상황에 적용하기는 역할과 원하는 방향까지 적어주세요",
];

const TIPS_BAD = [
  "단어 하나만 입력하면 추천 맥락이 부족할 수 있어요",
  "기업명만 입력하면 원하는 문제 상황을 파악하기 어려워요",
  "너무 넓은 주제는 구체적인 고민으로 좁혀주세요",
];

const FAQS = [
  {
    q: "어떤 케이스가 포함되어 있나요?",
    a: "DBR(동아비즈니스리뷰) 2021–2026년 케이스 스터디와 관련 아티클을 바탕으로 탐색할 수 있어요.",
  },
  {
    q: "관련 케이스 찾기와 내 상황에 적용하기는 뭐가 다른가요?",
    a: "관련 케이스 찾기는 비슷한 DBR 사례를 빠르게 찾는 기능이고, 내 상황에 적용하기는 직무와 제약 조건까지 반영해 실행 방향을 함께 정리해주는 기능이에요.",
  },
  {
    q: "케이스맵은 어떻게 활용하면 좋나요?",
    a: "추천 TOP5뿐 아니라 관련 후보 케이스까지 함께 볼 수 있어요. 점을 눌러가며 비슷한 문제와 해결 전략을 넓게 탐색해보면 좋아요.",
  },
  {
    q: "최근 본 케이스는 어디에서 다시 볼 수 있나요?",
    a: "히스토리에서 검색어별로 다시 확인할 수 있어요. 당시 봤던 케이스의 문제 상황, 해결 전략, 추천 이유, 맞춤 전략도 함께 복기할 수 있어요.",
  },
];

export default function AboutPage({ onStart }) {
  const [btnHover, setBtnHover] = useState(false);

  return (
    <div style={styles.page}>

      {/* 서비스 소개 */}
      <div style={styles.section}>
        <div style={styles.label}>서비스 소개</div>
        <div style={{ ...styles.title, fontSize: 34 }}>DBR Case Atlas란?</div>
        <p style={styles.desc}>
          바쁜 실무자를 위한 AI 기반 케이스 탐색 서비스예요. 지금 겪고 있는 비즈니스 고민을 자연어로 입력하면,<br/>
          DBR 아카이브 안에서 비슷한 문제와 해결 방식을 다룬 케이스와 적용 방향을 찾아드려요.
        </p>
      </div>

      {/* 사용 방법 */}
      <div style={styles.section}>
        <div style={styles.label}>사용 방법</div>
        <div style={styles.title}>이렇게 사용해보세요</div>
        <FlowDiagram />
      </div>

      {/* 핵심 기능 */}
      <div style={styles.section}>
        <div style={styles.label}>핵심 기능</div>
        <div style={styles.title}>이런 기능을 제공해요</div>
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
                <div style={styles.showcaseInputBadge}>{s.badge}</div>

                {s.type === "apply" ? (
                  <div style={styles.showcaseApplyBox}>
                    <span style={styles.showcaseApplyLabel}>역할</span>
                    <span>{s.role}</span>
                    <span style={styles.showcaseApplyLabel}>상황</span>
                    <span>{s.situation}</span>
                    <span style={styles.showcaseApplyLabel}>방향</span>
                    <span>{s.constraint}</span>
                  </div>
                ) : (
                  <div style={styles.showcaseInputText}>{s.input}</div>
                )}
              </div>

              <div style={styles.showcaseResult}>
                <div style={styles.showcaseResultBadge}>
                  {s.type === "apply" ? "맞춤 전략 방향" : "추천 방향"}
                </div>
                <div>
                  {s.cases.map((c, j) => (
                    <span key={j} style={styles.caseChip}>{c}</span>
                  ))}
                </div>
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
            <div style={styles.ctaTitle}>지금 고민과 비슷한 DBR 케이스를 찾아볼까요?</div>
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
