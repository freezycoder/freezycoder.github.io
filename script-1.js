const bannerText = document.getElementById("banner-text");
const countdownEl = document.getElementById("countdown");
const bannerEl = document.querySelector(".moving-banner");
const bannerWrap = document.querySelector(".banner-wrap");
const qrImg = document.querySelector("img.qr");

if (qrImg) {
  qrImg.addEventListener(
    "error",
    () => {
      const apply = (text) => {
        qrImg.src = `data:image/png;base64,${String(text).replace(/\s+/g, "")}`;
      };
      fetch("qr.b64")
        .then((response) => {
          if (!response.ok) {
            throw new Error("missing");
          }
          return response.text();
        })
        .then(apply)
        .catch(() => {
          Promise.all(
            ["qr-1.b64", "qr-2.b64", "qr-3.b64", "qr-4.b64"].map((path) =>
              fetch(path).then((response) => response.text()),
            ),
          )
            .then((parts) => apply(parts.join("")))
            .catch(() => {});
        });
    },
    { once: true },
  );
}
const params = new URLSearchParams(window.location.search);
const freezeMode = params.get("freeze");
const stillShot = params.get("still") === "1";

const FADE_MS = 450;
const SWAP_MS = 5000;
const expiryAt = Date.now() + (53 * 24 + 12) * 60 * 60 * 1000;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_ALIASES = {
  sunday: "sun",
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
};

const PINK_FILL = "linear-gradient(180deg, #ff4b88 0%, #f3176a 52%, #e10b5c 100%)";
const GREEN_FILL = "linear-gradient(180deg, #5ee08a 0%, #3ccf6c 48%, #22b85a 100%)";
const GREY_FILL = "linear-gradient(180deg, #c5c9cf 0%, #a8adb5 50%, #8e949c 100%)";
const BLUE_FILL = "linear-gradient(180deg, #8fd6ff 0%, #5ec4f7 48%, #3ab3ee 100%)";

const WEEKDAYS = {
  sun: { fill: PINK_FILL },
  mon: { fill: GREY_FILL },
  tue: { fill: PINK_FILL },
  wed: { fill: GREEN_FILL },
  thu: { fill: BLUE_FILL },
  fri: { fill: PINK_FILL },
  sat: { fill: PINK_FILL },
};

const DAY_TILT = {
  sun: 28,
  mon: 0,
  tue: 28,
  wed: -28,
  thu: -8,
  fri: 0,
  sat: 28,
};

const WORD_POOL = [
  "Amber", "Bloom", "Cedar", "Drift", "Ember", "Flint", "Grove", "Harbor",
  "Ivory", "Jasper", "Maple", "Noble", "Orbit", "Pulse", "Quartz", "Ridge",
  "Silk", "Tide", "Ultra", "Vivid", "Willow", "Yarn", "Brave", "Crisp",
  "Delta", "Echo", "Frost", "Gleam", "Honey", "Inlet", "Jewel", "Kite",
  "Lunar", "Mirth", "North", "Olive", "Peach", "Quest", "River", "Storm",
  "Trail", "Unity", "Valor", "Yield", "Azure", "Coral", "Dusk", "Fern",
  "Glint", "Haze", "Iris", "Lumen", "Moss", "Nexus", "Opal", "Plume",
  "Quill", "Sable", "Thorn", "Vapor", "Wisp",
];

function resolveDay() {
  const raw = (params.get("day") || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(WEEKDAYS, raw)) {
    return raw;
  }
  if (Object.prototype.hasOwnProperty.call(DAY_ALIASES, raw)) {
    return DAY_ALIASES[raw];
  }
  return DAY_KEYS[new Date().getDay()];
}

function pickWord() {
  return WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
}

const activeDay = resolveDay();
const theme = WEEKDAYS[activeDay];
const secretWord = pickWord();

document.documentElement.dataset.day = activeDay;
bannerEl.style.background = theme.fill;
bannerText.textContent = secretWord;

const COLOR_STORAGE_KEY = "ticket-ui-banner-color";
const DAY_HEX = {
  sun: "#f3176a",
  mon: "#a8adb5",
  tue: "#f3176a",
  wed: "#3ccf6c",
  thu: "#5ec4f7",
  fri: "#f3176a",
  sat: "#f3176a",
};

const COLOR_PRESETS = {
  day: { fill: theme.fill, hex: DAY_HEX[activeDay] },
  grey: { fill: GREY_FILL, hex: "#a8adb5" },
  pink: { fill: PINK_FILL, hex: "#f3176a" },
  green: { fill: GREEN_FILL, hex: "#3ccf6c" },
  blue: { fill: BLUE_FILL, hex: "#5ec4f7" },
};

const colorInput = document.getElementById("banner-color");
const colorChips = Array.from(document.querySelectorAll(".color-chip"));
const colorNative = document.querySelector(".color-native");
const dayChip = document.querySelector('.color-chip[data-preset="day"]');

if (dayChip) {
  dayChip.style.background = theme.fill;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

function fillFromHex(hex) {
  return `linear-gradient(180deg, ${mixHex(hex, 0.22)} 0%, ${hex} 52%, ${mixHex(hex, -0.18)} 100%)`;
}

function markSelected(presetId, custom) {
  colorChips.forEach((chip) => {
    chip.classList.toggle("is-selected", chip.dataset.preset === presetId);
  });
  if (colorNative) {
    colorNative.classList.toggle("is-selected", Boolean(custom));
  }
}

function applyBannerColor(fill, hex, presetId, persist) {
  bannerEl.style.background = fill;
  if (colorInput && hex) {
    colorInput.value = hex;
  }
  markSelected(presetId, presetId === "custom");
  if (persist && !stillShot) {
    try {
      window.localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify({ fill, hex, presetId }));
    } catch {
      // Safari private mode can block storage; color still applies in-page.
    }
  }
}
