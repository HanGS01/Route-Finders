import { useEffect, useState } from "react";
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import AboutPage from './components/AboutPage'
import SearchPage from './components/SearchPage'
import BookmarkPage from './components/BookmarkPage'
import HistoryPage from './components/HistoryPage'
import RequestPage from './components/RequestPage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function App() {
  const [page, setPage] = useState("landing");
  const [history, setHistory] = useState([]); 

  const [searchedCases, setSearchedCases] = useState([]);
  const [member, setMember] = useState(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [signupHover, setSignupHover] = useState(false);
  const [loginHover, setLoginHover] = useState(false);

  const fetchBookmarkCount = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setBookmarkCount(0);
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

      if (!res.ok || !data.success) {
        setBookmarkCount(0);
        return;
      }

      setBookmarkCount(Array.isArray(data.data) ? data.data.length : 0);
    } catch (error) {
      console.error("북마크 개수 조회 실패:", error);
      setBookmarkCount(0);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedMember = localStorage.getItem("member");

    if (savedMember) {
      try {
        setMember(JSON.parse(savedMember));
      } catch (error) {
        localStorage.removeItem("member");
      }
    }

    if (!savedToken) {
      setBookmarkCount(0);
      return;
    }

    const checkLogin = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          localStorage.removeItem("token");
          localStorage.removeItem("member");
          setMember(null);
          setBookmarkCount(0);
          return;
        }

        localStorage.setItem("member", JSON.stringify(data.member));
        setMember(data.member);
        fetchBookmarkCount();
      } catch (error) {
        console.error("로그인 유지 확인 실패:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("member");
        setMember(null);
        setBookmarkCount(0);
      }
    };

    checkLogin();
  }, []);

  useEffect(() => {
    const updateBookmarkCount = () => {
      fetchBookmarkCount();
    };

    updateBookmarkCount();

    window.addEventListener("bookmarkUpdated", updateBookmarkCount);
    window.addEventListener("storage", updateBookmarkCount);

    return () => {
      window.removeEventListener("bookmarkUpdated", updateBookmarkCount);
      window.removeEventListener("storage", updateBookmarkCount);
    };
  }, []);

  const navigateTo = (pageName) => {
    if (page === pageName) return; 
    window.scrollTo(0, 0);
    setHistory((prev) => [...prev, page]); 
    setPage(pageName);
  };

  const goBack = () => {
    if (history.length === 0) return; 

    const newHistory = [...history];
    const prevPage = newHistory.pop(); 

    setHistory(newHistory); 
    setPage(prevPage); 
    window.scrollTo(0, 0);
  };

  const handleAuthSuccess = (loginMember) => {
    setMember(loginMember);
    fetchBookmarkCount();
    navigateTo("search");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("member");

    setMember(null);
    setBookmarkCount(0);
    setHistory([]); 
    navigateTo("landing");
  };

  const handleBookmarkPageClick = () => {
    if (!member) {
      alert("북마크는 로그인 후 이용할 수 있습니다.");
      navigateTo("login");
      return;
    }
    navigateTo("bookmark");
  };

  return (
    <div>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0, height: 72,
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>
        <div style={styles.headerInner}>
          <div
          style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
          onClick={() => {
            setHistory([]);
            setPage("landing");
            window.scrollTo(0, 0);
          }}
        >
          <span style={{ fontSize: 46, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-3px", fontFamily: "Georgia, 'Times New Roman',serif" }}>DBR</span>
          <div style={{ width: 1, height: 28, background: "#e0e0e0" }} />
          <div>
            <p style={{ fontSize: 20, fontWeight: 600, color: "#E86F00" }}>Case Atlas</p>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          
          {/* 1. 케이스 요청 버튼 */}
          <button
            onClick={() => navigateTo("request")}
            style={styles.iconHeaderBtn}
            title="신규 케이스 요청"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="10" y1="10" x2="14" y2="10"></line>
            </svg>
          </button>

          {/* 2. 최근 본 케이스 버튼 */}
          <button
            onClick={() => navigateTo("history")}
            style={styles.iconHeaderBtn}
            title="최근 본 케이스"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>

          {/* 3. 북마크 버튼 */}
          <button
            style={styles.iconHeaderBtn}
            onClick={handleBookmarkPageClick}
            title="북마크"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>

            {member && bookmarkCount > 0 && (
              <span style={styles.bookmarkCountBadge}>
                {bookmarkCount > 99 ? "99+" : bookmarkCount}
              </span>
            )}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
            {member ? (
              <>
                <span style={{ fontSize: 14, color: "#666", marginRight: 6 }}>
                  {member.nickname || member.email}님
                </span>
                <button
                  style={{ padding: "8px 16px", fontSize: 14, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button
                  style={{ padding: "8px 16px", fontSize: 14, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: loginHover ? "#faf7f4" : "transparent" }}
                  onMouseEnter={() => setLoginHover(true)}
                  onMouseLeave={() => setLoginHover(false)}
                  onClick={() => navigateTo("login")}
                >
                  로그인
                </button>
                <button
                  style={{ padding: "8px 16px", fontSize: 14, color: "#fff", background: "#E86F00", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, opacity: signupHover ? 0.82 : 1 }}
                  onMouseEnter={() => setSignupHover(true)}
                  onMouseLeave={() => setSignupHover(false)}
                  onClick={() => navigateTo("signup")}
                >
                  회원가입
                </button>
              </>
            )}
          </div>
        </div>
        </div>
      </header>

      {page === "login" && (
        <LoginPage
          onSignup={() => navigateTo("signup")}
          onSuccess={handleAuthSuccess}
        />
      )}

      {page === "signup" && (
        <SignupPage
          onLogin={() => navigateTo("login")}
          onSuccess={handleAuthSuccess}
        />
      )}

      {page === "landing" && (
        <LandingPage
          onStart={() => { document.body.style.overflow = ""; navigateTo("search"); }}
          onAbout={() => { document.body.style.overflow = ""; navigateTo("about"); }}
        />
      )}

      {page === "about" && (
        <AboutPage onStart={() => navigateTo("search")} />
      )}

      {page === "search" && (
        <SearchPage
          onSearch={(cases) => setSearchedCases(cases)}
          searchedCases={searchedCases}
        />
      )}

      {page === "bookmark" && <BookmarkPage onBack={goBack} />}
      {page === "history" && <HistoryPage onBack={goBack} />}
      {page === "request" && <RequestPage onBack={goBack} />}
    </div>
  );
}

const styles = {
  headerInner: {
    width: "calc(100% - 280px)",
    maxWidth: 1500,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxSizing: "border-box",
  },

  iconHeaderBtn: {
    position: "relative",
    background: "#fff",
    border: "1px solid #e0e0e0",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    width: 38,
    height: 38,
  },

  bookmarkCountBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 17,
    height: 17,
    padding: "0 5px",
    borderRadius: 999,
    background: "#E86F00",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "17px",
    boxSizing: "border-box",
    border: "2px solid #fff",
    boxShadow: "0 1px 4px rgba(232, 111, 0, 0.35)",
    zIndex: 2,
  },
};

export default App;