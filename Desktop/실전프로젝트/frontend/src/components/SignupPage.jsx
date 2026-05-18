import { useState } from "react";

export default function SignupPage({ onLogin, onSuccess }) {
  const [focused, setFocused] = useState(null);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>회원가입</h2>

        <input
          style={{ ...styles.input, border: focused === "name" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="text"
          placeholder="이름"
          onFocus={() => setFocused("name")}
          onBlur={() => setFocused(null)}
        />
        <input
          style={{ ...styles.input, border: focused === "email" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="email"
          placeholder="이메일"
          onFocus={() => setFocused("email")}
          onBlur={() => setFocused(null)}
        />
        <input
          style={{ ...styles.input, border: focused === "pw" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="password"
          placeholder="비밀번호"
          onFocus={() => setFocused("pw")}
          onBlur={() => setFocused(null)}
        />
        <input
          style={{ ...styles.input, border: focused === "pw2" ? "1.5px solid #1a1a1a" : "1.5px solid transparent" }}
          type="password"
          placeholder="비밀번호 확인"
          onFocus={() => setFocused("pw2")}
          onBlur={() => setFocused(null)}
        />

        <button style={styles.submitBtn} onClick={onSuccess}>가입하기</button>

        <div style={styles.divider}>
          <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
          <span>또는</span>
          <div style={{ flex: 1, height: 1, background: "#e8e8e8" }} />
        </div>

        <button style={{ ...styles.socialBtn, background: "#1877F2", border: "none", color: "#fff" }}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" width={18} height={18} alt="facebook" />
          Facebook으로 가입하기
        </button>
        <button style={{ ...styles.socialBtn, background: "#FEE500", border: "none", color: "#1a1a1a" }}>
          <span style={{ fontWeight: 700 }}>K</span> 카카오로 가입하기
        </button>
        <button style={{ ...styles.socialBtn, background: "#03C75A", border: "none", color: "#fff" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>N</span> 네이버로 가입하기
        </button>

        <p style={styles.footer}>
          이미 계정이 있으신가요?{" "}
          <span style={styles.link} onClick={onLogin}>로그인</span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "calc(100vh - 72px)", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
  card: { padding: "2.5rem 2rem", width: 400, boxSizing: "border-box" },
  title: { fontSize: 25, fontWeight: 700, color: "#1a1a1a", marginBottom: 25, textAlign: "center" },
  socialBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px", fontSize: 14, border: "1px solid #e0e0e0", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", background: "#fff", marginBottom: 10 },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "16px 0", color: "#ccc", fontSize: 13 },
  input: { width: "100%", padding: "11px 14px", fontSize: 14, borderRadius: 2, marginBottom: 10, boxSizing: "border-box", fontFamily: "inherit", outline: "none", background: "#EAF4FB", color: "#1a1a1a" },
  submitBtn: { width: "100%", padding: "12px", fontSize: 15, fontWeight: 500, color: "#fff", background: "#E86F00", border: "none", borderRadius: 2, cursor: "pointer", fontFamily: "inherit", marginTop: 4 },
  footer: { fontSize: 13, fontWeight: 600, color: "#999", textAlign: "center", marginTop: 20 },
  link: { color: "#E86F00", cursor: "pointer", fontWeight: 600 },
};
