import { useState, useEffect, useRef } from "react";
import CaseMap from "./CaseMap";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || "http://localhost:8000";

const INDUSTRIES = ["IT·플랫폼", "커머스", "리테일", "식음료", "금융", "물류·운송", "제조", "콘텐츠·미디어", "헬스케어", "부동산·공간", "기타"];
const CATEGORIES = ["고객", "성장", "혁신", "효율"];
const KEYWORDS = {
  "고객": ["만족도", "개인화", "UX", "참여도", "이탈률", "접근성"],
  "성장": ["신규시장", "수익성", "확장성", "글로벌진출", "경쟁심화", "사용자변화"],
  "혁신": ["디지털전환", "기술전환필요", "서비스노후화", "경쟁심화", "사용자변화"],
  "효율": ["생산성", "비용", "운영복잡도", "물류", "공급망"]
};

const SYSTEM_PROMPT = `당신은 DBR(동아비즈니스리뷰) 케이스 아틀라스 서비스의 AI 분석 엔진입니다.`;

const EXAMPLE_QUERIES = [
  "브랜드 인지도는 높아졌는데 구매 전환율이 낮아요.",
  "매출은 나오는데 수익성이 계속 악화되고 있어요.",
  "새로운 시장에 진입하려는데 어디서부터 시작해야 할지 모르겠어요.",
  "신규 유저는 늘고 있는데 고객 이탈률이 높아요.",
  "기술은 있는데 어떤 고객층부터 공략해야 할지 모르겠어요.",
];

const HERO_KEYWORDS = [
  "반복되는 고객 이탈이",
  "오르지 않는 매출이",
  "낮은 구매 전환율이",
  "오래된 브랜드 이미지가",
  "새로운 성장 방향이",
  "줄어드는 재방문율이",
  "늘어나는 운영 비용이",
  "정체된 성장세가",
];

const getStatusLabel = (status) => {
  const statusMap = {
    DIRECT_MATCH: "딱 맞는 사례를 찾았어요",
    CLOSE_MATCH: "비슷한 고민을 다룬 사례를 찾았어요",
    ALTERNATIVE_MATCH: "참고할 만한 대체 사례예요",
    LOW_MATCH: "조금 더 구체적인 설명이 필요해요",
    NO_RESULT: "아직 맞는 사례를 찾지 못했어요",
  };

  return statusMap[status] || "추천 결과";
};

const getStatusMessage = (status, defaultMessage) => {
  const messageMap = {
    DIRECT_MATCH: "입력한 고민과 잘 맞는 DBR 케이스를 찾았어요.",
    CLOSE_MATCH: "완전히 같지는 않지만, 문제 상황과 해결 방향이 꽤 비슷한 사례예요.",
    ALTERNATIVE_MATCH: "정확히 같은 사례는 부족하지만, 고민의 일부 조건과 연결되는 참고 사례를 보여드릴게요.",
    LOW_MATCH: "지금 입력만으로는 딱 맞는 사례를 찾기 어려워요. 산업, 문제 상황, 원하는 해결 방향을 조금 더 적어보세요.",
    NO_RESULT: "조건에 맞는 추천 결과를 찾지 못했어요. 검색어를 조금 다르게 입력해보세요.",
  };

  return messageMap[status] || defaultMessage || "";
};

