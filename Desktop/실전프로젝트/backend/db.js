const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

pool.connect()
  .then((client) => {
    console.log('PostgreSQL 연결 성공');
    client.release();
  })
  .catch((error) => {
    console.error('PostgreSQL 연결 실패:', error.message);
  });

module.exports = pool;