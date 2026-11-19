const DEFAULT_HOLDER_NAME = "Default Name";
const LEGACY_DEFAULT_HOLDER_NAME = "Guzman Macho";
const NAME_STORAGE_KEY = "ticket-ui-holder-name";
const DEVICE_ID_KEY = "ticket-ui-device-id";
const NAME_SAVE_URL = "https://bgouomixhexlpqninhgj.supabase.co/functions/v1/ticket-holders";
const NAME_SAVE_DEBOUNCE_MS = 700;
const BAN_CHECK_MS = 20000;
const JUNK_HOLDER_NAMES = {
  name: true,
  "your name": true,
  "enter name": true,
  "full name": true,
  "ticket holder": true,
  holder: true,
  unnamed: true,
  unknown: true,
  anonymous: true,
  "n/a": true,
  na: true,
  test: true,
  placeholder: true,
  "default name": true,
  "guzman macho": true,
};
const nameEl = document.querySelector(".user-name");
const nameInput = document.getElementById("ticket-name");
let nameSaveTimer = 0;
let ticketBanned = false;
let banCheckTimer = 0;

function isLegacyDefaultHolderName(value) {
  return (
    String(value || "").replace(/\s+/g, " ").trim().toLowerCase() ===
    LEGACY_DEFAULT_HOLDER_NAME.toLowerCase()
  );
}

function normalizeHolderName(value) {
  const trimmed = String(value || "").replace(/\s+/g, " ").trim();
  if (!trimmed || isLegacyDefaultHolderName(trimmed)) {
    return DEFAULT_HOLDER_NAME;
  }
  return trimmed;
}

function isJunkHolderName(value) {
  const trimmed = String(value || "").replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return true;
  }
  return Object.prototype.hasOwnProperty.call(JUNK_HOLDER_NAMES, trimmed.toLowerCase());
}

function readStoredName() {
  if (stillShot) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(NAME_STORAGE_KEY);
    if (raw === null || raw === "" || isLegacyDefaultHolderName(raw)) {
      return null;
    }
    return normalizeHolderName(raw);
  } catch {
    return null;
  }
}

function getDeviceId() {
  try {
    let id = window.localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        window.crypto && typeof window.crypto.randomUUID === "function"
          ? window.crypto.randomUUID()
          : "d-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function setTicketBanned(banned) {
  ticketBanned = Boolean(banned);
  document.documentElement.classList.toggle("ticket-banned", ticketBanned);
  if (ticketBanned) {
    window.clearTimeout(nameSaveTimer);
  }
}

function postHolderName(value) {
  if (stillShot || ticketBanned) {
    return;
  }
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 48);
  if (isJunkHolderName(name)) {
    return;
  }
  const deviceId = getDeviceId();
  if (!deviceId) {
    return;
  }
  try {
    fetch(NAME_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        deviceId: deviceId,
        userAgent: String(navigator.userAgent || "").slice(0, 180),
      }),
      keepalive: true,
    })
      .then((response) => {
        if (response.status === 403) {
          setTicketBanned(true);
        }
      })
      .catch(() => {});
  } catch {
    // Ignore network failures; localStorage still holds the name on this phone.
  }
}

async function checkTicketBan() {
  if (stillShot) {
    return;
  }
  const deviceId = getDeviceId();
  if (!deviceId) {
    return;
  }
  try {
    const response = await fetch(NAME_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", deviceId: deviceId }),
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setTicketBanned(Boolean(data && data.banned));
  } catch {
    // Keep the last known state if the check fails.
  }
}

function scheduleHolderNameSave(value) {
  window.clearTimeout(nameSaveTimer);
  nameSaveTimer = window.setTimeout(() => {
    postHolderName(value);
  }, NAME_SAVE_DEBOUNCE_MS);
}

function applyHolderName(value, persist) {
  const name = normalizeHolderName(value);
  if (nameEl) {
    nameEl.textContent = name;
    nameEl.setAttribute("title", name);
  }
  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = name;
  }
  if (persist && !stillShot) {
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, name);
    } catch {
      // Safari private mode can block storage; name still applies in-page.
    }
  }
}

const storedHolderName = readStoredName();
applyHolderName(storedHolderName || DEFAULT_HOLDER_NAME, !storedHolderName);
checkTicketBan().then(() => {
  if (storedHolderName) {
    postHolderName(storedHolderName);
  }
});
window.clearInterval(banCheckTimer);
banCheckTimer = window.setInterval(checkTicketBan, BAN_CHECK_MS);

if (nameInput) {
  nameInput.addEventListener("input", () => {
    applyHolderName(nameInput.value, true);
    scheduleHolderNameSave(nameInput.value);
  });
  nameInput.addEventListener("change", () => {
    applyHolderName(nameInput.value, true);
    nameInput.value = normalizeHolderName(nameInput.value);
    postHolderName(nameInput.value);
  });
}
