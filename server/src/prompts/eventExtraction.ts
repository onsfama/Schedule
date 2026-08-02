import { SchemaType, type Schema } from "@google/generative-ai";

export function buildEventExtractionPrompt(today: string): string {
  return `너는 이미지(포스터, 초대장, 스크린샷, 알림장 등)에서 캘린더 일정 정보를 추출하는 도우미다.
이미지 안의 한국어/영어 텍스트를 모두 읽고, 지정된 JSON 스키마에 맞춰 결과를 반환하라.

오늘 날짜: ${today}

규칙:
- 이미지 안에 날짜/시간이 서로 다른 별개의 일정이 여러 개 있으면(예: 이번 주 여러 행사를 안내하는 알림장), 각각을 events 배열의 별도 항목으로 담아라. 일정이 하나뿐이면 항목이 1개인 배열로 반환하라.
- 날짜는 항상 YYYY-MM-DD 형식으로 변환한다. 연도가 없으면 이미지 내용상 가장 합리적인 연도를 추정하되, 확신이 없으면 오늘과 가장 가까운 미래 날짜를 사용한다.
- 시간은 24시간제 HH:mm 형식으로 변환한다 (예: "오후 3시" -> "15:00").
- 종료 시간이 명시되어 있지 않으면 startTime으로부터 1시간 뒤로 추정하되, allDay 이벤트라면 시간 필드를 빈 문자열로 둔다.
- 이미지에 날짜/시간이 전혀 없거나 일정과 무관한 이미지라면 confidence를 "low"로 설정하고 알 수 있는 필드만 채운 항목 1개를 반환한다.
- 장소, 제목은 이미지에 적힌 표현을 최대한 그대로 사용한다.`;
}

const EVENT_ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "일정 제목" },
    date: { type: SchemaType.STRING, description: "YYYY-MM-DD 형식의 시작 날짜" },
    startTime: { type: SchemaType.STRING, description: "HH:mm 형식 시작 시간, allDay면 빈 문자열" },
    endTime: { type: SchemaType.STRING, description: "HH:mm 형식 종료 시간, allDay면 빈 문자열" },
    location: { type: SchemaType.STRING, description: "장소" },
    description: { type: SchemaType.STRING, description: "추가 설명(주최자, 준비물 등)" },
    allDay: { type: SchemaType.BOOLEAN, description: "하루 종일 일정 여부" },
    confidence: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["high", "medium", "low"],
      description: "추출 신뢰도",
    },
  },
  required: ["title", "date", "allDay", "confidence"],
};

export const EVENT_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    events: {
      type: SchemaType.ARRAY,
      description: "이미지에서 추출한 일정 목록 (1개 이상)",
      items: EVENT_ITEM_SCHEMA,
    },
  },
  required: ["events"],
};
