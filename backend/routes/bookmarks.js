const express = require("express");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "dbr_case_atlas_secret_key";

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "로그인이 필요합니다.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.member = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "유효하지 않은 로그인 정보입니다.",
    });
  }
}

/**
 * 내 북마크 목록 조회
 * GET /api/bookmarks
 */
router.get("/", authRequired, async (req, res) => {
  try {
    const memberIdx = req.member.member_idx;

    const result = await pool.query(
      `
      SELECT
        b.bookmark_idx,
        b.member_idx,
        b.case_idx,
        b.created_at AS bookmarked_at,

        c.chapter_title,
        c.title,
        c.summary,
        c.src_url,
        c.issue_no,
        c.pub_year,
        c.comp_name,
        c.comp_size,
        c.industry,
        c.prob_main,
        c.prob_keyword,
        c.prob_def,
        c.sol_type,
        c.sol_detail,
        c.perf_type,
        c.perf_dir,
        c.x,
        c.y
      FROM t_case_bookmark b
      JOIN t_case c
        ON c.case_idx = b.case_idx
      WHERE b.member_idx = $1
      ORDER BY b.created_at DESC;
      `,
      [memberIdx]
    );

    return res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("북마크 목록 조회 오류:", error);

    return res.status(500).json({
      success: false,
      message: "북마크 목록 조회 중 서버 오류가 발생했습니다.",
    });
  }
});

/**
 * 북마크 추가
 * POST /api/bookmarks/:caseIdx
 */
router.post("/:caseIdx", authRequired, async (req, res) => {
  try {
    const memberIdx = req.member.member_idx;
    const caseIdx = Number(req.params.caseIdx);

    if (!caseIdx) {
      return res.status(400).json({
        success: false,
        message: "caseIdx가 올바르지 않습니다.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO t_case_bookmark (
        member_idx,
        case_idx
      )
      VALUES ($1, $2)
      ON CONFLICT (member_idx, case_idx)
      DO NOTHING
      RETURNING bookmark_idx, member_idx, case_idx, created_at;
      `,
      [memberIdx, caseIdx]
    );

    return res.status(201).json({
      success: true,
      message:
        result.rows.length > 0
          ? "북마크가 저장되었습니다."
          : "이미 저장된 북마크입니다.",
      data: result.rows[0] || null,
    });
  } catch (error) {
    console.error("북마크 추가 오류:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });

    return res.status(500).json({
      success: false,
      message: "북마크 추가 중 서버 오류가 발생했습니다.",
    });
  }
});

/**
 * 북마크 삭제
 * DELETE /api/bookmarks/:caseIdx
 */
router.delete("/:caseIdx", authRequired, async (req, res) => {
  try {
    const memberIdx = req.member.member_idx;
    const caseIdx = Number(req.params.caseIdx);

    if (!caseIdx) {
      return res.status(400).json({
        success: false,
        message: "caseIdx가 올바르지 않습니다.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM t_case_bookmark
      WHERE member_idx = $1
        AND case_idx = $2
      RETURNING bookmark_idx, member_idx, case_idx;
      `,
      [memberIdx, caseIdx]
    );

    return res.json({
      success: true,
      message:
        result.rows.length > 0
          ? "북마크가 삭제되었습니다."
          : "삭제할 북마크가 없습니다.",
    });
  } catch (error) {
    console.error("북마크 삭제 오류:", error);

    return res.status(500).json({
      success: false,
      message: "북마크 삭제 중 서버 오류가 발생했습니다.",
    });
  }
});

/**
 * 특정 케이스 북마크 여부 확인
 * GET /api/bookmarks/check/:caseIdx
 */
router.get("/check/:caseIdx", authRequired, async (req, res) => {
  try {
    const memberIdx = req.member.member_idx;
    const caseIdx = Number(req.params.caseIdx);

    if (!caseIdx) {
      return res.status(400).json({
        success: false,
        message: "caseIdx가 올바르지 않습니다.",
      });
    }

    const result = await pool.query(
      `
      SELECT bookmark_idx
      FROM t_case_bookmark
      WHERE member_idx = $1
        AND case_idx = $2;
      `,
      [memberIdx, caseIdx]
    );

    return res.json({
      success: true,
      bookmarked: result.rows.length > 0,
    });
  } catch (error) {
    console.error("북마크 여부 확인 오류:", error);

    return res.status(500).json({
      success: false,
      message: "북마크 여부 확인 중 서버 오류가 발생했습니다.",
    });
  }
});

module.exports = router;