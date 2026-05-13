import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/**
 * CaseMap.jsx
 * DBR Case Atlas — 2D 케이스 클러스터 맵 (D3.js)
 *
 * Props:
 *   cases: Array<CaseNode>     — UMAP 좌표 + 메타데이터 포함된 케이스 배열
 *   highlightedIds: string[]   — 검색 결과로 하이라이팅할 케이스 ID 목록
 *   onCaseClick: (case) => void
 *
 * CaseNode shape:
 * {
 *   id: string,
 *   title: string,
 *   company: string,
 *   industry: string,
 *   similarity: number,     // 0~100
 *   x: number,              // UMAP 결과 좌표 (0~1 정규화)
 *   y: number,
 *   cluster: number,        // HDBSCAN 클러스터 ID (-1 = noise)
 *   clusterLabel: string,
 * }
 *
 * 의존성: npm install d3
 */

// ── 클러스터 설정 ──────────────────────────────────────────────────────────────
const CLUSTER_LABELS = {
  0: "고객 확보 · 전환",
  1: "수익성 · 원가",
  2: "신사업 · 피보팅",
  3: "브랜드 · 마케팅",
  4: "조직 · 실행력",
  5: "디지털 전환",
};

const CLUSTER_COLORS = {
  0: "#E85A1B",
  1: "#C44D17",
  2: "#A84013",
  3: "#8C340F",
  4: "#F07A45",
  5: "#F59B72",
  "-1": "#ccc",
};

// ── 더미 데이터 (BE 연동 전 개발용) ──────────────────────────────────────────
function generateDummyCases() {
  const clusterCenters = [
    { cx: 0.15, cy: 0.75 },
    { cx: 0.72, cy: 0.68 },
    { cx: 0.25, cy: 0.28 },
    { cx: 0.78, cy: 0.22 },
    { cx: 0.50, cy: 0.50 },
    { cx: 0.88, cy: 0.50 },
  ];
  const companies = [
    ["쿠팡", "이커머스"], ["배달의민족", "푸드테크"], ["카카오", "플랫폼"],
    ["현대자동차", "제조"], ["삼성전자", "전자"], ["네이버", "IT"],
    ["LG화학", "화학"], ["토스", "핀테크"], ["마켓컬리", "이커머스"],
    ["당근마켓", "플랫폼"], ["무신사", "패션"], ["야놀자", "여행"],
    ["크래프톤", "게임"], ["카카오뱅크", "금융"], ["셀트리온", "바이오"],
    ["스타벅스코리아", "F&B"], ["올리브영", "리테일"], ["CJ제일제당", "식품"],
    ["롯데ON", "이커머스"], ["쏘카", "모빌리티"],
    ["애플", "IT"], ["아마존", "이커머스"], ["테슬라", "모빌리티"],
    ["넷플릭스", "미디어"], ["에어비앤비", "여행"],
  ];
  const titleTemplates = [
    (c) => `${c}의 고객 경험 혁신과 재구매율 제고 전략`,
    (c) => `${c}의 수익성 개선을 위한 원가 구조 재설계`,
    (c) => `${c}의 신사업 진입과 비즈니스 모델 피보팅`,
    (c) => `${c}의 브랜드 포지셔닝과 퍼포먼스 마케팅`,
    (c) => `${c}의 조직 실행력 강화와 애자일 전환`,
    (c) => `${c}의 디지털 전환과 데이터 기반 의사결정`,
  ];
  return Array.from({ length: 96 }, (_, i) => {
    const cluster = i % 6 === 5 && Math.random() < 0.05 ? -1 : i % 6;
    const center = clusterCenters[cluster === -1 ? 0 : cluster];
    const spread = 0.12;
    const [company, industry] = companies[i % companies.length];
    return {
      id: `case-${i + 1}`,
      title: titleTemplates[cluster === -1 ? 0 : cluster](company),
      company,
      industry,
      similarity: Math.floor(Math.random() * 35) + 60,
      x: Math.min(0.97, Math.max(0.03, center.cx + (Math.random() - 0.5) * spread * 2)),
      y: Math.min(0.97, Math.max(0.03, center.cy + (Math.random() - 0.5) * spread * 2)),
      cluster,
      clusterLabel: CLUSTER_LABELS[cluster] ?? "기타",
    };
  });
}

