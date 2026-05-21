const express = require("express");
const cors = require("cors");

const casesRouter = require("./routes/cases");

const { router: authRouter } = require("./routes/auth");

const logsRouter = require("./routes/logs");
const popularRouter = require("./routes/popular");

const bookmarksRouter = require("./routes/bookmarks");

require("dotenv").config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());

app.use("/api/cases", casesRouter);

app.use("/api/auth", authRouter);

app.use("/api/logs", logsRouter);
app.use("/api/popular", popularRouter);

app.use("/api/bookmarks", bookmarksRouter);

app.get("/", (req, res) => {
  res.send("Backend server is running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});