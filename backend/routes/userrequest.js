const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { exec } = require("child_process");
const path = require("path");

// 1. 목록 조회
router.get("/", async (req, res) => {
  const { member_idx, isAdmin } = req.query;
  const isAdm = isAdmin === 'true';

  try {
    let query;
    let params = [];

    if (isAdm) {
      query = "SELECT * FROM t_case_request ORDER BY created_at DESC";
    } else {
      query = `SELECT r.*, EXISTS(SELECT 1 FROM t_request_likes WHERE request_idx = r.request_idx AND member_idx = $1)::boolean as is_liked
               FROM t_case_request r 
               WHERE r.is_private = FALSE OR r.member_idx = $1 
               ORDER BY r.created_at DESC`;
      params = [member_idx];
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "조회 실패" });
  }
});

// 2. 등록 (AI 검사 로직 최적화)
router.post("/", async (req, res) => {
  const { topic, industry, content, is_private, member_idx } = req.body;
  const fullText = (topic + " " + content).replace(/"/g, '\\"');
  
  // 파이썬 파일 위치 지정
  const pythonScriptPath = path.join(__dirname, '../check_text.py');

  // 명령어: 'python' 대신 아나콘다 환경의 경로를 잡을 확률이 높은 방식을 사용
  exec(`python "${pythonScriptPath}" "${fullText}"`, async (error, stdout, stderr) => {
    
    // 로그를 반드시 확인하세요!
    console.log("--- AI 검사 로그 ---");
    console.log("결과(stdout):", stdout.trim());
    if (error) console.log("실행오류(error):", error.message);
    if (stderr) console.log("실행경고(stderr):", stderr);
    console.log("-------------------");

    // BAD라고 나오거나, 실행 자체가 실패했을 때 차단
    if (error || stdout.trim() === "BAD") {
      return res.status(400).json({ 
        success: false, 
        message: "부적절한 내용이 포함되어 등록할 수 없습니다." 
      });
    }

    try {
      await pool.query(
        "INSERT INTO t_case_request (topic, industry, content, is_private, member_idx) VALUES ($1, $2, $3, $4, $5)",
        [topic, industry, content, is_private, member_idx]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "DB 저장 실패" });
    }
  });
});

// 3. 삭제
router.delete("/:idx", async (req, res) => {
  const { idx } = req.params;
  const { member_idx, isAdmin } = req.body;
  try {
    const query = isAdmin 
      ? "DELETE FROM t_case_request WHERE request_idx = $1"
      : "DELETE FROM t_case_request WHERE request_idx = $1 AND member_idx = $2";
    const params = isAdmin ? [idx] : [idx, member_idx];
    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
});

// 4. 좋아요
router.post("/:idx/like", async (req, res) => {
  const { member_idx } = req.body;
  const { idx } = req.params;
  try {
    const check = await pool.query("SELECT 1 FROM t_request_likes WHERE request_idx = $1 AND member_idx = $2", [idx, member_idx]);
    if (check.rows.length > 0) {
      await pool.query("DELETE FROM t_request_likes WHERE request_idx = $1 AND member_idx = $2", [idx, member_idx]);
      await pool.query("UPDATE t_case_request SET likes = likes - 1 WHERE request_idx = $1", [idx]);
    } else {
      await pool.query("INSERT INTO t_request_likes (request_idx, member_idx) VALUES ($1, $2)", [idx, member_idx]);
      await pool.query("UPDATE t_case_request SET likes = likes + 1 WHERE request_idx = $1", [idx]);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false }); }
});

module.exports = router;