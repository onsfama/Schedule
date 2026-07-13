const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const imageInput = document.getElementById("image-input");
const dropZone = document.getElementById("drop-zone");
const dropZoneText = document.getElementById("drop-zone-text");
const preview = document.getElementById("preview");
const analyzeBtn = document.getElementById("analyze-btn");
const uploadStatus = document.getElementById("upload-status");

const formSection = document.getElementById("form-section");
const confidenceBanner = document.getElementById("confidence-banner");
const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const allDayInput = document.getElementById("all-day");
const timeFields = document.getElementById("time-fields");
const startTimeInput = document.getElementById("start-time");
const endTimeInput = document.getElementById("end-time");
const locationInput = document.getElementById("location");
const descriptionInput = document.getElementById("description");

const resetBtn = document.getElementById("reset-btn");
const registerBtn = document.getElementById("register-btn");
const registerStatus = document.getElementById("register-status");

let selectedFile = null;
let accessToken = null;
let tokenClient = null;

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = "status" + (kind ? ` ${kind}` : "");
}

function updateEmptyClass(input) {
  const mask = document.querySelector(`.field-mask[data-for="${input.id}"]`);
  if (mask) mask.classList.toggle("visible", !input.value);
}

[dateInput, startTimeInput, endTimeInput].forEach((input) => {
  input.addEventListener("input", () => updateEmptyClass(input));
  input.addEventListener("focus", () => {
    const mask = document.querySelector(`.field-mask[data-for="${input.id}"]`);
    if (mask) mask.classList.remove("visible");
  });
  input.addEventListener("blur", () => updateEmptyClass(input));
});

function resetToUpload() {
  selectedFile = null;
  imageInput.value = "";
  preview.src = "";
  preview.hidden = true;
  dropZoneText.hidden = false;
  analyzeBtn.disabled = true;
  setStatus(uploadStatus, "", null);

  titleInput.value = "";
  dateInput.value = "";
  allDayInput.checked = false;
  startTimeInput.value = "";
  endTimeInput.value = "";
  locationInput.value = "";
  descriptionInput.value = "";
  timeFields.hidden = false;
  confidenceBanner.hidden = true;
  [dateInput, startTimeInput, endTimeInput].forEach(updateEmptyClass);
  setStatus(registerStatus, "", null);

  formSection.hidden = true;
}

resetBtn.addEventListener("click", resetToUpload);

function handleFileSelected(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith("image/")) return;
  selectedFile = file;
  const url = URL.createObjectURL(file);
  preview.src = url;
  preview.hidden = false;
  dropZoneText.hidden = true;
  analyzeBtn.disabled = false;
  setStatus(uploadStatus, "", null);
}

imageInput.addEventListener("change", () => handleFileSelected(imageInput.files[0]));

dropZone.addEventListener("click", () => imageInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    imageInput.click();
  }
});

["dragover", "dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => e.preventDefault());
});
dropZone.addEventListener("dragover", () => dropZone.classList.add("dragover"));
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  dropZone.classList.remove("dragover");
  handleFileSelected(e.dataTransfer.files[0]);
});

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  analyzeBtn.disabled = true;
  setStatus(uploadStatus, "이미지를 분석하는 중...", null);

  try {
    const formData = new FormData();
    formData.append("image", selectedFile);
    const res = await fetch("/api/extract-event", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");

    titleInput.value = data.title || "";
    dateInput.value = data.date || "";
    allDayInput.checked = !!data.allDay;
    startTimeInput.value = data.startTime || "";
    endTimeInput.value = data.endTime || "";
    locationInput.value = data.location || "";
    descriptionInput.value = data.description || "";
    timeFields.hidden = allDayInput.checked;
    confidenceBanner.hidden = data.confidence !== "low";
    [dateInput, startTimeInput, endTimeInput].forEach(updateEmptyClass);

    formSection.hidden = false;
    setStatus(uploadStatus, "분석 완료", "success");
  } catch (err) {
    setStatus(uploadStatus, String(err.message || err), "error");
  } finally {
    analyzeBtn.disabled = false;
  }
});

allDayInput.addEventListener("change", () => {
  timeFields.hidden = allDayInput.checked;
});

function initGoogleClient() {
  if (!window.GOOGLE_CLIENT_ID) {
    setStatus(registerStatus, "GOOGLE_CLIENT_ID가 설정되지 않았습니다.", "error");
    registerBtn.disabled = true;
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: window.GOOGLE_CLIENT_ID,
    scope: CALENDAR_SCOPE,
    callback: (response) => {
      if (response.error) {
        setStatus(registerStatus, "로그인이 취소되었거나 실패했습니다.", "error");
        registerBtn.disabled = false;
        return;
      }
      accessToken = response.access_token;
      performRegister();
    },
  });
}

window.addEventListener("load", () => {
  const waitForGoogle = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(waitForGoogle);
      initGoogleClient();
    }
  }, 100);
});

registerBtn.addEventListener("click", () => {
  if (!titleInput.value.trim() || !dateInput.value) {
    setStatus(registerStatus, "제목과 날짜는 필수입니다.", "error");
    return;
  }

  if (accessToken) {
    performRegister();
    return;
  }

  if (!tokenClient) {
    setStatus(registerStatus, "Google 로그인 초기화 중입니다. 잠시 후 다시 시도해주세요.", "error");
    return;
  }

  registerBtn.disabled = true;
  setStatus(registerStatus, "Google 로그인 중...", null);
  tokenClient.requestAccessToken({ prompt: "consent" });
});

async function performRegister() {
  registerBtn.disabled = true;
  setStatus(registerStatus, "등록하는 중...", null);

  const event = buildGoogleCalendarEvent();

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        accessToken = null;
        setStatus(registerStatus, "로그인이 만료됐습니다. 버튼을 다시 눌러주세요.", "error");
      } else {
        throw new Error(data.error?.message || "등록에 실패했습니다.");
      }
      return;
    }
    setStatus(registerStatus, "캘린더에 등록되었습니다.", "success");
  } catch (err) {
    setStatus(registerStatus, String(err.message || err), "error");
  } finally {
    registerBtn.disabled = false;
  }
}

function buildGoogleCalendarEvent() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const base = {
    summary: titleInput.value.trim(),
    location: locationInput.value.trim(),
    description: descriptionInput.value.trim(),
  };

  if (allDayInput.checked) {
    const nextDay = new Date(dateInput.value);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      ...base,
      start: { date: dateInput.value },
      end: { date: nextDay.toISOString().slice(0, 10) },
    };
  }

  const startTime = startTimeInput.value || "09:00";
  const endTime = endTimeInput.value || startTime;
  return {
    ...base,
    start: { dateTime: `${dateInput.value}T${startTime}:00`, timeZone },
    end: { dateTime: `${dateInput.value}T${endTime}:00`, timeZone },
  };
}
