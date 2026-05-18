import { useState } from "react";
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import LandingPage from './components/LandingPage'
import AboutPage from './components/AboutPage'
import SearchPage from './components/SearchPage'
import BookmarkPage from './components/BookmarkPage'


function App() {
  const [page, setPage] = useState("landing");
  const [searchedCases, setSearchedCases] = useState([]);

  return (
    <div>
      <header style={{
        display: "flex", alignItems: "center",
        padding: "0 32px 0 490px", height: 72, borderBottom: "1px solid #e8e8e8",
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
            style={{ background: "#fff", border: "1px solid #e0e0e0", cursor: "pointer", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", width: 36, height: 36 }}
            onClick={() => setPage("bookmark")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            style={{ padding: "8px 16px", fontSize: 14, color: "#666", background: "transparent", border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit" }}
            onClick={() => setPage("login")}
          >로그인</button>
          <button
            style={{ padding: "8px 16px", fontSize: 14, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}
            onClick={() => setPage("signup")}
          >회원가입</button>
        </div>
      </header>

      {page === "login" && <LoginPage onSignup={() => setPage("signup")} onSuccess={() => setPage("search")} />}
      {page === "signup" && <SignupPage onLogin={() => setPage("login")} onSuccess={() => setPage("search")} />}
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

export default App;