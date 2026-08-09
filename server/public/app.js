const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const imageInput = document.getElementById("image-input");
const dropZone = document.getElementById("drop-zone");
const dropZoneText = document.getElementById("drop-zone-text");
const previewList = document.getElementById("preview-list");
const analyzeBtn = document.getElementById("analyze-btn");
const uploadStatus = document.getElementById("upload-status");

const selectSection = document.getElementById("select-section");
const selectIntro = document.getElementById("select-intro");
const eventList = document.getElementById("event-list");
const selectResetBtn = document.getElementById("select-reset-btn");
const eventFormTemplate = document.getElementById("event-form-template");

let selectedFiles = [];
let accessToken = null;
let tokenClient = null;
let googleReady = false;
let pendingAfterLogin = null;

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = "status" + (kind ? ` ${kind}` : "");
}

function updateEmptyClass(input) {
  const mask = input.parentElement.querySelector(".field-mask");
  if (mask) mask.classList.toggle("visible", !input.value);
}

function wireFieldMask(input) {
  updateEmptyClass(input);
  input.addEventListener("input", () => updateEmptyClass(input));
  input.addEventListener("focus", () => {
    const mask = input.parentElement.querySelector(".field-mask");
    if (mask) mask.classList.remove("visible");
  });
  input.addEventListener("blur", () => updateEmptyClass(input));
}

function resetToUpload() {
  selectedFiles = [];
  imageInput.value = "";
  previewList.innerHTML = "";
  dropZoneText.hidden = false;
  analyzeBtn.disabled = true;
  setStatus(uploadStatus, "", null);

  eventList.innerHTML = "";
  selectSection.hidden = true;
}

selectResetBtn.addEventListener("click", resetToUpload);

function appendDiag(text) {
  setStatus(uploadStatus, `${uploadStatus.textContent} / ${text}`.replace(/^ \//, ""), null);
}

const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

function compressImage(file) {
  return new Promise((resolve) => {
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
            resolve(file);
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
      resolve(file);
    };
    img.src = objectUrl;
  });
}

async function handleFilesSelected(fileList) {
  const files = Array.from(fileList || []).filter(
    (file) => !file.type || file.type.startsWith("image/")
  );
  if (files.length === 0) {
    appendDiag("이미지 파일이 없습니다.");
    return;
  }

  setStatus(uploadStatus, `이미지 ${files.length}장 처리 중...`, null);
  const compressed = await Promise.all(files.map((file) => compressImage(file)));
  selectedFiles = compressed;

  previewList.innerHTML = "";
  compressed.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "";
    previewList.appendChild(img);
  });
  dropZoneText.hidden = true;
  analyzeBtn.disabled = false;
  analyzeBtn.textContent = `이미지 분석 (${compressed.length}장)`;
  setStatus(uploadStatus, "", null);
}

dropZone.addEventListener("click", () => {
  imageInput.click();
});
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    imageInput.click();
  }
});

imageInput.addEventListener("change", () => {
  handleFilesSelected(imageInput.files);
});

["dragover", "dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => e.preventDefault());
});
dropZone.addEventListener("dragover", () => dropZone.classList.add("dragover"));
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  dropZone.classList.remove("dragover");
  handleFilesSelected(e.dataTransfer.files);
});

analyzeBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) return;
  analyzeBtn.disabled = true;
  setStatus(uploadStatus, `이미지 ${selectedFiles.length}장 분석하는 중...`, null);

  const results = await Promise.allSettled(
    selectedFiles.map(async (file) => {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/extract-event", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");
      return Array.isArray(data) ? data : [data];
    })
  );

  const allEvents = [];
  let failureCount = 0;
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    } else {
      failureCount++;
    }
  });

  analyzeBtn.disabled = false;

  if (allEvents.length === 0) {
    setStatus(uploadStatus, "분석에 실패했습니다. 다시 시도해주세요.", "error");
    return;
  }

  renderEventAccordion(allEvents);
  setStatus(
    uploadStatus,
    failureCount > 0 ? `일부 이미지 분석 실패(${failureCount}장). 나머지는 완료.` : "분석 완료",
    failureCount > 0 ? "error" : "success"
  );
});

function formatEventMeta(event) {
  const parts = [event.date || ""];
  if (event.allDay) {
    parts.push("하루 종일");
  } else if (event.startTime) {
    parts.push(event.endTime ? `${event.startTime}~${event.endTime}` : event.startTime);
  }
  if (event.location) parts.push(event.location);
  return parts.filter(Boolean).join(" · ");
}

function renderEventAccordion(events) {
  eventList.innerHTML = "";
  selectIntro.textContent =
    events.length > 1 ? "일정을 여러 개 찾았어요. 원하는 일정을 눌러 확인/등록하세요." : "찾은 일정을 확인하고 등록하세요.";

  events.forEach((event, index) => {
    eventList.appendChild(createAccordionItem(event, index));
  });

  selectSection.hidden = false;

  if (events.length === 1) {
    const header = eventList.querySelector(".event-accordion-header");
    if (header) header.click();
  }
}

