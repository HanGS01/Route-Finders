import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/**
 * DBR Case Atlas — CaseMap
 *
 * 1) 기존 산점도: DB에 저장된 x, y 좌표 사용
 * 2) 검색 결과 맵: 추천 API가 내려준 dynamic_x, dynamic_y 좌표 사용
 *
 * 핵심 원칙:
 * - 기존 x/y는 건드리지 않는다.
 * - 검색 결과 맵은 고정 X/Y축이 아니라 “현재 검색어 기준 유사도 맵”이다.
 * - 두 모드 모두 줌/드래그를 지원한다.
 * - 케이스 클릭 시 기존 상세 패널(onCaseClick)과 연동한다.
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

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function truncateText(text, maxLength = 18) {
  const value = String(text || "-");
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function getDynamicDisplayCoord(value, expandRatio = 1.82) {
  const num = toFiniteNumber(value);
  if (num === null) return null;

  // 검색 결과 맵은 전체 후보를 한 화면에 억지로 압축하지 않는다.
  // 중심(500, 500)을 기준으로 좌표 공간을 넓혀 TOP5~10이 여유 있게 보이도록 한다.
  return 500 + (num - 500) * expandRatio;
}

function getLabelDirection(x, y, centerX, centerY) {
  const dx = x - centerX;
  const dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  return { ux: dx / distance, uy: dy / distance };
}

function clampLabel(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getMapScore(item) {
  const rawScore = toFiniteNumber(item.final_score ?? item.finalScore);
  if (rawScore !== null) {
    return rawScore > 1 ? rawScore / 100 : rawScore;
  }

  const similarity = toFiniteNumber(item.similarity);
  if (similarity !== null) {
    return similarity > 1 ? similarity / 100 : similarity;
  }

  return null;
}

function getStableFallbackAngle(item, index) {
  const seed = Number(item.case_idx ?? item.id ?? index + 1);
  const safeSeed = Number.isFinite(seed) ? seed : index + 1;
  return ((safeSeed * 137.508) % 360) * (Math.PI / 180);
}

function getDynamicAngle(item, index) {
  const rawAngle = toFiniteNumber(item.map_angle ?? item.mapAngle);

  if (rawAngle !== null) {
    return Math.abs(rawAngle) > Math.PI * 2 ? rawAngle * (Math.PI / 180) : rawAngle;
  }

  const sourceX = toFiniteNumber(item.rawDynamicX ?? item.dynamicX);
  const sourceY = toFiniteNumber(item.rawDynamicY ?? item.dynamicY);

  if (sourceX !== null && sourceY !== null) {
    const dx = sourceX - 500;
    const dy = sourceY - 500;

    if (Math.abs(dx) + Math.abs(dy) > 0.001) {
      return Math.atan2(dy, dx);
    }
  }

  return getStableFallbackAngle(item, index);
}

function getScoreTargetRadius(item) {
  const rank = toFiniteNumber(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
  const score = getMapScore(item);

  // 검색 결과 맵의 거리 기준.
  // TOP5는 순위가 직관적으로 보이도록 기본 반지름을 갖고,
  // final_score가 낮을수록 조금 더 바깥으로 밀어낸다.
  const clampedScore = score !== null ? clampLabel(score, 0.4, 1) : null;

  if (rank !== null && rank >= 1 && rank <= 5) {
    const rankBase = [190, 270, 355, 445, 540][rank - 1];

    if (clampedScore !== null) {
      const scoreRadius = 155 + Math.pow(1 - clampedScore, 1.05) * 780;
      return rankBase * 0.68 + scoreRadius * 0.32;
    }

    return rankBase;
  }

  if (clampedScore !== null) {
    // 72%와 60%처럼 점수 차이가 있는 후보가 같은 거리처럼 보이지 않도록
    // 기존보다 점수별 거리 차이를 조금 더 벌린다.
    return 175 + Math.pow(1 - clampedScore, 1.08) * 820;
  }

  return 620;
}

function getOriginalDynamicRadius(item) {
  const x = toFiniteNumber(item.dynamicX);
  const y = toFiniteNumber(item.dynamicY);

  if (x === null || y === null) return null;

  const dx = x - 500;
  const dy = y - 500;
  const radius = Math.sqrt(dx * dx + dy * dy);

  return Number.isFinite(radius) ? radius : null;
}

function getSoftScoreAlignedRadius(item) {
  const rank = toFiniteNumber(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
  const originalRadius = getOriginalDynamicRadius(item);
  const targetRadius = getScoreTargetRadius(item);

  if (originalRadius === null) return targetRadius;

  // TOP5는 사용자가 순위와 거리감을 가장 먼저 보기 때문에
  // 기존 좌표를 과하게 믿지 않고 목표 반지름 쪽으로 강하게 보정한다.
  const isTop5 = rank !== null && rank >= 1 && rank <= 5;

  if (isTop5) {
    return targetRadius * 0.82 + originalRadius * 0.18;
  }

  // 일반 후보는 너무 튀는 경우만 완화한다.
  const tolerance = 130;
  const minRadius = Math.max(120, targetRadius - tolerance);
  const maxRadius = Math.min(900, targetRadius + tolerance);

  return clampLabel(originalRadius, minRadius, maxRadius);
}

function alignDynamicCaseByScore(item, index) {
  const angle = getDynamicAngle(item, index);
  const radius = getSoftScoreAlignedRadius(item);

  return {
    ...item,
    dynamicX: 500 + Math.cos(angle) * radius,
    dynamicY: 500 + Math.sin(angle) * radius,
    map_distance: radius,
  };
}


function getReadableRank(item) {
  const rank = toFiniteNumber(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
  return rank;
}

function getMinimumNodeDistance(a, b) {
  const rankA = getReadableRank(a);
  const rankB = getReadableRank(b);
  const topA = rankA !== null && rankA >= 1 && rankA <= 5;
  const topB = rankB !== null && rankB >= 1 && rankB <= 5;
  const labelA = rankA !== null && rankA >= 1 && rankA <= 20;
  const labelB = rankB !== null && rankB >= 1 && rankB <= 20;

  if (topA && topB) return 168;
  if (topA || topB) return 138;
  if (labelA && labelB) return 112;
  if (labelA || labelB) return 88;
  return 58;
}

function spreadDynamicCasesForReadability(items) {
  // 검색 결과 맵은 모든 후보를 첫 화면에 압축하지 않는다.
  // 대신 TOP5~20 라벨이 읽히도록 점 사이 최소 간격만 결정적으로 보정한다.
  const nodes = items.map((item, index) => ({
    ...item,
    _spreadIndex: index,
    dynamicX: toFiniteNumber(item.dynamicX) ?? 500,
    dynamicY: toFiniteNumber(item.dynamicY) ?? 500,
  }));

  const getTieAngle = (a, b) => {
    const seedA = Number(a.case_idx ?? a.id ?? a._spreadIndex + 1);
    const seedB = Number(b.case_idx ?? b.id ?? b._spreadIndex + 1);
    const seed = (Number.isFinite(seedA) ? seedA : a._spreadIndex + 1) + (Number.isFinite(seedB) ? seedB : b._spreadIndex + 1) * 17;
    return ((seed * 137.508) % 360) * (Math.PI / 180);
  };

  for (let pass = 0; pass < 64; pass += 1) {
    let moved = false;

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const minDistance = getMinimumNodeDistance(a, b);
        let dx = b.dynamicX - a.dynamicX;
        let dy = b.dynamicY - a.dynamicY;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.001) {
          const angle = getTieAngle(a, b);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        if (distance >= minDistance) continue;

        const push = (minDistance - distance) * 0.66;
        const ux = dx / distance;
        const uy = dy / distance;

        const rankA = getReadableRank(a) ?? 999;
        const rankB = getReadableRank(b) ?? 999;
        const weightA = rankA <= 5 ? 0.42 : 0.58;
        const weightB = rankB <= 5 ? 0.42 : 0.58;
        const total = weightA + weightB;

        a.dynamicX -= ux * push * (weightA / total);
        a.dynamicY -= uy * push * (weightA / total);
        b.dynamicX += ux * push * (weightB / total);
        b.dynamicY += uy * push * (weightB / total);
        moved = true;
      }
    }

    nodes.forEach((node) => {
      const dx = node.dynamicX - 500;
      const dy = node.dynamicY - 500;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = 960;
      const minRadius = 110;

      if (radius > 0.001) {
        const rank = getReadableRank(node);
        const targetRadius = getScoreTargetRadius(node);
        const pullStrength = rank !== null && rank >= 1 && rank <= 5 ? 0.38 : 0.12;
        let nextRadius = radius * (1 - pullStrength) + targetRadius * pullStrength;
        nextRadius = clampLabel(nextRadius, minRadius, maxRadius);
        const ratio = nextRadius / radius;
        node.dynamicX = 500 + dx * ratio;
        node.dynamicY = 500 + dy * ratio;
      } else {
        const angle = getStableFallbackAngle(node, node._spreadIndex ?? 0);
        node.dynamicX = 500 + Math.cos(angle) * minRadius;
        node.dynamicY = 500 + Math.sin(angle) * minRadius;
      }
    });

    if (!moved) break;
  }

  // 마지막에 한 번 더 TOP5 반지름을 정리해서
  // TOP1보다 TOP3가 중심에 더 가까워 보이는 상황을 줄인다.
  nodes.forEach((node) => {
    const rank = getReadableRank(node);
    const dx = node.dynamicX - 500;
    const dy = node.dynamicY - 500;
    const radius = Math.sqrt(dx * dx + dy * dy);

    if (rank !== null && rank >= 1 && rank <= 5 && radius > 0.001) {
      const targetRadius = getScoreTargetRadius(node);
      const nextRadius = radius * 0.28 + targetRadius * 0.72;
      const ratio = nextRadius / radius;
      node.dynamicX = 500 + dx * ratio;
      node.dynamicY = 500 + dy * ratio;
    }
  });

  return nodes.map(({ _spreadIndex, ...item }) => item);
}

function normalizeCase(item, index) {
  const id = item.case_idx ?? item.id ?? index + 1;

  const rawX = toFiniteNumber(item.x);
  const rawY = toFiniteNumber(item.y);
  const rawDynamicX = toFiniteNumber(item.dynamic_x ?? item.dynamicX);
  const rawDynamicY = toFiniteNumber(item.dynamic_y ?? item.dynamicY);

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
    rank: item.rank ?? item.ranking ?? null,
    isRecommended: item.isRecommended ?? item.is_recommended ?? false,
    map_group: item.map_group || (item.isRecommended || item.is_recommended ? "recommended" : "candidate"),
    map_distance: item.map_distance ?? null,
    map_rank: item.map_rank ?? item.mapRank ?? null,
    map_angle: item.map_angle ?? item.mapAngle ?? null,

    mapX: rawX ?? 500,
    mapY: rawY ?? 500,
    dynamicX: getDynamicDisplayCoord(rawDynamicX),
    dynamicY: getDynamicDisplayCoord(rawDynamicY),
    rawDynamicX,
    rawDynamicY,
  };
}

export default function CaseMap({
  cases = [],
  mapCandidates = [],
  highlightedIds = [],
  focusCaseId = null,
  onCaseClick,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);
  const currentTransformRef = useRef({
    scatter: d3.zoomIdentity,
    dynamic: d3.zoomIdentity,
  });
  const onCaseClickRef = useRef(onCaseClick);
  const lastSelectRef = useRef({ key: "", time: 0 });

  const [viewMode, setViewMode] = useState("scatter");
  const [hoveredCase, setHoveredCase] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentArea, setCurrentArea] = useState({
    problem: "중앙",
    strategy: "중앙",
  });
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });

  useEffect(() => {
    onCaseClickRef.current = onCaseClick;
  }, [onCaseClick]);

  const notifyCaseSelect = useCallback((caseData) => {
    if (!caseData) return;

    const caseKey = String(caseData.case_idx ?? caseData.id ?? caseData.title ?? "");
    const now = Date.now();

    if (lastSelectRef.current.key === caseKey && now - lastSelectRef.current.time < 250) {
      return;
    }

    lastSelectRef.current = { key: caseKey, time: now };

    if (typeof onCaseClickRef.current === "function") {
      onCaseClickRef.current(caseData);
    }

    window.dispatchEvent(new CustomEvent("caseMapCaseSelect", { detail: caseData }));
  }, []);

  const scatterCases = useMemo(() => {
    return cases.map((item, index) => normalizeCase(item, index));
  }, [cases]);

  const dynamicCases = useMemo(() => {
    const source = mapCandidates.length > 0 ? mapCandidates : [];

    const normalized = source
      .map((item, index) => normalizeCase(item, index))
      .filter((item) => Number.isFinite(item.dynamicX) && Number.isFinite(item.dynamicY))
      .filter((item) => {
        const score = Number(item.final_score ?? item.finalScore ?? 0);
        return item.isRecommended || item.is_recommended || item.map_group === "recommended" || score >= 0.4;
      })
      .map((item, index) => alignDynamicCaseByScore(item, index));

    return spreadDynamicCasesForReadability(normalized);
  }, [mapCandidates]);

  const highlightedIdSet = useMemo(() => {
    return new Set(highlightedIds.map(String));
  }, [highlightedIds]);

  const isRecommended = useCallback(
    (item) => {
      return (
        item.isRecommended === true ||
        item.is_recommended === true ||
        item.map_group === "recommended" ||
        highlightedIdSet.has(String(item.id)) ||
        highlightedIdSet.has(String(item.case_idx)) ||
        (item.similarity !== null && item.similarity !== undefined)
      );
    },
    [highlightedIdSet]
  );

  const getTopRank = useCallback(
    (item) => {
      const ownRank = Number(item.rank ?? item.ranking);

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
    },
    [highlightedIds]
  );

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;

      setDimensions({
        width,
        height: 700,
      });
    });

    if (containerRef.current) obs.observe(containerRef.current);

    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    if (viewMode === "dynamic") {
      renderDynamicMap();
    } else {
      renderScatterMap();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, scatterCases, dynamicCases, highlightedIds, dimensions]);

  useEffect(() => {
    if (!focusCaseId || !svgRef.current || !zoomRef.current) return;

    const sourceCases = viewMode === "dynamic" ? dynamicCases : scatterCases;

    const targetCase = sourceCases.find((item) => {
      const itemId = String(item.id);
      const caseIdx = String(item.case_idx);

      return itemId === String(focusCaseId) || caseIdx === String(focusCaseId);
    });

    if (!targetCase) return;

    const { width, height } = dimensions;
    const margin = viewMode === "dynamic"
      ? { top: 42, right: 46, bottom: 56, left: 46 }
      : { top: 28, right: 28, bottom: 58, left: 120 };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (innerW <= 0 || innerH <= 0) return;

    const xScale = d3.scaleLinear().domain([0, 1000]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1000]).range([innerH, 0]);

    const centerX = xScale(500);
    const centerY = yScale(500);
    const dynamicUnitScale = Math.min(innerW, innerH) / 1000;

    const targetX = viewMode === "dynamic"
      ? centerX + (targetCase.dynamicX - 500) * dynamicUnitScale
      : xScale(targetCase.mapX);
    const targetY = viewMode === "dynamic"
      ? centerY - (targetCase.dynamicY - 500) * dynamicUnitScale
      : yScale(targetCase.mapY);
    const targetScale = viewMode === "dynamic" ? 1.55 : 1.5;

    const nextTransform = d3.zoomIdentity
      .translate(innerW / 2 - targetX * targetScale, innerH / 2 - targetY * targetScale)
      .scale(targetScale);

    currentTransformRef.current[viewMode] = nextTransform;

    d3.select(svgRef.current)
      .transition()
      .duration(650)
      .call(zoomRef.current.transform, nextTransform);
  }, [focusCaseId, scatterCases, dynamicCases, dimensions, viewMode]);

  const setTooltipFromEvent = (event) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    setTooltipPos({
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top + 14,
    });
  };

  const renderScatterMap = () => {
    const { width, height } = dimensions;

    const margin = {
      top: 28,
      right: 28,
      bottom: 58,
      left: 120,
    };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", width)
      .attr("height", height)
      .on("mouseleave", () => setHoveredCase(null));

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

    mapLayer
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    axisLayer
      .append("line")
      .attr("x1", 0)
      .attr("y1", innerH)
      .attr("x2", innerW)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    axisLayer
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", innerH)
      .attr("stroke", "#d9d9d9")
      .attr("stroke-width", 1);

    PROBLEM_AXIS.forEach((item) => {
      axisLayer
        .append("text")
        .attr("x", xScale(item.value))
        .attr("y", innerH + 24)
        .attr("text-anchor", "middle")
        .attr("font-size", 14)
        .attr("font-weight", 700)
        .attr("fill", getProblemColor(item.key))
        .text(item.key);
    });

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
        .attr("font-size", 14)
        .attr("font-weight", 500)
        .attr("fill", "#666")
        .text(item.short);
    });

    axisLayer
      .append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 48)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#aaa")
      .text("X축: 문제 유형");

    axisLayer
      .append("text")
      .attr("transform", `translate(${-62}, ${innerH / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#aaa")
      .text("Y축: 전략 유형");

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

    renderCaseNodes({
      nodeLayer,
      data: scatterCases,
      xAccessor: (d) => xScale(d.mapX),
      yAccessor: (d) => yScale(d.mapY),
      mode: "scatter",
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
        currentTransformRef.current.scatter = event.transform;

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
    svg.call(zoom.transform, currentTransformRef.current.scatter);
  };

  const renderDynamicMap = () => {
    const { width, height } = dimensions;

    const margin = {
      top: 42,
      right: 46,
      bottom: 56,
      left: 46,
    };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("width", width)
      .attr("height", height)
      .on("mouseleave", () => setHoveredCase(null));

    const xScale = d3.scaleLinear().domain([0, 1000]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1000]).range([innerH, 0]);

    const root = svg.append("g");
    const clipId = `dynamic-map-clip-${Math.random().toString(36).slice(2)}`;

    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", innerW)
      .attr("height", innerH);

    root
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#fbfbfb");

    const viewport = root
      .append("g")
      .attr("clip-path", `url(#${clipId})`);

    const mapLayer = viewport
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    mapLayer
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "grab")
      .on("mouseenter", () => setHoveredCase(null))
      .on("mousemove", () => setHoveredCase(null))
      .on("mouseleave", () => setHoveredCase(null));

    const guideLayer = mapLayer.append("g").attr("class", "dynamic-guide");
    const centerX = xScale(500);
    const centerY = yScale(500);
    const maxRadius = Math.min(innerW, innerH) * 0.52;

    // 유사도 거리 링. 배경이 너무 흐려 보이지 않도록 단계 구분을 선명하게 한다.
    const distanceGuides = [
      { ratio: 0.25, label: "핵심 추천", stroke: "#f2a65a", width: 1.35, dash: "none", opacity: 0.75 },
      { ratio: 0.5, label: "높은 관련도", stroke: "#d1d5db", width: 1.15, dash: "4,6", opacity: 0.9 },
      { ratio: 0.75, label: "관련 후보", stroke: "#cfd4dc", width: 1.05, dash: "4,7", opacity: 0.9 },
      { ratio: 1, label: "참고 후보", stroke: "#b8bec8", width: 1.15, dash: "5,7", opacity: 0.95 },
    ];

    guideLayer
      .append("circle")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", maxRadius * 0.25)
      .attr("fill", "#fff7ed")
      .attr("fill-opacity", 0.52)
      .attr("stroke", "none");

    distanceGuides.forEach((guide) => {
      guideLayer
        .append("circle")
        .attr("cx", centerX)
        .attr("cy", centerY)
        .attr("r", maxRadius * guide.ratio)
        .attr("fill", "none")
        .attr("stroke", guide.stroke)
        .attr("stroke-width", guide.width)
        .attr("stroke-opacity", guide.opacity)
        .attr("stroke-dasharray", guide.dash);

      // 거리 단계 라벨은 케이스가 몰리는 중심 수평선에서 빼고,
      // 각 원의 하단 우측 선 위에 배치한다.
      // 이렇게 하면 점/기업명과 겹칠 확률이 낮고, 링의 의미도 더 직관적으로 보인다.
      const guideLabelAngle = Math.PI / 3.35;
      const guideLabelX = centerX + Math.cos(guideLabelAngle) * maxRadius * guide.ratio;
      const guideLabelY = centerY + Math.sin(guideLabelAngle) * maxRadius * guide.ratio;

      const labelGroup = guideLayer
        .append("g")
        .attr("transform", `translate(${guideLabelX},${guideLabelY})`)
        .style("pointer-events", "none");

      const labelText = guide.label;
      const labelWidth = Math.max(52, labelText.length * 12 + 18);

      labelGroup
        .append("rect")
        .attr("x", -labelWidth / 2)
        .attr("y", -10)
        .attr("width", labelWidth)
        .attr("height", 20)
        .attr("rx", 10)
        .attr("fill", "#fbfbfb")
        .attr("fill-opacity", 0.88)
        .attr("stroke", guide.ratio === 0.25 ? "#fed7aa" : "#e5e7eb")
        .attr("stroke-width", 0.8);

      labelGroup
        .append("text")
        .attr("x", 0)
        .attr("y", 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 10.5)
        .attr("font-weight", guide.ratio === 0.25 ? 800 : 650)
        .attr("fill", guide.ratio === 0.25 ? "#E86F00" : "#6b7280")
        .text(labelText);
    });

    guideLayer
      .append("line")
      .attr("x1", centerX - maxRadius)
      .attr("y1", centerY)
      .attr("x2", centerX + maxRadius)
      .attr("y2", centerY)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "2,8");

    guideLayer
      .append("line")
      .attr("x1", centerX)
      .attr("y1", centerY - maxRadius)
      .attr("x2", centerX)
      .attr("y2", centerY + maxRadius)
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "2,8");

    guideLayer
      .append("circle")
      .attr("cx", centerX)
      .attr("cy", centerY)
      .attr("r", 5)
      .attr("fill", "#E86F00")
      .attr("fill-opacity", 0.95);

    guideLayer
      .append("text")
      .attr("x", centerX)
      .attr("y", centerY - 16)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("font-weight", 800)
      .attr("fill", "#E86F00")
      .text("현재 고민 중심");

    guideLayer
      .append("text")
      .attr("x", centerX)
      .attr("y", centerY + maxRadius + 24)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#6b7280")
      .text("중심에 가까울수록 현재 입력한 고민과 더 가까운 사례입니다.");

    const legend = root
      .append("g")
      .attr("transform", `translate(${margin.left + 8},${margin.top + 8})`);

    legend
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 238)
      .attr("height", 34)
      .attr("rx", 17)
      .attr("fill", "rgba(255,255,255,0.88)")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-width", 0.8);

    const legendItems = ["고객", "성장", "효율", "혁신"];
    legendItems.forEach((key, index) => {
      const x = 14 + index * 54;
      legend
        .append("circle")
        .attr("cx", x)
        .attr("cy", 17)
        .attr("r", 4)
        .attr("fill", getProblemColor(key));

      legend
        .append("text")
        .attr("x", x + 8)
        .attr("y", 21)
        .attr("font-size", 11)
        .attr("font-weight", 700)
        .attr("fill", "#4b5563")
        .text(key);
    });

    const nodeLayer = mapLayer.append("g").attr("class", "dynamic-node-layer");
    const dynamicUnitScale = Math.min(innerW, innerH) / 1000;
    const dynamicXAccessor = (d) => centerX + (d.dynamicX - 500) * dynamicUnitScale;
    const dynamicYAccessor = (d) => centerY - (d.dynamicY - 500) * dynamicUnitScale;

    renderCaseNodes({
      nodeLayer,
      data: dynamicCases,
      xAccessor: dynamicXAccessor,
      yAccessor: dynamicYAccessor,
      mode: "dynamic",
    });

    const zoom = d3.zoom()
      .scaleExtent([0.45, 5.2])
      .translateExtent([
        [-innerW * 2.2, -innerH * 2.2],
        [innerW * 3.2, innerH * 3.2],
      ])
      .on("start", () => {
        mapLayer.select("rect").style("cursor", "grabbing");
      })
      .on("zoom", (event) => {
        currentTransformRef.current.dynamic = event.transform;

        mapLayer.attr(
          "transform",
          `translate(${margin.left},${margin.top}) ${event.transform}`
        );

        setZoomLevel(Math.round(event.transform.k * 100));
        setCurrentArea({
          problem: "현재 고민",
          strategy: "유사도 거리",
        });
      })
      .on("end", () => {
        mapLayer.select("rect").style("cursor", "grab");
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    const hasSavedDynamicTransform =
      currentTransformRef.current.dynamic &&
      (currentTransformRef.current.dynamic.k !== 1 ||
        currentTransformRef.current.dynamic.x !== 0 ||
        currentTransformRef.current.dynamic.y !== 0);

    if (hasSavedDynamicTransform) {
      svg.call(zoom.transform, currentTransformRef.current.dynamic);
    } else {
      const focusCandidates = dynamicCases
        .filter((item) => {
          const rank = Number(item.rank ?? item.ranking ?? item.map_rank);
          return Number.isFinite(rank) && rank >= 1 && rank <= 10;
        })
        .slice(0, 10);

      const focusSource = focusCandidates.length > 0 ? focusCandidates : dynamicCases.slice(0, 10);

      if (focusSource.length > 0) {
        const xs = focusSource.map((d) => dynamicXAccessor(d));
        const ys = focusSource.map((d) => dynamicYAccessor(d));
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const boxW = Math.max(maxX - minX, 260);
        const boxH = Math.max(maxY - minY, 220);
        const padding = 160;
        const scale = Math.min(1.35, Math.max(0.82, Math.min(innerW / (boxW + padding), innerH / (boxH + padding))));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const initialTransform = d3.zoomIdentity
          .translate(innerW / 2 - cx * scale, innerH / 2 - cy * scale)
          .scale(scale);

        currentTransformRef.current.dynamic = initialTransform;
        svg.call(zoom.transform, initialTransform);
      } else {
        svg.call(zoom.transform, d3.zoomIdentity);
      }
    }
  };

  const renderCaseNodes = ({ nodeLayer, data, xAccessor, yAccessor, mode }) => {
    const isDynamicRecommended = (item) => {
      const rank = Number(item.rank ?? item.ranking);
      return item.map_group === "recommended" || item.isRecommended === true || item.is_recommended === true || (Number.isFinite(rank) && rank >= 1 && rank <= 5);
    };

    const isDynamicTop20 = (item) => {
      const score = Number(item.final_score ?? item.finalScore ?? 0);
      const recommended = item.map_group === "recommended" || item.isRecommended === true || item.is_recommended === true;
      if (!recommended && score < 0.4) return false;
      const mapRank = Number(item.map_rank ?? item.mapRank);
      if (Number.isFinite(mapRank)) return mapRank >= 1 && mapRank <= 20;
      const rank = Number(item.rank ?? item.ranking);
      return Number.isFinite(rank) && rank >= 1 && rank <= 20;
    };

    const isNodeRecommended = (item) => {
      return mode === "dynamic" ? isDynamicRecommended(item) : isRecommended(item);
    };

    const getNodeRank = (item) => {
      if (mode === "dynamic") {
        const rank = Number(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
        if (Number.isFinite(rank) && rank >= 1 && rank <= 5) return rank;

        const id = String(item.id);
        const caseIdx = String(item.case_idx);
        const indexById = highlightedIds.map(String).findIndex(
          (target) => target === id || target === caseIdx
        );

        return indexById >= 0 && indexById < 5 ? indexById + 1 : null;
      }
      return getTopRank(item);
    };

    const recommendedData = data.filter(isNodeRecommended);

    const resetNodeStyles = () => {
      nodeLayer
        .selectAll(".case-node")
        .attr("r", (d) => {
          if (mode === "dynamic") return isNodeRecommended(d) ? 11.4 : 5.2;
          return isNodeRecommended(d) ? 7.5 : 5.5;
        })
        .attr("fill-opacity", (d) => {
          if (mode === "dynamic") return isNodeRecommended(d) ? 1 : 0.68;
          return isNodeRecommended(d) ? 0.96 : 0.62;
        });
    };

    if (mode === "dynamic") {
      const centerX = xAccessor({ dynamicX: 500 });
      const centerY = yAccessor({ dynamicY: 500 });
      const topRankData = recommendedData.filter((d) => getNodeRank(d) !== null);

      // 후보군 점: TOP5는 과한 원형 링 대신 점 크기, 흰색 테두리, 은은한 그림자로만 강조한다.
      nodeLayer
        .selectAll(".case-node")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "case-node")
        .attr("cx", (d) => xAccessor(d))
        .attr("cy", (d) => yAccessor(d))
        .attr("r", (d) => (isNodeRecommended(d) ? 12.6 : 5.2))
        .attr("fill", (d) => getProblemColor(d.prob_main))
        .attr("fill-opacity", (d) => (isNodeRecommended(d) ? 1 : 0.68))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", (d) => (isNodeRecommended(d) ? 5.8 : 1.4))
        .style("filter", (d) => (isNodeRecommended(d) ? "drop-shadow(0px 3px 8px rgba(17,24,39,0.24))" : "none"))
        .style("cursor", "pointer")
        .on("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
        })
        .on("pointerup", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        })
        .on("mouseenter", function (event, d) {
          resetNodeStyles();
          setHoveredCase(d);
          setTooltipFromEvent(event);

          d3.select(this)
            .raise()
            .attr("r", isNodeRecommended(d) ? 14.2 : 7)
            .attr("fill-opacity", 1);

          nodeLayer.selectAll(".dynamic-top-rank-number").raise();
          nodeLayer.selectAll(".dynamic-company-label").raise();
        })
        .on("mousemove", function (event, d) {
          setHoveredCase(d);
          setTooltipFromEvent(event);
        })
        .on("mouseleave", function () {
          setHoveredCase(null);
          resetNodeStyles();
        })
        .on("click", function (event, d) {
          event.stopPropagation();
          notifyCaseSelect(d);
        });

      // 클릭 히트 영역: 점이 작거나 라벨을 눌러도 우측 패널이 열리도록 투명 클릭 영역을 둔다.
      nodeLayer
        .selectAll(".case-node-hit-area")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "case-node-hit-area")
        .attr("cx", (d) => xAccessor(d))
        .attr("cy", (d) => yAccessor(d))
        .attr("r", (d) => (isNodeRecommended(d) ? 28 : 18))
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .style("cursor", "pointer")
        .on("mouseenter", function (event, d) {
          resetNodeStyles();
          setHoveredCase(d);
          setTooltipFromEvent(event);
          nodeLayer.selectAll(".dynamic-top-rank-number").raise();
          nodeLayer.selectAll(".dynamic-company-label").raise();
        })
        .on("mousemove", function (event, d) {
          setHoveredCase(d);
          setTooltipFromEvent(event);
        })
        .on("mouseleave", function () {
          setHoveredCase(null);
          resetNodeStyles();
        })
        .on("click", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        });

      // TOP5 순위는 원 안에 숫자로만 표시한다.
      nodeLayer
        .selectAll(".dynamic-top-rank-number")
        .data(topRankData)
        .enter()
        .append("text")
        .attr("class", "dynamic-top-rank-number")
        .attr("x", (d) => xAccessor(d))
        .attr("y", (d) => yAccessor(d) + 3.5)
        .attr("text-anchor", "middle")
        .attr("font-size", 9.4)
        .attr("font-weight", 900)
        .attr("fill", "#ffffff")
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(0,0,0,0.18)")
        .attr("stroke-width", 1.2)
        .attr("stroke-linejoin", "round")
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .on("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
        })
        .on("pointerup", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        })
        .on("mouseenter", function (event, d) {
          resetNodeStyles();
          setHoveredCase(d);
          setTooltipFromEvent(event);
          d3.select(this).raise();
          nodeLayer.selectAll(".dynamic-company-label").raise();
        })
        .on("mousemove", function (event, d) {
          setHoveredCase(d);
          setTooltipFromEvent(event);
        })
        .on("mouseleave", function () {
          setHoveredCase(null);
          resetNodeStyles();
        })
        .on("click", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        })
        .text((d) => getNodeRank(d));

      // 유사도 상위 20개까지 기업명만 표시한다.
      // 라벨은 점 하단 정중앙에 고정해서 사용자가 위치를 예측할 수 있게 한다.
      const labelData = data
        .filter(isDynamicTop20)
        .sort((a, b) => Number(a.map_rank ?? a.rank ?? 999) - Number(b.map_rank ?? b.rank ?? 999));

      const labelPositions = labelData.map((d) => {
        const nodeX = xAccessor(d);
        const nodeY = yAccessor(d);
        const recommended = isNodeRecommended(d);

        return {
          ...d,
          nodeX,
          nodeY,
          labelX: nodeX,
          labelY: nodeY + (recommended ? 35 : 24),
          recommended,
        };
      });

      const labelGroups = nodeLayer
        .selectAll(".dynamic-company-label")
        .data(labelPositions)
        .enter()
        .append("g")
        .attr("class", "dynamic-company-label")
        .attr("transform", (d) => `translate(${d.labelX},${d.labelY})`)
        .style("pointer-events", "auto")
        .style("cursor", "pointer")
        .on("pointerdown", function (event) {
          event.preventDefault();
          event.stopPropagation();
        })
        .on("pointerup", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        })
        .on("mouseenter", function (event, d) {
          resetNodeStyles();
          setHoveredCase(d);
          setTooltipFromEvent(event);
          nodeLayer.selectAll(".dynamic-top-rank-number").raise();
          nodeLayer.selectAll(".dynamic-company-label").raise();
        })
        .on("mousemove", function (event, d) {
          setHoveredCase(d);
          setTooltipFromEvent(event);
        })
        .on("mouseleave", function () {
          setHoveredCase(null);
          resetNodeStyles();
        })
        .on("click", function (event, d) {
          event.preventDefault();
          event.stopPropagation();
          setHoveredCase(null);
          notifyCaseSelect(d);
        });

      labelGroups
        .append("rect")
        .attr("x", (d) => (d.recommended ? -42 : -38))
        .attr("y", -14)
        .attr("width", (d) => (d.recommended ? 84 : 76))
        .attr("height", 24)
        .attr("rx", 6)
        .attr("fill", "transparent");

      labelGroups
        .append("text")
        .attr("text-anchor", "middle")
        .attr("font-size", (d) => (d.recommended ? 12 : 10.5))
        .attr("font-weight", (d) => (d.recommended ? 850 : 650))
        .attr("fill", (d) => (d.recommended ? "#111827" : "#4b5563"))
        .attr("fill-opacity", (d) => (d.recommended ? 0.96 : 0.86))
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(255,255,255,0.92)")
        .attr("stroke-width", (d) => (d.recommended ? 3.4 : 2.6))
        .attr("stroke-linejoin", "round")
        .text((d) => truncateText(d.company, d.recommended ? 9 : 8));

      nodeLayer.selectAll(".case-node").raise();
      nodeLayer.selectAll(".dynamic-top-rank-number").raise();
      nodeLayer.selectAll(".dynamic-company-label").raise();
      return;
    }

    const recommendedNodes = nodeLayer
      .selectAll(".recommend-ring")
      .data(recommendedData)
      .enter()
      .append("g")
      .attr("class", "recommend-ring")
      .attr("transform", (d) => `translate(${xAccessor(d)},${yAccessor(d)})`);

    recommendedNodes
      .append("circle")
      .attr("r", 15)
      .attr("fill", "none")
      .attr("stroke", "#111827")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.88)
      .style("pointer-events", "none");

    recommendedNodes
      .filter((d) => getNodeRank(d) !== null)
      .append("circle")
      .attr("cx", 0)
      .attr("cy", -20)
      .attr("r", 9)
      .attr("fill", "#ffffff")
      .attr("stroke", "#111827")
      .attr("stroke-width", 1.2)
      .style("pointer-events", "none");

    recommendedNodes
      .filter((d) => getNodeRank(d) !== null)
      .append("text")
      .attr("y", -16.5)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-weight", 800)
      .attr("fill", "#111827")
      .text((d) => getNodeRank(d))
      .style("pointer-events", "none");

    nodeLayer
      .selectAll(".case-node")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "case-node")
      .attr("cx", (d) => xAccessor(d))
      .attr("cy", (d) => yAccessor(d))
      .attr("r", (d) => (isNodeRecommended(d) ? 7.5 : 5.5))
      .attr("fill", (d) => getProblemColor(d.prob_main))
      .attr("fill-opacity", (d) => (isNodeRecommended(d) ? 0.96 : 0.62))
      .attr("stroke", (d) => (isNodeRecommended(d) ? "#ffffff" : "none"))
      .attr("stroke-width", (d) => (isNodeRecommended(d) ? 1.5 : 0))
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        resetNodeStyles();
        setHoveredCase(d);
        setTooltipFromEvent(event);

        d3.select(this)
          .raise()
          .attr("r", isNodeRecommended(d) ? 10.5 : 8)
          .attr("fill-opacity", 1);
      })
      .on("mousemove", function (event, d) {
        setHoveredCase(d);
        setTooltipFromEvent(event);
      })
      .on("mouseleave", function () {
        setHoveredCase(null);
        resetNodeStyles();
      })
      .on("click", function (event, d) {
        event.stopPropagation();
        notifyCaseSelect(d);
      });
  };

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

    currentTransformRef.current[viewMode] = d3.zoomIdentity;

    const svg = d3.select(svgRef.current);

    svg
      .transition()
      .duration(260)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, [viewMode]);

  const handleViewModeChange = (nextMode) => {
    if (viewMode === nextMode) return;

    setHoveredCase(null);
    setCurrentArea(
      nextMode === "dynamic"
        ? { problem: "검색어 중심", strategy: "유사도 거리" }
        : { problem: "중앙", strategy: "중앙" }
    );
    setZoomLevel(Math.round((currentTransformRef.current[nextMode]?.k || 1) * 100));
    setViewMode(nextMode);
  };

  const hasDynamicMap = dynamicCases.length > 0;

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <p style={styles.headerLabel}>DBR Case Atlas</p>
          <div style={styles.titleRow}>
            <h2 style={styles.headerTitle}>케이스 맵</h2>
            <div style={styles.viewToggle}>
              <button
                type="button"
                style={viewMode === "scatter" ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => handleViewModeChange("scatter")}
              >
                전체 산점도
              </button>
              <button
                type="button"
                style={viewMode === "dynamic" ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => handleViewModeChange("dynamic")}
                disabled={!hasDynamicMap}
                title={!hasDynamicMap ? "검색 후 확인할 수 있습니다." : "현재 검색어 기준 동적 좌표 맵"}
              >
                검색 결과 맵
              </button>
            </div>
          </div>
        </div>
      </div>

      <div ref={containerRef} style={styles.mapContainer}>
        <svg ref={svgRef} style={{ display: "block", width: "100%" }} />

        {scatterCases.length === 0 && viewMode === "scatter" && (
          <div style={styles.emptyText}>케이스 데이터를 불러오는 중입니다.</div>
        )}

        {viewMode === "dynamic" && !hasDynamicMap && (
          <div style={styles.emptyText}>검색 후 추천 결과 맵을 확인할 수 있습니다.</div>
        )}

        <div style={styles.areaBadge}>
          <span style={styles.areaLabel}>
            {viewMode === "dynamic" ? "현재 맵 기준" : "현재 영역"}
          </span>
          <strong style={styles.areaValue}>
            {currentArea.problem} × {currentArea.strategy}
          </strong>
          {viewMode === "dynamic" && (
            <span style={styles.areaDesc}>TOP5와 40% 이상 관련 후보만 표시됩니다.</span>
          )}
        </div>

        {hoveredCase && (
          <div
            style={{
              ...styles.tooltip,
              left: tooltipPos.x,
              top: tooltipPos.y,
            }}
          >
            {getTopRank(hoveredCase) && (
              <p style={styles.tooltipRank}>추천 TOP {getTopRank(hoveredCase)}</p>
            )}

            <p style={styles.tooltipTitle}>{hoveredCase.title}</p>

            <p style={styles.tooltipSub}>
              {hoveredCase.company} · {hoveredCase.industry}
            </p>

            <p style={styles.tooltipSub}>
              {hoveredCase.prob_main}
              {hoveredCase.prob_keyword ? ` / ${hoveredCase.prob_keyword}` : ""}
            </p>

            <p style={styles.tooltipSub}>{hoveredCase.sol_type}</p>

            {hoveredCase.similarity !== null && hoveredCase.similarity !== undefined && (
              <p style={styles.tooltipSimilarity}>유사도 {hoveredCase.similarity}%</p>
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
          {viewMode === "dynamic"
            ? "드래그로 이동 · 휠로 확대/축소 · 상위 20개 기업명 표시 · 드래그/축소로 나머지 탐색"
            : "드래그로 이동 · 휠로 확대/축소"}
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
  },
  viewToggle: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: 4,
    background: "#f5f5f5",
    border: "1px solid #e0e0e0",
    borderRadius: 999,
  },
  viewToggleBtn: {
    border: "none",
    background: "transparent",
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    color: "#666",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  viewToggleBtnActive: {
    border: "none",
    background: "#111827",
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 7px rgba(0,0,0,0.14)",
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
    zIndex: 10,
    pointerEvents: "none",
  },
  areaBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    background: "rgba(255,255,255,0.94)",
    border: "0.5px solid #e0e0e0",
    borderRadius: 8,
    padding: "7px 10px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    zIndex: 20,
    pointerEvents: "none",
    maxWidth: 260,
  },
  areaLabel: {
    display: "block",
    fontSize: 11,
    color: "#aaa",
    marginBottom: 3,
    fontWeight: 700,
  },
  areaValue: {
    display: "block",
    fontSize: 14,
    color: "#333",
    fontWeight: 800,
  },
  areaDesc: {
    display: "block",
    fontSize: 11,
    color: "#999",
    lineHeight: 1.45,
    marginTop: 5,
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
    fontWeight: 800,
    color: "#E86F00",
    marginBottom: 4,
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: 700,
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
    fontWeight: 700,
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
    width: 20,
    height: 20,
    border: "none",
    background: "transparent",
    color: "#444",
    fontSize: 15,
    cursor: "pointer",
    borderRadius: 4,
    lineHeight: 1,
  },
  zoomLevel: {
    fontSize: 11,
    color: "#aaa",
  },
  zoomHint: {
    position: "absolute",
    left: 14,
    bottom: 12,
    fontSize: 12,
    color: "#aaa",
    pointerEvents: "none",
  },
};