export default function SearchPage({ onSearch, searchedCases = [] }) {
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState("case");
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [applyRole, setApplyRole] = useState("");
  const [applySituation, setApplySituation] = useState("");
  const [applyConstraint, setApplyConstraint] = useState("");
  const [loadingSearchMode, setLoadingSearchMode] = useState("case");
  const [loadingApplyStrategy, setLoadingApplyStrategy] = useState(false);
  const [loadingApplyStep, setLoadingApplyStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);
  const [applyRoleHistory, setApplyRoleHistory] = useState([]);
  const [applySituationHistory, setApplySituationHistory] = useState([]);
  const [applyConstraintHistory, setApplyConstraintHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("today");
  const [showQueryHistory, setShowQueryHistory] = useState(false);
  const [focusedApplyField, setFocusedApplyField] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [invalidNotice, setInvalidNotice] = useState("");
  
  const [allCases, setAllCases] = useState([]);
  const [caseLoadError, setCaseLoadError] = useState(null);
  const [popularCases, setPopularCases] = useState([]);
  const [popularLoading, setPopularLoading] = useState(false);
  const [popularError, setPopularError] = useState(null);
  const [popularQueries, setPopularQueries] = useState([]);
  const [popularQueryLoading, setPopularQueryLoading] = useState(false);
  const [popularQueryError, setPopularQueryError] = useState(null);
  const [caseViewCountMap, setCaseViewCountMap] = useState({});
  const [bookmarkedCaseIds, setBookmarkedCaseIds] = useState(new Set());

  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showPersonalStrategyModal, setShowPersonalStrategyModal] = useState(false);
  const [personalContext, setPersonalContext] = useState("");
  const [personalStrategyLoading, setPersonalStrategyLoading] = useState(false);
  const [personalStrategyError, setPersonalStrategyError] = useState(null);
  const [personalStrategyToast, setPersonalStrategyToast] = useState("");

  const [showAllList, setShowAllList] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showBottomExport, setShowBottomExport] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [clearBtnHover, setClearBtnHover] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 추천 케이스 리스트 클릭으로만 케이스맵 중앙 이동을 요청한다.
  // selectedCase/focusCaseId는 상세 패널과 선택 표시용이고,
  // centerTargetId/centerRequestKey는 맵 이동 명령용으로 분리한다.
  const [centerTargetId, setCenterTargetId] = useState(null);
  const [centerRequestKey, setCenterRequestKey] = useState(0);

  const [browseHover, setBrowseHover] = useState(false);
  const [showSelectedList, setShowSelectedList] = useState(false);
  const resultSectionRef = useRef(null);
  const applyHistoryAreaRef = useRef(null);

  const [exampleIndex, setExampleIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("businessQueryHistory") || "[]");
    const savedApplyRoleHistory = JSON.parse(localStorage.getItem("businessApplyRoleHistory") || "[]");
    const savedApplySituationHistory = JSON.parse(localStorage.getItem("businessApplySituationHistory") || "[]");
    const savedApplyConstraintHistory = JSON.parse(localStorage.getItem("businessApplyConstraintHistory") || "[]");

    setQueryHistory(savedHistory);
    setApplyRoleHistory(savedApplyRoleHistory);
    setApplySituationHistory(savedApplySituationHistory);
    setApplyConstraintHistory(savedApplyConstraintHistory);
  }, []);

  useEffect(() => {
    const handleClickOutsideApplyHistory = (event) => {
      if (
        applyHistoryAreaRef.current &&
        !applyHistoryAreaRef.current.contains(event.target)
      ) {
        setFocusedApplyField(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideApplyHistory);

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideApplyHistory);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setExampleIndex(prev => (prev + 1) % EXAMPLE_QUERIES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_KEYWORDS.length);
    }, 2300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cases`);

        if (!res.ok) {
          throw new Error("케이스 데이터를 불러오지 못했습니다.");
        }

        const json = await res.json();

        if (!json.success || !Array.isArray(json.data)) {
          throw new Error("케이스 데이터 형식이 올바르지 않습니다.");
        }

        const mappedCases = json.data.map((item) => ({
          id: item.case_idx,
          rank: null,
          case_idx: item.case_idx,
          title: item.title,
          company: item.comp_name,
          industry: item.industry,
          date: item.pub_year ? `${item.pub_year}년` : "",
          tags: [item.prob_main, item.prob_keyword, item.sol_type].filter(Boolean),
          summary: item.summary,
          similarity: null,

          chapter_title: item.chapter_title,
          src_url: item.src_url,
          issue_no: item.issue_no,
          pub_year: item.pub_year,
          comp_name: item.comp_name,
          comp_size: item.comp_size,
          prob_main: item.prob_main,
          prob_keyword: item.prob_keyword,
          prob_def: item.prob_def,
          sol_type: item.sol_type,
          sol_detail: item.sol_detail,
          perf_type: item.perf_type,
          perf_dir: item.perf_dir,
          x: item.x,
          y: item.y,
          created_at: item.created_at,
        }));

        const sorted = [...mappedCases].sort((a, b) => (b.pub_year || 0) - (a.pub_year || 0));
        sorted.forEach((item, index) => { item.rank = index + 1; });

        setAllCases(sorted);
      } catch (error) {
        console.error("케이스 데이터 로딩 실패:", error);
        setCaseLoadError(error.message);
      }
    };

    fetchCases();
  }, []);

  useEffect(() => {
    const fetchPopularCases = async () => {
      setPopularLoading(true);
      setPopularError(null);

      try {
        const res = await fetch(`${API_BASE_URL}/api/popular/cases?limit=5&days=7`);

        if (!res.ok) {
          throw new Error("인기 케이스를 불러오지 못했습니다.");
        }

        const json = await res.json();

        if (!json.success || !Array.isArray(json.data)) {
          throw new Error("인기 케이스 데이터 형식이 올바르지 않습니다.");
        }

        const mappedPopularCases = json.data.map((item, index) => ({
          id: item.case_idx,
          rank: index + 1,
          case_idx: item.case_idx,
          title: item.title,
          company: item.comp_name,
          industry: item.industry,
          date: item.pub_year ? `${item.pub_year}년` : "",
          summary: item.summary,
          view_count: item.view_count,

          chapter_title: item.chapter_title,
          src_url: item.src_url,
          issue_no: item.issue_no,
          pub_year: item.pub_year,
          comp_name: item.comp_name,
          comp_size: item.comp_size,
          prob_main: item.prob_main,
          prob_keyword: item.prob_keyword,
          prob_def: item.prob_def,
          sol_type: item.sol_type,
          sol_detail: item.sol_detail,
          perf_type: item.perf_type,
          perf_dir: item.perf_dir,
          x: item.x,
          y: item.y,
        }));

        setPopularCases(mappedPopularCases);
      } catch (error) {
        console.error("인기 케이스 로딩 실패:", error);
        setPopularError(error.message);
      } finally {
        setPopularLoading(false);
      }
    };

    fetchPopularCases();
  }, []);

  const fetchPopularQueries = async () => {
    setPopularQueryLoading(true);
    setPopularQueryError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/popular/queries?limit=10&days=7`);

      if (!res.ok) {
        throw new Error("인기 검색 키워드를 불러오지 못했습니다.");
      }

      const json = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("인기 검색 키워드 데이터 형식이 올바르지 않습니다.");
      }

      setPopularQueries(json.data);
    } catch (error) {
      console.error("인기 검색 키워드 로딩 실패:", error);
      setPopularQueryError(error.message);
    } finally {
      setPopularQueryLoading(false);
    }
  };

  const fetchCaseViewCounts = async (caseIds = []) => {
    const uniqueIds = [...new Set(
      caseIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (uniqueIds.length === 0) {
      setCaseViewCountMap({});
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/popular/case-view-counts?ids=${uniqueIds.join(",")}&days=365`
      );

      if (!res.ok) {
        throw new Error("케이스별 조회수를 불러오지 못했습니다.");
      }

      const json = await res.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("케이스별 조회수 데이터 형식이 올바르지 않습니다.");
      }

      const nextMap = {};

      json.data.forEach((item) => {
        nextMap[String(item.case_idx)] = Number(item.view_count || 0);
      });

      setCaseViewCountMap(nextMap);
    } catch (error) {
      console.error("케이스별 조회수 로딩 실패:", error);
      setCaseViewCountMap({});
    }
  };

  useEffect(() => {
    fetchPopularQueries();
  }, []);

  useEffect(() => {
    const candidateIds = (result?.map_candidates || [])
      .map((item) => item.case_idx || item.id)
      .filter(Boolean);

    fetchCaseViewCounts(candidateIds);
  }, [result?.map_candidates]);

  const handlePopularQueryClick = (keyword) => {
    if (!keyword) return;
    setQuery(keyword);
    setTextareaFocused(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadBookmarkedCaseIds = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setBookmarkedCaseIds(new Set());
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookmarks`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        setBookmarkedCaseIds(new Set());
        return;
      }

      const nextIds = new Set(
        data.data
          .map((item) => String(item.case_idx))
          .filter(Boolean)
      );

      setBookmarkedCaseIds(nextIds);
    } catch (error) {
      console.error("북마크 목록 확인 실패:", error);
      setBookmarkedCaseIds(new Set());
    }
  };

  useEffect(() => {
    loadBookmarkedCaseIds();

    const handleBookmarkUpdated = () => {
      loadBookmarkedCaseIds();
    };

    window.addEventListener("bookmarkUpdated", handleBookmarkUpdated);
    window.addEventListener("storage", handleBookmarkUpdated);

    return () => {
      window.removeEventListener("bookmarkUpdated", handleBookmarkUpdated);
      window.removeEventListener("storage", handleBookmarkUpdated);
    };
  }, []);

  useEffect(() => {
    let interval;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const increment = Math.floor(Math.random() * 7) + 2;
          return Math.min(prev + increment, 90);
        });
      }, 400);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!loadingApplyStrategy) {
      setLoadingApplyStep(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setLoadingApplyStep((prev) => prev + 1);
    }, 1500);

    return () => clearInterval(timer);
  }, [loadingApplyStrategy]);

  const getLoadingText = (percent) => {
  if (loadingSearchMode === "apply") {
    if (loadingApplyStrategy) {
      const applySteps = [
      "추천 케이스와 내 상황을 연결하고 있어요",
      "적용할 수 있는 전략을 찾고 있어요",
      "실행 순서와 주의점을 정리하고 있어요",
      "맞춤 전략을 완성하고 있어요",
    ];

      return applySteps[loadingApplyStep % applySteps.length];
    }

    if (percent < 30) return "내 역할과 고민을 정리하고 있어요";
    if (percent < 60) return "상황에 맞는 DBR 케이스를 찾고 있어요";
    if (percent < 90) return "케이스와 내 상황의 연결점을 살펴보고 있어요";
    return "맞춤 전략을 만들 준비를 하고 있어요";
  }

  if (percent < 30) return "입력한 고민을 DBR 기준으로 정리하고 있어요";
  if (percent < 60) return "비슷한 문제를 다룬 케이스를 찾고 있어요";
  if (percent < 90) return "해결 방식이 가까운 케이스를 추리고 있어요";
  return "추천 케이스를 보기 좋게 정리하고 있어요";
};

  const handleToggleBookmark = async (caseData) => {
    const token = localStorage.getItem("token");
    const caseIdx = caseData?.case_idx || caseData?.id;

    if (!token) {
      alert("북마크는 로그인 후 이용할 수 있습니다.");
      return;
    }

    if (!caseIdx) {
      alert("북마크할 케이스 정보를 찾지 못했습니다.");
      return;
    }

    const caseKey = String(caseIdx);
    const isAlreadyBookmarked = bookmarkedCaseIds.has(caseKey);

    try {
      const res = await fetch(`${API_BASE_URL}/api/bookmarks/${caseIdx}`, {
        method: isAlreadyBookmarked ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "북마크 처리에 실패했습니다.");
      }

      setBookmarkedCaseIds((prev) => {
        const next = new Set(prev);

        if (isAlreadyBookmarked) {
          next.delete(caseKey);
        } else {
          next.add(caseKey);
        }

        return next;
      });

      window.dispatchEvent(new Event("bookmarkUpdated"));
    } catch (error) {
      console.error("북마크 처리 실패:", error);
      alert(error.message || "북마크 처리 중 오류가 발생했습니다.");
    }
  };


  const saveSearchQueryLog = async (searchQuery, queryMeta, recommendations = []) => {
    if (!searchQuery) return null;

    const blockedRawQueryPattern =
      /(시발|씨발|ㅅㅂ|병신|새끼|개새|좆|존나|ㅈㄴ|꺼져|죽어|대머리새끼|미친|개빡|짜증)/i;

    if (blockedRawQueryPattern.test(searchQuery)) {
      console.log("검색 로그 저장 제외: 원문에 부적절한 표현 포함", searchQuery);
      return null;
    }

    const isValidBusinessQuery = queryMeta?.is_valid_business_query !== false;
    const displayKeyword = queryMeta?.display_keyword
      ? String(queryMeta.display_keyword).trim()
      : "";

    const keywordGroup = queryMeta?.keyword_group
      ? String(queryMeta.keyword_group).trim()
      : displayKeyword;

    const blockedDisplayKeywords = [
      "검색 의도 확인 필요",
      "기타",
      "일반 문의",
      "분류 불가",
      "확인 필요",
      "의도 확인 필요",
      "비즈니스 의도 확인 필요",
    ];

    const blockedPattern = /(test|asdf|qwer|ㅋㅋ|ㅎㅎ|짜증|시발|ㅅㅂ|개빡|몰라|안녕|뭐해)/i;

    const hasBlockedKeyword =
      !displayKeyword ||
      !keywordGroup ||
      blockedDisplayKeywords.includes(displayKeyword) ||
      blockedDisplayKeywords.includes(keywordGroup) ||
      blockedPattern.test(displayKeyword) ||
      blockedPattern.test(keywordGroup);

    if (!isValidBusinessQuery || hasBlockedKeyword || recommendations.length === 0) {
      console.log("검색 로그 저장 제외:", {
        isValidBusinessQuery,
        displayKeyword,
        keywordGroup,
        recommendationCount: recommendations.length,
        invalidReason: queryMeta?.invalid_reason || null,
      });

      return null;
    }

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/api/logs/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query_text: searchQuery,
          prob_main: queryMeta?.prob_main || null,
          prob_keyword: Array.isArray(queryMeta?.prob_keyword)
            ? queryMeta.prob_keyword.join(", ")
            : queryMeta?.prob_keyword || null,
          industry: queryMeta?.industry || null,
          sol_type: queryMeta?.sol_type || null,
          display_keyword: displayKeyword,
          keyword_group: keywordGroup,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "검색 로그 저장에 실패했습니다.");
      }

      return data.query_idx || data.data?.query_idx || null;
    } catch (error) {
      console.error("검색 로그 저장 실패:", error);
      return null;
    }
  };

  const saveBusinessQueryHistory = (text) => {
    const trimmedText = text.trim();

    if (!trimmedText) return;

    const newItem = {
      id: Date.now(),
      text: trimmedText,
      created_at: new Date().toISOString(),
    };

    const savedHistory = JSON.parse(localStorage.getItem("businessQueryHistory") || "[]");

    const updatedHistory = [newItem, ...savedHistory];

    localStorage.setItem("businessQueryHistory", JSON.stringify(updatedHistory));
    setQueryHistory(updatedHistory);
  };

  const getApplyHistoryConfig = (field) => {
    const configMap = {
      role: {
        storageKey: "businessApplyRoleHistory",
        history: applyRoleHistory,
        setter: setApplyRoleHistory,
        valueSetter: setApplyRole,
      },
      situation: {
        storageKey: "businessApplySituationHistory",
        history: applySituationHistory,
        setter: setApplySituationHistory,
        valueSetter: setApplySituation,
      },
      constraint: {
        storageKey: "businessApplyConstraintHistory",
        history: applyConstraintHistory,
        setter: setApplyConstraintHistory,
        valueSetter: setApplyConstraint,
      },
    };

    return configMap[field] || null;
  };

  const saveApplyFieldHistory = (field, text) => {
    const trimmedText = text.trim();
    const config = getApplyHistoryConfig(field);

    if (!trimmedText || !config) return;

    const newItem = {
      id: Date.now(),
      text: trimmedText,
      created_at: new Date().toISOString(),
    };

    const savedHistory = JSON.parse(localStorage.getItem(config.storageKey) || "[]");
    const filteredHistory = savedHistory.filter((item) => item.text !== trimmedText);
    const updatedHistory = [newItem, ...filteredHistory].slice(0, 10);

    localStorage.setItem(config.storageKey, JSON.stringify(updatedHistory));
    config.setter(updatedHistory);
  };

  const saveBusinessApplyHistory = () => {
    saveApplyFieldHistory("role", applyRole);
    saveApplyFieldHistory("situation", applySituation);
    saveApplyFieldHistory("constraint", applyConstraint);
  };


  const handleDeleteQueryHistory = (historyId) => {
    const updatedHistory = queryHistory.filter((item) => item.id !== historyId);
    localStorage.setItem("businessQueryHistory", JSON.stringify(updatedHistory));
    setQueryHistory(updatedHistory);
    setTextareaFocused(true);
    setShowQueryHistory(true);
  };

  const handleDeleteApplyFieldHistory = (field, historyId) => {
    const config = getApplyHistoryConfig(field);

    if (!config) return;

    const updatedHistory = config.history.filter((item) => item.id !== historyId);
    localStorage.setItem(config.storageKey, JSON.stringify(updatedHistory));
    config.setter(updatedHistory);
    setFocusedApplyField(field);
  };

  const handleSelectApplyFieldHistory = (field, text) => {
    const config = getApplyHistoryConfig(field);

    if (!config) return;

    config.valueSetter(text || "");
    setFocusedApplyField(null);
  };

  const renderApplyFieldHistory = (field) => {
    const config = getApplyHistoryConfig(field);

    if (!config || focusedApplyField !== field || config.history.length === 0) return null;

    return (
      <div style={styles.applyFieldHistoryDropdown}>
        {config.history.slice(0, 6).map((item) => (
          <div
            key={item.id}
            style={styles.applyFieldHistoryItem}
            onMouseEnter={e => e.currentTarget.style.background = "#fef0e9"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelectApplyFieldHistory(field, item.text);
            }}
          >
            <span style={styles.applyFieldHistoryText}>{item.text}</span>
            <span style={styles.applyFieldHistoryDate}>{new Date(item.created_at).toLocaleDateString()}</span>
            <button
              type="button"
              style={styles.applyFieldHistoryDeleteBtn}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteApplyFieldHistory(field, item.id);
              }}
              aria-label="최근 입력 삭제"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    );
  };

  const buildApplyContextText = () => {
    const role = applyRole.trim();
    const situation = applySituation.trim();
    const constraint = applyConstraint.trim();

    return [
      role ? `직무/역할: ${role}` : "",
      situation ? `현재 문제 상황: ${situation}` : "",
      constraint ? `제약 조건/원하는 방향: ${constraint}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const isApplyInputReady = () => (
    applyRole.trim() &&
    applySituation.trim() &&
    applyConstraint.trim()
  );

  const requestPersonalStrategiesForCases = async (userContext, sourceCases) => {
    const requestBody = {
      user_context: userContext,
      cases: sourceCases.map((caseItem) => ({
        case_idx: caseItem.case_idx || caseItem.id,
        title: caseItem.title,
        summary: caseItem.summary,
        prob_def: caseItem.prob_def,
        sol_detail: caseItem.sol_detail,
        prob_main: caseItem.prob_main,
        prob_keyword: caseItem.prob_keyword,
        sol_type: caseItem.sol_type,
        industry: caseItem.industry,
        perf_type: caseItem.perf_type,
        perf_dir: caseItem.perf_dir,
        reco_reason: caseItem.reco_reason,
        condition_match: caseItem.condition_match,
        final_score: caseItem.final_score,
      })),
    };

    const res = await fetch(`${AI_API_BASE_URL}/personal-strategies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "맞춤 전략 생성에 실패했습니다.");
    }

    const data = await res.json();
    const strategies = Array.isArray(data.strategies) ? data.strategies : [];

    return new Map(
      strategies.map((item) => [
        String(item.case_idx),
        {
          personal_strategy: item.personal_strategy || "",
          personal_strategy_status: item.strategy_status || null,
        },
      ])
    );
  };

  const applyPersonalStrategiesToCases = (sourceCases, strategyMap, userContext) => (
    sourceCases.map((caseItem) => {
      const caseKey = String(caseItem.case_idx ?? caseItem.id);
      const strategyInfo = strategyMap.get(caseKey);

      if (!strategyInfo) return caseItem;

      return {
        ...caseItem,
        personal_strategy: strategyInfo.personal_strategy,
        personal_strategy_status: strategyInfo.personal_strategy_status,
        personal_context: userContext,
      };
    })
  );

  const handleSearch = async () => {
    const filters = [selectedIndustry, selectedCategory, selectedKeyword]
      .filter((val) => val && val !== "상관없음")
      .join(", ");

    const isApplyMode = searchMode === "apply";
    const applyContextText = buildApplyContextText();

    if (isApplyMode) {
      if (!isApplyInputReady()) return;
    } else if (!query.trim() && !filters) {
      return;
    }

    const baseQueryText = isApplyMode ? applyContextText : query.trim();
    const searchQuery = baseQueryText
      ? filters
        ? `[필터조건: ${filters}] ${baseQueryText}`
        : baseQueryText
      : filters;

    const rawQueryText = baseQueryText;
    
    if (isApplyMode) {
      saveBusinessApplyHistory();
    } else {
      saveBusinessQueryHistory(rawQueryText);
    }
    setLoadingSearchMode(searchMode);
    setLoadingApplyStrategy(false);

    const blockedRawQueryPattern =
      /(시발|씨발|ㅅㅂ|병신|새끼|개새|좆|존나|ㅈㄴ|꺼져|죽어|대머리새끼|미친|개빡|짜증)/i;

    if (blockedRawQueryPattern.test(rawQueryText)) {
      const noticeMessage =
        "입력하신 문장에 부적절한 표현이 포함되어 있어요. 비즈니스 문제 중심으로 다시 작성해주세요.";

      setResult({
        search_mode: isApplyMode ? "apply" : "case",
        problem_summary: noticeMessage,
        problem_types: [],
        kpis: [],
        causes: [],
        query_idx: null,
        query_meta: {
          is_valid_business_query: false,
          invalid_reason: noticeMessage,
        },
        result_status: {
          status: "NO_RESULT",
          message: noticeMessage,
        },
        cases: [],
      });

      setInvalidNotice(noticeMessage);

      if (onSearch) {
        onSearch([]);
      }

      setTimeout(() => {
        setInvalidNotice("");
      }, 3200);

      setHasSearched(true);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setInvalidNotice("");
    setCenterTargetId(null);
    setCenterRequestKey(0);

    try {
      const requestBody = {
        query: String(searchQuery || "").trim(),
        top_k: 80,
        rerank_k: 20,
        final_k: 5,
      };

      const res = await fetch(`${AI_API_BASE_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error("추천 API 오류 상세:", errorData);
        throw new Error(errorData?.detail || "추천 API 호출에 실패했습니다.");
      }

      const data = await res.json();

      const queryMeta = data.query_meta || {};
      const resultStatus = data.result_status || {};
      const recommendations = data.recommendations || [];
      const mapCandidatesRaw = Array.isArray(data.map_candidates) ? data.map_candidates : [];

      if (queryMeta.is_valid_business_query === false || recommendations.length === 0) {
        const noticeMessage =
          resultStatus.message ||
          queryMeta.invalid_reason ||
          "입력하신 내용만으로는 어떤 비즈니스 문제를 해결하려는지 파악하기 어려워요. 해결하고 싶은 상황을 조금 더 구체적으로 적어주세요.";

        setResult({
          problem_summary: noticeMessage,
          problem_types: [],
          kpis: [],
          causes: [],
          query_idx: null,
          query_meta: queryMeta,
          result_status: {
            status: "NO_RESULT",
            message: noticeMessage,
          },
          cases: [],
          map_candidates: [],
        });

        setInvalidNotice(noticeMessage);

        if (onSearch) {
          onSearch([]);
        }

        setTimeout(() => {
          setInvalidNotice("");
        }, 3200);

        return;
      }

      const savedQueryIdx = await saveSearchQueryLog(searchQuery, queryMeta, recommendations);

      if (savedQueryIdx) {
        fetchPopularQueries();
      }

      const mappedCases = recommendations.map((item, index) => ({
        id: item.case_idx,
        rank: item.ranking || index + 1,
        case_idx: item.case_idx,
        title: item.title,
        company: item.comp_name,
        industry: item.industry,
        date: item.pub_year ? `${item.pub_year}년` : "",
        tags: [item.prob_main, item.prob_keyword, item.sol_type].filter(Boolean),
        summary: item.summary,
        similarity: item.final_score != null
          ? Number(item.final_score) * 100
          : null,
        isRecommended: true,

        chapter_title: item.chapter_title,
        src_url: item.src_url,
        issue_no: item.issue_no,
        pub_year: item.pub_year,
        comp_name: item.comp_name,
        comp_size: item.comp_size,
        prob_main: item.prob_main,
        prob_keyword: item.prob_keyword,
        prob_def: item.prob_def,
        sol_type: item.sol_type,
        sol_detail: item.sol_detail,
        perf_type: item.perf_type,
        perf_dir: item.perf_dir,
        x: item.x,
        y: item.y,
        dynamic_x: item.dynamic_x,
        dynamic_y: item.dynamic_y,
        map_group: item.map_group || "recommended",
        map_distance: item.map_distance,
        map_rank: item.map_rank,
        map_angle: item.map_angle,

        meta_sim: item.meta_sim,
        summary_sim: item.summary_sim,
        metadata_bonus: item.metadata_bonus,
        base_score: item.base_score,
        gpt_relevance_score: item.gpt_relevance_score,
        condition_match: item.condition_match,
        raw_final_score: item.raw_final_score,
        final_score: item.final_score,
        reco_reason: item.reco_reason,
        reason_check: item.reason_check,
        personal_strategy: null,
        personal_strategy_status: null,
      }));


      const mappedMapCandidates = (mapCandidatesRaw.length > 0 ? mapCandidatesRaw : recommendations).map((item, index) => ({
        id: item.case_idx,
        rank: item.ranking || item.rank || null,
        case_idx: item.case_idx,
        title: item.title,
        company: item.comp_name || item.company,
        industry: item.industry,
        date: item.pub_year ? `${item.pub_year}년` : "",
        tags: [item.prob_main, item.prob_keyword, item.sol_type].filter(Boolean),
        summary: item.summary,
        similarity: item.final_score != null
          ? Number(item.final_score) * 100
          : item.similarity ?? null,
        isRecommended: item.is_recommended === true || item.isRecommended === true || item.map_group === "recommended" || (item.ranking != null && Number(item.ranking) <= 5),

        chapter_title: item.chapter_title,
        src_url: item.src_url,
        issue_no: item.issue_no,
        pub_year: item.pub_year,
        comp_name: item.comp_name || item.company,
        comp_size: item.comp_size,
        prob_main: item.prob_main,
        prob_keyword: item.prob_keyword,
        prob_def: item.prob_def,
        sol_type: item.sol_type,
        sol_detail: item.sol_detail,
        perf_type: item.perf_type,
        perf_dir: item.perf_dir,
        x: item.x,
        y: item.y,
        dynamic_x: item.dynamic_x,
        dynamic_y: item.dynamic_y,
        map_group: item.map_group || (item.is_recommended ? "recommended" : "candidate"),
        map_distance: item.map_distance,
        map_rank: item.map_rank,
        map_angle: item.map_angle,

        meta_sim: item.meta_sim,
        summary_sim: item.summary_sim,
        metadata_bonus: item.metadata_bonus,
        base_score: item.base_score,
        gpt_relevance_score: item.gpt_relevance_score,
        condition_match: item.condition_match,
        raw_final_score: item.raw_final_score,
        final_score: item.final_score,
        reco_reason: item.reco_reason,
        reason_check: item.reason_check,
        personal_strategy: null,
        personal_strategy_status: null,
      })).filter((item) => {
        const score = Number(item.final_score ?? 0);
        return item.isRecommended || score >= 0.4;
      });

      let finalMappedCases = mappedCases;

      if (isApplyMode) {
        setLoadingApplyStrategy(true);
        const strategyMap = await requestPersonalStrategiesForCases(applyContextText, mappedCases);
        finalMappedCases = applyPersonalStrategiesToCases(mappedCases, strategyMap, applyContextText);
        setPersonalContext(applyContextText);
        setPersonalStrategyToast("맞춤 전략이 생성되었습니다.");

        setTimeout(() => {
          setPersonalStrategyToast("");
        }, 3200);
      }

      setResult({
        search_mode: isApplyMode ? "apply" : "case",
        problem_summary:
          resultStatus.message ||
          queryMeta.expected_cause ||
          "입력하신 고민을 바탕으로 유사한 DBR 케이스를 추천했습니다.",

        problem_types: [
          queryMeta.prob_main,
          ...(Array.isArray(queryMeta.prob_keyword) ? queryMeta.prob_keyword : []),
        ].filter(Boolean),

        kpis: [
          queryMeta.perf_type,
          queryMeta.sol_type,
        ].filter(Boolean),

        causes: [
          queryMeta.expected_cause,
          ...(Array.isArray(queryMeta.must_have) ? queryMeta.must_have : []),
        ].filter(Boolean),

        query_idx: savedQueryIdx,
        query_text: rawQueryText,
        raw_query_text: rawQueryText,
        search_query: searchQuery,
        searched_at: new Date().toISOString(),
        query_meta: queryMeta,
        result_status: resultStatus,
        cases: finalMappedCases,
        map_candidates: mappedMapCandidates,
      });

      if (onSearch) {
        onSearch(finalMappedCases);
      }

      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } catch (e) {
      console.error("추천 API 호출 실패:", e);
      setError(e.message || "추천 결과를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setLoadingApplyStrategy(false);
      setHasSearched(true);
    }
  };

  const getFilteredQueryHistory = () => {
    const now = new Date();

    return queryHistory.filter((item) => {
      const createdAt = new Date(item.created_at);
      const diffTime = now - createdAt;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (historyFilter === "today") {
        return createdAt.toDateString() === now.toDateString();
      }

      if (historyFilter === "week") {
        return diffDays <= 7;
      }

      if (historyFilter === "month") {
        return diffDays <= 30;
      }

      return true;
    });
  };

  const handleCreatePersonalStrategies = async () => {
    const trimmedContext = personalContext.trim();

    if (!trimmedContext) {
      setPersonalStrategyError("현재 상황을 먼저 입력해주세요.");
      return;
    }

    if (!result?.cases || result.cases.length === 0) {
      setPersonalStrategyError("맞춤 전략을 생성할 추천 케이스가 없습니다.");
      return;
    }

    setPersonalStrategyLoading(true);
    setPersonalStrategyError(null);

    try {
      const requestBody = {
        user_context: trimmedContext,
        cases: result.cases.map((caseItem) => ({
          case_idx: caseItem.case_idx || caseItem.id,
          title: caseItem.title,
          summary: caseItem.summary,
          prob_def: caseItem.prob_def,
          sol_detail: caseItem.sol_detail,
          prob_main: caseItem.prob_main,
          prob_keyword: caseItem.prob_keyword,
          sol_type: caseItem.sol_type,
          industry: caseItem.industry,
          perf_type: caseItem.perf_type,
          perf_dir: caseItem.perf_dir,
          reco_reason: caseItem.reco_reason,
          condition_match: caseItem.condition_match,
          final_score: caseItem.final_score,
        })),
      };

      const res = await fetch(`${AI_API_BASE_URL}/personal-strategies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "맞춤 전략 생성에 실패했습니다.");
      }

      const data = await res.json();
      const strategies = Array.isArray(data.strategies) ? data.strategies : [];
      const strategyMap = new Map(
        strategies.map((item) => [
          String(item.case_idx),
          {
            personal_strategy: item.personal_strategy || "",
            personal_strategy_status: item.strategy_status || null,
          },
        ])
      );

      const applyStrategyToCase = (caseItem) => {
        const caseKey = String(caseItem.case_idx ?? caseItem.id);
        const strategyInfo = strategyMap.get(caseKey);

        if (!strategyInfo) return caseItem;

        return {
          ...caseItem,
          personal_strategy: strategyInfo.personal_strategy,
          personal_strategy_status: strategyInfo.personal_strategy_status,
          personal_context: trimmedContext,
        };
      };

      setResult((prev) => {
        if (!prev?.cases) return prev;

        return {
          ...prev,
          cases: prev.cases.map(applyStrategyToCase),
        };
      });

      setSelectedCase((prev) => (prev ? applyStrategyToCase(prev) : prev));
      setSelectedCases((prev) => prev.map(applyStrategyToCase));
      setShowPersonalStrategyModal(false);
      setPersonalStrategyToast("맞춤 전략이 생성되었습니다.");

      setTimeout(() => {
        setPersonalStrategyToast("");
      }, 3200);
    } catch (error) {
      console.error("적용 방향 생성 실패:", error);
      setPersonalStrategyError(error.message || "맞춤 전략 생성 중 오류가 발생했습니다.");
    } finally {
      setPersonalStrategyLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setApplyRole("");
    setApplySituation("");
    setApplyConstraint("");
    setSearchMode("case");
    setResult(null);
    setError(null);
    setSelectedCase(null);
    setSelectedCases([]);
    setSelectedIndustry(null);
    setSelectedCategory(null);
    setSelectedKeyword(null);
    setShowAnalysisModal(false);
    setShowPersonalStrategyModal(false);
    setShowBottomExport(false);
    setPersonalContext("");
    setPersonalStrategyError(null);
    setShowAllList(false);
    setVisibleCount(10);
    setHasSearched(false);
    setCenterTargetId(null);
    setCenterRequestKey(0);
  };

  const toggleSelectCase = (c) => {
    setSelectedCases((prev) =>
      prev.find((s) => s.title === c.title)
        ? prev.filter((s) => s.title !== c.title)
        : prev.length < 3 ? [...prev, c] : prev
    );
  };

  const cases = result ? result.cases : allCases.slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 }));
  const isSearchDisabled = loading || (
    searchMode === "apply"
      ? !isApplyInputReady()
      : (!query.trim() && !selectedIndustry && !selectedCategory)
  );

  const recommendedCaseIds = result?.cases
    ? result.cases.map((c) => String(c.case_idx ?? c.id))
    : [];

  const mapCases = allCases.map((c) => {
    const matched = result?.cases?.find((r) => {
      const cId = String(c.case_idx ?? c.id);
      const rId = String(r.case_idx ?? r.id);

      return cId === rId || c.title === r.title;
    });

    if (!matched) return c;

    return {
      ...c,
      ...matched,
      id: c.id,
      case_idx: c.case_idx,
      title: c.title,
      company: c.company,
      comp_name: c.comp_name,
      rank: matched.rank,
      similarity: matched.similarity,
      isRecommended: true,
      dynamic_x: matched.dynamic_x,
      dynamic_y: matched.dynamic_y,
      map_group: matched.map_group,
      map_distance: matched.map_distance,
      map_rank: matched.map_rank,
      map_angle: matched.map_angle,
    };
  });

  const mapCandidatesWithViewCount = (result?.map_candidates || []).map((item) => {
    const caseId = String(item.case_idx ?? item.id ?? "");
    const dbViewCount = caseViewCountMap[caseId];

    return {
      ...item,
      view_count: Number.isFinite(dbViewCount)
        ? dbViewCount
        : Number(item.view_count || 0),
    };
  });

  const mergeDefinedCaseData = (...sources) => {
    const merged = {};

    sources.forEach((source) => {
      if (!source) return;

      Object.entries(source).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          merged[key] = value;
        }
      });
    });

    return merged;
  };

  const enrichCaseForSelection = (caseData) => {
    const targetId = String(caseData?.case_idx ?? caseData?.id ?? "");

    if (!targetId) return caseData;

    const archiveMatch = allCases.find((item) => String(item.case_idx ?? item.id) === targetId);
    const mapMatch = result?.map_candidates?.find((item) => String(item.case_idx ?? item.id) === targetId);
    const recommendMatch = result?.cases?.find((item) => String(item.case_idx ?? item.id) === targetId);

    return mergeDefinedCaseData(
      archiveMatch,
      mapMatch,
      recommendMatch,
      caseData
    );
  };

  const getCurrentHistoryContext = (viewSource = "unknown") => {
    const source = String(viewSource || "unknown");
    const isSearchBasedSource = ["recommend", "map"].includes(source);

    if (!isSearchBasedSource || !result) {
      return {
        view_source: source,
        query_text: "",
        search_query: "",
        query_idx: null,
        searched_at: null,
        search_mode: null,
      };
    }

    return {
      view_source: source,
      query_text: result.raw_query_text || result.query_text || result.search_query || "",
      search_query: result.search_query || result.query_text || result.raw_query_text || "",
      query_idx: result.query_idx || null,
      searched_at: result.searched_at || null,
      search_mode: result.search_mode || null,
    };
  };

  const saveCaseViewLog = async (caseData, viewSource = "unknown") => {
    const caseIdx = caseData?.case_idx || caseData?.id;

    if (!caseIdx) return;

    try {
      const token = localStorage.getItem("token");

      await fetch(`${API_BASE_URL}/api/logs/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          case_idx: caseIdx,
          query_idx: ["recommend", "map"].includes(viewSource) ? result?.query_idx || null : null,
          view_source: viewSource,
        }),
      });
    } catch (error) {
      console.error("케이스 조회 로그 저장 실패:", error);
    }
  };

  const handleCaseSelect = (caseData, viewSource = "unknown") => {
    if (!caseData) {
      setSelectedCase(null);
      return;
    }

    const enrichedCase = enrichCaseForSelection(caseData);
    if (!enrichedCase) return;

    const historyContext = getCurrentHistoryContext(viewSource);

    setSelectedCase({
      ...enrichedCase,
      _view_source: viewSource,
      _query_text: historyContext.query_text,
      _search_query: historyContext.search_query,
      _query_idx: historyContext.query_idx,
      _searched_at: historyContext.searched_at,
      _search_mode: historyContext.search_mode,
    });
    saveCaseViewLog(enrichedCase, viewSource);
  };

  const requestCaseMapCenter = (caseData) => {
    const caseId = caseData?.case_idx ?? caseData?.id;

    if (!caseId) return;

    setCenterTargetId(String(caseId));
    setCenterRequestKey((prev) => prev + 1);
  };

  const handleRecommendedCaseSelect = (caseData) => {
    handleCaseSelect(caseData, result ? "recommend" : "archive");

    const caseId = String(caseData?.case_idx ?? caseData?.id ?? "");
    const isRecommendedResult = Boolean(
      result?.cases?.some((item) => String(item.case_idx ?? item.id) === caseId)
    );

    // 화면 중앙 이동은 추천 케이스 리스트 TOP5 클릭일 때만 발생한다.
    // 케이스맵 내부 점/라벨 클릭은 CaseMap의 onCaseClick만 타므로 여기로 들어오지 않는다.
    if (isRecommendedResult) {
      requestCaseMapCenter(caseData);
    }
  };

  useEffect(() => {
    const handleMapCaseSelect = (event) => {
      if (!event?.detail) {
        setSelectedCase(null);
        return;
      }

      handleCaseSelect(event.detail, "map");
    };

    const handleMapCaseClear = () => {
      setSelectedCase(null);
    };

    window.addEventListener("caseMapCaseSelect", handleMapCaseSelect);
    window.addEventListener("caseMapCaseClear", handleMapCaseClear);

    return () => {
      window.removeEventListener("caseMapCaseSelect", handleMapCaseSelect);
      window.removeEventListener("caseMapCaseClear", handleMapCaseClear);
    };
  }, [result, allCases]);

  return (
    <>
      <style>{`
        body {
          font-family: 'Karrot Sans', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', sans-serif;
        }

        @keyframes fadeInOut {
          0% { opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes heroKeywordSlide {
          0% { opacity: 0; transform: translateY(18px); }
          16% { opacity: 1; transform: translateY(0); }
          82% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-16px); }
        }

        @keyframes loadingPageFlip {
          0% { transform: rotateY(0deg); opacity: 0.9; }
          45% { transform: rotateY(-145deg); opacity: 0.75; }
          100% { transform: rotateY(-180deg); opacity: 0; }
        }

        @keyframes loadingBookPulse {
          0%, 100% { transform: translateY(0); box-shadow: 0 10px 24px rgba(232, 111, 0, 0.12); }
          50% { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(232, 111, 0, 0.18); }
        }

        @keyframes loadingCardFloat {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50% { transform: translateY(-5px); opacity: 1; }
        }

        @keyframes loadingMagnifierScan {
          0% { transform: translateX(-12px) translateY(3px) rotate(-8deg); }
          50% { transform: translateX(54px) translateY(-3px) rotate(6deg); }
          100% { transform: translateX(-12px) translateY(3px) rotate(-8deg); }
        }

        @keyframes loadingStrategySlide {
          0% { transform: translateY(8px); opacity: 0.25; }
          35% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-3px); opacity: 0.7; }
        }

        @keyframes loadingMapPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.45); opacity: 1; }
        }
      `}</style>
      <div style={styles.topSearchLayout}>
        <div style={styles.searchMainCol}>
          <div style={styles.page}>
        <div style={styles.logoArea}>
          <div style={styles.heroTitleWrap}>
            <h1 style={styles.logoTitle}>
              <span key={heroIndex} style={styles.heroKeyword}>
                {HERO_KEYWORDS[heroIndex]}
              </span>{" "}
              <span style={{ color: "#E86F00" }}>고민이신가요?</span>
            </h1>
          </div>
        </div>

        <div style={{ ...styles.filterWrapper, margin: "0 auto 1.5rem" }}>
          <div style={styles.filterSection}>
            <p style={styles.filterLabel}>1. 산업군</p>
            <div style={styles.chipGroup}>
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  style={selectedIndustry === ind ? styles.chipActive : styles.chip}
                  onClick={() => {
                    setSelectedIndustry(ind === selectedIndustry ? null : ind);
                    setSelectedCategory(null);
                    setSelectedKeyword(null);
                  }}
                >{ind}</button>
              ))}
            </div>
          </div>

          {selectedIndustry && (
            <div style={styles.filterSection}>
              <p style={styles.filterLabel}>2. 문제 유형</p>
              <div style={styles.chipGroup}>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    style={selectedCategory === cat ? styles.chipActive : styles.chip}
                    onClick={() => {
                      setSelectedCategory(cat === selectedCategory ? null : cat);
                      setSelectedKeyword(null);
                    }}
                  >{cat}</button>
                ))}
                <button
                  style={selectedCategory === "상관없음" ? styles.chipActiveNone : styles.chipNone}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === "상관없음" ? null : "상관없음");
                    setSelectedKeyword(null);
                  }}
                >상관없음</button>
              </div>
            </div>
          )}

          {selectedCategory && selectedCategory !== "상관없음" && (
            <div style={{ ...styles.filterSection, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
              <p style={styles.filterLabel}>3. 핵심 키워드</p>
              <div style={styles.chipGroup}>
                {KEYWORDS[selectedCategory].map((kw) => (
                  <button
                    key={kw}
                    style={selectedKeyword === kw ? styles.chipActive : styles.chip}
                    onClick={() => setSelectedKeyword(kw === selectedKeyword ? null : kw)}
                  >{kw}</button>
                ))}
                <button
                  style={selectedKeyword === "상관없음" ? styles.chipActiveNone : styles.chipNone}
                  onClick={() => setSelectedKeyword(selectedKeyword === "상관없음" ? null : "상관없음")}
                >상관없음</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={styles.searchModeRow}>
            <div style={styles.searchModeHelpWrap}>
              <button
                type="button"
                style={styles.searchModeHelpBtn}
                onMouseEnter={() => setShowModeHelp(true)}
                onMouseLeave={() => setShowModeHelp(false)}
                onFocus={() => setShowModeHelp(true)}
                onBlur={() => setShowModeHelp(false)}
                aria-label="검색 모드 설명"
              >
                ?
              </button>
              {showModeHelp && (
                <div style={styles.searchModeHelpTooltip}>
                  {/* <p style={styles.searchModeHelpTitle}>검색 모드 차이</p> */}

                  <div style={styles.searchModeHelpItem}>
                    <span style={styles.searchModeHelpBadge}>관련 케이스 찾기</span>
                    <p style={styles.searchModeHelpText}>
                      입력한 고민과 비슷한 DBR 케이스를 빠르게 찾아드려요.
                    </p>
                  </div>

                  <div style={styles.searchModeHelpItemLast}>
                    <span style={styles.searchModeHelpBadge}>내 상황에 적용하기</span>
                    <p style={styles.searchModeHelpText}>
                      직무와 상황을 바탕으로 케이스를 찾고, <br/>내 상황에 맞는 실행 방향까지 정리해드려요.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div style={styles.searchModeBox}>
              <button
                type="button"
                style={searchMode === "case" ? styles.searchModeBtnActive : styles.searchModeBtn}
                onClick={() => {
                  if (loading) return;
                  setSearchMode("case");
                }}
                disabled={loading}
              >
                관련 케이스 찾기
              </button>
              <button
                type="button"
                style={searchMode === "apply" ? styles.searchModeBtnActive : styles.searchModeBtn}
                onClick={() => {
                  if (loading) return;
                  setSearchMode("apply");
                }}
                disabled={loading}
              >
                추천 케이스 내 상황에 적용하기
              </button>
            </div>
          </div>

          {searchMode === "case" ? (
            <div style={styles.caseModePanel}>
              <div style={styles.applyModeHeader}>
                <p style={styles.applyModeTitle}>관련 케이스 찾기</p>
                <p style={styles.applyModeDesc}>
                  해결하고 싶은 비즈니스 고민을 적으면, 비슷한 DBR 케이스를 찾아드려요.
                </p>
              </div>

              <div style={{ ...styles.inputPanel, border: textareaFocused ? "1.5px solid #f0f0f0" : "1px solid #eeeeee", position: "relative", width: "100%", maxWidth: "100%", margin: 0 }}>
                <textarea
                  style={{
                    ...styles.textarea,
                    minHeight: 120,
                    background: textareaFocused ? "#fff" : "#f5f5f5",
                    borderTop: textareaFocused ? "1.5px solid transparent" : "1px solid transparent",
                    borderLeft: textareaFocused ? "1.5px solid transparent" : "1px solid transparent",
                    borderRight: textareaFocused ? "1.5px solid transparent" : "1px solid transparent",
                    borderBottom: "none",
                    borderRadius: 0,
                    marginBottom: 0,
                  }}
                  placeholder="지금 해결하고 싶은 비즈니스 고민을 적어주세요."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowQueryHistory(e.target.value.trim() === "");
                  }}
                  onFocus={() => {
                    setTextareaFocused(true);
                    setShowQueryHistory(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => {
                      setTextareaFocused(false);
                      setShowQueryHistory(false);
                    }, 150);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch(); }}
                />
              </div>

              {textareaFocused && queryHistory.length > 0 && (
                <div style={styles.queryHistoryDropdown}>
                  {queryHistory.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      style={styles.queryHistoryDropdownItem}
                      onMouseEnter={e => e.currentTarget.style.background = "#fef0e9"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                      onClick={() => {
                        setQuery(item.text);
                        setShowQueryHistory(false);
                      }}
                    >
                      <span style={styles.queryHistoryDropdownText}>
                        {item.text}
                      </span>
                      <span style={styles.queryHistoryDropdownDate}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        style={styles.queryHistoryDeleteBtn}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteQueryHistory(item.id);
                        }}
                        aria-label="최근 검색어 삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.searchExampleBoxSeparate}>
                <span style={styles.searchExampleLabel}>입력 예시</span>
                <p key={exampleIndex} style={styles.searchExampleText}>
                  {EXAMPLE_QUERIES[exampleIndex]}
                </p>
              </div>
            </div>
          ) : (
            <div style={styles.applyModePanel} ref={applyHistoryAreaRef}>
              <div style={styles.applyModeHeader}>
                <p style={styles.applyModeTitle}>추천 케이스 내 상황에 적용하기</p>
                <p style={styles.applyModeDesc}>
                  내 역할과 고민을 알려주면, 추천 케이스를 바탕으로 실행 방향을 정리해드려요.
                  
                </p>
              </div>

              <div style={styles.applyInputGrid}>
                <div style={styles.applyFieldWrap}>
                  <label style={styles.applyField}>
                    <span style={styles.applyFieldLabel}>내 역할</span>
                    <input
                      type="text"
                      style={styles.applyInput}
                      value={applyRole}
                      onChange={(e) => setApplyRole(e.target.value)}
                      onFocus={() => setFocusedApplyField("role")}
                      placeholder="예: 커머스 서비스 PM"
                      disabled={loading}
                    />
                  </label>
                  {renderApplyFieldHistory("role")}
                </div>

                <div style={styles.applyFieldWrapWide}>
                  <label style={styles.applyFieldWide}>
                    <span style={styles.applyFieldLabel}>현재 고민</span>
                    <textarea
                      style={styles.applyTextarea}
                      value={applySituation}
                      onChange={(e) => setApplySituation(e.target.value)}
                      onFocus={() => setFocusedApplyField("situation")}
                      placeholder="예: 방문자는 늘고 있는데 실제 구매 전환율이 낮아 매출로 잘 이어지지 않아요."
                      disabled={loading}
                    />
                  </label>
                  {renderApplyFieldHistory("situation")}
                </div>

                <div style={styles.applyFieldWrapWide}>
                  <label style={styles.applyFieldWide}>
                    <span style={styles.applyFieldLabel}>제약 조건 / 원하는 방향</span>
                    <textarea
                      style={styles.applyTextareaSmall}
                      value={applyConstraint}
                      onChange={(e) => setApplyConstraint(e.target.value)}
                      onFocus={() => setFocusedApplyField("constraint")}
                      placeholder="예: 가격 할인보다 고객 경험을 개선해서 전환율을 높이고 싶어요."
                      disabled={loading}
                    />
                  </label>
                  {renderApplyFieldHistory("constraint")}
                </div>
              </div>
            </div>
          )}

          <div style={styles.btnRow}>
            <button
              style={{ ...styles.btnClear, background: clearBtnHover ? "#e8e8e8" : "transparent", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setClearBtnHover(true)}
              onMouseLeave={() => setClearBtnHover(false)}
              onClick={handleClear}
              disabled={isSearchDisabled && selectedIndustry === null}
            >다시 입력</button>
            <button
              style={{ ...styles.btnSearch, background: btnHover ? "#C45E00" : "#E86F00", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={handleSearch}
              disabled={isSearchDisabled}
            >{searchMode === "apply" ? "맞춤 전략 받기" : "케이스 찾아보기"}</button>
          </div>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}
        {caseLoadError && <p style={styles.errorText}>{caseLoadError}</p>}
          </div>
        </div>

        <div style={styles.popularSideCol}>
          <PopularRankBoard
            cases={popularCases}
            caseLoading={popularLoading}
            caseError={popularError}
            onCaseClick={(caseData) => handleCaseSelect(caseData, "popular")}
            queries={popularQueries}
            queryLoading={popularQueryLoading}
            queryError={popularQueryError}
            onQueryClick={handlePopularQueryClick}
          />
        </div>
      </div>

      {hasSearched && (
        <div ref={resultSectionRef} style={styles.splitRow}>
          <div style={styles.caseListCol}>
            <div style={styles.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={styles.cardLabel}>
                  추천 케이스 <span style={{ color: "#E86F00" }}>5</span>
                </p>
                
                {result && (
                  <button 
                    style={styles.infoBtn} 
                    onClick={() => setShowAnalysisModal(true)}
                    title="AI 문제 분석 결과 보기"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>AI 분석 결과</span>
                  </button>
                )}
              </div>

              <hr style={{ border: "none", borderTop: "2px solid #E86F00", margin: "0 0 12px 0" }} />

              {result && result.search_mode !== "apply" && (
                <div style={styles.personalStrategyActionBox}>
                  <button
                    type="button"
                    style={styles.personalStrategyTopBtn}
                    onClick={() => {
                      setPersonalStrategyError(null);
                      setShowPersonalStrategyModal(true);
                    }}
                    title="추천 케이스 내 상황에 맞게 적용하기"
                  >
                    <span>추천 케이스 내 상황에 적용하기</span>
                    <span style={styles.personalStrategyTopBtnArrow}></span>
                  </button>
                </div>
              )}

              {result?.result_status && (
                <div style={styles.recommendStatusBox}>
                  <p style={styles.recommendStatusTitle}>
                    {getStatusLabel(result.result_status.status)}
                  </p>
                  <p style={styles.recommendStatusMessage}>
                    {getStatusMessage(
                      result.result_status.status,
                      result.result_status.message
                    )}
                  </p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cases.map((c) => (
                  <CaseItem
                    key={c.case_idx || c.id || c.rank}
                    item={c}
                    isSelected={!!selectedCases.find((s) => s.title === c.title)}
                    isViewing={selectedCase?.title === c.title}
                    isBookmarked={bookmarkedCaseIds.has(String(c.case_idx ?? c.id))}
                    onClick={() => handleRecommendedCaseSelect(c)}
                    onDoubleClick={() => toggleSelectCase(c)}
                    onToggleBookmark={() => handleToggleBookmark(c)}
                    onRemove={() => setSelectedCases(prev => prev.filter(s => s.title !== c.title))}
                    onAdd={() => setSelectedCases(prev => prev.length < 3 ? [...prev, c] : prev)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div style={styles.mapCol}>
            <CaseMap
              cases={mapCases}
              mapCandidates={mapCandidatesWithViewCount}
              highlightedIds={recommendedCaseIds}
              focusCaseId={selectedCase?.case_idx || selectedCase?.id || null}
              centerTargetId={centerTargetId}
              centerRequestKey={centerRequestKey}
              onCaseClick={(caseData) => handleCaseSelect(caseData, "map")}
            />
          </div>
        </div>
      )}

      <div style={styles.bottomBrowseSection}>
        {!showAllList ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button 
              style={{ ...styles.btnBrowseAll, background: browseHover ? "#E86F00" : "#F2F2F2", color: browseHover ? "#fff" : "#1a1a1a" }}
              onClick={() => setShowAllList(true)}
              onMouseEnter={() => setBrowseHover(true)}
              onMouseLeave={() => setBrowseHover(false)}
            >
              DBR 전체 케이스 확인하기
            </button>
          </div>
        ) : (
          <div style={styles.allListWrapper}>
            <div style={styles.allListHeader}>
              <h2 style={styles.allListTitle}>DBR 전체 케이스</h2>
              <button style={styles.btnCloseAll} onClick={() => { setShowAllList(false); setVisibleCount(10); }}>접기 ✕</button>
            </div>
            
            <div style={styles.allListGrid}>
              {allCases.slice(0, visibleCount).map((c, index) => (
                <div 
                  key={c.case_idx || c.id} 
                  style={{
                    ...styles.archiveCard,
                    borderBottom: "1px solid #f0f0f0",
                    borderRight: index % 2 === 0 ? "1px solid #f0f0f0" : "none",
                    paddingRight: index % 2 === 0 ? 24 : 12,
                    borderLeft: selectedCase?.title === c.title ? "3px solid #E86F00" : "3px solid transparent",
                    background: selectedCases.find((s) => s.title === c.title) ? "#FEF0E9" : "#fff"
                  }}
                  onClick={() => handleCaseSelect(c, "archive")}
                >
                  <div style={styles.archiveHeader}>
                    <span style={styles.archiveIndustry}>{c.industry}</span>
                    <span style={styles.archiveDate}>발행 연도 : {c.date}</span>
                  </div>
                  <div style={styles.archiveTitle}>{c.title}</div>
                  <div style={styles.archiveCompany}>{c.company}</div>
                  <p style={styles.archiveSummary}>{c.summary}</p>
                </div>
              ))}
            </div>

            {visibleCount < allCases.length && (
              <div style={{ textAlign: "center", marginTop: 30 }}>
                <button 
                  style={styles.btnLoadMore}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E86F00"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#E86F00"; }}
                  onClick={() => setVisibleCount(prev => prev + 10)}
                >
                  더보기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showAnalysisModal && result && (
        <AnalysisModal 
          result={result} 
          onClose={() => setShowAnalysisModal(false)} 
        />
      )}

      {showPersonalStrategyModal && result && (
        <PersonalStrategyModal
          value={personalContext}
          onChange={setPersonalContext}
          loading={personalStrategyLoading}
          error={personalStrategyError}
          caseCount={result.cases?.length || 0}
          onClose={() => {
            if (!personalStrategyLoading) {
              setShowPersonalStrategyModal(false);
              setPersonalStrategyError(null);
            }
          }}
          onSubmit={handleCreatePersonalStrategies}
        />
      )}

      {selectedCase && (
        <CasePanel
          caseData={selectedCase}
          selectedCases={selectedCases}
          onToggleSelect={() => toggleSelectCase(selectedCase)}
          isSelected={!!selectedCases.find((s) => s.title === selectedCase.title)}
          isBookmarked={bookmarkedCaseIds.has(String(selectedCase.case_idx ?? selectedCase.id))}
          onToggleBookmark={() => handleToggleBookmark(selectedCase)}
          onClose={() => setSelectedCase(null)}
          hasRecommendationResult={!!result?.cases?.length}
          isTopRecommendedCase={recommendedCaseIds.includes(String(selectedCase.case_idx ?? selectedCase.id))}
          isArchiveCase={["archive", "popular", "bookmark", "unknown"].includes(selectedCase?._view_source)}
          onOpenPersonalStrategy={() => {
            setPersonalStrategyError(null);
            setShowPersonalStrategyModal(true);
          }}
        />
      )}
      {showCompare && (
        <CompareSidebar
          cases={selectedCases}
          onRemove={(title) => setSelectedCases((prev) => prev.filter((s) => s.title !== title))}
          onClose={() => setShowCompare(false)}
        />
      )}

      {showBottomExport && (
        <QuickExportModal
          cases={selectedCases}
          onClose={() => setShowBottomExport(false)}
        />
      )}

      {selectedCases.length > 0 && (
        <div style={{ ...styles.bottomBar, flexDirection: "column", padding: 0 }}>
          {showSelectedList && (
            <div style={{ width: "100%", background: "#2a2a2a", padding: "12px 24px", display: "flex", gap: 16, borderBottom: "1px solid #444" }}>
              {selectedCases.map((c, i) => (
                <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 8, background: "#3a3a3a", padding: "8px 12px", borderRadius: 2, flex: 1 }}
                onClick={() => setSelectedCase(c)}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#E86F00" }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: "#fff", flex: 1 }}>{c.title.length > 25 ? c.title.slice(0, 25) + "..." : c.title}</span>
                  <span style={{ fontSize: 12, color: "#999" }}>{c.company}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedCases(prev => prev.filter(s => s.title !== c.title)); }}
                    style={{ background: "none", border: "none", color: "#999", fontSize: 14, cursor: "pointer", padding: "0 0 0 8px", lineHeight: 1 }}
                  >✕</button>
                  </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", width: "100%", boxSizing: "border-box" }}>
            <span 
              style={{ ...styles.bottomBarText, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setShowSelectedList(prev => !prev)}
            >
              {selectedCases.length}개의 케이스가 선택되었습니다 ({selectedCases.length}/3)
              <span style={{ fontSize: 12, color: "#999" }}>{showSelectedList ? "▼" : "▲"} 목록 보기</span>
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={styles.bottomBarBtnReset}
                onClick={() => {
                  setSelectedCases([]);
                  setShowSelectedList(false);
                  setShowCompare(false);
                  setShowBottomExport(false);
                }}
              >초기화</button>
              <button style={styles.bottomBarBtnOutline} onClick={() => { setShowCompare(true); setSelectedCase(null); }}>케이스 비교하기</button>
              <button style={styles.bottomBarBtnFill} onClick={() => setShowBottomExport(true)}>내보내기</button>
            </div>
          </div>
        </div>
      )}

      {personalStrategyToast && (
        <div style={styles.personalStrategyToast}>
          <div style={styles.personalStrategyToastIcon}>✓</div>
          <div>
            <p style={styles.personalStrategyToastTitle}>생성 완료</p>
            <p style={styles.personalStrategyToastText}>{personalStrategyToast}</p>
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.fullScreenLoading}>
          <div style={styles.loadingContent}>
            <LoadingMotionVisual
              mode={loadingSearchMode}
              isApplyingStrategy={loadingApplyStrategy}
            />
            <div style={styles.progressHeader}>
              <span style={{ ...styles.loadingStatusTextCenter, flex: 1, textAlign: "center" }}>
                {getLoadingText(progress)}
              </span>
              <span style={styles.progressPercent}>{progress}%</span>
            </div>
            <div style={styles.progressBarContainer}>
              <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}

      {invalidNotice && (
        <div style={styles.fullScreenLoading}>
          <div style={styles.invalidNoticeContent}>
            <div style={styles.invalidNoticeIcon}>!</div>
            <p style={styles.invalidNoticeTitle}>입력 내용을 다시 확인해주세요</p>
            <p style={styles.invalidNoticeText}>{invalidNotice}</p>
            <div style={styles.invalidNoticeExamples}>
              <span style={styles.invalidNoticeExampleLabel}>이렇게 입력해보세요</span>
              <p style={styles.invalidNoticeExampleText}>고객 이탈률을 줄이고 싶어요</p>
              <p style={styles.invalidNoticeExampleText}>새로운 시장에 진입하는 방법을 찾고 싶어요</p>
              <p style={styles.invalidNoticeExampleText}>브랜드 인지도는 높은데 구매 전환율이 낮아요</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingMotionVisual({ mode, isApplyingStrategy }) {
  const isApplyMode = mode === "apply";

  const visualLabel = isApplyMode
    ? isApplyingStrategy
      ? "전략 적용 정리"
      : "상황 기반 탐색"
    : "DBR 케이스 탐색";

  return (
    <div style={styles.loadingVisualWrap}>
      <div style={styles.loadingVisualStage}>
        <div style={styles.loadingBook} aria-hidden="true">
          <div style={styles.loadingBookCover}>DBR</div>
          <div style={styles.loadingBookPageBack} />
          <div style={styles.loadingBookPageFlip} />
        </div>

        <div style={styles.loadingCardsWrap} aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                ...styles.loadingMiniCard,
                animationDelay: `${item * 0.22}s`,
              }}
            >
              <span style={styles.loadingMiniCardLineLong} />
              <span style={styles.loadingMiniCardLineShort} />
            </div>
          ))}
        </div>

        {isApplyMode && isApplyingStrategy ? (
          <div style={styles.loadingStrategyStack} aria-hidden="true">
            <span style={styles.loadingStrategyChip}>문제</span>
            <span style={{ ...styles.loadingStrategyChip, animationDelay: "0.2s" }}>전략</span>
            <span style={{ ...styles.loadingStrategyChip, animationDelay: "0.4s" }}>실행</span>
          </div>
        ) : isApplyMode ? (
          <div style={styles.loadingMapDots} aria-hidden="true">
            {[0, 1, 2, 3].map((item) => (
              <span
                key={item}
                style={{
                  ...styles.loadingMapDot,
                  left: [4, 26, 44, 18][item],
                  top: [22, 6, 25, 34][item],
                  animationDelay: `${item * 0.18}s`,
                }}
              />
            ))}
          </div>
        ) : (
          <div style={styles.loadingMagnifier} aria-hidden="true">
            <span style={styles.loadingMagnifierCircle} />
            <span style={styles.loadingMagnifierHandle} />
          </div>
        )}
      </div>
      <p style={styles.loadingVisualLabel}>{visualLabel}</p>
    </div>
  );
}

function PopularRankBoard({
  cases,
  caseLoading,
  caseError,
  onCaseClick,
  queries,
  queryLoading,
  queryError,
  onQueryClick,
}) {
  return (
    <div style={styles.popularRankBoard}>
      <div style={styles.popularRankColumn}>
        <div style={styles.popularColumnHeader}>
          <h3 style={styles.popularTitle}>많이 저장한 케이스</h3>
          <span style={styles.popularBadge}>TOP 5</span>
        </div>

        {caseLoading && <p style={styles.popularMessage}>인기 케이스를 불러오는 중...</p>}
        {caseError && <p style={styles.popularMessage}>{caseError}</p>}
        {!caseLoading && !caseError && cases.length === 0 && (
          <p style={styles.popularMessage}>아직 충분한 저장 데이터가 없습니다.</p>
        )}

        {!caseLoading && !caseError && cases.length > 0 && (
          <div style={styles.popularCaseCompactList}>
            {cases.map((item, index) => (
              <button
                key={item.case_idx || item.id}
                style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 0", background: "none", border: "none", borderBottom: "1px solid #f0f0f0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}
                onMouseEnter={e => {
                  e.currentTarget.querySelector(".side-bar").style.background = "#E86F00";
                  e.currentTarget.querySelector(".rank-num").style.color = "#E86F00";
                }}
                onMouseLeave={e => {
                  e.currentTarget.querySelector(".side-bar").style.background = "#e0e0e0";
                  e.currentTarget.querySelector(".rank-num").style.color = "#e0e0e0";
                }}
                onClick={() => onCaseClick(item)}
                title={item.title}
              >
                <div className="side-bar" style={{ width: 3, height: 58, borderRadius: 0, background: "#e0e0e0", flexShrink: 0, transition: "background 0.2s" }} />
                <span className="rank-num" style={{ fontSize: 15, fontWeight: 500, color: "#e0e0e0", minWidth: 20, lineHeight: 1, transition: "color 0.2s" }}>{index + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{item.company}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={styles.popularRankDivider} />

      <div style={styles.popularRankColumn}>
        <div style={styles.popularColumnHeader}>
          <h3 style={styles.popularTitle}>자주 찾는 고민</h3>
          <span style={styles.popularBadge}>TOP 10</span>
        </div>

        {queryLoading && <p style={styles.popularMessage}>인기 키워드를 불러오는 중...</p>}
        {queryError && <p style={styles.popularMessage}>{queryError}</p>}
        {!queryLoading && !queryError && queries.length === 0 && (
          <p style={styles.popularMessage}>검색을 진행하면 키워드 순위가 쌓입니다.</p>
        )}

        {!queryLoading && !queryError && queries.length > 0 && (
          <div style={styles.popularCompactList}>
            {queries.map((item, index) => (
              <button
                key={`${item.keyword_group || item.display_keyword}-${index}`}
                style={styles.popularKeywordItem}
                onMouseEnter={e => {
                  e.currentTarget.style.borderBottom = "1px solid #E86F00";
                  e.currentTarget.querySelector(".keyword-rank").style.color = "#E86F00";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderBottom = "1px solid #f0f0f0";
                  e.currentTarget.querySelector(".keyword-rank").style.color = "#e0e0e0";
                }}
                onClick={() => onQueryClick(item.keyword_group || item.display_keyword)}
                title="검색창에 입력하기"
              >
                <span className="keyword-rank" style={{ ...styles.popularCompactRank, color: "#e0e0e0", transition: "color 0.2s" }}>{index + 1}</span>
                <span style={styles.popularKeywordText}>
                  {item.keyword_group || item.display_keyword}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PopularCaseBox({ cases, loading, error, onCaseClick }) {
  return (
    <div style={styles.popularBox}>
      <div style={styles.popularHeader}>
        <div>
          {/* <p style={styles.popularEyebrow}>실시간 탐색 데이터</p> */}
          <h3 style={styles.popularTitle}>많이 본 케이스</h3>
        </div>
        <span style={styles.popularBadge}>TOP 5</span>
      </div>

      {loading && (
        <p style={styles.popularMessage}>인기 케이스를 불러오는 중...</p>
      )}

      {error && (
        <p style={styles.popularMessage}>{error}</p>
      )}

      {!loading && !error && cases.length === 0 && (
        <p style={styles.popularMessage}>
          아직 충분한 저장 데이터가 없어 케이스를 클릭하면 순위가 쌓입니다.
        </p>
      )}

      {!loading && !error && cases.length > 0 && (
        <div style={styles.popularList}>
          {cases.map((item, index) => (
            <div
              key={item.case_idx || item.id}
              style={styles.popularItem}
              onClick={() => onCaseClick(item)}
            >
              <div style={styles.popularRank}>{index + 1}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.popularMeta}>
                  <span>{item.industry || "산업 미분류"}</span>
                  {/* <span>·</span>
                  <span>조회 {item.view_count || 0}</span> */}
                </div>
                <p style={styles.popularItemTitle}>{item.title}</p>
                <p style={styles.popularCompany}>{item.company}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getFilteredCases(cases, filters) {
  const { selectedIndustry, selectedCategory, selectedKeyword, query } = filters;

  let filtered = [...cases];

  if (selectedIndustry && selectedIndustry !== "상관없음") {
    filtered = filtered.filter((c) => c.industry === selectedIndustry);
  }

  if (selectedCategory && selectedCategory !== "상관없음") {
    filtered = filtered.filter((c) => c.prob_main === selectedCategory);
  }

  if (selectedKeyword && selectedKeyword !== "상관없음") {
    filtered = filtered.filter((c) => c.prob_keyword === selectedKeyword);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();

    filtered = filtered.filter((c) =>
      [
        c.title,
        c.summary,
        c.company,
        c.industry,
        c.prob_main,
        c.prob_keyword,
        c.prob_def,
        c.sol_type,
        c.sol_detail,
        c.perf_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  return filtered;
}

function AnalysisModal({ result, onClose }) {
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000 }} onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "#fff", borderRadius: 16, zIndex: 1100, padding: 32, boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>AI 분석 결과</h2>
          <button style={{ background: "none", border: "none", fontSize: 24, color: "#999", cursor: "pointer", lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>
        <p style={styles.problemSummary}>{result.problem_summary}</p>
        <hr style={styles.divider} />
        <TagSection label="고민 유형" tags={result.problem_types || []} color="type" />
        <TagSection label="핵심 지표" tags={result.kpis || []} color="kpi" />
        <TagSection label="이렇게 판단했어요" tags={result.causes || []} color="cause" />
        <button style={{ ...styles.btnSearch, width: "100%", marginTop: 24 }} onClick={onClose}>확인</button>
      </div>
    </>
  );
}

function PersonalStrategyModal({ value, onChange, loading, error, caseCount, onClose, onSubmit }) {
  const loadingSteps = [
    "케이스 핵심 포인트를 정리하는 중...",
    "내 상황과 연결되는 부분을 찾는 중...",
    "바로 실행할 액션을 구성하는 중...",
    "주의할 점을 점검하는 중...",
    "맞춤 전략을 보기 좋게 정리하는 중...",
  ];

  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
    }, 1500);

    return () => clearInterval(timer);
  }, [loading]);

  return (
    <>
      <style>
        {`
          @keyframes personalStrategySpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes personalStrategyProgress {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(310%); }
          }

          @keyframes personalStrategyPulse {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
        `}
      </style>

      <div style={styles.personalModalOverlay} onClick={loading ? undefined : onClose} />

      <div style={styles.personalModal}>
        <div style={styles.personalModalHeader}>
          <div>
            <p style={styles.personalModalLabel}>추천 케이스를 내 상황에 적용하기</p>
            <h2 style={styles.personalModalTitle}>현재 상황을 알려주세요</h2>
            <p style={styles.personalModalDesc}>
              입력한 내용을 바탕으로 추천 케이스를 내 상황에 맞게 해석해드려요.
            </p>
          </div>

          <button
            type="button"
            style={styles.personalModalCloseBtn}
            onClick={onClose}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div style={styles.personalExampleBox}>
          <p style={styles.personalExampleTitle}>예시</p>
          <p style={styles.personalExampleText}>
            CRM 마케팅을 맡고 있고, 고객 이탈률을 줄이고 싶어요.
            <br/>예산이 많지 않아 바로 실행할 수 있는 작은 개선 방향이 필요해요.
          </p>
        </div>

        <textarea
          style={styles.personalTextarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="내 역할, 고민, 제약 조건을 자유롭게 적어주세요."
          disabled={loading}
        />

        {error && <p style={styles.personalErrorText}>{error}</p>}

        {loading && (
          <div style={styles.personalLoadingBox}>
            <div style={styles.personalLoadingTop}>
              <span style={styles.personalLoadingSpinner} />
              <div>
                <p style={styles.personalLoadingTitle}>AI가 추천 케이스를 내 상황에 맞게 해석하고 있어요.</p>
                <p style={styles.personalLoadingStep}>{loadingSteps[loadingStepIndex]}</p>
              </div>
            </div>
            <div style={styles.personalLoadingProgressTrack}>
              <div style={styles.personalLoadingProgressBar} />
            </div>
          </div>
        )}

        {/* <div style={styles.personalModalNotice}>
          입력한 상황과 케이스가 충분히 맞지 않으면 적용 한계도 함께 안내합니다.
        </div> */}

        <div style={styles.personalModalFooter}>
          <button
            type="button"
            style={styles.personalCancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="button"
            style={{
              ...styles.personalSubmitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.personalSubmitLoadingText}>
                <span style={styles.personalBtnSpinner} />
                맞춤 전략 생성 중...
              </span>
            ) : (
              "적용하기"
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...styles.dot, animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function LoadingEllipsis() {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : `${prev}.`));
    }, 400);

    return () => clearInterval(timer);
  }, []);

  return <span style={styles.loadingEllipsis}>{dots}</span>;
}

function TagSection({ label, tags, color }) {
  const colorMap = {
    type: { bg: "#E6F1FB", text: "#0C447C" },
    kpi: { bg: "#E1F5EE", text: "#085041" },
    cause: { bg: "#FAEEDA", text: "#633806" },
  };
  const { bg, text } = colorMap[color];

  return (
    <div style={{ marginBottom: 12 }}>
      <p style={styles.tagSectionLabel}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags.map((t) => (
          <span key={t} style={{ ...styles.tag, background: bg, color: text }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function CaseItem({ item, isSelected, isViewing, isBookmarked, onClick, onDoubleClick, onToggleBookmark, onRemove, onAdd }) {
  const toggleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark?.();
  };

  return (
    <div
      style={{ ...styles.caseItem, border: isViewing ? "2px solid #E86F00" : "1px solid transparent", borderBottom: isViewing ? "2px solid #E86F00" : "1px solid #f0f0f0", background: isViewing ? "linear-gradient(135deg, #fff 60%, #FEF0E9 100%)" : "#fff" }}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      <div style={{ ...styles.caseRank, color: item.rank <= 3 ? "#E86F00" : "#aaaaaa" }}>{item.rank}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E86F00" }}>케이스스터디</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E86F00" }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E86F00" }}>{item.industry}</span>
        </div>
        <p style={styles.caseTitle}>{item.title}</p>
        <p style={styles.caseMeta}>{item.company}</p>
      </div>
      <button
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
        onClick={toggleBookmark}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isBookmarked ? "#E86F00" : "none"} stroke="#E86F00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      {onRemove && (
        <button
          style={{
            padding: "4px 8px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 2,
            cursor: "pointer", fontFamily: "inherit", flexShrink: 0, transition: "all 0.2s",
            color: "#fff", background: isSelected ? "#1a1a1a" : "#E86F00",
          }}
          onClick={(e) => { e.stopPropagation(); isSelected ? onRemove() : onAdd?.(); }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {isSelected ? "제거" : "추가"}
        </button>
      )}
    </div>
  );
}

function formatInsightParagraphs(text) {
  if (!text) return [];

  const normalized = String(text)
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?。！？]|다\.|요\.|음\.|됨\.|했다\.|였다\.|한다\.|있다\.|됐다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return [normalized];
  }

  const paragraphs = [];

  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }

  return paragraphs;
}

function InsightParagraphs({ text, paragraphStyle }) {
  const paragraphs = formatInsightParagraphs(text);

  if (paragraphs.length === 0) return null;

  return (
    <div style={styles.insightTextGroup}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} style={paragraphStyle || styles.insightParagraph}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}


const PERSONAL_STRATEGY_SECTION_ORDER = [
  "케이스에서 가져올 포인트",
  "내 상황에서 먼저 확인할 것",
  "바로 실행할 액션",
  "주의할 점",
];

function parsePersonalStrategySections(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  const headingPattern = /^##\s*(.+)$/gm;
  const matches = [...normalized.matchAll(headingPattern)];

  if (matches.length === 0) {
    return [
      {
        title: "적용 방향",
        body: normalized,
      },
    ];
  }

  return matches.map((match, index) => {
    const title = match[1].trim();
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const body = normalized.slice(start, end).trim();

    return { title, body };
  }).filter((section) => section.title && section.body);
}

function renderStrategyBody(body, paragraphStyle, actionStyle) {
  const blocks = String(body || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (blocks.length === 0) return null;

  return blocks.map((line, index) => {
    const isNumberedAction = /^\d+[.)]\s+/.test(line);
    const cleanedLine = line.replace(/^[-•]\s*/, "");

    if (isNumberedAction) {
      return (
        <p key={index} style={actionStyle || styles.strategyActionLine}>
          {cleanedLine}
        </p>
      );
    }

    return (
      <p key={index} style={paragraphStyle || styles.strategyModalParagraph}>
        {cleanedLine}
      </p>
    );
  });
}

function formatPersonalStrategyExportHtml(value, escapeHtml) {
  const sections = parsePersonalStrategySections(value);

  if (sections.length === 0) {
    return `<p>${escapeHtml("아직 생성된 맞춤 전략이 없습니다.")}</p>`;
  }

  return sections
    .map((section) => {
      const lines = String(section.body || "")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      const bodyHtml = lines
        .map((line) => {
          const isNumberedAction = /^\d+[.)]\s+/.test(line);
          const cleanedLine = line.replace(/^[-•]\s*/, "");
          const className = isNumberedAction ? "strategy-action-line" : "strategy-paragraph";
          return `<p class="${className}">${escapeHtml(cleanedLine)}</p>`;
        })
        .join("");

      return `
        <div class="strategy-export-section">
          <h3>${escapeHtml(section.title)}</h3>
          ${bodyHtml}
        </div>
      `;
    })
    .join("");
}

function CasePanel({
  caseData,
  selectedCases,
  isSelected,
  isBookmarked,
  onToggleSelect,
  onToggleBookmark,
  onClose,
  hasRecommendationResult = false,
  isTopRecommendedCase = false,
  isArchiveCase = false,
  onOpenPersonalStrategy,
}) {
  const [linkHover, setLinkHover] = useState(false); 
  const [addHover, setAddHover] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);

  useEffect(() => {
    if (!caseData) return;

    const now = new Date();
    const viewedAt = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const viewSource = caseData._view_source || caseData.view_source || "unknown";
    const queryText = caseData._query_text || caseData.query_text || "";
    const searchQuery = caseData._search_query || caseData.search_query || "";
    const queryIdx = caseData._query_idx || caseData.query_idx || null;
    const searchedAt = caseData._searched_at || caseData.searched_at || null;
    const searchMode = caseData._search_mode || caseData.search_mode || null;

    const newItem = {
      ...caseData,
      viewedAt,
      viewed_at: now.toISOString(),
      view_source: viewSource,
      query_text: queryText,
      search_query: searchQuery,
      query_idx: queryIdx,
      searched_at: searchedAt,
      search_mode: searchMode,
      reco_reason: caseData.reco_reason || "",
      personal_strategy: caseData.personal_strategy || "",
      personal_strategy_status: caseData.personal_strategy_status || null,
    };

    const prev = JSON.parse(localStorage.getItem("caseHistory") || "[]");
    const caseKey = String(caseData.case_idx ?? caseData.id ?? caseData.title ?? "");
    const currentQueryKey = queryIdx ? `query:${queryIdx}` : queryText ? `text:${queryText}` : "no-query";

    const filtered = prev.filter((h) => {
      const prevCaseKey = String(h.case_idx ?? h.id ?? h.title ?? "");
      const prevViewSource = h.view_source || h._view_source || "unknown";
      const prevQueryText = h.query_text || h._query_text || "";
      const prevQueryIdx = h.query_idx || h._query_idx || null;
      const prevQueryKey = prevQueryIdx ? `query:${prevQueryIdx}` : prevQueryText ? `text:${prevQueryText}` : "no-query";

      return !(prevCaseKey === caseKey && prevViewSource === viewSource && prevQueryKey === currentQueryKey);
    });

    localStorage.setItem("caseHistory", JSON.stringify([newItem, ...filtered].slice(0, 50)));
  }, [caseData]);

  const toggleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark?.();
  };

  const openOriginalArticle = () => {
    if (caseData.src_url) {
      window.open(caseData.src_url, "_blank", "noopener,noreferrer");
    }
  };

  const getPersonalStrategyEmptyMessage = () => {
    if (isArchiveCase) {
      return "맞춤 전략은 추천케이스 TOP5에서만 확인할 수 있어요.";
    }

    if (hasRecommendationResult && !isTopRecommendedCase) {
      return "맞춤 전략은 추천 TOP5 케이스에서만 확인할 수 있어요.";
    }

    return "현재 상황을 입력하면, 맞춤 전략을 정리해드려요.";
  };

  return (
    <>
      <div style={{ ...styles.panel, paddingBottom: selectedCases.length > 0 ? 120 : 32 }}>
      <div style={styles.panelHeader}>
        <h3 style={styles.panelTitle}>{caseData.title}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", marginTop: 8 }} onClick={toggleBookmark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={isBookmarked ? "#E86F00" : "none"} stroke="#E86F00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button style={{ border: "none", background: "none", fontSize: 20, color: "#ccc", cursor: "pointer" }} onClick={onClose}>✕</button>
        </div>
      </div>
      <p style={styles.panelMeta}>{caseData.company}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>케이스스터디</span>
        {caseData.industry && <><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>|</span><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>{caseData.industry}</span></>}
        {caseData.date && <><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>|</span><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>{caseData.date}</span></>}
        {caseData.prob_main && <><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>|</span><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>{caseData.prob_main}</span></>}
        {caseData.sol_type && <><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>|</span><span style={{ fontSize: 14, fontWeight: 600, color: "#E86F00" }}>{caseData.sol_type}</span></>}
      </div>

      <div style={styles.panelActionGroup}>
        <button
          style={{ 
            width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, 
            color: "#fff", background: isSelected ? "#1a1a1a" : selectedCases.length >= 3 && !isSelected ? "#ccc" : addHover ? "#C45E00" : "#E86F00", 
            border: "none", borderRadius: 12, cursor: isSelected || selectedCases.length < 3 ? "pointer" : "not-allowed", 
            fontFamily: "inherit", transition: "all 0.2s"
          }}
          onClick={onToggleSelect}
          onMouseEnter={() => setAddHover(true)}
          onMouseLeave={() => setAddHover(false)}
          disabled={!isSelected && selectedCases.length >= 3}
        >
          {isSelected ? "비교에서 제거" : "＋ 비교에 추가"}
        </button>

        <button
          type="button"
          style={styles.panelSummaryBtn}
          onClick={() => setShowSummaryModal(true)}
        >
          요약문 바로보기
        </button>
      </div>

      <div style={{ flex: 1 }}>
        {caseData.reco_reason && (
          <div style={styles.reasonBox}>
            <p style={styles.reasonTitle}>AI 추천 이유</p>
            <InsightParagraphs text={caseData.reco_reason} />
          </div>
        )}

        {caseData.prob_def && (
          <div style={styles.reasonBoxWhite}>
            <p style={styles.reasonTitleDark}>문제 상황</p>
            <p style={styles.reasonItem}>{caseData.prob_def}</p>
          </div>
        )}

        {caseData.sol_detail && (
          <div style={styles.reasonBoxWhite}>
            <p style={styles.reasonTitleDark}>해결 전략</p>
            <p style={styles.reasonItem}>{caseData.sol_detail}</p>
          </div>
        )}

        {caseData.personal_strategy ? (
          <div style={styles.personalStrategyPreviewBox}>
            <div style={styles.personalStrategyHeader}>
              <p style={styles.personalStrategyTitle}>맞춤 전략</p>
              {caseData.personal_strategy_status === "reference" && (
                <span style={styles.personalStrategyBadge}>참고 관점</span>
              )}
              {caseData.personal_strategy_status === "limited" && (
                <span style={styles.personalStrategyBadgeMuted}>적용 한계</span>
              )}
            </div>
            <p style={styles.personalStrategyPreviewText}>
              현재 상황을 기준으로 정리한 실무형 적용 전략이 생성되었습니다.
            </p>
            <button
              type="button"
              style={styles.personalStrategyOpenBtn}
              onClick={() => setShowStrategyModal(true)}
            >
              맞춤 전략 바로보기
            </button>
          </div>
        ) : (
          <div style={styles.personalStrategyEmptyBox}>
            <p style={styles.personalStrategyEmptyTitle}>맞춤 전략</p>
            <p style={styles.personalStrategyEmptyText}>
              {getPersonalStrategyEmptyMessage()}
            </p>
            {hasRecommendationResult && isTopRecommendedCase && (
              <button
                type="button"
                style={styles.personalStrategyApplyBtn}
                onClick={onOpenPersonalStrategy}
              >
                내 상황에 적용하기
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24}}>
        <button 
          style={{ ...styles.panelLink, background: linkHover ? "#FEF0E9" : "#fff" }} 
          onClick={openOriginalArticle}
          onMouseEnter={() => setLinkHover(true)}
          onMouseLeave={() => setLinkHover(false)}
        >
          DBR 원문 아티클 읽기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </div>

      {showSummaryModal && (
        <CaseSummaryModal
          caseData={caseData}
          onClose={() => setShowSummaryModal(false)}
          onOpenOriginal={openOriginalArticle}
        />
      )}

      {showStrategyModal && (
        <CasePersonalStrategyModal
          caseData={caseData}
          onClose={() => setShowStrategyModal(false)}
        />
      )}
    </>
  );
}

function formatSummaryParagraphs(summary) {
  if (!summary) return ["등록된 요약문이 없습니다."];

  const normalized = String(summary)
    .replace(/\s+/g, " ")
    .trim();

  const sentences = normalized
    .split(/(?<=[.!?。！？]|다\.|요\.|음\.|됨\.|했다\.|였다\.|한다\.|있다\.|됐다\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return [normalized];
  }

  const paragraphs = [];

  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }

  return paragraphs;
}

function CaseSummaryModal({ caseData, onClose, onOpenOriginal }) {
  return (
    <>
      <div style={styles.caseSummaryModalOverlay} onClick={onClose} />

      <div style={styles.caseSummaryModal}>
        <div style={styles.caseSummaryModalHeader}>
          <div>
            <p style={styles.caseSummaryModalLabel}>케이스 요약</p>
            <h3 style={styles.caseSummaryModalTitle}>{caseData.title}</h3>
            <p style={styles.caseSummaryModalMeta}>
              {caseData.company || caseData.comp_name || "기업명 미등록"}
              {caseData.industry ? ` · ${caseData.industry}` : ""}
              {caseData.date ? ` · ${caseData.date}` : ""}
            </p>
          </div>

          <button style={styles.caseSummaryModalCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.caseSummaryModalBody}>
          {formatSummaryParagraphs(caseData.summary).map((paragraph, index) => (
            <p key={index} style={styles.caseSummaryParagraph}>
              {paragraph}
            </p>
          ))}
        </div>

        <div style={styles.caseSummaryModalFooter}>
          <button style={styles.caseSummaryModalSubBtn} onClick={onClose}>
            닫기
          </button>
          <button style={styles.caseSummaryModalMainBtn} onClick={onOpenOriginal}>
            DBR 원문 바로가기 →
          </button>
        </div>
      </div>
    </>
  );
}


function CasePersonalStrategyModal({ caseData, onClose }) {
  const sections = parsePersonalStrategySections(caseData.personal_strategy);

  return (
    <>
      <div style={styles.caseSummaryModalOverlay} onClick={onClose} />

      <div style={styles.caseSummaryModal}>
        <div style={styles.caseSummaryModalHeader}>
          <div>
            <p style={styles.personalStrategyModalLabel}>맞춤 전략</p>
            <h3 style={styles.caseSummaryModalTitle}>{caseData.title}</h3>
            <p style={styles.caseSummaryModalMeta}>
              {caseData.company || caseData.comp_name || "기업명 미등록"}
              {caseData.industry ? ` · ${caseData.industry}` : ""}
              {caseData.personal_strategy_status === "reference" ? " · 참고 관점" : ""}
              {caseData.personal_strategy_status === "limited" ? " · 적용 한계" : ""}
            </p>
          </div>

          <button style={styles.caseSummaryModalCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.strategyModalBody}>
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <div key={`${section.title}-${index}`} style={styles.strategyModalSection}>
                <p style={styles.strategyModalSectionTitle}>{section.title}</p>
                {renderStrategyBody(section.body)}
              </div>
            ))
          ) : (
            <p style={styles.strategyModalParagraph}>생성된 맞춤 전략이 없습니다.</p>
          )}
        </div>

        <div style={styles.caseSummaryModalFooter}>
          <button style={styles.caseSummaryModalMainBtn} onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </>
  );
}

function CompareSidebar({ cases, onClose }) {
  const [summaryCase, setSummaryCase] = useState(null);
  const [personalStrategyCase, setPersonalStrategyCase] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    industry: true,
    probMain: true,
    solType: true,
    date: true,
    probDef: true,
    solDetail: true,
    recoReason: true,
    personalStrategy: true,
    summary: false,
  });

  const getCaseCompany = (caseData) => {
    return caseData.company || caseData.comp_name || "-";
  };

  const getCaseYear = (caseData) => {
    return caseData.date || (caseData.pub_year ? `${caseData.pub_year}년` : "-");
  };

  const getCaseReason = (caseData) => {
    return caseData.reco_reason || caseData.reason_check || "추천 이유가 등록되지 않았습니다.";
  };

  const getPersonalStrategy = (caseData) => {
    return caseData.personal_strategy || "아직 생성된 적용 전략이 없습니다.";
  };

  const escapeHtml = (value) => {
    return String(value ?? "-")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatExportSummaryHtml = (summary) => {
    return formatSummaryParagraphs(summary)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  };

  const formatExportInsightHtml = (value) => {
    return formatInsightParagraphs(value)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  };

  const openOriginalArticle = (caseData) => {
    if (caseData?.src_url) {
      window.open(caseData.src_url, "_blank", "noopener,noreferrer");
    }
  };

  const toggleExportOption = (key) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const exportOptionList = [
    { key: "industry", label: "산업 분야" },
    { key: "probMain", label: "문제 유형" },
    { key: "solType", label: "전략 유형" },
    { key: "date", label: "발행일" },
    { key: "probDef", label: "문제 정의" },
    { key: "solDetail", label: "해결 전략" },
    { key: "recoReason", label: "AI 추천 이유" },
    { key: "personalStrategy", label: "맞춤 전략" },
    { key: "summary", label: "요약문" },
  ];

  const compareRows = [
    {
      label: "기업명",
      key: "company",
      values: cases.map((c) => getCaseCompany(c)),
    },
    {
      label: "산업 분야",
      key: "industry",
      values: cases.map((c) => c.industry || "-"),
    },
    {
      label: "문제 유형",
      key: "prob_main",
      values: cases.map((c) => c.prob_main || "-"),
    },
    {
      label: "전략 유형",
      key: "sol_type",
      values: cases.map((c) => c.sol_type || "-"),
    },
    {
      label: "발행일",
      key: "date",
      values: cases.map((c) => getCaseYear(c)),
    },
    {
      label: "문제 정의",
      key: "prob_def",
      values: cases.map((c) => c.prob_def || "-"),
    },
    {
      label: "해결 전략",
      key: "sol_detail",
      values: cases.map((c) => c.sol_detail || "-"),
    },
    {
      label: "AI 추천 이유",
      key: "reco_reason",
      values: cases.map((c) => (
        <div style={styles.compareReasonBox}>
          <p style={styles.compareReasonTitle}>AI 추천 이유</p>
          <InsightParagraphs
            text={getCaseReason(c)}
            paragraphStyle={styles.compareReasonParagraph}
          />
        </div>
      )),
    },
    {
      label: "맞춤 전략",
      key: "personal_strategy",
      values: cases.map((c) => (
        <div style={c.personal_strategy ? styles.comparePersonalBox : styles.comparePersonalEmptyBox}>
          <p style={c.personal_strategy ? styles.comparePersonalTitle : styles.comparePersonalEmptyTitle}>맞춤 전략</p>
          {c.personal_strategy ? (
            <>
              <p style={styles.comparePersonalPreviewText}>실무형 적용 전략이 생성되었습니다.</p>
              <button
                type="button"
                style={styles.compareSummaryBtn}
                onClick={() => setPersonalStrategyCase(c)}
              >
                맞춤 전략 바로보기
              </button>
            </>
          ) : (
            <p style={styles.comparePersonalEmptyParagraph}>{getPersonalStrategy(c)}</p>
          )}
        </div>
      )),
    },
    {
      label: "요약문",
      key: "summary",
      values: cases.map((c) => (
        <button
          type="button"
          style={styles.compareSummaryBtn}
          onClick={() => setSummaryCase(c)}
        >
          요약문 바로보기
        </button>
      )),
    },
  ];

  const buildExportRows = () => {
    const rows = [
      {
        label: "기업명",
        valueGetter: (c) => escapeHtml(getCaseCompany(c)),
      },
    ];

    if (exportOptions.industry) {
      rows.push({
        label: "산업 분야",
        valueGetter: (c) => escapeHtml(c.industry || "-"),
      });
    }

    if (exportOptions.probMain) {
      rows.push({
        label: "문제 유형",
        valueGetter: (c) => escapeHtml(c.prob_main || "-"),
      });
    }

    if (exportOptions.solType) {
      rows.push({
        label: "전략 유형",
        valueGetter: (c) => escapeHtml(c.sol_type || "-"),
      });
    }

    if (exportOptions.date) {
      rows.push({
        label: "발행일",
        valueGetter: (c) => escapeHtml(getCaseYear(c)),
      });
    }

    if (exportOptions.probDef) {
      rows.push({
        label: "문제 정의",
        valueGetter: (c) => escapeHtml(c.prob_def || "-"),
      });
    }

    if (exportOptions.solDetail) {
      rows.push({
        label: "해결 전략",
        valueGetter: (c) => escapeHtml(c.sol_detail || "-"),
      });
    }

    if (exportOptions.recoReason) {
      rows.push({
        label: "AI 추천 이유",
        className: "reason-cell",
        valueGetter: (c) => `
          <div class="reason-box">
            <p class="reason-title">AI 추천 이유</p>
            <div class="reason-text">${formatExportInsightHtml(getCaseReason(c))}</div>
          </div>
        `,
      });
    }

    if (exportOptions.personalStrategy) {
      rows.push({
        label: "맞춤 전략",
        className: "personal-strategy-cell",
        valueGetter: (c) => `
          <div class="personal-strategy-box">
            <p class="personal-strategy-title">맞춤 전략</p>
            <div class="personal-strategy-text">${formatPersonalStrategyExportHtml(getPersonalStrategy(c), escapeHtml)}</div>
          </div>
        `,
      });
    }

    if (exportOptions.summary) {
      rows.push({
        label: "요약문",
        className: "summary-cell",
        valueGetter: (c) => formatExportSummaryHtml(c.summary),
      });
    }

    return rows;
  };

  const handleExportCompare = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      alert("팝업이 차단되어 내보내기 창을 열 수 없습니다. 브라우저 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    const selectedRows = buildExportRows();

    const rowHtml = selectedRows
      .map(
        (row) => `
          <tr>
            <th>${escapeHtml(row.label)}</th>
            ${cases
              .map((caseItem) => `<td class="${row.className || ""}">${row.valueGetter(caseItem)}</td>`)
              .join("")}
          </tr>
        `
      )
      .join("");

    const includedLabels = selectedRows.map((row) => row.label).join(", ");

    const printContent = `
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>DBR Case Atlas - 케이스 비교</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 34px 42px;
              font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif;
              color: #1a1a1a;
              background: #fff;
            }
            .eyebrow {
              margin: 0 0 6px;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.12em;
              color: #E86F00;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 28px;
              line-height: 1.3;
            }
            .desc {
              margin: 0 0 8px;
              font-size: 14px;
              color: #666;
              line-height: 1.6;
            }
            .included {
              margin: 0 0 18px;
              font-size: 12px;
              color: #999;
              line-height: 1.6;
            }
            .bar {
              height: 2px;
              background: #E86F00;
              margin: 18px 0 18px;
            }
            table {
              width: 100%;
              table-layout: fixed;
              border-collapse: collapse;
              border: 1px solid #e6e6e6;
            }
            th, td {
              border: 1px solid #e6e6e6;
              padding: 14px 14px;
              vertical-align: top;
              font-size: 13px;
              line-height: 1.7;
              word-break: keep-all;
            }
            th {
              width: 120px;
              background: #fafafa;
              color: #555;
              font-weight: 800;
              text-align: left;
            }
            .case-head { background: #fcfcfc; }
            .case-rank {
              display: inline-block;
              margin-right: 8px;
              color: #E86F00;
              font-weight: 900;
            }
            .case-title {
              font-weight: 900;
              line-height: 1.55;
            }
            .case-company {
              margin-top: 8px;
              color: #999;
              font-size: 12px;
              font-weight: 600;
            }
            .reason-box {
              border: 1px solid #f5cbb8;
              background: #FEF0E9;
              border-radius: 8px;
              padding: 12px 13px;
            }
            .reason-title {
              margin: 0 0 6px;
              color: #E86F00;
              font-size: 12px;
              font-weight: 900;
            }
            .reason-text p {
              margin: 0 0 8px;
              color: #444;
              line-height: 1.75;
            }
            .reason-text p:last-child { margin-bottom: 0; }
            .personal-strategy-box {
              border: 1px solid #d8e7d9;
              background: #f4faf4;
              border-radius: 8px;
              padding: 12px 13px;
            }
            .personal-strategy-title {
              margin: 0 0 6px;
              color: #32753b;
              font-size: 12px;
              font-weight: 900;
            }
            .personal-strategy-text p {
              margin: 0 0 8px;
              color: #444;
              line-height: 1.75;
            }
            .personal-strategy-text p:last-child { margin-bottom: 0; }
            .strategy-export-section {
              margin: 0 0 14px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e4efe5;
            }
            .strategy-export-section:last-child {
              margin-bottom: 0;
              padding-bottom: 0;
              border-bottom: none;
            }
            .strategy-export-section h3 {
              margin: 0 0 7px;
              color: #2F6F3A;
              font-size: 12px;
              font-weight: 900;
            }
            .strategy-action-line {
              font-weight: 700;
            }
            .summary-cell p {
              margin: 0 0 10px;
              color: #333;
              line-height: 1.8;
              word-break: keep-all;
            }
            .summary-cell p:last-child { margin-bottom: 0; }
            @media print {
              body { padding: 24px; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <p class="eyebrow">DBR CASE ATLAS</p>
          <h1>케이스 비교</h1>
          <p class="desc">선택한 ${cases.length}개 케이스의 공통점과 차이점을 정리한 비교표입니다.</p>
          <p class="included">포함 항목: ${escapeHtml(includedLabels)}</p>
          <div class="bar"></div>

          <table>
            <thead>
              <tr>
                <th>비교 항목</th>
                ${cases
                  .map(
                    (caseItem, index) => `
                      <td class="case-head">
                        <div class="case-title"><span class="case-rank">${index + 1}</span>${escapeHtml(caseItem.title || "-")}</div>
                        <div class="case-company">${escapeHtml(getCaseCompany(caseItem))}</div>
                      </td>
                    `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rowHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  const handleOpenExportModal = () => {
    setShowExportModal(true);
  };

  const handleConfirmExport = () => {
    setShowExportModal(false);
    handleExportCompare();
  };

  const renderExportToggle = (option) => {
    const isChecked = !!exportOptions[option.key];

    return (
      <button
        key={option.key}
        type="button"
        style={styles.exportOptionItem}
        onClick={() => toggleExportOption(option.key)}
      >
        <span style={styles.exportOptionText}>{option.label}</span>
        <span
          style={{
            ...styles.exportSwitch,
            background: isChecked ? "#E86F00" : "#d5d5d5",
          }}
        >
          <span
            style={{
              ...styles.exportSwitchCircle,
              transform: isChecked ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </span>
      </button>
    );
  };

  return (
    <>
      <div style={styles.compareOverlay} onClick={onClose} />

      <div style={styles.compareModal}>
        <div style={styles.compareHeader}>
          <div>
            <h2 style={styles.compareTitle}>케이스 비교</h2>
            <p style={styles.compareSubTitle}>
              선택한 {cases.length}개 케이스의 공통점과 차이점을 확인하세요.
            </p>
          </div>

          <button type="button" style={styles.compareCloseBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.compareTableWrap}>
          <table style={styles.compareTable}>
            <colgroup>
              <col style={{ width: "124px" }} />
              {cases.map((c, i) => (
                <col
                  key={`compare-col-${c.case_idx || c.id || c.title || i}`}
                  style={{ width: `calc((100% - 124px) / ${Math.max(cases.length, 1)})` }}
                />
              ))}
            </colgroup>

            <thead>
              <tr style={styles.compareHeaderRow}>
                <th style={styles.compareLabelHead}>비교 항목</th>
                {cases.map((c, i) => (
                  <th
                    key={c.case_idx || c.id || c.title || i}
                    style={styles.compareCaseHead}
                  >
                    <div style={styles.compareCaseHeadInner}>
                      <span style={styles.compareCaseNum}>{i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={styles.compareCaseTitle}>{c.title}</p>
                        <p style={styles.compareCaseCompany}>{getCaseCompany(c)}</p>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {compareRows.map((row) => (
                <tr key={row.key} style={styles.compareRow}>
                  <td style={styles.compareLabelCell}>{row.label}</td>
                  {row.values.map((val, i) => (
                    <td key={`${row.key}-${i}`} style={styles.compareValueCell}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.compareFooter}>
          <button type="button" style={styles.compareFooterBtn} onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            style={styles.compareExportBtn}
            onClick={handleOpenExportModal}
          >
            내보내기
          </button>
        </div>
      </div>

      {showExportModal && (
        <>
          <div
            style={styles.exportModalOverlay}
            onClick={() => setShowExportModal(false)}
          />

          <div style={styles.exportModal}>
            <div style={styles.exportModalHeader}>
              <div>
                <p style={styles.exportModalLabel}>PDF 내보내기 설정</p>
                <h3 style={styles.exportModalTitle}>포함할 비교 항목 선택</h3>
                <p style={styles.exportModalDesc}>
                  {/* 기업명은 기본 항목이라 항상 포함됩니다. 요약문은 길어질 수 있어 기본 제외 상태입니다. */}
                </p>
              </div>

              <button
                type="button"
                style={styles.exportModalCloseBtn}
                onClick={() => setShowExportModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={styles.exportFixedItem}>
              <span style={styles.exportFixedText}>기업명</span>
              {/* <span style={styles.exportFixedBadge}></span> */}
            </div>

            <div style={styles.exportOptionGrid}>
              {exportOptionList.map(renderExportToggle)}
            </div>

            <div style={styles.exportModalFooter}>
              <button
                type="button"
                style={styles.exportCancelBtn}
                onClick={() => setShowExportModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                style={styles.exportConfirmBtn}
                onClick={handleConfirmExport}
              >
                PDF로 내보내기
              </button>
            </div>
          </div>
        </>
      )}

      {summaryCase && (
        <CaseSummaryModal
          caseData={summaryCase}
          onClose={() => setSummaryCase(null)}
          onOpenOriginal={() => openOriginalArticle(summaryCase)}
        />
      )}

      {personalStrategyCase && (
        <CasePersonalStrategyModal
          caseData={personalStrategyCase}
          onClose={() => setPersonalStrategyCase(null)}
        />
      )}
    </>
  );
}



function QuickExportModal({ cases, onClose }) {
  const [exportOptions, setExportOptions] = useState({
    industry: true,
    probMain: true,
    solType: true,
    date: true,
    probDef: true,
    solDetail: true,
    recoReason: true,
    personalStrategy: true,
    summary: false,
  });

  const getCaseCompany = (caseData) => {
    return caseData.company || caseData.comp_name || "-";
  };

  const getCaseYear = (caseData) => {
    return caseData.date || (caseData.pub_year ? `${caseData.pub_year}년` : "-");
  };

  const getCaseReason = (caseData) => {
    return caseData.reco_reason || caseData.reason_check || "추천 이유가 등록되지 않았습니다.";
  };

  const getPersonalStrategy = (caseData) => {
    return caseData.personal_strategy || "아직 생성된 맞춤 전략이 없습니다.";
  };

  const escapeHtml = (value) => {
    return String(value ?? "-")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatExportSummaryHtml = (summary) => {
    return formatSummaryParagraphs(summary)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  };

  const formatExportInsightHtml = (value) => {
    return formatInsightParagraphs(value)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  };

  const toggleExportOption = (key) => {
    setExportOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const exportOptionList = [
    { key: "industry", label: "산업 분야" },
    { key: "probMain", label: "문제 유형" },
    { key: "solType", label: "전략 유형" },
    { key: "date", label: "발행일" },
    { key: "probDef", label: "문제 정의" },
    { key: "solDetail", label: "해결 전략" },
    { key: "recoReason", label: "AI 추천 이유" },
    { key: "personalStrategy", label: "맞춤 전략" },
    { key: "summary", label: "요약문" },
  ];

  const buildExportRows = () => {
    const rows = [
      {
        label: "기업명",
        valueGetter: (c) => escapeHtml(getCaseCompany(c)),
      },
    ];

    if (exportOptions.industry) {
      rows.push({
        label: "산업 분야",
        valueGetter: (c) => escapeHtml(c.industry || "-"),
      });
    }

    if (exportOptions.probMain) {
      rows.push({
        label: "문제 유형",
        valueGetter: (c) => escapeHtml(c.prob_main || "-"),
      });
    }

    if (exportOptions.solType) {
      rows.push({
        label: "전략 유형",
        valueGetter: (c) => escapeHtml(c.sol_type || "-"),
      });
    }

    if (exportOptions.date) {
      rows.push({
        label: "발행일",
        valueGetter: (c) => escapeHtml(getCaseYear(c)),
      });
    }

    if (exportOptions.probDef) {
      rows.push({
        label: "문제 정의",
        valueGetter: (c) => escapeHtml(c.prob_def || "-"),
      });
    }

    if (exportOptions.solDetail) {
      rows.push({
        label: "해결 전략",
        valueGetter: (c) => escapeHtml(c.sol_detail || "-"),
      });
    }

    if (exportOptions.recoReason) {
      rows.push({
        label: "AI 추천 이유",
        className: "reason-cell",
        valueGetter: (c) => `
          <div class="reason-box">
            <p class="reason-title">AI 추천 이유</p>
            <div class="reason-text">${formatExportInsightHtml(getCaseReason(c))}</div>
          </div>
        `,
      });
    }

    if (exportOptions.personalStrategy) {
      rows.push({
        label: "맞춤 전략",
        className: "personal-strategy-cell",
        valueGetter: (c) => `
          <div class="personal-strategy-box">
            <p class="personal-strategy-title">맞춤 전략</p>
            <div class="personal-strategy-text">${formatPersonalStrategyExportHtml(getPersonalStrategy(c), escapeHtml)}</div>
          </div>
        `,
      });
    }

    if (exportOptions.summary) {
      rows.push({
        label: "요약문",
        className: "summary-cell",
        valueGetter: (c) => formatExportSummaryHtml(c.summary),
      });
    }

    return rows;
  };

  const handleExportCases = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      alert("팝업이 차단되어 내보내기 창을 열 수 없습니다. 브라우저 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    const selectedRows = buildExportRows();

    const rowHtml = selectedRows
      .map(
        (row) => `
          <tr>
            <th>${escapeHtml(row.label)}</th>
            ${cases
              .map((caseItem) => `<td class="${row.className || ""}">${row.valueGetter(caseItem)}</td>`)
              .join("")}
          </tr>
        `
      )
      .join("");

    const includedLabels = selectedRows.map((row) => row.label).join(", ");

    const printContent = `
      <!doctype html>
      <html lang="ko">
        <head>
          <meta charset="utf-8" />
          <title>DBR Case Atlas - 케이스 내보내기</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 34px 42px;
              font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Arial, sans-serif;
              color: #1a1a1a;
              background: #fff;
            }
            .eyebrow {
              margin: 0 0 6px;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.12em;
              color: #E86F00;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 28px;
              line-height: 1.3;
            }
            .desc {
              margin: 0 0 8px;
              font-size: 14px;
              color: #666;
              line-height: 1.6;
            }
            .included {
              margin: 0 0 18px;
              font-size: 12px;
              color: #999;
              line-height: 1.6;
            }
            .bar {
              height: 2px;
              background: #E86F00;
              margin: 18px 0 18px;
            }
            table {
              width: 100%;
              table-layout: fixed;
              border-collapse: collapse;
              border: 1px solid #e6e6e6;
            }
            th, td {
              border: 1px solid #e6e6e6;
              padding: 14px 14px;
              vertical-align: top;
              font-size: 13px;
              line-height: 1.7;
              word-break: keep-all;
            }
            th {
              width: 120px;
              background: #fafafa;
              color: #555;
              font-weight: 800;
              text-align: left;
            }
            .case-head { background: #fcfcfc; }
            .case-rank {
              display: inline-block;
              margin-right: 8px;
              color: #E86F00;
              font-weight: 900;
            }
            .case-title {
              font-weight: 900;
              line-height: 1.55;
            }
            .case-company {
              margin-top: 8px;
              color: #999;
              font-size: 12px;
              font-weight: 600;
            }
            .reason-box {
              border: 1px solid #f5cbb8;
              background: #FEF0E9;
              border-radius: 8px;
              padding: 12px 13px;
            }
            .reason-title {
              margin: 0 0 6px;
              color: #E86F00;
              font-size: 12px;
              font-weight: 900;
            }
            .reason-text p {
              margin: 0 0 8px;
              color: #444;
              line-height: 1.75;
            }
            .reason-text p:last-child { margin-bottom: 0; }
            .personal-strategy-box {
              border: 1px solid #d8e7d9;
              background: #f4faf4;
              border-radius: 8px;
              padding: 12px 13px;
            }
            .personal-strategy-title {
              margin: 0 0 6px;
              color: #32753b;
              font-size: 12px;
              font-weight: 900;
            }
            .personal-strategy-text p {
              margin: 0 0 8px;
              color: #444;
              line-height: 1.75;
            }
            .personal-strategy-text p:last-child { margin-bottom: 0; }
            .strategy-export-section {
              margin: 0 0 14px;
              padding-bottom: 10px;
              border-bottom: 1px solid #e4efe5;
            }
            .strategy-export-section:last-child {
              margin-bottom: 0;
              padding-bottom: 0;
              border-bottom: none;
            }
            .strategy-export-section h3 {
              margin: 0 0 7px;
              color: #2F6F3A;
              font-size: 12px;
              font-weight: 900;
            }
            .strategy-action-line {
              font-weight: 700;
            }
            .summary-cell p {
              margin: 0 0 10px;
              color: #333;
              line-height: 1.8;
              word-break: keep-all;
            }
            .summary-cell p:last-child { margin-bottom: 0; }
            @media print {
              body { padding: 24px; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <p class="eyebrow">DBR CASE ATLAS</p>
          <h1>케이스 내보내기</h1>
          <p class="desc">선택한 ${cases.length}개 케이스를 정리한 내보내기 문서입니다.</p>
          <p class="included">포함 항목: ${escapeHtml(includedLabels)}</p>
          <div class="bar"></div>

          <table>
            <thead>
              <tr>
                <th>항목</th>
                ${cases
                  .map(
                    (caseItem, index) => `
                      <td class="case-head">
                        <div class="case-title"><span class="case-rank">${index + 1}</span>${escapeHtml(caseItem.title || "-")}</div>
                        <div class="case-company">${escapeHtml(getCaseCompany(caseItem))}</div>
                      </td>
                    `
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rowHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 350);
  };

  const handleConfirmExport = () => {
    onClose();
    handleExportCases();
  };

  const renderExportToggle = (option) => {
    const isChecked = !!exportOptions[option.key];

    return (
      <button
        key={option.key}
        type="button"
        style={styles.exportOptionItem}
        onClick={() => toggleExportOption(option.key)}
      >
        <span style={styles.exportOptionText}>{option.label}</span>
        <span
          style={{
            ...styles.exportSwitch,
            background: isChecked ? "#E86F00" : "#d5d5d5",
          }}
        >
          <span
            style={{
              ...styles.exportSwitchCircle,
              transform: isChecked ? "translateX(18px)" : "translateX(0)",
            }}
          />
        </span>
      </button>
    );
  };

  return (
    <>
      <div style={styles.exportModalOverlay} onClick={onClose} />

      <div style={styles.exportModal}>
        <div style={styles.exportModalHeader}>
          <div>
            <p style={styles.exportModalLabel}>PDF 내보내기 설정</p>
            <h3 style={styles.exportModalTitle}>포함할 항목 선택</h3>
            <p style={styles.exportModalDesc}></p>
          </div>

          <button
            type="button"
            style={styles.exportModalCloseBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={styles.exportFixedItem}>
          <span style={styles.exportFixedText}>기업명</span>
        </div>

        <div style={styles.exportOptionGrid}>
          {exportOptionList.map(renderExportToggle)}
        </div>

        <div style={styles.exportModalFooter}>
          <button
            type="button"
            style={styles.exportCancelBtn}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            style={styles.exportConfirmBtn}
            onClick={handleConfirmExport}
          >
            PDF로 내보내기
          </button>
        </div>
      </div>
    </>
  );
}

const styles = {
  resultActionGroup: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  personalStrategyActionBox: { width: "100%", padding: "0 0 12px", margin: "0 0 12px", borderBottom: "1px solid #f0f0f0", background: "transparent" },
  personalStrategyActionTitle: { margin: "0 0 4px", fontSize: 13, fontWeight: 900, color: "#E86F00" },
  personalStrategyActionDesc: { flex: 1, margin: 0, fontSize: 12.5, color: "#888", lineHeight: 1.45, wordBreak: "keep-all" },
  personalStrategyToast: { position: "fixed", right: 28, bottom: 92, zIndex: 2200, display: "flex", alignItems: "center", gap: 12, width: 320, padding: "14px 16px", background: "#fff", border: "1px solid #F7D8C6", borderLeft: "4px solid #E86F00", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.14)" },
  personalStrategyToastIcon: { width: 28, height: 28, borderRadius: "50%", background: "#E86F00", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, flexShrink: 0 },
  personalStrategyToastTitle: { margin: "0 0 3px", fontSize: 13, fontWeight: 900, color: "#1a1a1a" },
  personalStrategyToastText: { margin: 0, fontSize: 12.5, lineHeight: 1.45, color: "#666" },
  personalStrategyTopBtn: { width: "100%", minHeight: 44, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 900, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 8px 18px rgba(232, 111, 0, 0.18)", transition: "all 0.2s ease" },
  personalStrategyTopBtnArrow: { fontSize: 16, fontWeight: 900, lineHeight: 1, transform: "translateY(-1px)" },
  personalModalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.48)", zIndex: 1200 },
  personalModal: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(620px, calc(100vw - 40px))", maxHeight: "88vh", overflowY: "auto", background: "#fff", borderRadius: 16, zIndex: 1300, padding: 30, boxShadow: "0 18px 50px rgba(0,0,0,0.18)", boxSizing: "border-box" },
  personalModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 18 },
  personalModalLabel: { margin: "0 0 6px", fontSize: 12, fontWeight: 900, color: "#E86F00", letterSpacing: "0.08em" },
  personalModalTitle: { margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#1a1a1a" },
  personalModalDesc: { margin: 0, fontSize: 14, lineHeight: 1.65, color: "#666", wordBreak: "keep-all" },
  personalModalCloseBtn: { background: "rgba(232,111,0,0.1)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#E86F00", fontSize: 16, cursor: "pointer", flexShrink: 0 },
  personalExampleBox: { background: "#FEF0E9", border: "1px solid #F7D8C6", borderRadius: 10, padding: "13px 15px", marginBottom: 14 },
  personalExampleTitle: { margin: "0 0 6px", fontSize: 12, fontWeight: 900, color: "#E86F00" },
  personalExampleText: { margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "#555", wordBreak: "keep-all" },
  personalTextarea: { width: "100%", minHeight: 150, padding: 15, border: "1px solid #e0e0e0", borderRadius: 10, resize: "vertical", fontSize: 14, lineHeight: 1.7, color: "#1a1a1a", fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  personalErrorText: { margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: "#c0392b" },
  personalLoadingBox: { marginTop: 14, padding: "14px 15px", background: "linear-gradient(135deg, #FFF8F2 0%, #ffffff 100%)", border: "1px solid #F7D8C6", borderRadius: 12, boxShadow: "0 8px 22px rgba(232,111,0,0.08)" },
  personalLoadingTop: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  personalLoadingSpinner: { width: 22, height: 22, borderRadius: "50%", border: "3px solid rgba(232,111,0,0.18)", borderTopColor: "#E86F00", animation: "personalStrategySpin 0.8s linear infinite", flexShrink: 0 },
  personalLoadingTitle: { margin: "0 0 4px", fontSize: 13, fontWeight: 900, color: "#1a1a1a", wordBreak: "keep-all" },
  personalLoadingStep: { margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#E86F00", fontWeight: 750, animation: "personalStrategyPulse 1.5s ease-in-out infinite", wordBreak: "keep-all" },
  personalLoadingProgressTrack: { position: "relative", height: 4, overflow: "hidden", background: "#F8E1D2", borderRadius: 999 },
  personalLoadingProgressBar: { position: "absolute", top: 0, left: 0, width: "34%", height: "100%", background: "linear-gradient(90deg, rgba(232,111,0,0.2), #E86F00, rgba(232,111,0,0.2))", borderRadius: 999, animation: "personalStrategyProgress 1.25s ease-in-out infinite" },
  personalSubmitLoadingText: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 },
  personalBtnSpinner: { width: 13, height: 13, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.38)", borderTopColor: "#fff", animation: "personalStrategySpin 0.75s linear infinite", flexShrink: 0 },
  personalModalNotice: { marginTop: 12, padding: "11px 13px", background: "#f8f8f8", border: "1px solid #eee", borderRadius: 8, fontSize: 12.5, color: "#777", lineHeight: 1.6, wordBreak: "keep-all" },
  personalModalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 },
  personalCancelBtn: { padding: "10px 18px", fontSize: 13, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  personalSubmitBtn: { padding: "10px 18px", fontSize: 13, fontWeight: 800, color: "#fff", background: "#E86F00", border: "none", borderRadius: 8, fontFamily: "inherit" },
  personalStrategyBox: { background: "#fff", border: "1px solid #d9e7dc", borderLeft: "3px solid #4A8F57", borderRadius: 6, padding: "14px 15px", marginBottom: 12 },
  personalStrategyPreviewBox: { background: "#fff", border: "1px solid #d9e7dc", borderLeft: "3px solid #4A8F57", borderRadius: 6, padding: "14px 15px", marginBottom: 12 },
  personalStrategyPreviewText: { margin: "0 0 11px", fontSize: 13, lineHeight: 1.6, color: "#666", wordBreak: "keep-all" },
  personalStrategyOpenBtn: { width: "100%", padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#2F6F3A", background: "#F4FAF4", border: "1px solid #cfe4d2", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" },
  personalStrategyModalLabel: { fontSize: 13, fontWeight: 800, color: "#2F6F3A", margin: "0 0 8px" },
  strategyModalBody: { padding: "22px 24px", overflowY: "auto" },
  strategyModalSection: { padding: "16px 0", borderBottom: "1px solid #f0f0f0" },
  strategyModalSectionTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 900, color: "#2F6F3A" },
  strategyModalParagraph: { margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.85, color: "#333", letterSpacing: "-0.01em", wordBreak: "keep-all" },
  strategyActionLine: { margin: "0 0 8px", padding: "9px 11px", fontSize: 14, lineHeight: 1.65, color: "#333", background: "#F7FBF7", border: "1px solid #e2efe4", borderRadius: 8, wordBreak: "keep-all" },
  personalStrategyHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 },
  personalStrategyTitle: { margin: 0, fontSize: 13, fontWeight: 900, color: "#2F6F3A" },
  personalStrategyParagraph: { margin: "0 0 9px", fontSize: 13.5, lineHeight: 1.75, color: "#444", wordBreak: "keep-all" },
  personalStrategyBadge: { flexShrink: 0, padding: "3px 7px", fontSize: 11, fontWeight: 800, color: "#2F6F3A", background: "#EEF7EF", borderRadius: 999 },
  personalStrategyBadgeMuted: { flexShrink: 0, padding: "3px 7px", fontSize: 11, fontWeight: 800, color: "#777", background: "#f3f3f3", borderRadius: 999 },
  personalStrategyText: { margin: 0, fontSize: 13.5, lineHeight: 1.75, color: "#444", wordBreak: "keep-all" },
  personalStrategyGuide: { margin: "8px 0 0", fontSize: 12, color: "#777", lineHeight: 1.5 },
  personalStrategyEmptyBox: { background: "#fff", border: "1px dashed #dedede", borderRadius: 6, padding: "13px 14px", marginBottom: 12 },
  personalStrategyEmptyTitle: { margin: "0 0 7px", fontSize: 13, fontWeight: 800, color: "#777" },
  personalStrategyEmptyText: { margin: 0, fontSize: 13, lineHeight: 1.65, color: "#999", wordBreak: "keep-all",
    whiteSpace: "pre-line",
  },
  personalStrategyApplyBtn: { width: "100%", marginTop: 10, padding: "10px 12px", fontSize: 13, fontWeight: 800, color: "#fff", background: "#E86F00", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  comparePersonalBox: { background: "#fff", border: "1px solid #d9e7dc", borderLeft: "3px solid #4A8F57", borderRadius: 6, padding: "12px 13px" },
  comparePersonalTitle: { margin: "0 0 7px", fontSize: 12, fontWeight: 900, color: "#2F6F3A" },
  comparePersonalText: { margin: 0, fontSize: 13, lineHeight: 1.7, color: "#444", wordBreak: "keep-all" },
  comparePersonalParagraph: { margin: "0 0 8px", fontSize: 13, lineHeight: 1.7, color: "#444", wordBreak: "keep-all" },
  comparePersonalPreviewText: { margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.55, color: "#666", wordBreak: "keep-all" },
  comparePersonalEmptyBox: { background: "#fafafa", border: "1px dashed #e0e0e0", borderRadius: 6, padding: "12px 13px" },
  comparePersonalEmptyTitle: { margin: "0 0 7px", fontSize: 12, fontWeight: 900, color: "#999" },
  comparePersonalEmptyText: { margin: 0, fontSize: 13, lineHeight: 1.6, color: "#aaa", wordBreak: "keep-all" },
  comparePersonalEmptyParagraph: { margin: "0 0 8px", fontSize: 13, lineHeight: 1.6, color: "#aaa", wordBreak: "keep-all" },
  compareOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 500 },
  compareModal: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "92%", maxWidth: 1180, maxHeight: "86vh", background: "#fff", borderRadius: 16, zIndex: 600, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 18px 50px rgba(0,0,0,0.18)" },
  compareHeader: { background: "#f3f3f3", padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 },
  compareTitle: { fontSize: 22, fontWeight: 800, color: "#1a1a1a", margin: "0 0 6px" },
  compareSubTitle: { fontSize: 15, color: "#666", margin: 0 },
  compareCloseBtn: { background: "rgba(232, 111, 0, 0.1)", border: "none", borderRadius: "50%", width: 34, height: 34, fontSize: 16, color: "#E86F00", cursor: "pointer", flexShrink: 0 },
  compareTableWrap: { overflowY: "auto", flex: 1 },
  compareTable: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  compareHeaderRow: { borderBottom: "1px solid #e8e8e8" },
  compareLabelHead: { padding: "15px 16px", fontSize: 13, color: "#999", fontWeight: 700, textAlign: "left", background: "#fafafa", verticalAlign: "top" },
  compareCaseHead: { padding: "15px 16px", textAlign: "left", background: "#fafafa", borderLeft: "1px solid #e8e8e8", verticalAlign: "top" },
  compareCaseHeadInner: { display: "flex", alignItems: "flex-start", gap: 9, minWidth: 0 },
  compareCaseNum: { fontSize: 16, fontWeight: 900, color: "#E86F00", lineHeight: 1.4, flexShrink: 0 },
  compareCaseTitle: { fontSize: 13.5, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.55, wordBreak: "keep-all", margin: 0 },
  compareCaseCompany: { fontSize: 12, color: "#999", fontWeight: 600, margin: "6px 0 0", lineHeight: 1.4 },
  compareRow: { borderBottom: "1px solid #f0f0f0" },
  compareLabelCell: { padding: "15px 16px", fontSize: 13, color: "#666", fontWeight: 700, background: "#fafafa", verticalAlign: "top" },
  compareValueCell: { padding: "15px 16px", fontSize: 13.5, color: "#1a1a1a", borderLeft: "1px solid #f0f0f0", verticalAlign: "top", lineHeight: 1.65, wordBreak: "keep-all" },
  compareReasonBox: { background: "#FFF6F0", border: "1px solid #F3D8C7", borderLeft: "3px solid #E86F00", borderRadius: 6, padding: "12px 13px" },
  compareReasonTitle: { fontSize: 12, fontWeight: 900, color: "#C45E00", margin: "0 0 7px" },
  compareReasonText: { fontSize: 13, color: "#555", lineHeight: 1.7, margin: 0, wordBreak: "keep-all" },
  compareReasonParagraph: { margin: "0 0 8px", fontSize: 13, color: "#555", lineHeight: 1.7, wordBreak: "keep-all" },
  compareSummaryBtn: { padding: "9px 13px", fontSize: 13, fontWeight: 800, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" },
  compareFooter: { padding: "1rem 2rem", borderTop: "1px solid #e8e8e8", display: "flex", justifyContent: "flex-end", gap: 8, background: "#fff" },
  compareFooterBtn: { padding: "10px 20px", fontSize: 13, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  compareExportBtn: { padding: "10px 20px", fontSize: 13, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 800 },
  exportModalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 800 },
  exportModal: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(560px, calc(100vw - 40px))", background: "#fff", borderRadius: 16, zIndex: 900, boxShadow: "0 18px 50px rgba(0,0,0,0.22)", overflow: "hidden" },
  exportModalHeader: { padding: "24px 28px 18px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  exportModalLabel: { margin: "0 0 6px", fontSize: 12, fontWeight: 900, color: "#E86F00", letterSpacing: "0.08em" },
  exportModalTitle: { margin: "0 0 8px", fontSize: 21, fontWeight: 900, color: "#1a1a1a" },
  exportModalDesc: { margin: 0, fontSize: 13, color: "#666", lineHeight: 1.6 },
  exportModalCloseBtn: { background: "rgba(232, 111, 0, 0.1)", border: "none", borderRadius: "50%", width: 32, height: 32, fontSize: 15, color: "#E86F00", cursor: "pointer", flexShrink: 0 },
  exportFixedItem: { margin: "18px 28px 10px", padding: "13px 14px", borderRadius: 10, background: "#fafafa", border: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" },
  exportFixedText: { fontSize: 14, fontWeight: 800, color: "#1a1a1a" },
  exportFixedBadge: { fontSize: 12, fontWeight: 800, color: "#E86F00", background: "#FEF0E9", padding: "5px 8px", borderRadius: 999 },
  exportOptionGrid: { padding: "8px 28px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  exportOptionItem: { width: "100%", padding: "12px 13px", border: "1px solid #eee", borderRadius: 10, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontFamily: "inherit" },
  exportOptionText: { fontSize: 13.5, fontWeight: 700, color: "#333" },
  exportSwitch: { width: 42, height: 24, borderRadius: 999, padding: 3, display: "flex", alignItems: "center", transition: "all 0.2s", flexShrink: 0 },
  exportSwitchCircle: { width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", transition: "transform 0.2s" },
  exportModalFooter: { padding: "16px 28px 24px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "flex-end", gap: 8 },
  exportCancelBtn: { padding: "10px 18px", fontSize: 13, color: "#666", background: "#fff", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  exportConfirmBtn: { padding: "10px 18px", fontSize: 13, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 800 },
  topSearchLayout: { width: "min(1600px, calc(100vw - 96px))", margin: "0 auto", padding: "2.5rem 0 0", display: "grid", gridTemplateColumns: "minmax(840px, 1fr) 560px", gap: 24, alignItems: "start", boxSizing: "border-box" },
  searchMainCol: { minWidth: 0 },
  popularSideCol: { position: "sticky", top: 96, minWidth: 0, width: "100%" },
  popularRankBoard: { background: "transparent", border: "none", borderRadius: 0, padding: "16px 0", boxShadow: "none", display: "grid", gridTemplateColumns: "1.2fr 1px 0.8fr", gap: 14, minHeight: 520, alignItems: "start", width: "100%" },
  popularRankColumn: { minWidth: 0, display: "flex", flexDirection: "column", height: "100%" },
  popularRankDivider: { width: 1, background: "#f0f0f0", alignSelf: "stretch" },
  popularColumnHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  popularCompactList: { display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "space-between" },
  popularCaseCompactList: { display: "flex", flexDirection: "column", gap: 0, flex: 1, justifyContent: "stretch" },
  popularCompactItem: { width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 8px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" },
  popularCompactRank: { fontSize: 14, fontWeight: 800, color: "#E86F00", flexShrink: 0, minWidth: 14, lineHeight: 1.4 },
  popularCompactBody: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 },
  popularCompactMeta: { fontSize: 12, color: "#E86F00", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularCompactTitle: { fontSize: 13.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  popularCompactCompany: { fontSize: 12, color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularKeywordItem: { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 8px", background: "#fff", border: "none", borderBottom: "1px solid #f0f0f0", borderRadius: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" },
  popularKeywordText: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularKeywordCount: { minWidth: 22, height: 20, padding: "0 6px", borderRadius: 999, background: "#FEF0E9", color: "#E86F00", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  page: { width: "100%", margin: "0 auto", padding: 0, fontFamily: "'Karrot Sans', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', sans-serif", boxSizing: "border-box" },
  splitRow: { display: "flex", gap: 16, alignItems: "flex-start", width: "min(1600px, calc(100vw - 96px))", margin: "0 auto", padding: "0 0 2rem", boxSizing: "border-box" },
  caseListCol: { width: 420, flexShrink: 0, borderRight: "1px solid #e0e0e0", paddingRight: 16 },
  mapCol: { flex: 1, minWidth: 0 },
  logoArea: { marginBottom: "2.5rem", textAlign: "center" },
  heroTitleWrap: { minHeight: 88, display: "flex", alignItems: "center", justifyContent: "center" },
  heroKeyword: { display: "inline-block", minWidth: 250, textAlign: "right", fontWeight: 850, lineHeight: 1.18, letterSpacing: "-0.045em", color: "#111827", animation: "heroKeywordSlide 2.3s ease-in-out both", willChange: "transform, opacity", verticalAlign: "baseline" },
  logoTitle: { margin: 0, fontSize: 34, fontWeight: 760, lineHeight: 1.32, letterSpacing: "-0.04em", color: "#1a1a1a", whiteSpace: "nowrap" },
  
  filterWrapper: { marginBottom: "1.5rem", background: "#fff", border: "1px solid #ede8e2", borderRadius: 12, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", maxWidth: 800  },
  filterSection: { marginBottom: 16, paddingBottom: 16, borderBottom: "1px dashed #f0f0f0" },
  filterLabel: { fontSize: 15, fontWeight: 600, color: "#666", marginBottom: 10 },
  chipGroup: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "7px 18px", fontSize: 13, fontWeight: 500, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActive: { padding: "7px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(232, 111, 0, 0.2)" },
  chipNone: { padding: "7px 18px", fontSize: 13, fontWeight: 500, color: "#888", background: "#f9f9f9", border: "1px dashed #d0d0d0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActiveNone: { padding: "7px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#666", border: "1px solid #666", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)" },

  textarea: { width: "100%", minHeight: 100, padding: "14px 16px", fontSize: 16, fontFamily: "inherit", color: "#1a1a1a", background: "#f5f5f5", borderRadius: 12, lineHeight: 1.6, outline: "none", boxSizing: "border-box", resize: "none", maxHeight: 180 },
  btnRow: { display: "flex", justifyContent: "flex-end", gap: 8, maxWidth: 848, margin: "12px auto 0.8rem" },
  btnClear: { padding: "8px 16px", fontSize: 15, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  btnSearch: { padding: "8px 20px", fontSize: 15, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 12, fontFamily: "inherit" },
  exampleArea: { marginBottom: "1.5rem" },
  chipsLabel: { fontSize: 13, color: "#999", marginBottom: 6, textAlign: "center" },
  exampleChip: { padding: "4px 10px", fontSize: 13, color: "#E86F00", background: "#fef0e9", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  loadingRow: { display: "flex", alignItems: "center", gap: 8, padding: "1rem 0" },
  loadingText: { fontSize: 14, color: "#999" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#E86F00", animation: "pulse 1.2s ease-in-out infinite" },
  errorText: { fontSize: 14, color: "#A32D2D", padding: "0.5rem 0" },
  inputPanel: { background: "#f0f0f0", border: "none", overflow: "hidden", boxSizing: "border-box", borderRadius: 12, maxWidth: 848 },
  exampleAreaInInput: { padding: "8px 14px 10px", background: "#fff", border: "none", boxSizing: "border-box" },
  loadingStatusArea: { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "flex-start", padding: "0.2rem 0 1rem", marginTop: "-0.2rem" },
  loadingStatusText: { fontSize: 17, fontWeight: 600, color: "#E86F00", letterSpacing: "-0.01em" },
  loadingEllipsis: { display: "inline-block", width: 28, textAlign: "left" },

  popularBox: { background: "#fff", border: "1px solid #ede8e2", borderRadius: 12, padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" },
  popularHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  popularEyebrow: { fontSize: 12, color: "#999", margin: 0, marginBottom: 4 },
  popularTitle: { fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: 0 },
  popularBadge: { fontSize: 12, fontWeight: 700, color: "#E86F00" },
  popularMessage: { fontSize: 14, color: "#777", lineHeight: 1.5, padding: "14px 0", margin: 0 },
  popularList: { display: "flex", flexDirection: "column", gap: 8 },
  popularItem: { display: "flex", gap: 12, padding: "12px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid #f0f0f0", transition: "all 0.2s", background: "#fff" },
  popularRank: { fontSize: 14, fontWeight: 800, color: "#E86F00", flexShrink: 0, minWidth: 12 },
  popularMeta: { display: "flex", gap: 5, fontSize: 12, color: "#E86F00", fontWeight: 600, marginBottom: 4 },
  popularItemTitle: { fontSize: 14, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.4, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  popularCompany: { fontSize: 12, color: "#999", marginTop: 5 },

  recommendStatusBox: {
    background: "#FFF8F3",
    border: "1px solid #F3D8C7",
    borderLeft: "3px solid #E86F00",
    borderRadius: 6,
    padding: "12px 14px",
    marginBottom: 12,
  },

  recommendStatusTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#C45E00",
    margin: "0 0 4px",
  },

  recommendStatusMessage: {
    fontSize: 13,
    color: "#666",
    lineHeight: 1.55,
    margin: 0,
  },

  infoBtn: { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#E86F00", background: "#fef0e9", border: "none", borderRadius: 20, cursor: "pointer", transition: "background 0.2s" },
  card: { background: "#fff", border: "0.5px solid #fff", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: 12 },
  cardLabel: { fontSize: 21, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1a1a1a", margin: 0, textAlign: "left" },
  problemSummary: { fontSize: 15, color: "#333", lineHeight: 1.7, marginBottom: 16 },
  divider: { border: "none", borderTop: "1px solid #f0f0f0", margin: "16px 0" },
  tagSectionLabel: { fontSize: 12, color: "#999", marginBottom: 8, fontWeight: 500 },
  tag: { padding: "4px 10px", fontSize: 13, borderRadius: 4, fontWeight: 500 },
  
  caseItem: { display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 12px", border: "1px solid transparent", borderBottom: "1px solid #f0f0f0", borderRadius: 2, cursor: "pointer", transition: "all 0.2s" },
  caseRank: { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0, color: "#1a1a1a" },
  caseTitle: { fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 3 },
  caseMeta: { fontSize: 13, color: "#999" },
  caseTag: { padding: "4px 10px", fontSize: 13, color: "#555", background: "#f0f0f0", borderRadius: 2 },

  bottomBrowseSection: { width: 1000, margin: "0 auto 5rem", padding: "0 2rem", boxSizing: "border-box" },
  btnBrowseAll: { width: "100%", padding: "14px", fontSize: 16, fontWeight: 600, color: "#1a1a1a", background: "#f0f0f0", border: "none", borderRadius: 12, cursor: "pointer", transition: "all 0.2s" },
  allListWrapper: { background: "#fff", border: "1px solid #ede8e2", borderRadius: 2, padding: 24, marginTop: 10 },
  allListHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  allListTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  btnCloseAll: { background: "none", border: "none", fontSize: 14, color: "#888", cursor: "pointer", fontWeight: 500 },
  allListGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1px", borderTop: "1px solid #f0f0f0", background: "#f0f0f0" },
  archiveCard: { padding: "16px 12px", background: "#fff", borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "all 0.2s" },
  archiveHeader: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "#999", marginBottom: 6 },
  archiveIndustry: { fontSize: 14, fontWeight: 600, color: "#E86F00" },
  archiveDate: { fontSize: 14 },
  archiveTitle: { fontSize: 18, fontWeight: 900, color: "#1a1a1a", marginBottom: 4 },
  archiveCompany: { fontSize: 15, color: "#666", marginBottom: 8 },
  archiveSummary: { fontSize: 14, color: "#666", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  btnLoadMore: { padding: "12px 120px", fontSize: 14, fontWeight: 600, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 2, cursor: "pointer" },

  panel: { position: "fixed", top: 72, right: 0, width: 420, height: "calc(100vh - 72px)", background: "#fff", borderLeft: "1px solid #e0e0e0", boxShadow: "-4px 0 20px rgba(0,0,0,0.08)", zIndex: 200, padding: "2rem", boxSizing: "border-box", overflowY: "auto", display: "flex", flexDirection: "column" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  panelTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.4, margin: 0, flex: 1 },
  panelMeta: { fontSize: 15, color: "#666", marginBottom: 16 },
  reasonBox: { background: "#FFF6F0", border: "1px solid #F3D8C7", borderLeft: "3px solid #E86F00", borderRadius: 6, padding: "14px 15px", marginBottom: 14 },
  summaryBox: { background: "#FFF9F5", border: "1px solid #F3D8C7", borderRadius: 6, padding: "13px 14px", marginBottom: 14 },
  reasonBoxWhite: { background: "#fff", border: "1px solid #eee", borderRadius: 6, padding: "14px", marginBottom: 14 },
  reasonTitle: { fontSize: 13, fontWeight: 900, color: "#C45E00", margin: "0 0 8px" },
  summaryBoxTitle: { fontSize: 13, fontWeight: 900, color: "#E86F00", margin: "0 0 6px" },
  reasonTitleDark: { fontSize: 13, fontWeight: 800, color: "#333", margin: "0 0 7px" },
  reasonItem: { fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0, wordBreak: "keep-all" },
  insightTextGroup: { display: "flex", flexDirection: "column", gap: 8 },
  insightParagraph: { fontSize: 13.5, color: "#555", lineHeight: 1.75, margin: 0, wordBreak: "keep-all" },
  panelActionGroup: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  panelSummaryBtn: { width: "100%", padding: "11px 12px", fontSize: 13.5, fontWeight: 800, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" },
  panelLink: { width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" },

  summaryPreviewHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 },
  summaryPreviewText: { fontSize: 13, color: "#666", lineHeight: 1.5, margin: 0 },
  summaryOpenBtn: { flexShrink: 0, padding: "8px 11px", fontSize: 12.5, fontWeight: 800, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },

  caseSummaryModalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000 },
  caseSummaryModal: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(620px, calc(100vw - 40px))", maxHeight: "78vh", background: "#fff", borderRadius: 16, zIndex: 1100, boxShadow: "0 18px 50px rgba(0,0,0,0.18)", overflow: "hidden", display: "flex", flexDirection: "column" },
  caseSummaryModalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "22px 24px 18px", borderBottom: "1px solid #f0f0f0" },
  caseSummaryModalLabel: { fontSize: 13, fontWeight: 800, color: "#E86F00", margin: "0 0 8px" },
  caseSummaryModalTitle: { fontSize: 20, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.45, margin: "0 0 8px", letterSpacing: "-0.03em" },
  caseSummaryModalMeta: { fontSize: 13, color: "#999", margin: 0 },
  caseSummaryModalCloseBtn: { width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f7f7f7", color: "#999", cursor: "pointer", fontSize: 16, flexShrink: 0 },
  caseSummaryModalBody: { padding: "22px 24px", overflowY: "auto" },
  caseSummaryParagraph: { fontSize: 15, color: "#333", lineHeight: 1.9, margin: "0 0 18px", letterSpacing: "-0.01em", wordBreak: "keep-all" },
  caseSummaryModalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 24px", borderTop: "1px solid #f0f0f0", background: "#fafafa" },
  caseSummaryModalSubBtn: { padding: "9px 16px", fontSize: 14, fontWeight: 700, color: "#666", background: "#fff", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" },
  caseSummaryModalMainBtn: { padding: "9px 16px", fontSize: 14, fontWeight: 800, color: "#fff", background: "#E86F00", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" },

  bottomBar: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#1a1a1a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", zIndex: 300, boxShadow: "0 -4px 12px rgba(0,0,0,0.15)" },
  bottomBarText: { fontSize: 14, fontWeight: 500 },
  bottomBarBtnReset: { padding: "8px 16px", fontSize: 13, color: "#fff", background: "transparent", border: "1px solid #555", borderRadius: 12, cursor: "pointer" },
  bottomBarBtnOutline: { padding: "8px 16px", fontSize: 13, color: "#fff", background: "transparent", border: "1px solid #666", borderRadius: 12, cursor: "pointer" },
  bottomBarBtnFill: { padding: "8px 16px", fontSize: 13, color: "#1a1a1a", background: "#fff", border: "none", borderRadius: 12, cursor: "pointer" },

  fullScreenLoading: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(4px)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    display: "flex",
    flexDirection: "column",
    padding: "36px 40px",
    background: "#fff",
    borderRadius: 2,
    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
    width: 520,
    maxWidth: "90%",
    boxSizing: "border-box"
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16
  },
  loadingStatusTextCenter: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a1a",
    letterSpacing: "-0.01em",
    textAlign: "center",
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: 800,
    color: "#E86F00"
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    background: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    background: "#E86F00",
    borderRadius: 4,
    transition: "width 0.4s ease-out"
  },

  loadingVisualWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  loadingVisualStage: {
    position: "relative",
    width: 196,
    height: 92,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBook: {
    position: "absolute",
    left: 26,
    top: 16,
    width: 58,
    height: 54,
    borderRadius: "4px 8px 8px 4px",
    background: "#fff",
    border: "1px solid #E7E7E7",
    transformStyle: "preserve-3d",
    perspective: 500,
    animation: "loadingBookPulse 2.2s ease-in-out infinite",
    overflow: "visible",
  },
  loadingBookCover: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 29,
    height: "100%",
    borderRadius: "4px 2px 2px 4px",
    background: "#E86F00",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "0.02em",
  },
  loadingBookPageBack: {
    position: "absolute",
    left: 30,
    top: 7,
    width: 24,
    height: 38,
    borderRadius: "2px 6px 6px 2px",
    background: "linear-gradient(90deg, #fff 0%, #f4f4f4 100%)",
    border: "1px solid #eeeeee",
  },
  loadingBookPageFlip: {
    position: "absolute",
    left: 30,
    top: 7,
    width: 24,
    height: 38,
    borderRadius: "2px 6px 6px 2px",
    background: "#fff",
    border: "1px solid #eeeeee",
    transformOrigin: "left center",
    animation: "loadingPageFlip 1.65s ease-in-out infinite",
  },
  loadingCardsWrap: {
    position: "absolute",
    right: 22,
    top: 18,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  loadingMiniCard: {
    width: 74,
    height: 18,
    borderRadius: 5,
    background: "#FAFAFA",
    border: "1px solid #E8E8E8",
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "0 7px",
    boxSizing: "border-box",
    animation: "loadingCardFloat 1.6s ease-in-out infinite",
  },
  loadingMiniCardLineLong: {
    display: "block",
    width: 34,
    height: 3,
    borderRadius: 3,
    background: "#D9D9D9",
  },
  loadingMiniCardLineShort: {
    display: "block",
    width: 16,
    height: 3,
    borderRadius: 3,
    background: "#E86F00",
    opacity: 0.55,
  },
  loadingMagnifier: {
    position: "absolute",
    left: 86,
    top: 35,
    width: 38,
    height: 38,
    animation: "loadingMagnifierScan 1.9s ease-in-out infinite",
  },
  loadingMagnifierCircle: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "3px solid #1a1a1a",
    background: "rgba(255,255,255,0.55)",
  },
  loadingMagnifierHandle: {
    position: "absolute",
    left: 21,
    top: 23,
    width: 18,
    height: 3,
    borderRadius: 3,
    background: "#1a1a1a",
    transform: "rotate(45deg)",
    transformOrigin: "left center",
  },
  loadingStrategyStack: {
    position: "absolute",
    left: 86,
    top: 28,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  loadingStrategyChip: {
    width: 58,
    height: 20,
    borderRadius: 999,
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "loadingStrategySlide 1.5s ease-in-out infinite",
  },
  loadingMapDots: {
    position: "absolute",
    left: 92,
    top: 30,
    width: 58,
    height: 42,
  },
  loadingMapDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#E86F00",
    animation: "loadingMapPulse 1.4s ease-in-out infinite",
  },
  loadingVisualLabel: {
    margin: "2px 0 0",
    fontSize: 12,
    fontWeight: 700,
    color: "#888",
    letterSpacing: "0.02em",
  },

  invalidNoticeContent: {
    width: 520,
    maxWidth: "calc(100vw - 40px)",
    padding: "34px 38px",
    background: "#fff",
    borderRadius: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
    border: "1px solid #f0f0f0",
    textAlign: "center",
    boxSizing: "border-box",
  },

  invalidNoticeIcon: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#FEF0E9",
    color: "#E86F00",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 900,
    margin: "0 auto 14px",
  },

  invalidNoticeTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#1a1a1a",
    margin: "0 0 10px",
    letterSpacing: "-0.02em",
  },

  invalidNoticeText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 1.7,
    margin: "0 0 20px",
    wordBreak: "keep-all",
  },

  invalidNoticeExamples: {
    background: "#fafafa",
    border: "1px solid #eeeeee",
    borderRadius: 10,
    padding: "14px 16px",
    textAlign: "left",
    fontSize: 13,
    color: "#666",
    lineHeight: 1.6,
  },

  invalidNoticeExampleLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 800,
    color: "#E86F00",
    marginBottom: 6,
  },

  invalidNoticeExampleText: {
    margin: "2px 0",
    fontSize: 13,
    color: "#666",
  },

historyToggleWrapper: {
  marginTop: 18,
},

historyToggleBtn: {
  width: "100%",
  height: 48,
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 2,
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 14,
  fontWeight: 700,
  color: "#1a1a1a",
  cursor: "pointer",
  fontFamily: "inherit",
},

historyToggleIcon: {
  fontSize: 12,
  color: "#E86F00",
},

historyPanel: {
  marginTop: 8,
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 2,
  padding: 16,
},

historyFilterGroup: {
  display: "flex",
  gap: 6,
  justifyContent: "flex-end",
  flexWrap: "wrap",
  marginBottom: 12,
},

historyFilterBtn: {
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#666",
  background: "#f5f5f5",
  border: "1px solid #e0e0e0",
  borderRadius: 20,
  cursor: "pointer",
  fontFamily: "inherit",
},

historyFilterActive: {
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
  background: "#E86F00",
  border: "1px solid #E86F00",
  borderRadius: 20,
  cursor: "pointer",
  fontFamily: "inherit",
},

historyEmpty: {
  margin: 0,
  fontSize: 13,
  color: "#999",
  textAlign: "center",
  padding: "14px 0",
},

historyList: {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 220,
  overflowY: "auto",
},

historyItem: {
  width: "100%",
  textAlign: "left",
  background: "#fafafa",
  border: "1px solid #eeeeee",
  borderRadius: 6,
  padding: "10px 12px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontFamily: "inherit",
},

historyText: {
  fontSize: 13,
  fontWeight: 600,
  color: "#333",
  lineHeight: 1.5,
},

historyDate: {
  fontSize: 11,
  color: "#999",
},


searchModeRow: {
  maxWidth: 848,
  margin: "0 auto 12px",
  display: "flex",
  alignItems: "stretch",
  gap: 8,
},

searchModeHelpWrap: {
  position: "relative",
  flexShrink: 0,
},

searchModeHelpBtn: {
  width: 25,
  height: 25,
  borderRadius: "50%",
  border: "1px solid #fa8f51",
  background: "#fff",
  color: "#fa8f51",
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
  marginTop : 13,
  marginLeft : 3
},

searchModeHelpTooltip: {
  position: "absolute",
  top: 38,
  left: 0,
  width: 350,
  padding: "14px 15px",
  background: "#1f1f1f",
  color: "#fff",
  borderRadius: 12,
  boxShadow: "0 14px 30px rgba(0,0,0,0.20)",
  zIndex: 30,
  boxSizing: "border-box",
},

searchModeHelpTitle: {
  margin: "0 0 10px",
  fontSize: 13,
  fontWeight: 900,
  color: "#fff",
},

searchModeHelpItem: {
  padding: "0 0 10px",
  marginBottom: 10,
  borderBottom: "1px solid rgba(255,255,255,0.12)",
},

searchModeHelpItemLast: {
  padding: 0,
  margin: 0,
},

searchModeHelpBadge: {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  padding: "0 8px",
  marginBottom: 6,
  borderRadius: 999,
  background: "rgba(232,111,0,0.16)",
  color: "#FFB16A",
  fontSize: 11,
  fontWeight: 900,
},

searchModeHelpText: {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: "#e5e5e5",
},

searchModeBox: {
  flex: 1,
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
  gap: 8,
  background: "#f6f6f6",
  border: "1px solid #eeeeee",
  borderRadius: 14,
  padding: 6,
},

searchModeBtn: {
  flex: 1,
  padding: "9px 12px",
  border: "1px solid transparent",
  borderRadius: 10,
  background: "transparent",
  color: "#777",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.18s ease",
},

searchModeBtnActive: {
  flex: 1,
  padding: "9px 12px",
  border: "1px solid #E86F00",
  borderRadius: 10,
  background: "#fff",
  color: "#E86F00",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 6px 16px rgba(232,111,0,0.12)",
  transition: "all 0.18s ease",
},

queryHistoryDropdown: {
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  maxHeight: 160,
  maxWidth: 848,
  margin: "4px auto 0",
  overflowY: "auto",
},

queryHistoryDropdownItem: {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  background: "#fff",
  border: "none",
  borderBottom: "1px solid #f0f0f0",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "grid",
  gridTemplateColumns: "1fr auto 26px",
  alignItems: "center",
  gap: 10,
},

queryHistoryDropdownText: {
  minWidth: 5,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  color: "#444",
},

queryHistoryDropdownDate: {
  fontSize: 11,
  color: "#aaa",
  whiteSpace: "nowrap",
},


queryHistoryDeleteBtn: {
  width: 22,
  height: 22,
  marginLeft: 0,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "#b8b8b8",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: "22px",
  textAlign: "center",
  cursor: "pointer",
  flexShrink: 0,
},

searchExampleBar: {
  maxWidth: 848,
  margin: "0 auto",
  borderTop: "1px solid #e0e0e0",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 16px",
  background: "#fff",
  overflow: "hidden",
},

searchExampleLabel: {
  fontSize: 12,
  fontWeight : 700,
  color: "#E86F00",
  flexShrink: 0,
},

searchExampleText: {
  margin: 0,
  fontSize: 13,
  color: "#777",
  animation: "fadeInOut 4.0s ease-in-out",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
},

caseModePanel: {
  maxWidth: 848,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #eeeeee",
  borderRadius: 14,
  padding: 18,
  boxSizing: "border-box",
  boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
},

searchExampleBoxSeparate: {
  width: "100%",
  marginTop: 10,
  border: "1px solid #e8e8e8",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  background: "#fafafa",
  overflow: "hidden",
  boxSizing: "border-box",
},

applyModePanel: {
  maxWidth: 848,
  minHeight: 286,
  margin: "0 auto",
  background: "#fff",
  border: "1px solid #eeeeee",
  borderRadius: 14,
  padding: 16,
  boxSizing: "border-box",
  boxShadow: "0 8px 22px rgba(0,0,0,0.04)",
},

applyModeHeader: {
  marginBottom: 10,
},

applyModeTitle: {
  margin: "0 0 5px",
  fontSize: 15,
  fontWeight: 900,
  color: "#1a1a1a",
},

applyModeDesc: {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#777",
},

applyInputGrid: {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 9,
},

applyFieldWrap: {
  position: "relative",
  width: "100%",
},

applyFieldWrapWide: {
  position: "relative",
  width: "100%",
},

applyField: {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontFamily: "inherit",
},

applyFieldWide: {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontFamily: "inherit",
},

applyFieldLabel: {
  fontSize: 12,
  fontWeight: 850,
  color: "#E86F00",
},

applyInput: {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#333",
  background: "#fafafa",
  outline: "none",
  fontFamily: "inherit",
},

applyTextarea: {
  width: "100%",
  minHeight: 54,
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#333",
  background: "#fafafa",
  outline: "none",
  fontFamily: "inherit",
},

applyTextareaSmall: {
  width: "100%",
  minHeight: 54,
  resize: "vertical",
  boxSizing: "border-box",
  border: "1px solid #e6e6e6",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#333",
  background: "#fafafa",
  outline: "none",
  fontFamily: "inherit",
},

applyFieldHistoryDropdown: {
  position: "absolute",
  left: 0,
  right: 0,
  top: "100%",
  zIndex: 30,
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  maxHeight: 160,
  marginTop: 4,
  overflowY: "auto",
},

applyFieldHistoryItem: {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  background: "#fff",
  border: "none",
  borderBottom: "1px solid #f0f0f0",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "grid",
  gridTemplateColumns: "1fr auto 26px",
  alignItems: "center",
  gap: 10,
  boxSizing: "border-box",
},

applyFieldHistoryText: {
  minWidth: 5,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 13,
  color: "#444",
},

applyFieldHistoryDate: {
  fontSize: 11,
  color: "#aaa",
  whiteSpace: "nowrap",
},

applyFieldHistoryDeleteBtn: {
  width: 22,
  height: 22,
  marginLeft: 0,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "#b8b8b8",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: "22px",
  textAlign: "center",
  cursor: "pointer",
  flexShrink: 0,
},

applyHistoryBox: {
  marginTop: 12,
  border: "1px solid #eeeeee",
  borderRadius: 12,
  background: "#fafafa",
  padding: "10px 12px",
},

applyHistoryHeader: {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
},

applyHistoryTitle: {
  fontSize: 12,
  fontWeight: 850,
  color: "#E86F00",
},

applyHistoryList: {
  display: "flex",
  flexDirection: "column",
  gap: 6,
},

applyHistoryItem: {
  width: "100%",
  display: "grid",
  gridTemplateColumns: "1fr auto 24px",
  alignItems: "center",
  gap: 8,
  border: "1px solid #eeeeee",
  borderRadius: 10,
  background: "#fff",
  padding: "8px 10px",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
},

applyHistoryText: {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12.5,
  color: "#555",
},

applyHistoryDate: {
  fontSize: 11,
  color: "#aaa",
  whiteSpace: "nowrap",
},

applyHistoryDeleteBtn: {
  width: 22,
  height: 22,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "#b8b8b8",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: "22px",
  textAlign: "center",
  cursor: "pointer",
},
};