function createAccordionItem(event, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "event-accordion";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "event-accordion-header";
  header.setAttribute("aria-expanded", "false");
  header.innerHTML = `<span class="event-title"></span><span class="event-meta"></span>`;
  header.querySelector(".event-title").textContent = event.title || `일정 ${index + 1}`;
  header.querySelector(".event-meta").textContent = formatEventMeta(event);

  const body = document.createElement("div");
  body.className = "event-accordion-body";
  body.hidden = true;
  body.appendChild(eventFormTemplate.content.cloneNode(true));

  const banner = body.querySelector(".confidence-banner");
  const fTitle = body.querySelector(".f-title");
  const fDate = body.querySelector(".f-date");
  const fAllDay = body.querySelector(".f-allday");
  const fTimeFields = body.querySelector(".f-time-fields");
  const fStart = body.querySelector(".f-start");
  const fEnd = body.querySelector(".f-end");
  const fLocation = body.querySelector(".f-location");
  const fDescription = body.querySelector(".f-description");
  const fRegister = body.querySelector(".f-register");
  const fStatus = body.querySelector(".f-status");

  fTitle.value = event.title || "";
  fDate.value = event.date || "";
  fAllDay.checked = !!event.allDay;
  fStart.value = event.startTime || "";
  fEnd.value = event.endTime || "";
  fLocation.value = event.location || "";
  fDescription.value = event.description || "";
  fTimeFields.hidden = fAllDay.checked;
  banner.hidden = event.confidence !== "low";
  fRegister.disabled = !googleReady;

  [fDate, fStart, fEnd].forEach(wireFieldMask);

  fAllDay.addEventListener("change", () => {
    fTimeFields.hidden = fAllDay.checked;
  });

  function doRegister() {
    fRegister.disabled = true;
    setStatus(fStatus, "등록하는 중...", null);

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const calendarEvent = {
      summary: fTitle.value.trim(),
      location: fLocation.value.trim(),
      description: fDescription.value.trim(),
    };
    if (fAllDay.checked) {
      const nextDay = new Date(fDate.value);
      nextDay.setDate(nextDay.getDate() + 1);
      calendarEvent.start = { date: fDate.value };
      calendarEvent.end = { date: nextDay.toISOString().slice(0, 10) };
    } else {
      const startTime = fStart.value || "09:00";
      const endTime = fEnd.value || startTime;
      calendarEvent.start = { dateTime: `${fDate.value}T${startTime}:00`, timeZone };
      calendarEvent.end = { dateTime: `${fDate.value}T${endTime}:00`, timeZone };
    }

    fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(calendarEvent),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            accessToken = null;
            setStatus(fStatus, "로그인이 만료됐습니다. 버튼을 다시 눌러주세요.", "error");
          } else {
            throw new Error(data.error?.message || "등록에 실패했습니다.");
          }
          return;
        }
        setStatus(fStatus, "캘린더에 등록되었습니다.", "success");
      })
      .catch((err) => setStatus(fStatus, String(err.message || err), "error"))
      .finally(() => {
        fRegister.disabled = false;
      });
  }

  fRegister.addEventListener("click", () => {
    if (!fTitle.value.trim() || !fDate.value) {
      setStatus(fStatus, "제목과 날짜는 필수입니다.", "error");
      return;
    }

    if (accessToken) {
      doRegister();
      return;
    }

    if (!tokenClient) {
      setStatus(fStatus, "Google 로그인 초기화 중입니다. 잠시 후 다시 시도해주세요.", "error");
      return;
    }

    setStatus(fStatus, "Google 로그인 중...", null);
    document.querySelectorAll(".f-register").forEach((btn) => (btn.disabled = true));
    pendingAfterLogin = doRegister;
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  header.addEventListener("click", () => {
    const willOpen = body.hidden;
    body.hidden = !willOpen;
    header.setAttribute("aria-expanded", String(willOpen));
  });

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  return wrapper;
}

function initGoogleClient() {
  if (!window.GOOGLE_CLIENT_ID) {
    setStatus(uploadStatus, "GOOGLE_CLIENT_ID가 설정되지 않았습니다.", "error");
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: window.GOOGLE_CLIENT_ID,
    scope: CALENDAR_SCOPE,
    callback: (response) => {
      if (response.error) {
        pendingAfterLogin = null;
        document.querySelectorAll(".f-register").forEach((btn) => (btn.disabled = false));
        return;
      }
      accessToken = response.access_token;
      document.querySelectorAll(".f-register").forEach((btn) => (btn.disabled = false));
      const fn = pendingAfterLogin;
      pendingAfterLogin = null;
      if (fn) fn();
    },
  });
  googleReady = true;
  document.querySelectorAll(".f-register").forEach((btn) => (btn.disabled = false));
}

window.addEventListener("load", () => {
  const waitForGoogle = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(waitForGoogle);
      initGoogleClient();
    }
  }, 100);

  setTimeout(() => {
    if (!googleReady) {
      appendDiag("Google 로그인을 불러오는 데 시간이 걸리고 있어요. 네트워크를 확인하거나 다른 브라우저(Chrome 등)에서 열어보세요.");
    }
  }, 8000);
});
