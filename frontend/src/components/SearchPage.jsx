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

const getStatusLabel = (status) => {
  const statusMap = {
    DIRECT_MATCH: "딱 맞는 사례를 찾았어요",
    CLOSE_MATCH: "꽤 가까운 사례를 찾았어요",
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
  const [loading, setLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("today");
  const [showQueryHistory, setShowQueryHistory] = useState(false);
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
  const [bookmarkedCaseIds, setBookmarkedCaseIds] = useState(new Set());

  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const [showAllList, setShowAllList] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [btnHover, setBtnHover] = useState(false);
  const [clearBtnHover, setClearBtnHover] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [browseHover, setBrowseHover] = useState(false);
  const [showSelectedList, setShowSelectedList] = useState(false);
  const resultSectionRef = useRef(null);

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem("businessQueryHistory") || "[]");
    setQueryHistory(savedHistory);
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

  useEffect(() => {
    fetchPopularQueries();
  }, []);

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

  const getLoadingText = (percent) => {
    if (percent < 30) return "입력하신 비즈니스 문제를 분석하는 중...";
    if (percent < 60) return "DBR 아카이브에서 유사 상황을 탐색하는 중...";
    if (percent < 90) return "AI가 해결 전략과 케이스를 매칭하는 중...";
    return "최적의 케이스를 마무리 정리하는 중...";
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

  const handleSearch = async () => {
    const filters = [selectedIndustry, selectedCategory, selectedKeyword]
      .filter((val) => val && val !== "상관없음")
      .join(", ");

    if (!query.trim() && !filters) return;

    const searchQuery = query.trim()
      ? filters
        ? `[필터조건: ${filters}] ${query.trim()}`
        : query.trim()
      : filters;

    const rawQueryText = query.trim();
    
    saveBusinessQueryHistory(rawQueryText);

    const blockedRawQueryPattern =
      /(시발|씨발|ㅅㅂ|병신|새끼|개새|좆|존나|ㅈㄴ|꺼져|죽어|대머리새끼|미친|개빡|짜증)/i;

    if (blockedRawQueryPattern.test(rawQueryText)) {
      const noticeMessage =
        "입력하신 문장에 부적절한 표현이 포함되어 있어요. 비즈니스 문제 중심으로 다시 작성해주세요.";

      setResult({
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
          ? Math.round(Number(item.final_score) * 100)
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
      }));

      setResult({
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
        query_meta: queryMeta,
        result_status: resultStatus,
        cases: mappedCases,
      });

      if (onSearch) {
        onSearch(mappedCases);
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

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setError(null);
    setSelectedCase(null);
    setSelectedCases([]);
    setSelectedIndustry(null);
    setSelectedCategory(null);
    setSelectedKeyword(null);
    setShowAnalysisModal(false);
    setShowAllList(false);
    setVisibleCount(10);
    setHasSearched(false);
  };

  const toggleSelectCase = (c) => {
    setSelectedCases((prev) =>
      prev.find((s) => s.title === c.title)
        ? prev.filter((s) => s.title !== c.title)
        : prev.length < 3 ? [...prev, c] : prev
    );
  };

  const cases = result ? result.cases : allCases.slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 }));
  const isSearchDisabled = loading || (!query.trim() && !selectedIndustry && !selectedCategory);

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
      rank: matched.rank,
      similarity: matched.similarity,
      isRecommended: true,
    };
  });

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
    setSelectedCase(caseData);
    saveCaseViewLog(caseData, viewSource);
  };

  return (
    <>
      <div style={styles.topSearchLayout}>
        <div style={styles.searchMainCol}>
          <div style={styles.page}>
        <div style={styles.logoArea}>
          <h1 style={styles.logoTitle}>
            어떤 비즈니스 문제를{" "}
            <span style={{ color: "#E86F00" }}>해결하려 하시나요?</span>
          </h1>
        </div>

        <div style={styles.filterWrapper}>
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
          <div style={{ ...styles.inputPanel, border: "1px solid #e0e0e0" }}>
            <textarea
              style={{
                ...styles.textarea,
                background: textareaFocused ? "#fff" : "#f5f5f5",
                border: textareaFocused ? "1.5px solid #E86F00" : "1px solid transparent",
                borderBottom: "none",
                borderRadius: 0,
                marginBottom: -5,
              }}
              placeholder="비즈니스 고민을 자유롭게 입력해주세요."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => { if (!query.trim()) setTextareaFocused(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch(); }}
            />

            <div style={{ ...styles.exampleAreaInInput, borderTop: "1px solid #e0e0e0" }}>
              <p style={styles.chipsLabel}>예시 고민</p>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 6, flexWrap: "wrap" }}>
                <span style={styles.exampleChip}>리테일 업종에서 3년 차 마케터인데, 브랜드 인지도는 높아졌는데 실제 구매 전환율이 너무 낮아요.</span>
                <span style={styles.exampleChip}>식음료 스타트업 창업한지 2년차, 매출은 나오는데 수익성이 계속 악화되고 있어요.</span>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                <span style={styles.exampleChip}>IT 플랫폼 기업 신사업팀 4년 차인데, 새로운 시장에 진입하려는데 어디서부터 시작해야 할까요?</span>
                <span style={styles.exampleChip}>커머스 회사 PM입니다. 신규 유저는 늘고 있는데 고객 이탈률이 높아서 고민이에요.</span>
                <span style={styles.exampleChip}>헬스케어 스타트업 대표인데, 기술은 있는데 어떤 고객층부터 공략해야 할지 방향을 못 잡겠어요.</span>
              </div>
            </div>
          </div>

          <div style={styles.btnRow}>
            <button
              style={{ ...styles.btnClear, background: clearBtnHover ? "#e8e8e8" : "transparent", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setClearBtnHover(true)}
              onMouseLeave={() => setClearBtnHover(false)}
              onClick={handleClear}
              disabled={isSearchDisabled && selectedIndustry === null}
            >초기화</button>
            <button
              style={{ ...styles.btnSearch, background: btnHover ? "#C45E00" : "#E86F00", opacity: isSearchDisabled ? 0.5 : 1, cursor: isSearchDisabled ? "not-allowed" : "pointer" }}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              onClick={handleSearch}
              disabled={isSearchDisabled}
            >케이스 탐색 시작</button>
          </div>
          <div style={styles.historyToggleWrapper}>
            <button
              type="button"
              style={styles.historyToggleBtn}
              onClick={() => setShowQueryHistory(prev => !prev)}
            >
              <span>최근 입력한 비즈니스 고민</span>
              <span style={styles.historyToggleIcon}>
                {showQueryHistory ? "▲" : "▼"}
              </span>
            </button>

            {showQueryHistory && (
              <div style={styles.historyPanel}>
                <div style={styles.historyFilterGroup}>
                  <button
                    type="button"
                    style={historyFilter === "today" ? styles.historyFilterActive : styles.historyFilterBtn}
                    onClick={() => setHistoryFilter("today")}
                  >
                    오늘
                  </button>
                  <button
                    type="button"
                    style={historyFilter === "week" ? styles.historyFilterActive : styles.historyFilterBtn}
                    onClick={() => setHistoryFilter("week")}
                  >
                    일주일
                  </button>
                  <button
                    type="button"
                    style={historyFilter === "month" ? styles.historyFilterActive : styles.historyFilterBtn}
                    onClick={() => setHistoryFilter("month")}
                  >
                    한 달
                  </button>
                  <button
                    type="button"
                    style={historyFilter === "all" ? styles.historyFilterActive : styles.historyFilterBtn}
                    onClick={() => setHistoryFilter("all")}
                  >
                    전체
                  </button>
                </div>

                {getFilteredQueryHistory().length === 0 ? (
                  <p style={styles.historyEmpty}>아직 기록된 고민이 없습니다.</p>
                ) : (
                  <div style={styles.historyList}>
                    {getFilteredQueryHistory().map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        style={styles.historyItem}
                        onClick={() => {
                          setQuery(item.text);
                          setTextareaFocused(true);
                          setShowQueryHistory(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <span style={styles.historyText}>{item.text}</span>
                        <span style={styles.historyDate}>
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            onCaseClick={(caseData) => handleCaseSelect(caseData, "archive")}
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
                  {result ? "유사 케이스 추천 " : "추천 케이스 TOP 5"}
                  {result && <span style={{ color: "#E86F00" }}>5</span>}
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
                    onClick={() => handleCaseSelect(c, result ? "recommend" : "archive")}
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
              highlightedIds={recommendedCaseIds}
              focusCaseId={selectedCase?.case_idx || selectedCase?.id || null}
              onCaseClick={(caseData) => handleCaseSelect(caseData, "map")}
            />
          </div>
        </div>
      )}

      <div style={styles.bottomBrowseSection}>
        {!showAllList ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <button 
              style={{ ...styles.btnBrowseAll, background: browseHover ? "#E86F00" : "#F2F2F2", color: browseHover ? "#fff" : "#1a1a1a", border: browseHover ? "1px solid #E86F00" : "1px solid #ddd" }}
              onClick={() => setShowAllList(true)}
              onMouseEnter={() => setBrowseHover(true)}
              onMouseLeave={() => setBrowseHover(false)}
            >
              DBR 전체 케이스 펼쳐보기
            </button>
          </div>
        ) : (
          <div style={styles.allListWrapper}>
            <div style={styles.allListHeader}>
              <h2 style={styles.allListTitle}>DBR 전체 케이스 아카이브</h2>
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

      {selectedCase && (
        <CasePanel
          caseData={selectedCase}
          selectedCases={selectedCases}
          onToggleSelect={() => toggleSelectCase(selectedCase)}
          isSelected={!!selectedCases.find((s) => s.title === selectedCase.title)}
          isBookmarked={bookmarkedCaseIds.has(String(selectedCase.case_idx ?? selectedCase.id))}
          onToggleBookmark={() => handleToggleBookmark(selectedCase)}
          onClose={() => setSelectedCase(null)}
        />
      )}
      {showCompare && (
        <CompareSidebar
          cases={selectedCases}
          onRemove={(title) => setSelectedCases((prev) => prev.filter((s) => s.title !== title))}
          onClose={() => setShowCompare(false)}
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
              <button style={styles.bottomBarBtnOutline} onClick={() => { setShowCompare(true); setSelectedCase(null); }}>케이스 비교하기</button>
              {/* <button style={styles.bottomBarBtnFill}>내보내기</button> */}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.fullScreenLoading}>
          <div style={styles.loadingContent}>
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
            <p style={styles.invalidNoticeTitle}>검색 의도를 확인하기 어려워요</p>
            <p style={styles.invalidNoticeText}>{invalidNotice}</p>
            <div style={styles.invalidNoticeExamples}>
              <span style={styles.invalidNoticeExampleLabel}>이렇게 입력해보세요</span>
              <p style={styles.invalidNoticeExampleText}>고객 이탈률을 줄이고 싶어요</p>
              <p style={styles.invalidNoticeExampleText}>신사업 진입 전략을 참고하고 싶어요</p>
              <p style={styles.invalidNoticeExampleText}>브랜드 인지도는 높은데 구매 전환이 안 돼요</p>
            </div>
          </div>
        </div>
      )}
    </>
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
          <h3 style={styles.popularTitle}>인기 케이스</h3>
          <span style={styles.popularBadge}>TOP 5</span>
        </div>

        {caseLoading && <p style={styles.popularMessage}>인기 케이스를 불러오는 중...</p>}
        {caseError && <p style={styles.popularMessage}>{caseError}</p>}
        {!caseLoading && !caseError && cases.length === 0 && (
          <p style={styles.popularMessage}>아직 충분한 조회 데이터가 없습니다.</p>
        )}

        {!caseLoading && !caseError && cases.length > 0 && (
          <div style={styles.popularCompactList}>
            {cases.map((item, index) => (
              <button
                key={item.case_idx || item.id}
                style={styles.popularCompactItem}
                onMouseEnter={e => e.currentTarget.style.border = "1px solid #E86F00"}
                onMouseLeave={e => e.currentTarget.style.border = "1px solid #f0f0f0"}
                onClick={() => onCaseClick(item)}
                title={item.title}
              >
                <span style={styles.popularCompactRank}>{index + 1}</span>
                <span style={styles.popularCompactBody}>
                  <span style={styles.popularCompactMeta}>{item.industry || "산업 미분류"}</span>
                  <span style={styles.popularCompactTitle}>{item.title}</span>
                  <span style={styles.popularCompactCompany}>{item.company}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={styles.popularRankDivider} />

      <div style={styles.popularRankColumn}>
        <div style={styles.popularColumnHeader}>
          <h3 style={styles.popularTitle}>인기 키워드</h3>
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
                onMouseEnter={e => e.currentTarget.style.borderBottom = "1px solid #E86F00"}
                onMouseLeave={e => e.currentTarget.style.borderBottom = "1px solid #f0f0f0"}
                onClick={() => onQueryClick(item.keyword_group || item.display_keyword)}
                title="검색창에 입력하기"
              >
                <span style={styles.popularCompactRank}>{index + 1}</span>
                <span style={styles.popularKeywordText}>
                  {item.keyword_group || item.display_keyword}
                </span>
                {/* <span style={styles.popularKeywordCount}>{item.search_count || 0}</span> */}
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
          <h3 style={styles.popularTitle}>인기 케이스</h3>
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
          아직 충분한 조회 데이터가 없어 케이스를 클릭하면 순위가 쌓입니다.
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
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>AI 문제 구조화</h2>
          <button style={{ background: "none", border: "none", fontSize: 24, color: "#999", cursor: "pointer", lineHeight: 1 }} onClick={onClose}>✕</button>
        </div>
        <p style={styles.problemSummary}>{result.problem_summary}</p>
        <hr style={styles.divider} />
        <TagSection label="문제 유형" tags={result.problem_types || []} color="type" />
        <TagSection label="핵심 KPI" tags={result.kpis || []} color="kpi" />
        <TagSection label="예상 원인" tags={result.causes || []} color="cause" />
        <button style={{ ...styles.btnSearch, width: "100%", marginTop: 24 }} onClick={onClose}>확인</button>
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

function CaseItem({ item, isSelected, isViewing, isBookmarked, onClick, onToggleBookmark, onRemove, onAdd }) {
  const toggleBookmark = (e) => {
    e.stopPropagation();
    onToggleBookmark?.();
  };

  return (
    <div
      style={{ ...styles.caseItem, border: isViewing ? "2px solid #E86F00" : "1px solid transparent", borderBottom: isViewing ? "2px solid #E86F00" : "1px solid #f0f0f0", background: isViewing ? "linear-gradient(135deg, #fff 60%, #FEF0E9 100%)" : "#fff" }}
      onClick={onClick}
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
      <button style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }} onClick={toggleBookmark}>
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
        >
          {isSelected ? "제거" : "추가"}
        </button>
      )}
    </div>
  );
}

function CasePanel({ caseData, selectedCases, isSelected, isBookmarked, onToggleSelect, onToggleBookmark, onClose }) {
  const [linkHover, setLinkHover] = useState(false); 
  const [addHover, setAddHover] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    if (!caseData) return;
    const now = new Date();
    const viewedAt = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newItem = { ...caseData, viewedAt };
    const prev = JSON.parse(localStorage.getItem("caseHistory") || "[]");
    const filtered = prev.filter((h) => h.title !== caseData.title);
    localStorage.setItem("caseHistory", JSON.stringify([newItem, ...filtered].slice(0, 30)));
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
      <button
        style={{ 
          width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, 
          color: "#fff", background: isSelected ? "#1a1a1a" : selectedCases.length >= 3 && !isSelected ? "#ccc" : addHover ? "#C45E00" : "#E86F00", 
          border: "none", borderRadius: 2, cursor: isSelected || selectedCases.length < 3 ? "pointer" : "not-allowed", 
          fontFamily: "inherit", transition: "all 0.2s", marginBottom: 14
        }}
        onClick={onToggleSelect}
        onMouseEnter={() => setAddHover(true)}
        onMouseLeave={() => setAddHover(false)}
        disabled={!isSelected && selectedCases.length >= 3}
      >
        {isSelected ? "비교에서 제거" : "＋ 비교에 추가"}
      </button>
      
      <div style={{ flex: 1 }}>
        {caseData.reco_reason && (
          <div style={styles.reasonBox}>
            <p style={styles.reasonTitle}>[ AI 추천 이유 ]</p>
            <p style={styles.reasonItem}>→ {caseData.reco_reason}</p>
          </div>
        )}

        <div style={styles.reasonBox}>
          <div style={styles.summaryPreviewHeader}>
            <div>
              <p style={styles.reasonTitle}>[ 상세 요약 및 전략 ]</p>
              <p style={styles.summaryPreviewText}>
                긴 요약문은 별도 창에서 더 편하게 확인할 수 있어요.
              </p>
            </div>

            <button
              style={styles.summaryOpenBtn}
              onClick={() => setShowSummaryModal(true)}
            >
              요약문 바로보기
            </button>
          </div>
        </div>

        {caseData.prob_def && (
          <div style={styles.reasonBoxWhite}>
            <p style={styles.reasonTitleDark}>문제 정의</p>
            <p style={styles.reasonItem}>{caseData.prob_def}</p>
          </div>
        )}

        {caseData.sol_detail && (
          <div style={styles.reasonBoxWhite}>
            <p style={styles.reasonTitleDark}>해결 전략</p>
            <p style={styles.reasonItem}>{caseData.sol_detail}</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
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

function CompareSidebar({ cases, onClose }) {
  const [summaryCase, setSummaryCase] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    industry: true,
    probMain: true,
    solType: true,
    date: true,
    probDef: true,
    solDetail: true,
    recoReason: true,
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
          <p style={styles.compareReasonTitle}>[ AI 추천 이유 ]</p>
          <p style={styles.compareReasonText}>→ {getCaseReason(c)}</p>
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
            <p class="reason-title">[ AI 추천 이유 ]</p>
            <p class="reason-text">→ ${escapeHtml(getCaseReason(c))}</p>
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
            .reason-text {
              margin: 0;
              color: #444;
              line-height: 1.75;
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
    </>
  );
}


const styles = {
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
  compareReasonBox: { background: "#FEF0E9", border: "1px solid #F7D8C6", borderRadius: 8, padding: "12px 13px" },
  compareReasonTitle: { fontSize: 12, fontWeight: 900, color: "#E86F00", margin: "0 0 6px" },
  compareReasonText: { fontSize: 13, color: "#555", lineHeight: 1.7, margin: 0, wordBreak: "keep-all" },
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
  popularSideCol: { position: "sticky", top: 96, minWidth: 0 },
  popularRankBoard: { background: "#fff", border: "1px solid #ede8e2", borderRadius: 12, padding: "16px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)", display: "grid", gridTemplateColumns: "1.05fr 1px 0.95fr", gap: 14, minHeight: 520 },
  popularRankColumn: { minWidth: 0, display: "flex", flexDirection: "column", height: "100%" },
  popularRankDivider: { width: 1, background: "#f0f0f0", alignSelf: "stretch" },
  popularColumnHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 },
  popularCompactList: { display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "space-between" },
  popularCompactItem: { width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 8px", background: "#fff", border: "1px solid #f0f0f0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" },
  popularCompactRank: { fontSize: 14, fontWeight: 800, color: "#E86F00", flexShrink: 0, minWidth: 14, lineHeight: 1.4 },
  popularCompactBody: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 },
  popularCompactMeta: { fontSize: 12, color: "#E86F00", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularCompactTitle: { fontSize: 13.5, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  popularCompactCompany: { fontSize: 12, color: "#999", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularKeywordItem: { width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "10px 8px", background: "#fff", border: "none", borderBottom: "1px solid #f0f0f0", borderRadius: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" },
  popularKeywordText: { flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  popularKeywordCount: { minWidth: 22, height: 20, padding: "0 6px", borderRadius: 999, background: "#FEF0E9", color: "#E86F00", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  page: { width: "100%", margin: "0 auto", padding: 0, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", boxSizing: "border-box" },
  splitRow: { display: "flex", gap: 16, alignItems: "flex-start", width: "min(1600px, calc(100vw - 96px))", margin: "0 auto", padding: "0 0 2rem", boxSizing: "border-box" },
  caseListCol: { width: 420, flexShrink: 0, borderRight: "1px solid #e0e0e0", paddingRight: 16 },
  mapCol: { flex: 1, minWidth: 0 },
  logoArea: { marginBottom: "2.5rem" },
  logoTitle: { fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: "#1a1a1a" },
  
  filterWrapper: { marginBottom: "1.5rem", background: "#fff", border: "1px solid #ede8e2", borderRadius: 2, padding: "20px 24px", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" },
  filterSection: { marginBottom: 16, paddingBottom: 16, borderBottom: "1px dashed #f0f0f0" },
  filterLabel: { fontSize: 16, fontWeight: 600, color: "#666", marginBottom: 10 },
  chipGroup: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "7px 18px", fontSize: 15, fontWeight: 500, color: "#666", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActive: { padding: "7px 18px", fontSize: 15, fontWeight: 600, color: "#fff", background: "#E86F00", border: "1px solid #E86F00", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(232, 111, 0, 0.2)" },
  chipNone: { padding: "7px 18px", fontSize: 15, fontWeight: 500, color: "#888", background: "#f9f9f9", border: "1px dashed #d0d0d0", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" },
  chipActiveNone: { padding: "7px 18px", fontSize: 15, fontWeight: 600, color: "#fff", background: "#666", border: "1px solid #666", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)" },

  textarea: { width: "100%", minHeight: 100, padding: "14px 16px", fontSize: 16, fontFamily: "inherit", color: "#1a1a1a", background: "#f5f5f5", borderRadius: 2, lineHeight: 1.6, outline: "none", boxSizing: "border-box", resize: "none", maxHeight: 180 },
  btnRow: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12, marginBottom: "0.8rem" },
  btnClear: { padding: "8px 16px", fontSize: 15, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" },
  btnSearch: { padding: "8px 20px", fontSize: 15, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, fontFamily: "inherit" },
  exampleArea: { marginBottom: "1.5rem" },
  chipsLabel: { fontSize: 13, color: "#999", marginBottom: 6, textAlign: "center" },
  exampleChip: { padding: "4px 10px", fontSize: 13, color: "#E86F00", background: "#fef0e9", border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  loadingRow: { display: "flex", alignItems: "center", gap: 8, padding: "1rem 0" },
  loadingText: { fontSize: 14, color: "#999" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#E86F00", animation: "pulse 1.2s ease-in-out infinite" },
  errorText: { fontSize: 14, color: "#A32D2D", padding: "0.5rem 0" },
  inputPanel: { background: "#f5f5f5", border: "1px solid #e0e0e0", overflow: "hidden", boxSizing: "border-box" },
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
    background: "#fef0e9",
    border: "1px solid #fff",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 12,
  },

  recommendStatusTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#E86F00",
    marginBottom: 4,
  },

  recommendStatusMessage: {
    fontSize: 13,
    color: "#555",
    lineHeight: 1.5,
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
  btnBrowseAll: { width: "100%", padding: "14px", fontSize: 16, fontWeight: 600, color: "#1a1a1a", background: "#F2F2F2", border: "1px solid #ddd", borderRadius: 2, cursor: "pointer", transition: "all 0.2s" },
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
  reasonBox: { background: "#FEF0E9", borderRadius: 4, padding: "14px", marginBottom: 14 },
  reasonBoxWhite: { background: "#fff", border: "1px solid #eee", borderRadius: 4, padding: "14px", marginBottom: 14 },
  reasonTitle: { fontSize: 13, fontWeight: 700, color: "#E86F00", marginBottom: 6 },
  reasonTitleDark: { fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 6 },
  reasonItem: { fontSize: 14, color: "#555", lineHeight: 1.6, margin: 0 },
  panelLink: { width: "100%", padding: "12px", fontSize: 14, fontWeight: 600, color: "#E86F00", background: "#fff", border: "1px solid #E86F00", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" },

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
  bottomBarBtnOutline: { padding: "8px 16px", fontSize: 13, color: "#fff", background: "transparent", border: "1px solid #666", borderRadius: 2, cursor: "pointer" },
  bottomBarBtnFill: { padding: "8px 16px", fontSize: 13, color: "#1a1a1a", background: "#fff", border: "none", borderRadius: 2, cursor: "pointer" },

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
  borderRadius: 8,
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
  borderRadius: 8,
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
};

