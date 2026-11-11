function setFollowDevice(on) {
  followDevice = Boolean(on);
  document.documentElement.classList.toggle("follow-device", followDevice);
  if (followToggle) {
    followToggle.checked = followDevice;
  }
  if (followDevice) {
    smoothedDeviceTilt = null;
  }
}

const FOLLOW_LERP = 0.1;
const FOLLOW_SENSITIVITY = 0.4;

function deviceTiltFromOrientation(event) {
  const gamma = event.gamma;
  const beta = event.beta;
  if (gamma === null && beta === null) {
    return null;
  }
  const orient = window.orientation;
  let tilt = gamma === null ? 0 : gamma;
  if (orient === 90 || orient === -90) {
    tilt = (beta === null ? 0 : beta) * (orient === 90 ? 1 : -1);
  }
  return clampTilt(tilt * FOLLOW_SENSITIVITY);
}

function onDeviceOrientation(event) {
  if (stillShot) {
    return;
  }
  const next = deviceTiltFromOrientation(event);
  if (next === null) {
    return;
  }
  targetDeviceTilt = next;
}

function tickDeviceFollow() {
  followRaf = window.requestAnimationFrame(tickDeviceFollow);
  if (!followDevice || targetDeviceTilt === null || stillShot) {
    return;
  }
  if (smoothedDeviceTilt === null) {
    smoothedDeviceTilt = getDefaultTilt();
  }
  smoothedDeviceTilt += (targetDeviceTilt - smoothedDeviceTilt) * FOLLOW_LERP;
  applyBannerTilt(smoothedDeviceTilt, false, true);
}

function startOrientationListen() {
  if (orientationListening || stillShot) {
    return;
  }
  orientationListening = true;
  window.addEventListener("deviceorientation", onDeviceOrientation, true);
  if (followRaf === null) {
    followRaf = window.requestAnimationFrame(tickDeviceFollow);
  }
}

function ensureOrientationPermission() {
  const Orientation = window.DeviceOrientationEvent;
  if (!Orientation) {
    return;
  }
  // iOS 13+ needs a tap + requestPermission. Older iOS has no such API.
  if (typeof Orientation.requestPermission === "function") {
    Orientation.requestPermission()
      .then((state) => {
        if (state === "granted") {
          startOrientationListen();
        }
      })
      .catch(() => {});
    return;
  }
  startOrientationListen();
}

if (moreDetails) {
  moreDetails.addEventListener("pointerdown", ensureOrientationPermission);
}
setFollowDevice(true);
startOrientationListen();

colorChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const presetId = chip.dataset.preset;
    if (!presetId || !Object.prototype.hasOwnProperty.call(COLOR_PRESETS, presetId)) {
      return;
    }
    const preset = COLOR_PRESETS[presetId];
    applyBannerColor(preset.fill, preset.hex, presetId, true);
  });
});

if (colorInput) {
  colorInput.addEventListener("input", () => {
    const hex = colorInput.value;
    applyBannerColor(fillFromHex(hex), hex, "custom", true);
  });
}

if (tiltSlider) {
  tiltSlider.addEventListener("input", () => {
    setFollowDevice(false);
    applyBannerTilt(tiltSlider.value, true, false);
  });
}

if (followToggle) {
  followToggle.addEventListener("change", () => {
    setFollowDevice(followToggle.checked);
    if (followDevice) {
      ensureOrientationPermission();
    }
  });
}

if (daySelect) {
  daySelect.addEventListener("change", () => {
    const chosen = daySelect.value;
    if (chosen === "auto") {
      applyDayPreset(DAY_KEYS[new Date().getDay()]);
      return;
    }
    applyDayPreset(chosen);
  });
}

if (params.get("panel") === "1") {
  setPickerOpen(true);
  const tiltParam = params.get("tilt");
  if (tiltParam !== null && tiltParam !== "") {
    applyBannerTilt(tiltParam, false);
  }
}

let showingWord = true;
let timeTicker = null;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatClock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fadeTo(nextText, timeMode) {
  bannerText.style.opacity = "0";
  window.setTimeout(() => {
    bannerText.textContent = nextText;
    bannerText.classList.toggle("time-mode", timeMode);
    bannerText.style.opacity = "1";
  }, FADE_MS);
}

function startLiveClock() {
  stopLiveClock();
  timeTicker = window.setInterval(() => {
    bannerText.textContent = formatClock(new Date());
  }, 1000);
}

function stopLiveClock() {
  if (timeTicker !== null) {
    window.clearInterval(timeTicker);
    timeTicker = null;
  }
}

function updateCountdown() {
  const remaining = Math.max(0, expiryAt - Date.now());
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  countdownEl.textContent = `${days}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;
}

if (stillShot) {
  document.documentElement.classList.add("still");
}

if (freezeMode === "time") {
  showingWord = false;
  bannerText.textContent = formatClock(new Date());
  bannerText.classList.add("time-mode");
  startLiveClock();
} else if (freezeMode === "house" || freezeMode === "word") {
  showingWord = true;
  bannerText.textContent = secretWord;
  bannerText.classList.remove("time-mode");
} else {
  window.setInterval(() => {
    showingWord = !showingWord;
    if (showingWord) {
      stopLiveClock();
      fadeTo(secretWord, false);
      return;
    }
    fadeTo(formatClock(new Date()), true);
    window.setTimeout(startLiveClock, FADE_MS);
  }, SWAP_MS);
}

updateCountdown();
window.setInterval(updateCountdown, 1000);
