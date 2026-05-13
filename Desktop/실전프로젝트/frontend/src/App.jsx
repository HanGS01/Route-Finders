import { useState } from "react";
import LandingPage from './components/LandingPage'
import AboutPage from './components/AboutPage'
import SearchPage from './components/SearchPage'
import CaseMap from './components/CaseMap'

function App() {
  const [page, setPage] = useState("landing");
  const [searchedCases, setSearchedCases] = useState([]);

  return (
    <div>
      {/* 헤더 */}
      <header style={{
        display: "flex", alignItems: "center",
        padding: "0 32px 0 490px", height: 56, borderBottom: "1px solid #e8e8e8",
        background: "#fff", position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>

        <div
          style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}
          onClick={() => setPage("landing")}
        >
          <span style={{ fontSize: 38, fontWeight: 900, color: "#1a1a1a", letterSpacing: "-3px", fontFamily: "Georgia, 'Times New Roman',serif"}}>DBR</span>
          <div style={{ width: 1, height: 28, background: "#e0e0e0" }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#e85a18" }}>Case Atlas</p>
          </div>
        </div>
      </header>

      {page === "landing" && (
        <LandingPage onStart={() => setPage("search")} onAbout={() => setPage("about")} />
      )}
      {page === "about" && (
        <AboutPage onStart={() => setPage("search")} />
      )}
      {page === "search" && (
        <>
          <SearchPage onSearch={(cases) => setSearchedCases(cases)} />
          <CaseMap cases={searchedCases.length > 0 ? searchedCases : undefined} />
        </>
      )}
    </div>
  );
}

export default App