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

function getDynamicRadius(item) {
  const x = toFiniteNumber(item.dynamicX);
  const y = toFiniteNumber(item.dynamicY);

  if (x === null || y === null) return 0;

  const dx = x - 500;
  const dy = y - 500;
  const radius = Math.sqrt(dx * dx + dy * dy);

  return Number.isFinite(radius) ? radius : 0;
}

function getDynamicAngleFromPoint(item, index) {
  const x = toFiniteNumber(item.dynamicX);
  const y = toFiniteNumber(item.dynamicY);

  if (x !== null && y !== null) {
    const dx = x - 500;
    const dy = y - 500;

    if (Math.abs(dx) + Math.abs(dy) > 0.001) {
      return Math.atan2(dy, dx);
    }
  }

  return getDynamicAngle(item, index);
}

function getReadableRank(item) {
  const rank = toFiniteNumber(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
  return rank;
}

function getRankRadiusRange(rank, score) {
  // TOP5는 "가까운 추천" 영역 안에서만 순서를 살짝 보정한다.
  // 완전한 줄 세우기는 하지 않고, 반지름 범위만 제한해서 자연스러운 방향성은 유지한다.
  const ranges = {
    1: [145, score !== null && score >= 0.8 ? 215 : 245],
    2: [210, 315],
    3: [275, 390],
    4: [340, 475],
    5: [405, 560],
  };

  return ranges[rank] || null;
}

function stabilizeDynamicCasePosition(item, index) {
  const rank = getReadableRank(item);
  const score = getMapScore(item);
  const angle = getDynamicAngleFromPoint(item, index);
  let radius = getDynamicRadius(item);

  if (!Number.isFinite(radius) || radius < 1) {
    radius = 460 + index * 12;
  }

  const isTop5 = rank !== null && rank >= 1 && rank <= 5;

  if (isTop5) {
    const range = getRankRadiusRange(rank, score);

    if (range) {
      const [minR, maxR] = range;
      radius = clampLabel(radius, minR, maxR);
    }
  } else {
    // TOP5가 아닌 후보가 현재 고민 중심 근처로 들어와 TOP 추천처럼 보이는 것만 방지한다.
    // 대신 바깥쪽 좌표는 그대로 두어 의미 분포가 무너지지 않게 한다.
    radius = Math.max(radius, 430);
  }

  return {
    ...item,
    dynamicX: 500 + Math.cos(angle) * radius,
    dynamicY: 500 + Math.sin(angle) * radius,
    map_distance: radius,
  };
}

function getMinimumNodeDistance(a, b) {
  const rankA = getReadableRank(a);
  const rankB = getReadableRank(b);
  const topA = rankA !== null && rankA >= 1 && rankA <= 5;
  const topB = rankB !== null && rankB >= 1 && rankB <= 5;
  const labelA = rankA !== null && rankA >= 1 && rankA <= 20;
  const labelB = rankB !== null && rankB >= 1 && rankB <= 20;

  if (topA && topB) return 118;
  if (topA || topB) return 96;
  if (labelA && labelB) return 78;
  if (labelA || labelB) return 62;
  return 42;
}

function spreadDynamicCasesForReadability(items) {
  // 핵심: 반지름은 추천 강도 의미를 담기 때문에 크게 흔들지 않는다.
  // 겹침 완화는 거의 각도 조정에 가깝게, 약하게만 적용한다.
  const nodes = items.map((item, index) => ({
    ...item,
    _spreadIndex: index,
    _baseRadius: getDynamicRadius(item),
    _baseAngle: getDynamicAngleFromPoint(item, index),
  }));

  const getTieAngle = (a, b) => {
    const seedA = Number(a.case_idx ?? a.id ?? a._spreadIndex + 1);
    const seedB = Number(b.case_idx ?? b.id ?? b._spreadIndex + 1);
    const seed = (Number.isFinite(seedA) ? seedA : a._spreadIndex + 1) + (Number.isFinite(seedB) ? seedB : b._spreadIndex + 1) * 17;
    return ((seed * 137.508) % 360) * (Math.PI / 180);
  };

  for (let pass = 0; pass < 28; pass += 1) {
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

        const push = (minDistance - distance) * 0.28;
        const ux = dx / distance;
        const uy = dy / distance;

        const rankA = getReadableRank(a) ?? 999;
        const rankB = getReadableRank(b) ?? 999;
        const lockA = rankA <= 5 ? 0.35 : 0.5;
        const lockB = rankB <= 5 ? 0.35 : 0.5;
        const total = lockA + lockB;

        a.dynamicX -= ux * push * (lockA / total);
        a.dynamicY -= uy * push * (lockA / total);
        b.dynamicX += ux * push * (lockB / total);
        b.dynamicY += uy * push * (lockB / total);
        moved = true;
      }
    }

    nodes.forEach((node) => {
      const rank = getReadableRank(node);
      const isTop5 = rank !== null && rank >= 1 && rank <= 5;
      const angle = getDynamicAngleFromPoint(node, node._spreadIndex);
      let radius = getDynamicRadius(node);

      if (isTop5) {
        const range = getRankRadiusRange(rank, getMapScore(node));
        if (range) radius = clampLabel(radius, range[0], range[1]);
      } else {
        radius = Math.max(radius, 430);
      }

      // 너무 멀리 튄 점만 제한한다. 일반 후보의 자연스러운 분포는 유지한다.
      radius = Math.min(radius, 930);
      node.dynamicX = 500 + Math.cos(angle) * radius;
      node.dynamicY = 500 + Math.sin(angle) * radius;
      node.map_distance = radius;
    });

    if (!moved) break;
  }

  return nodes.map(({ _spreadIndex, _baseRadius, _baseAngle, ...item }) => item);
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

  const [viewMode, setViewMode] = useState("dynamic");
  const [selectedCaseKey, setSelectedCaseKey] = useState("");
  const [centerRequestCount, setCenterRequestCount] = useState(0);
  const [hoveredCase, setHoveredCase] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentArea, setCurrentArea] = useState({
    problem: "검색어 중심",
    strategy: "유사도 거리",
  });
  const [dimensions, setDimensions] = useState({ width: 1000, height: 700 });

  useEffect(() => {
    onCaseClickRef.current = onCaseClick;
  }, [onCaseClick]);

  const getCaseIdentity = useCallback((caseData) => {
    if (!caseData) return "";
    return String(caseData.case_idx ?? caseData.id ?? caseData.title ?? "");
  }, []);

  const notifyCaseSelect = useCallback((caseData) => {
    if (!caseData) return;

    const caseKey = getCaseIdentity(caseData);
    const now = Date.now();

    if (lastSelectRef.current.key === caseKey && now - lastSelectRef.current.time < 180) {
      return;
    }

    lastSelectRef.current = { key: caseKey, time: now };
    setSelectedCaseKey(caseKey);
    setCenterRequestCount((prev) => prev + 1);

    if (typeof onCaseClickRef.current === "function") {
      onCaseClickRef.current(caseData);
    }

    window.dispatchEvent(new CustomEvent("caseMapCaseSelect", { detail: caseData }));
  }, [getCaseIdentity]);

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
      .map((item, index) => stabilizeDynamicCasePosition(item, index));

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
  }, [viewMode, scatterCases, dynamicCases, highlightedIds, dimensions, selectedCaseKey]);

  const getRenderedPointForCase = useCallback((targetCase, targetMode = viewMode) => {
    if (!targetCase) return null;

    const { width, height } = dimensions;
    const margin = targetMode === "dynamic"
      ? { top: 42, right: 46, bottom: 56, left: 46 }
      : { top: 28, right: 28, bottom: 58, left: 120 };

    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (innerW <= 0 || innerH <= 0) return null;

    const xScale = d3.scaleLinear().domain([0, 1000]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1000]).range([innerH, 0]);

    if (targetMode === "dynamic") {
      const centerX = xScale(500);
      const centerY = yScale(500);
      const dynamicUnitScale = Math.min(innerW, innerH) / 1000;

      return {
        innerW,
        innerH,
        targetX: centerX + (targetCase.dynamicX - 500) * dynamicUnitScale,
        targetY: centerY - (targetCase.dynamicY - 500) * dynamicUnitScale,
        targetScale: 1.28,
      };
    }

    return {
      innerW,
      innerH,
      targetX: xScale(targetCase.mapX),
      targetY: yScale(targetCase.mapY),
      targetScale: 1.5,
    };
  }, [dimensions, viewMode]);

  const centerCaseOnMap = useCallback((targetCase, targetMode = viewMode) => {
    if (!targetCase || !svgRef.current || !zoomRef.current) return;

    const point = getRenderedPointForCase(targetCase, targetMode);
    if (!point) return;

    const nextTransform = d3.zoomIdentity
      .translate(point.innerW / 2 - point.targetX * point.targetScale, point.innerH / 2 - point.targetY * point.targetScale)
      .scale(point.targetScale);

    currentTransformRef.current[targetMode] = nextTransform;

    d3.select(svgRef.current)
      .transition()
      .duration(430)
      .ease(d3.easeCubicOut)
      .call(zoomRef.current.transform, nextTransform);
  }, [getRenderedPointForCase, viewMode]);

  useEffect(() => {
    if (!focusCaseId || !svgRef.current || !zoomRef.current) return;

    const sourceCases = viewMode === "dynamic" ? dynamicCases : scatterCases;

    const targetCase = sourceCases.find((item) => {
      const itemId = String(item.id);
      const caseIdx = String(item.case_idx);

      return itemId === String(focusCaseId) || caseIdx === String(focusCaseId);
    });

    if (!targetCase) return;

    setSelectedCaseKey(getCaseIdentity(targetCase));
    centerCaseOnMap(targetCase, viewMode);
  }, [focusCaseId, scatterCases, dynamicCases, viewMode, centerCaseOnMap, getCaseIdentity]);

  useEffect(() => {
    if (!selectedCaseKey || !svgRef.current || !zoomRef.current) return;

    const sourceCases = viewMode === "dynamic" ? dynamicCases : scatterCases;
    const targetCase = sourceCases.find((item) => getCaseIdentity(item) === selectedCaseKey);

    if (!targetCase) return;

    centerCaseOnMap(targetCase, viewMode);
  }, [selectedCaseKey, centerRequestCount, scatterCases, dynamicCases, viewMode, centerCaseOnMap, getCaseIdentity]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target) return false;
      const tagName = String(target.tagName || "").toLowerCase();
      return tagName === "input" || tagName === "textarea" || target.isContentEditable;
    };

    const getKeyboardPoint = (item) => {
      if (viewMode === "dynamic") {
        return { x: Number(item.dynamicX), y: Number(item.dynamicY) };
      }
      return { x: Number(item.mapX), y: Number(item.mapY) };
    };

    const findNextCaseByDirection = (currentCase, direction, sourceCases) => {
      const currentPoint = getKeyboardPoint(currentCase);
      if (!Number.isFinite(currentPoint.x) || !Number.isFinite(currentPoint.y)) return null;

      const directionConfig = {
        ArrowRight: { vx: 1, vy: 0 },
        ArrowLeft: { vx: -1, vy: 0 },
        ArrowUp: { vx: 0, vy: 1 },
        ArrowDown: { vx: 0, vy: -1 },
      }[direction];

      if (!directionConfig) return null;

      const getNavigationTier = (item) => {
        const rank = Number(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank);
        const isTop5 = Number.isFinite(rank) && rank >= 1 && rank <= 5;
        const isTop20 = Number.isFinite(rank) && rank >= 1 && rank <= 20;
        const isRecommendedCase =
          item.map_group === "recommended" ||
          item.isRecommended === true ||
          item.is_recommended === true;

        if (isTop5 || isRecommendedCase) return 0;
        if (isTop20) return 1;
        return 2;
      };

      const currentTier = getNavigationTier(currentCase);

      const candidates = sourceCases
        .filter((item) => getCaseIdentity(item) !== getCaseIdentity(currentCase))
        .map((item) => ({ item, point: getKeyboardPoint(item) }))
        .filter(({ point }) => Number.isFinite(point.x) && Number.isFinite(point.y));

      const buildDirectionalCandidates = (minCos) => candidates
        .map(({ item, point }) => {
          const dx = point.x - currentPoint.x;
          const dy = point.y - currentPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (!Number.isFinite(distance) || distance < 0.001) return null;

          const projection = dx * directionConfig.vx + dy * directionConfig.vy;

          // 실제로 누른 방향 앞쪽에 있는 후보만 본다.
          if (projection <= 8) return null;

          const cos = projection / distance;
          if (cos < minCos) return null;

          const perpendicular = Math.sqrt(Math.max(0, distance * distance - projection * projection));
          const tier = getNavigationTier(item);
          const rank = Number(item.rank ?? item.ranking ?? item.map_rank ?? item.mapRank ?? 999);

          // TOP5 내부 탐색 중일 때만 TOP5/추천 후보를 우선한다.
          // 일반 후보를 보고 있을 때는 TOP5로 빨려 들어가지 않게 공간상 방향성을 더 우선한다.
          const tierPenalty = currentTier === 0
            ? tier * 2600
            : tier === 0
              ? 780
              : 0;

          const rankPenalty = currentTier === 0 && Number.isFinite(rank)
            ? Math.min(rank, 999) * 0.35
            : 0;

          // 방향키는 "방향 일치도"를 가장 크게 보고, 거리는 보조로만 본다.
          // 이렇게 해야 아래 방향키가 왼쪽/오른쪽으로 튀는 현상이 줄어든다.
          const directionScore = (1 - cos) * 3600;
          const sideScore = perpendicular * 1.35;
          const forwardScore = projection * 0.18;
          const distanceScore = distance * 0.04;

          const score =
            directionScore +
            sideScore +
            forwardScore +
            distanceScore +
            tierPenalty +
            rankPenalty;

          return { item, score, cos, distance, projection, perpendicular, tier };
        })
        .filter(Boolean)
        .sort((a, b) =>
          a.score - b.score ||
          b.cos - a.cos ||
          a.perpendicular - b.perpendicular ||
          a.distance - b.distance
        );

      // 1차: 방향에서 많이 벗어난 후보는 제외한다.
      const strictCandidates = buildDirectionalCandidates(0.48);
      if (strictCandidates.length > 0) return strictCandidates[0].item;

      // 2차: 후보가 없을 때만 대각선까지 조금 허용한다.
      const relaxedCandidates = buildDirectionalCandidates(0.30);
      if (relaxedCandidates.length > 0) return relaxedCandidates[0].item;

      return null;
    };

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (!selectedCaseKey) return;

      const sourceCases = viewMode === "dynamic" ? dynamicCases : scatterCases;
      const currentCase = sourceCases.find((item) => getCaseIdentity(item) === selectedCaseKey);
      if (!currentCase) return;

      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const nextCase = findNextCaseByDirection(currentCase, event.key, sourceCases);
        if (nextCase) notifyCaseSelect(nextCase);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        notifyCaseSelect(currentCase);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedCaseKey("");
        setHoveredCase(null);

        // 선택 표시뿐 아니라 우측 상세 패널도 함께 닫는다.
        if (typeof onCaseClickRef.current === "function") {
          onCaseClickRef.current(null);
        }

        window.dispatchEvent(new CustomEvent("caseMapCaseClear"));
        window.dispatchEvent(new CustomEvent("caseMapCaseSelect", { detail: null }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCaseKey, viewMode, dynamicCases, scatterCases, notifyCaseSelect, getCaseIdentity]);


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
      { ratio: 0.25, label: "추천 케이스", stroke: "#f2a65a", width: 1.35, dash: "none", opacity: 0.75 },
      { ratio: 0.5, label: "연관 케이스", stroke: "#d1d5db", width: 1.15, dash: "4,6", opacity: 0.9 },
      { ratio: 0.75, label: "탐색 케이스", stroke: "#cfd4dc", width: 1.05, dash: "4,7", opacity: 0.9 },
      { ratio: 1, label: "참고 케이스", stroke: "#b8bec8", width: 1.15, dash: "5,7", opacity: 0.95 },
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
      .text("내 고민 중심");

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
      // 범례는 맵 내부 여백에 영향받지 않게 화면 좌측 상단에 고정한다.
      .attr("transform", "translate(12, 12)");

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

    const isSelectedNode = (item) => {
      return Boolean(selectedCaseKey) && getCaseIdentity(item) === selectedCaseKey;
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
        .attr("r", (d) => {
          if (isSelectedNode(d)) return isNodeRecommended(d) ? 13.4 : 6.8;
          return isNodeRecommended(d) ? 12.6 : 5.2;
        })
        .attr("fill", (d) => getProblemColor(d.prob_main))
        .attr("fill-opacity", (d) => (isSelectedNode(d) || isNodeRecommended(d) ? 1 : 0.68))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", (d) => {
          if (isSelectedNode(d)) return isNodeRecommended(d) ? 6.2 : 2.4;
          return isNodeRecommended(d) ? 5.8 : 1.4;
        })
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
        .attr("fill", (d) => (isSelectedNode(d) ? "#E86F00" : d.recommended ? "#111827" : "#4b5563"))
        .attr("fill-opacity", (d) => (d.recommended || isSelectedNode(d) ? 0.96 : 0.86))
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(255,255,255,0.92)")
        .attr("stroke-width", (d) => (d.recommended ? 3.4 : 2.6))
        .attr("stroke-linejoin", "round")
        .text((d) => truncateText(d.company, d.recommended ? 9 : 8));

      const selectedDynamicData = data.filter(isSelectedNode);

      const selectedGlow = nodeLayer
        .selectAll(".selected-case-glow")
        .data(selectedDynamicData)
        .enter()
        .append("g")
        .attr("class", "selected-case-glow")
        .attr("transform", (d) => `translate(${xAccessor(d)},${yAccessor(d)})`)
        .style("pointer-events", "none");

      selectedGlow
        .append("circle")
        .attr("r", (d) => (isNodeRecommended(d) ? 25 : 17))
        .attr("fill", (d) => getProblemColor(d.prob_main))
        .attr("fill-opacity", 0.22);

      selectedGlow
        .append("circle")
        .attr("r", (d) => (isNodeRecommended(d) ? 16 : 10))
        .attr("fill", "#ffffff")
        .attr("fill-opacity", 0.38);

      nodeLayer.selectAll(".selected-case-glow").lower();
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
      .attr("r", (d) => {
        if (isSelectedNode(d)) return isNodeRecommended(d) ? 8.4 : 6.6;
        return isNodeRecommended(d) ? 7.5 : 5.5;
      })
      .attr("fill", (d) => getProblemColor(d.prob_main))
      .attr("fill-opacity", (d) => (isSelectedNode(d) || isNodeRecommended(d) ? 0.98 : 0.62))
      .attr("stroke", (d) => (isSelectedNode(d) || isNodeRecommended(d) ? "#ffffff" : "none"))
      .attr("stroke-width", (d) => (isSelectedNode(d) ? 2.2 : isNodeRecommended(d) ? 1.5 : 0))
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

    const selectedScatterGlow = nodeLayer
      .selectAll(".selected-case-glow")
      .data(data.filter(isSelectedNode))
      .enter()
      .append("g")
      .attr("class", "selected-case-glow")
      .attr("transform", (d) => `translate(${xAccessor(d)},${yAccessor(d)})`)
      .style("pointer-events", "none");

    selectedScatterGlow
      .append("circle")
      .attr("r", 24)
      .attr("fill", (d) => getProblemColor(d.prob_main))
      .attr("fill-opacity", 0.12);

    selectedScatterGlow
      .append("circle")
      .attr("r", 15)
      .attr("fill", (d) => getProblemColor(d.prob_main))
      .attr("fill-opacity", 0.2);

    nodeLayer.selectAll(".selected-case-glow").lower();
    nodeLayer.selectAll(".case-node").raise();
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
                style={viewMode === "dynamic" ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => handleViewModeChange("dynamic")}
                disabled={!hasDynamicMap}
                title={!hasDynamicMap ? "검색 후 확인할 수 있습니다." : "현재 검색어 기준 동적 좌표 맵"}
              >
                탐색형 맵
              </button>
              <button
                type="button"
                style={viewMode === "scatter" ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => handleViewModeChange("scatter")}
              >
                산점도
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
            ? "드래그로 이동 · 휠로 확대/축소"
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
