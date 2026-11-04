function readStoredColor() {
  if (stillShot) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(COLOR_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fill !== "string" || typeof parsed.hex !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

applyBannerColor(theme.fill, DAY_HEX[activeDay], "day", false);

const TILT_STORAGE_KEY = "ticket-ui-banner-tilt";
const tiltSlider = document.getElementById("banner-tilt");
const tiltValue = document.getElementById("tilt-value");
const daySelect = document.getElementById("banner-day");
let currentDay = activeDay;

function getDefaultTilt() {
  return DAY_TILT[currentDay];
}

function clampTilt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return getDefaultTilt();
  }
  return Math.max(-45, Math.min(45, Math.round(n)));
}

function applyBannerTilt(deg, persist, fromFollow) {
  const tilt = clampTilt(deg);
  if (bannerWrap) {
    bannerWrap.style.setProperty("--banner-tilt", `${tilt}deg`);
  }
  if (!fromFollow) {
    if (tiltSlider) {
      tiltSlider.value = String(tilt);
      tiltSlider.setAttribute("aria-valuenow", String(tilt));
    }
    if (tiltValue) {
      tiltValue.textContent = `${tilt}°`;
    }
  } else if (pickerOpen && tiltValue) {
    tiltValue.textContent = `${tilt}°`;
    if (tiltSlider) {
      tiltSlider.value = String(tilt);
      tiltSlider.setAttribute("aria-valuenow", String(tilt));
    }
  }
  if (persist && !stillShot && !fromFollow) {
    try {
      window.localStorage.setItem(TILT_STORAGE_KEY, String(tilt));
    } catch {
      // Safari private mode can block storage; tilt still applies in-page.
    }
  }
}

function readStoredTilt() {
  if (stillShot) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(TILT_STORAGE_KEY);
    if (raw === null || raw === "") {
      return null;
    }
    return clampTilt(raw);
  } catch {
    return null;
  }
}

function syncTiltControls(deg) {
  if (tiltSlider) {
    tiltSlider.value = String(deg);
    tiltSlider.setAttribute("aria-valuenow", String(deg));
  }
  if (tiltValue) {
    tiltValue.textContent = `${deg}°`;
  }
}

syncTiltControls(getDefaultTilt());

function applyDayPreset(dayKey) {
  if (!Object.prototype.hasOwnProperty.call(WEEKDAYS, dayKey)) {
    return;
  }
  currentDay = dayKey;
  document.documentElement.dataset.day = dayKey;
  COLOR_PRESETS.day = { fill: WEEKDAYS[dayKey].fill, hex: DAY_HEX[dayKey] };
  if (dayChip) {
    dayChip.style.background = WEEKDAYS[dayKey].fill;
  }
  applyBannerColor(WEEKDAYS[dayKey].fill, DAY_HEX[dayKey], "day", false);
  applyBannerTilt(DAY_TILT[dayKey], false);
}

const secretPanel = document.querySelector(".secret-panel");
const moreDetails = document.querySelector(".more-details");
let pickerOpen = false;
let tapCount = 0;
let tapResetTimer = null;
let longPressTimer = null;
let longPressFired = false;
let restoredFromStorage = false;

const rawDayParam = (params.get("day") || "").trim().toLowerCase();
const usingAutoDay = rawDayParam === "" || rawDayParam === "auto";
if (daySelect) {
  daySelect.value = usingAutoDay ? "auto" : activeDay;
}

function setPickerOpen(open) {
  pickerOpen = open;
  if (!secretPanel) {
    return;
  }
  secretPanel.classList.toggle("is-open", pickerOpen);
  secretPanel.hidden = !pickerOpen;
  secretPanel.setAttribute("aria-hidden", pickerOpen ? "false" : "true");
  if (pickerOpen && !restoredFromStorage) {
    restoredFromStorage = true;
    const storedColor = readStoredColor();
    if (storedColor) {
      applyBannerColor(storedColor.fill, storedColor.hex, storedColor.presetId || "custom", false);
    }
    const storedTilt = readStoredTilt();
    if (storedTilt !== null) {
      applyBannerTilt(storedTilt, false);
    } else {
      syncTiltControls(getDefaultTilt());
    }
  }
}

function togglePicker() {
  setPickerOpen(!pickerOpen);
}

function registerTap() {
  tapCount += 1;
  if (tapResetTimer !== null) {
    window.clearTimeout(tapResetTimer);
  }
  tapResetTimer = window.setTimeout(() => {
    tapCount = 0;
    tapResetTimer = null;
  }, 1800);
  if (tapCount >= 5) {
    tapCount = 0;
    if (tapResetTimer !== null) {
      window.clearTimeout(tapResetTimer);
      tapResetTimer = null;
    }
    togglePicker();
  }
}

if (moreDetails) {
  moreDetails.addEventListener("pointerdown", () => {
    longPressFired = false;
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
    }
    longPressTimer = window.setTimeout(() => {
      longPressFired = true;
      tapCount = 0;
      togglePicker();
    }, 1000);
  });
  moreDetails.addEventListener("pointerup", () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (!longPressFired) {
      registerTap();
    }
  });
  moreDetails.addEventListener("pointercancel", () => {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
  moreDetails.addEventListener("click", (event) => {
    event.preventDefault();
  });
}

const followToggle = document.getElementById("follow-device");
let followDevice = true;
let orientationListening = false;
let targetDeviceTilt = null;
let smoothedDeviceTilt = null;
let followRaf = null;
