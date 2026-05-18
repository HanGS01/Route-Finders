const express = require('express');
const cors = require('cors');
const caseRoutes = require('./routes/caseRoutes');
require('dotenv').config();
require('./db');


const app = express();

app.use(cors({
  origin: process.env.FRONT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use('/api/cases', caseRoutes);

app.get('/', (req, res) => {
  res.send('DBR Case Atlas backend server is running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});