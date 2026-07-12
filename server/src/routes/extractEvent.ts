import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { extractEventFromImage } from "../services/geminiService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const extractRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
});

export const extractEventRouter = Router();

extractEventRouter.post("/extract-event", extractRateLimit, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "image 파일이 필요합니다." });
  }

  try {
    const event = await extractEventFromImage(req.file.buffer, req.file.mimetype);
    res.json(event);
  } catch (error) {
    console.error("이벤트 추출 실패:", error);
    const message = error instanceof Error ? error.message : "이벤트 추출 중 오류가 발생했습니다.";
    res.status(422).json({ error: message });
  }
});