const DUMMY_CASES = generateDummyCases();
const DUMMY_HIGHLIGHTED = DUMMY_CASES.slice(0, 5).map((c) => c.id);

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function CaseMap({
  cases = DUMMY_CASES,
  highlightedIds = DUMMY_HIGHLIGHTED,
  onCaseClick,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);
  const [hoveredCase, setHoveredCase] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 520 });

  // 반응형 사이즈
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.min(520, Math.max(360, width * 0.65)) });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // D3 렌더링
  useEffect(() => {
    if (!svgRef.current || !cases.length) return;
    const { width, height } = dimensions;
    const margin = { top: 28, right: 28, bottom: 28, left: 28 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // 줌
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        const k = event.transform.k;
        setZoomLevel(Math.round(k * 10) / 10);
        g.selectAll(".node-label").style("opacity", k > 2.5 ? Math.min(1, (k - 2.5) / 0.8) : 0);
        g.selectAll(".cluster-label").style("opacity", k < 2.8 ? 1 : Math.max(0, 1 - (k - 2.8)));
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    // 그리드
    [0.25, 0.5, 0.75].forEach((v) => {
      g.append("line")
        .attr("x1", xScale(v)).attr("x2", xScale(v))
        .attr("y1", 0).attr("y2", innerH)
        .attr("stroke", "#ebebeb").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,5");
      g.append("line")
        .attr("x1", 0).attr("x2", innerW)
        .attr("y1", yScale(v)).attr("y2", yScale(v))
        .attr("stroke", "#ebebeb").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,5");
    });

    // 클러스터 배경 타원
    const clusterGroups = d3.group(cases.filter((c) => c.cluster !== -1), (c) => c.cluster);
    clusterGroups.forEach((nodes, clusterId) => {
      const xs = nodes.map((n) => xScale(n.x));
      const ys = nodes.map((n) => yScale(n.y));
      const cx = d3.mean(xs);
      const cy = d3.mean(ys);
      const rx = Math.max((d3.max(xs) - d3.min(xs)) / 2 + 22, 30);
      const ry = Math.max((d3.max(ys) - d3.min(ys)) / 2 + 22, 30);
      const color = CLUSTER_COLORS[clusterId] ?? "#888";

      g.append("ellipse")
        .attr("cx", cx).attr("cy", cy)
        .attr("rx", rx).attr("ry", ry)
        .attr("fill", color).attr("fill-opacity", 0.055)
        .attr("stroke", color).attr("stroke-width", 0.8).attr("stroke-opacity", 0.18)
        .attr("stroke-dasharray", "4,4");
    });

    // 클러스터 레이블
    clusterGroups.forEach((nodes, clusterId) => {
      const xs = nodes.map((n) => xScale(n.x));
      const ys = nodes.map((n) => yScale(n.y));
      const color = CLUSTER_COLORS[clusterId] ?? "#888";
      g.append("text")
        .attr("class", "cluster-label")
        .attr("x", d3.mean(xs))
        .attr("y", d3.min(ys) - 16)
        .attr("text-anchor", "middle")
        .attr("font-size", 10).attr("font-weight", 500)
        .attr("fill", color).attr("fill-opacity", 0.65)
        .attr("letter-spacing", "0.04em")
        .text(CLUSTER_LABELS[clusterId] ?? "")
        .style("pointer-events", "none");
    });

    // 하이라이트 노드 연결선
    const highlighted = cases.filter((c) => highlightedIds.includes(c.id));
    if (highlighted.length > 1) {
      g.append("path")
        .datum(highlighted)
        .attr("d", d3.line()
          .x((d) => xScale(d.x))
          .y((d) => yScale(d.y))
          .curve(d3.curveCatmullRom.alpha(0.5))
        )
        .attr("fill", "none")
        .attr("stroke", "#378ADD")
        .attr("stroke-width", 0.7)
        .attr("stroke-opacity", 0.22)
        .attr("stroke-dasharray", "3,5");
    }

    // 노드
    const isHighlighted = (d) => highlightedIds.includes(d.id);

    const nodeG = g.selectAll(".node")
      .data(cases)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${xScale(d.x)},${yScale(d.y)})`)
      .style("cursor", "pointer")
      .on("mouseenter", function (_, d) {
        setHoveredCase(d);
        d3.select(this).select(".node-circle")
          .transition().duration(100)
          .attr("r", isHighlighted(d) ? 11 : 7)
          .attr("fill-opacity", 1);
      })
      .on("mouseleave", function (_, d) {
        setHoveredCase(null);
        d3.select(this).select(".node-circle")
          .transition().duration(100)
          .attr("r", isHighlighted(d) ? 8 : 5)
          .attr("fill-opacity", isHighlighted(d) ? 0.92 : 0.45);
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        onCaseClick?.(d);
      });

    // 하이라이트 링
    nodeG.filter(isHighlighted)
      .append("circle")
      .attr("r", 14)
      .attr("fill", "none")
      .attr("stroke", (d) => CLUSTER_COLORS[d.cluster] ?? "#888")
      .attr("stroke-width", 0.8)
      .attr("stroke-opacity", 0.35);

    // 노드 원
    nodeG.append("circle")
      .attr("class", "node-circle")
      .attr("r", (d) => isHighlighted(d) ? 8 : 5)
      .attr("fill", (d) => CLUSTER_COLORS[d.cluster] ?? "#888")
      .attr("fill-opacity", (d) => isHighlighted(d) ? 0.92 : 0.45)
      .attr("stroke", (d) => isHighlighted(d) ? "#fff" : "none")
      .attr("stroke-width", 1.5);

    // 노드 레이블 (줌인 시)
    nodeG.append("text")
      .attr("class", "node-label")
      .attr("y", -11)
      .attr("text-anchor", "middle")
      .attr("font-size", 7.5)
      .attr("fill", "#444")
      .text((d) => d.company)
      .style("opacity", 0)
      .style("pointer-events", "none");

  }, [cases, highlightedIds, dimensions]);

  // 줌 버튼 핸들러
  const doZoom = useCallback((factor) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const current = d3.zoomTransform(svgRef.current);
    const next = Math.min(8, Math.max(0.5, current.k * factor));
    svg.transition().duration(260).call(
      zoomRef.current.transform,
      current.scale(next / current.k)
    );
  }, []);

  const doReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current)
      .transition().duration(380)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  return (
    <div style={styles.wrapper}>

      {/* 헤더 */}
      <div style={styles.header}>
        <div>
          <p style={styles.headerLabel}>DBR Case Atlas</p>
          <h2 style={styles.headerTitle}>케이스 맵</h2>
        </div>
      </div>

      {/* 맵 */}
      <div ref={containerRef} style={styles.mapContainer}>
        <svg ref={svgRef} style={{ display: "block", width: "100%" }} />

        {/* 줌 컨트롤 */}
        <div style={styles.zoomControls}>
          <button style={styles.zoomBtn} onClick={() => doZoom(1.4)}>+</button>
          <span style={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
          <button style={styles.zoomBtn} onClick={() => doZoom(1 / 1.4)}>−</button>
          <div style={{ height: 1, background: "#e8e8e8", margin: "2px 0" }} />
          <button style={{ ...styles.zoomBtn, fontSize: 12 }} onClick={doReset}>↺</button>
        </div>

      </div>

    </div>
  );
}

// ── 슬라이드인 패널 ───────────────────────────────────────────────────────────
function SlidePanel({ caseData, isHighlighted, onClose }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHeader}>
        <div style={{ flex: 1 }}>
          <p style={styles.panelCompany}>{caseData.company}</p>
          <p style={styles.panelIndustry}>{caseData.industry} · {caseData.clusterLabel}</p>
        </div>
        <button style={styles.panelClose} onClick={onClose}>✕</button>
      </div>

      <p style={styles.panelTitle}>{caseData.title}</p>

      {isHighlighted && (
        <div style={styles.similarityBar}>
          <div style={styles.similarityLabel}>
            <span>유사도</span>
            <span style={{ color: "#e85a18", fontWeight: 500 }}>{caseData.similarity}%</span>
          </div>
          <div style={styles.similarityTrack}>
            <div style={{ ...styles.similarityFill, width: `${caseData.similarity}%` }} />
          </div>
        </div>
      )}

      <div style={styles.panelMeta}>
        {[
          ["클러스터", caseData.clusterLabel],
          ["산업", caseData.industry],
          ["기업", caseData.company],
        ].map(([k, v]) => (
          <div key={k} style={styles.metaRow}>
            <span style={styles.metaKey}>{k}</span>
            <span style={styles.metaVal}>{v}</span>
          </div>
        ))}
      </div>

      <button style={styles.panelCta}>DBR 아티클 보기 →</button>
    </div>
  );
}


// ── 스타일 ────────────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    padding: "0.5rem 1.5rem",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "1rem",
    flexWrap: "wrap",
    gap: 12,
  },
  headerLabel: { fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", marginBottom: 2 },
  headerTitle: { fontSize: 25, fontWeight: 500, color: "#1a1a1a" },
  legend: { display: "flex", flexWrap: "wrap", gap: "6px 14px", maxWidth: 460 },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: "50%", opacity: 0.85 },
  legendText: { fontSize: 11, color: "#666" },
  mapContainer: {
    position: "relative",
    background: "#fafafa",
    border: "0.5px solid #e0e0e0",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: "1rem",
  },
  tooltip: {
    position: "absolute", top: 14, left: 14,
    background: "#fff", border: "0.5px solid #e0e0e0",
    borderRadius: 8, padding: "8px 12px", pointerEvents: "none",
  },
  tooltipTitle: { fontSize: 13, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 },
  tooltipSub: { fontSize: 11, color: "#999" },
  tooltipSimilarity: { fontSize: 11, color: "#e85a18", marginTop: 4, fontWeight: 500 },
  zoomControls: {
    position: "absolute", bottom: 14, right: 14,
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 8, padding: "6px 8px",
  },
  zoomBtn: {
    width: 24, height: 24, fontSize: 15, fontWeight: 400,
    color: "#444", background: "transparent", border: "none", cursor: "pointer",
    lineHeight: 1, borderRadius: 4,
  },
  zoomLevel: { fontSize: 10, color: "#aaa" },
  zoomHint: {
    position: "absolute", bottom: 10, left: 14,
    fontSize: 10, color: "#c0c0c0", pointerEvents: "none",
  },
  highlightList: {
    background: "#fff", border: "0.5px solid #e0e0e0",
    borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem",
  },
  highlightListLabel: {
    fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "#999", marginBottom: 10,
  },
  highlightItems: { display: "flex", flexWrap: "wrap", gap: 6 },
  highlightItem: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "5px 10px", fontSize: 12,
    border: "0.5px solid #e8e8e8", borderRadius: 20,
    cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.12s, border-color 0.12s",
  },
  highlightItemTitle: { color: "#1a1a1a" },
  highlightItemScore: { color: "#e85a18", fontWeight: 500 },
  panel: {
    position: "fixed", top: 0, right: 0, width: 320, height: "100vh",
    background: "#fff", borderLeft: "0.5px solid #e0e0e0",
    padding: "1.5rem", overflowY: "auto", zIndex: 100, boxSizing: "border-box",
  },
  panelHeader: { display: "flex", alignItems: "flex-start", marginBottom: "1rem" },
  panelCompany: { fontSize: 15, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 },
  panelIndustry: { fontSize: 11, color: "#999" },
  panelClose: { background: "none", border: "none", fontSize: 14, color: "#999", cursor: "pointer", padding: 4 },
  panelTitle: { fontSize: 13, color: "#333", lineHeight: 1.65, marginBottom: "1.25rem" },
  similarityBar: { marginBottom: "1.25rem" },
  similarityLabel: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999", marginBottom: 5 },
  similarityTrack: { height: 4, background: "#f0f0f0", borderRadius: 2, overflow: "hidden" },
  similarityFill: { height: "100%", background: "#e85a18", borderRadius: 2, transition: "width 0.4s ease" },
  panelMeta: { borderTop: "0.5px solid #f0f0f0", paddingTop: "1rem", marginBottom: "1.25rem" },
  metaRow: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "0.5px solid #f5f5f5" },
  metaKey: { color: "#999" },
  metaVal: { color: "#1a1a1a", fontWeight: 500 },
  panelCta: {
    width: "100%", padding: "10px", fontSize: 13, fontWeight: 500,
    color: "#e85a18", background: "#fef0e9", border: "none",
    borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
  },
};
