import { GoogleGenerativeAI } from "@google/generative-ai";
import { EVENT_RESPONSE_SCHEMA, buildEventExtractionPrompt } from "../prompts/eventExtraction";

export interface ExtractedEvent {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  allDay: boolean;
  confidence: "high" | "medium" | "low";
}

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

function assertSupportedMediaType(mimeType: string): asserts mimeType is SupportedMediaType {
  if (!(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mimeType)) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${mimeType}`);
  }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function extractEventFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedEvent> {
  assertSupportedMediaType(mimeType);

  const model = getClient().getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EVENT_RESPONSE_SCHEMA,
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const result = await model.generateContent([
    { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
    { text: buildEventExtractionPrompt(today) },
  ]);

  const text = result.response.text();
  try {
    return JSON.parse(text) as ExtractedEvent;
  } catch {
    throw new Error("Gemini가 일정 정보를 추출하지 못했습니다.");
  }
}
