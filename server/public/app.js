const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

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

function appendDiag(text) {
  setStatus(uploadStatus, `${uploadStatus.textContent} / ${text}`.replace(/^ \//, ""), null);
}

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("압축 실패"));
            return;
          }
          const name = file.name.replace(/\.\w+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    img.src = objectUrl;
  });
}

async function handleFileSelected(file) {
  if (!file) {
    appendDiag("file 없음");
    return;
  }
  if (file.type && !file.type.startsWith("image/")) {
    appendDiag(`타입 거부됨(${file.type})`);
    return;
  }

  let fileForUpload = file;
  try {
    fileForUpload = await compressImage(file);
    appendDiag(`압축: ${(file.size / 1024).toFixed(0)}KB → ${(fileForUpload.size / 1024).toFixed(0)}KB`);
  } catch (err) {
    appendDiag(`압축 건너뜀(원본 사용): ${err}`);
  }

  selectedFile = fileForUpload;
  try {
    const url = URL.createObjectURL(fileForUpload);
    preview.src = url;
    preview.hidden = false;
    dropZoneText.hidden = true;
    analyzeBtn.disabled = false;
    appendDiag("미리보기 설정 완료");
  } catch (err) {
    appendDiag(`createObjectURL 에러: ${err}`);
  }
}

preview.addEventListener("error", () => appendDiag("이미지 로드 실패"));
preview.addEventListener("load", () => appendDiag("이미지 로드 성공"));

let changeEventCount = 0;
imageInput.addEventListener("change", () => {
  changeEventCount++;
  const files = imageInput.files;
  const file = files && files[0];
  setStatus(
    uploadStatus,
    `[진단#${changeEventCount}] 파일수:${files ? files.length : 0}` +
      (file ? ` 이름:${file.name} 타입:${file.type || "없음"} 크기:${file.size}` : ""),
    null
  );
  handleFileSelected(file);
});

let dropZoneClickCount = 0;
dropZone.addEventListener("click", () => {
  dropZoneClickCount++;
  setStatus(uploadStatus, `[진단] 드롭존 클릭 #${dropZoneClickCount}`, null);
  imageInput.click();
});
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

let googleReady = false;

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
  googleReady = true;
  registerBtn.disabled = false;
  setStatus(registerStatus, "", null);
}

setStatus(registerStatus, "Google 로그인 준비 중...", null);

window.addEventListener("load", () => {
  const waitForGoogle = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(waitForGoogle);
      initGoogleClient();
    }
  }, 100);

  setTimeout(() => {
    if (!googleReady) {
      setStatus(
        registerStatus,
        "Google 로그인을 불러오는 데 시간이 걸리고 있어요. 네트워크를 확인하거나 다른 브라우저(Chrome 등)에서 열어보세요.",
        "error"
      );
    }
  }, 8000);
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
