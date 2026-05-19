import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/**
 * DBR Case Atlas — DB 좌표 기반 탐색형 케이스 맵
 *
 * - DB t_case.x, t_case.y 좌표 사용
 * - 줌 / 드래그 탐색 가능
 * - 확대 상태에서 케이스 클릭해도 줌 유지
 * - plot 영역 밖 노드 clip 처리
 * - 추천 TOP5 별도 강조
 * - 호버 툴팁 표시
 * - 고정 배경 격자 + 의미 기준선 분리
 */

const PROBLEM_AXIS = [
  { key: "고객", value: 150 },
  { key: "성장", value: 380 },
  { key: "효율", value: 620 },
  { key: "혁신", value: 850 },
];

const STRATEGY_AXIS = [
  { key: "운영 효율화", short: "운영 효율화", value: 120 },
  { key: "제품·서비스 개선", short: "제품 개선", value: 270 },
  { key: "사용자 유지", short: "사용자 유지", value: 400 },
  { key: "수익화", short: "수익화", value: 530 },
  { key: "마케팅·브랜딩", short: "마케팅·브랜딩", value: 660 },
  { key: "플랫폼 활용", short: "플랫폼 활용", value: 800 },
  { key: "기술 도입", short: "기술 도입", value: 920 },
];

const PROBLEM_COLORS = {
  고객: "#2563EB",
  성장: "#16A34A",
  효율: "#F59E0B",
  혁신: "#9333EA",
  기타: "#9CA3AF",
};

function getProblemColor(probMain) {
  return PROBLEM_COLORS[probMain] || PROBLEM_COLORS.기타;
}

function findNearestLabel(value, axis) {
  if (!Number.isFinite(value)) return "-";

  let nearest = axis[0];

  axis.forEach((item) => {
    if (Math.abs(item.value - value) < Math.abs(nearest.value - value)) {
      nearest = item;
    }
  });

  return nearest?.key ?? "-";
}

function normalizeCase(item, index) {
  const id = item.case_idx ?? item.id ?? index + 1;

  const rawX = Number(item.x);
  const rawY = Number(item.y);

  return {
    ...item,
    id,
    case_idx: item.case_idx ?? id,
    title: item.title || "제목 없음",
    company: item.company || item.comp_name || "-",
    industry: item.industry || "-",
    prob_main: item.prob_main || "기타",
    prob_keyword: item.prob_keyword || "",
    prob_def: item.prob_def || "",
    sol_type: item.sol_type || "기타",
    sol_detail: item.sol_detail || "",
    perf_type: item.perf_type || "",
    perf_dir: item.perf_dir || "",
    summary: item.summary || "",
    similarity: item.similarity ?? null,
    rank: item.rank ?? null,
    isRecommended: item.isRecommended ?? false,

    mapX: Number.isFinite(rawX) ? rawX : 500,
    mapY: Number.isFinite(rawY) ? rawY : 500,
  };
}

