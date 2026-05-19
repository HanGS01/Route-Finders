const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// t_case 전체 조회
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        case_idx,
        chapter_title,
        title,
        summary,
        src_url,
        issue_no,
        pub_year,
        comp_name,
        comp_size,
        industry,
        prob_main,
        prob_keyword,
        prob_def,
        sol_type,
        sol_detail,
        perf_type,
        perf_dir,
        x,
        y,
        created_at
      FROM t_case
      ORDER BY case_idx ASC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("t_case 조회 실패:", error);

    res.status(500).json({
      success: false,
      message: "t_case 조회 실패",
      error: error.message,
    });
  }
});

module.exports = router;