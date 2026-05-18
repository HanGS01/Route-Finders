const express = require('express');
const pool = require('../db');

const router = express.Router();

// 케이스 목록 조회
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        case_idx,
        title,
        summary,
        industry
      FROM t_case
      ORDER BY case_idx DESC
      LIMIT 20
      `
    );

    return res.json({
      message: '케이스 목록 조회 성공',
      cases: result.rows,
    });
  } catch (error) {
    console.error('케이스 목록 조회 오류:', error);

    return res.status(500).json({
      message: '케이스 목록 조회 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

module.exports = router;