export default function CaseMap({
  cases = [],
  highlightedIds = [],
  onCaseClick,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);
  const currentTransformRef = useRef(d3.zoomIdentity);
  const onCaseClickRef = useRef(onCaseClick);

  const [hoveredCase, setHoveredCase] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentArea, setCurrentArea] = useState({
    problem: "중앙",
    strategy: "중앙",
  });
  const [dimensions, setDimensions] = useState({ width: 820, height: 540 });

  useEffect(() => {
    onCaseClickRef.current = onCaseClick;
  }, [onCaseClick]);

  const mappedCases = useMemo(() => {
    return cases.map((item, index) => normalizeCase(item, index));
  }, [cases]);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;

      setDimensions({
        width,
        height: Math.min(580, Math.max(430, width * 0.7)),
      });
    });

    if (containerRef.current) obs.observe(containerRef.current);

    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const { width, height } = dimensions;

    const margin = {
      top: 28,
      right: 28,
      bottom: 58,
      left: 82,
    };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const xScale = d3.scaleLinear().domain([0, 1000]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1000]).range([innerH, 0]);

    const root = svg.append("g");

    const clipId = `case-map-clip-${Math.random().toString(36).slice(2)}`;

    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", innerW)
      .attr("height", innerH);

    const axisLayer = root
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const viewport = root
      .append("g")
      .attr("clip-path", `url(#${clipId})`);

    const mapLayer = viewport
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    axisLayer
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "#fafafa");

    // 고정 배경 격자: 줌 75%에서도 화면 전체에 남아 있음
    for (let x = 100; x <= 900; x += 100) {
      axisLayer
        .append("line")
        .attr("x1", xScale(x))
        .attr("y1", 0)
        .attr("x2", xScale(x))
        .attr("y2", innerH)
        .attr("stroke", "#f0f0f0")
        .attr("stroke-width", 0.5);
    }

    for (let y = 100; y <= 900; y += 100) {
      axisLayer
        .append("line")
        .attr("x1", 0)
        .attr("y1", yScale(y))
        .attr("x2", innerW)
        .attr("y2", yScale(y))
        .attr("stroke", "#f0f0f0")
        .attr("stroke-width", 0.5);
    }

    // 줌/드래그용 배경 rect. 노드보다 먼저 그려서 hover 방해 안 함.
    mapLayer
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    // 고정 X축
    axisLayer
      .append("line")
      .attr("x1", 0)
      .attr("y1", innerH)
      .attr("x2", innerW)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    // 고정 Y축
    axisLayer
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    // X축 라벨
    PROBLEM_AXIS.forEach((item) => {
      axisLayer
        .append("text")
        .attr("x", xScale(item.value))
        .attr("y", innerH + 24)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 700)
        .attr("fill", getProblemColor(item.key))
        .text(item.key);
    });

    // Y축 라벨: 전체 분류를 작고 자연스럽게 배치
    STRATEGY_AXIS.forEach((item) => {
      axisLayer
        .append("line")
        .attr("x1", -5)
        .attr("y1", yScale(item.value))
        .attr("x2", 0)
        .attr("y2", yScale(item.value))
        .attr("stroke", "#cfcfcf")
        .attr("stroke-width", 0.8);

      axisLayer
        .append("text")
        .attr("x", -12)
        .attr("y", yScale(item.value) + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 10)
        .attr("font-weight", 500)
        .attr("fill", "#666")
        .text(item.short);
    });

    axisLayer
      .append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 48)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#aaa")
      .text("X축: 문제 유형");

    axisLayer
      .append("text")
      .attr("transform", `translate(${-62}, ${innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("fill", "#aaa")
      .text("Y축: 전략 유형");

    // 줌 대상 내부 의미 기준선
    const guideLayer = mapLayer.append("g");

    PROBLEM_AXIS.forEach((item) => {
      guideLayer
        .append("line")
        .attr("x1", xScale(item.value))
        .attr("y1", 0)
        .attr("x2", xScale(item.value))
        .attr("y2", innerH)
        .attr("stroke", "#e1e1e1")
        .attr("stroke-width", 0.9)
        .attr("stroke-dasharray", "3,5");
    });

    STRATEGY_AXIS.forEach((item) => {
      guideLayer
        .append("line")
        .attr("x1", 0)
        .attr("y1", yScale(item.value))
        .attr("x2", innerW)
        .attr("y2", yScale(item.value))
        .attr("stroke", "#eaeaea")
        .attr("stroke-width", 0.7)
        .attr("stroke-dasharray", "3,5");
    });

    const nodeLayer = mapLayer.append("g");

    const highlightedIdSet = new Set(highlightedIds.map(String));

    const isRecommended = (item) => {
      return (
        item.isRecommended === true ||
        highlightedIdSet.has(String(item.id)) ||
        highlightedIdSet.has(String(item.case_idx)) ||
        item.similarity !== null
      );
    };

    const getTopRank = (item) => {
      const ownRank = Number(item.rank);

      if (Number.isFinite(ownRank) && ownRank >= 1 && ownRank <= 5) {
        return ownRank;
      }

      const id = String(item.id);
      const caseIdx = String(item.case_idx);

      const indexById = highlightedIds.map(String).findIndex(
        (target) => target === id || target === caseIdx
      );

      if (indexById >= 0 && indexById < 5) {
        return indexById + 1;
      }

      return null;
    };

    const resetNodeStyles = () => {
      nodeLayer
        .selectAll(".case-node")
        .attr("r", (d) => (isRecommended(d) ? 7.5 : 5.5))
        .attr("fill-opacity", (d) => (isRecommended(d) ? 0.96 : 0.62));
    };

    const recommendedCases = mappedCases.filter(isRecommended);

    const recommendedNodes = nodeLayer
      .selectAll(".recommend-ring")
      .data(recommendedCases)
      .enter()
      .append("g")
      .attr("class", "recommend-ring")
      .attr("transform", (d) => `translate(${xScale(d.mapX)},${yScale(d.mapY)})`);

    // TOP5 외곽 링
    recommendedNodes
      .append("circle")
      .attr("r", 15)
      .attr("fill", "none")
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.88)
      .style("pointer-events", "none");

    // TOP 번호 배지
    recommendedNodes
      .filter((d) => getTopRank(d) !== null)
      .append("circle")
      .attr("cx", 0)
      .attr("cy", -20)
      .attr("r", 9)
      .attr("fill", "#ffffff")
      .attr("stroke", "#111827")
      .attr("stroke-width", 1.2)
      .style("pointer-events", "none");

    recommendedNodes
      .filter((d) => getTopRank(d) !== null)
      .append("text")
      .attr("y", -16.5)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-weight", 800)
      .attr("fill", "#111827")
      .text((d) => getTopRank(d))
      .style("pointer-events", "none");

    // 전체 노드
    nodeLayer
      .selectAll(".case-node")
      .data(mappedCases)
      .enter()
      .append("circle")
      .attr("class", "case-node")
      .attr("cx", (d) => xScale(d.mapX))
      .attr("cy", (d) => yScale(d.mapY))
      .attr("r", (d) => (isRecommended(d) ? 7.5 : 5.5))
      .attr("fill", (d) => getProblemColor(d.prob_main))
      .attr("fill-opacity", (d) => (isRecommended(d) ? 0.96 : 0.62))
      .attr("stroke", (d) => (isRecommended(d) ? "#ffffff" : "none"))
      .attr("stroke-width", (d) => (isRecommended(d) ? 1.5 : 0))
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        resetNodeStyles();
        setHoveredCase(d);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();

          setTooltipPos({
            x: event.clientX - rect.left + 14,
            y: event.clientY - rect.top + 14,
          });
        }

        d3.select(this)
          .raise()
          .attr("r", isRecommended(d) ? 10.5 : 8)
          .attr("fill-opacity", 1);
      })
      .on("mousemove", function (event, d) {
        setHoveredCase(d);

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();

          setTooltipPos({
            x: event.clientX - rect.left + 14,
            y: event.clientY - rect.top + 14,
          });
        }
      })
      .on("mouseleave", function () {
        setHoveredCase(null);
        resetNodeStyles();
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        onCaseClickRef.current?.(d);
      });

    svg.on("mouseleave", () => {
      setHoveredCase(null);
      resetNodeStyles();
    });

    const updateCurrentArea = (transform) => {
      const centerX = xScale.invert((innerW / 2 - transform.x) / transform.k);
      const centerY = yScale.invert((innerH / 2 - transform.y) / transform.k);

      setCurrentArea({
        problem: findNearestLabel(centerX, PROBLEM_AXIS),
        strategy: findNearestLabel(centerY, STRATEGY_AXIS),
      });
    };

    const zoom = d3.zoom()
      .scaleExtent([0.75, 8])
      .translateExtent([
        [-innerW * 0.9, -innerH * 0.9],
        [innerW * 1.9, innerH * 1.9],
      ])
      .on("start", () => {
        mapLayer.select("rect").style("cursor", "grabbing");
      })
      .on("zoom", (event) => {
        currentTransformRef.current = event.transform;

        mapLayer.attr(
          "transform",
          `translate(${margin.left},${margin.top}) ${event.transform}`
        );

        setZoomLevel(Math.round(event.transform.k * 100));
        updateCurrentArea(event.transform);
      })
      .on("end", () => {
        mapLayer.select("rect").style("cursor", "grab");
      });

    zoomRef.current = zoom;

    svg.call(zoom);
    svg.call(zoom.transform, currentTransformRef.current);

  }, [mappedCases, highlightedIds, dimensions]);

  const doZoom = useCallback((factor) => {
    if (!svgRef.current || !zoomRef.current) return;

    const svg = d3.select(svgRef.current);

    svg
      .transition()
      .duration(220)
      .call(zoomRef.current.scaleBy, factor);
  }, []);

  const doReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;

    currentTransformRef.current = d3.zoomIdentity;

    const svg = d3.select(svgRef.current);

    svg
      .transition()
      .duration(260)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.headerLabel}>DBR Case Atlas</p>
          <h2 style={styles.headerTitle}>케이스 맵</h2>
        </div>
      </div>

      <div ref={containerRef} style={styles.mapContainer}>
        <svg ref={svgRef} style={{ display: "block", width: "100%" }} />

        {mappedCases.length === 0 && (
          <div style={styles.emptyText}>케이스 데이터를 불러오는 중입니다.</div>
        )}

        <div style={styles.areaBadge}>
          <span style={styles.areaLabel}>현재 영역</span>
          <strong style={styles.areaValue}>
            {currentArea.problem} × {currentArea.strategy}
          </strong>
        </div>

        {hoveredCase && (
          <div
            style={{
              ...styles.tooltip,
              left: tooltipPos.x,
              top: tooltipPos.y,
            }}
          >
            {hoveredCase.rank && Number(hoveredCase.rank) <= 5 && (
              <p style={styles.tooltipRank}>추천 TOP {hoveredCase.rank}</p>
            )}

            <p style={styles.tooltipTitle}>{hoveredCase.title}</p>

            <p style={styles.tooltipSub}>
              {hoveredCase.company} · {hoveredCase.industry}
            </p>

            <p style={styles.tooltipSub}>
              {hoveredCase.prob_main}
              {hoveredCase.prob_keyword ? ` / ${hoveredCase.prob_keyword}` : ""}
            </p>

            <p style={styles.tooltipSub}>
              {hoveredCase.sol_type}
            </p>

            {hoveredCase.similarity !== null && hoveredCase.similarity !== undefined && (
              <p style={styles.tooltipSimilarity}>
                유사도 {hoveredCase.similarity}%
              </p>
            )}
          </div>
        )}

        <div style={styles.zoomControls}>
          <button style={styles.zoomBtn} onClick={() => doZoom(1.3)}>+</button>
          <span style={styles.zoomLevel}>{zoomLevel}%</span>
          <button style={styles.zoomBtn} onClick={() => doZoom(0.77)}>−</button>
          <div style={{ height: 1, background: "#ececec", width: "100%" }} />
          <button style={{ ...styles.zoomBtn, fontSize: 12 }} onClick={doReset}>↺</button>
        </div>

        <div style={styles.zoomHint}>
          드래그로 이동 · 휠로 확대/축소
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    padding: "0.5rem 0",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "1rem",
  },
  headerLabel: {
    fontSize: 15,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#999",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: 600,
    color: "#1a1a1a",
  },
  mapContainer: {
    position: "relative",
    background: "#fafafa",
    border: "0.5px solid #e0e0e0",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: "1rem",
    minHeight: 430,
  },
  emptyText: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: 14,
    color: "#999",
  },
  areaBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "rgba(255,255,255,0.92)",
    border: "0.5px solid #e0e0e0",
    borderRadius: 8,
    padding: "8px 11px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    zIndex: 20,
    pointerEvents: "none",
  },
  areaLabel: {
    display: "block",
    fontSize: 10,
    color: "#aaa",
    marginBottom: 2,
  },
  areaValue: {
    display: "block",
    fontSize: 12,
    color: "#333",
    fontWeight: 700,
  },
  tooltip: {
    position: "absolute",
    maxWidth: 320,
    background: "#fff",
    border: "0.5px solid #e0e0e0",
    borderRadius: 8,
    padding: "9px 12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    pointerEvents: "none",
    zIndex: 30,
  },
  tooltipRank: {
    fontSize: 11,
    fontWeight: 700,
    color: "#E86F00",
    marginBottom: 4,
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1a1a",
    lineHeight: 1.4,
    marginBottom: 3,
  },
  tooltipSub: {
    fontSize: 11,
    color: "#888",
    lineHeight: 1.5,
  },
  tooltipSimilarity: {
    fontSize: 11,
    color: "#E86F00",
    fontWeight: 600,
    marginTop: 4,
  },
  zoomControls: {
    position: "absolute",
    right: 14,
    bottom: 14,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    background: "#fff",
    border: "0.5px solid #e0e0e0",
    borderRadius: 8,
    padding: "6px 8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    zIndex: 20,
  },
  zoomBtn: {
    width: 24,
    height: 24,
    border: "none",
    background: "transparent",
    color: "#444",
    fontSize: 15,
    cursor: "pointer",
    borderRadius: 4,
    lineHeight: 1,
  },
  zoomLevel: {
    fontSize: 10,
    color: "#aaa",
  },
  zoomHint: {
    position: "absolute",
    left: 14,
    bottom: 12,
    fontSize: 10,
    color: "#bbb",
    pointerEvents: "none",
  },
};