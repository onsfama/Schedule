import "dotenv/config";
import cors from "cors";
import express from "express";
import path from "path";
import { extractEventRouter } from "./routes/extractEvent";

if (!process.env.GEMINI_API_KEY) {
  console.warn("경고: GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.");
}

const app = express();
app.use(cors());
app.use("/api", extractEventRouter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.send(`window.GOOGLE_CLIENT_ID = ${JSON.stringify(process.env.GOOGLE_CLIENT_ID || "")};`);
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
