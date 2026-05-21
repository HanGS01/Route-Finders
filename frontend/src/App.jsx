import { useEffect, useState } from "react";
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import AboutPage from './components/AboutPage'
import SearchPage from './components/SearchPage'
import BookmarkPage from './components/BookmarkPage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function App() {
  const [page, setPage] = useState("landing");
  const [searchedCases, setSearchedCases] = useState([]);
  const [member, setMember] = useState(null);
  const [bookmarkCount, setBookmarkCount] = useState(0);

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

  const handleAuthSuccess = (loginMember) => {
    setMember(loginMember);
    fetchBookmarkCount();
    setPage("search");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("member");

    setMember(null);
    setBookmarkCount(0);
    setPage("landing");
  };

  const handleBookmarkPageClick = () => {
    if (!member) {
      alert("북마크는 로그인 후 이용할 수 있습니다.");
      setPage("login");
      return;
    }

    setPage("bookmark");
  };

  return (
    <div>
      <header style={{
        display: "flex", alignItems: "center",
        padding: "0 32px 0 240px", height: 72, borderBottom: "1px solid #e8e8e8",
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
          onClick={() => setPage("landing")}
        >
          <span style={{ fontSize: 46, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-3px", fontFamily: "Georgia, 'Times New Roman',serif" }}>DBR</span>
          <div style={{ width: 1, height: 28, background: "#e0e0e0" }} />
          <div>
            <p style={{ fontSize: 20, fontWeight: 600, color: "#E86F00" }}>Case Atlas</p>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            style={styles.bookmarkHeaderBtn}
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

          {member ? (
            <>
              <span style={{ fontSize: 14, color: "#666", marginRight: 6 }}>
                {member.nickname || member.email}님
              </span>
              <button
                style={{ padding: "8px 16px", fontSize: 14, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" }}
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <button
                style={{ padding: "8px 16px", fontSize: 14, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" }}
                onClick={() => setPage("login")}
              >
                로그인
              </button>
              <button
                style={{ padding: "8px 16px", fontSize: 14, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
                onClick={() => setPage("signup")}
              >
                회원가입
              </button>
            </>
          )}
        </div>
      </header>

      {page === "login" && (
        <LoginPage
          onSignup={() => setPage("signup")}
          onSuccess={handleAuthSuccess}
        />
      )}

      {page === "signup" && (
        <SignupPage
          onLogin={() => setPage("login")}
          onSuccess={handleAuthSuccess}
        />
      )}

      {page === "landing" && (
        <LandingPage
          onStart={() => { document.body.style.overflow = ""; setPage("search"); }}
          onAbout={() => { document.body.style.overflow = ""; setPage("about"); }}
        />
      )}

      {page === "about" && (
        <AboutPage onStart={() => setPage("search")} />
      )}

      {page === "search" && (
        <SearchPage
          onSearch={(cases) => setSearchedCases(cases)}
          searchedCases={searchedCases}
        />
      )}

      {page === "bookmark" && <BookmarkPage onBack={() => setPage("search")} />}
    </div>
  );
}

const styles = {
  bookmarkHeaderBtn: {
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