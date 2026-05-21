import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function LoginPage({ onSignup, onSuccess }) {
  const [focused, setFocused] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "로그인에 실패했습니다.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("member", JSON.stringify(data.member));

      if (onSuccess) {
        onSuccess(data.member);
      }
    } catch (error) {
      console.error("로그인 실패:", error);
      setError(error.message || "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>DBR</h2>

        <input
          style={{ ...styles.input, border: focused === "email" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="email"
          placeholder="아이디"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />

        <input
          style={{ ...styles.input, border: focused === "pw" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setFocused("pw")}
          onBlur={() => setFocused(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />

        {error && <p style={styles.errorText}>{error}</p>}

        <button
          style={{
            ...styles.submitBtn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <div style={styles.divider}>
          <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
          <span>또는</span>
          <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
        </div>

        <button
            style={{ ...styles.socialBtn, background: "#1877F2", border: "none", color: "#fff" }}
            onClick={() => alert("Facebook 로그인은 준비 중입니다.")}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
              width={18}
              height={18}
              alt="facebook"
            />
            Facebook으로 시작하기
          </button>

          <button
            style={{ ...styles.socialBtn, background: "#FEE500", border: "none", color: "#1a1a1a" }}
            onClick={() => alert("카카오 로그인은 준비 중입니다.")}
          >
            <span style={{ fontWeight: 700 }}>K</span> 카카오로 시작하기
          </button>

          <button
            style={{ ...styles.socialBtn, background: "#03C75A", border: "none", color: "#fff" }}
            onClick={() => alert("네이버 로그인은 준비 중입니다.")}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>N</span> 네이버로 시작하기
          </button>

        <p style={styles.footer}>
          DBR 회원이 아니신가요?{" "}
          <span style={styles.link} onClick={onSignup}>회원가입</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "calc(100vh - 72px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
  card: { padding: "2.5rem 2rem", width: 400, boxSizing: "border-box" },
  title: { fontSize: 40, fontWeight: 700, color: "#1a1a1a", marginBottom: 25, textAlign: "center" },
  socialBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", background: "#fff", marginBottom: 10 },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "16px 0", color: "#ccc", fontSize: 13 },
  input: { width: "100%", padding: "14px 16px", fontSize: 14, borderRadius: 2, outline: "none", marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit", background: "#EAF4FB", color: "#1a1a1a" },
  submitBtn: { width: "100%", padding: "12px", fontSize: 15, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  errorText: { fontSize: 13, color: "#A32D2D", marginBottom: 10, lineHeight: 1.5 },
  footer: { fontSize: 13, fontWeight: 600, color: "#999", textAlign: "center", marginTop: 20 },
  link: { color: "#E86F00", cursor: "pointer", fontWeight: 600 },
};