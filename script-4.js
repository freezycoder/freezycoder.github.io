const DEFAULT_HOLDER_NAME = "Default Name";
const LEGACY_DEFAULT_HOLDER_NAME = "Guzman Macho";
const NAME_STORAGE_KEY = "ticket-ui-holder-name";
const DEVICE_ID_KEY = "ticket-ui-device-id";
const DEVICE_IDB_NAME = "ticket-ui";
const DEVICE_IDB_STORE = "device";
const DEVICE_COOKIE_MAX_AGE = 34560000;
const NAME_SAVE_URL = "https://bgouomixhexlpqninhgj.supabase.co/functions/v1/ticket-holders";
const NAME_SAVE_DEBOUNCE_MS = 700;
const BAN_CHECK_MS = 20000;
const BAN_CHECK_BANNED_MS = 2500;
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
let cachedDeviceId = "";

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

function isValidDeviceId(value) {
  return /^[A-Za-z0-9._:-]{8,80}$/.test(String(value || ""));
}

function mintDeviceId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "d-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readLocalStorageDeviceId() {
  try {
    const id = window.localStorage.getItem(DEVICE_ID_KEY);
    return isValidDeviceId(id) ? id : "";
  } catch {
    return "";
  }
}

function writeLocalStorageDeviceId(id) {
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    // Private mode can block storage.
  }
}

function readCookieDeviceId() {
  try {
    const parts = String(document.cookie || "").split(";");
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i].trim();
      if (part.indexOf(DEVICE_ID_KEY + "=") === 0) {
        const id = decodeURIComponent(part.slice(DEVICE_ID_KEY.length + 1));
        return isValidDeviceId(id) ? id : "";
      }
    }
  } catch {
    // Ignore cookie access failures.
  }
  return "";
}

function writeCookieDeviceId(id) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      DEVICE_ID_KEY +
      "=" +
      encodeURIComponent(id) +
      "; Max-Age=" +
      DEVICE_COOKIE_MAX_AGE +
      "; Path=/; SameSite=Lax" +
      secure;
  } catch {
    // Ignore cookie write failures.
  }
}

function openDeviceIdb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("no indexedDB"));
      return;
    }
    const request = window.indexedDB.open(DEVICE_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEVICE_IDB_STORE)) {
        db.createObjectStore(DEVICE_IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("idb open failed"));
  });
}

async function readIdbDeviceId() {
  try {
    const db = await openDeviceIdb();
    try {
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(DEVICE_IDB_STORE, "readonly");
        const store = tx.objectStore(DEVICE_IDB_STORE);
        const request = store.get(DEVICE_ID_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("idb get failed"));
      });
      return isValidDeviceId(value) ? value : "";
    } finally {
      db.close();
    }
  } catch {
    return "";
  }
}

async function writeIdbDeviceId(id) {
  try {
    const db = await openDeviceIdb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DEVICE_IDB_STORE, "readwrite");
        const store = tx.objectStore(DEVICE_IDB_STORE);
        const request = store.put(id, DEVICE_ID_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("idb put failed"));
      });
    } finally {
      db.close();
    }
  } catch {
    // IndexedDB can fail in private mode.
  }
}

function persistDeviceId(id) {
  if (!isValidDeviceId(id)) {
    return;
  }
  cachedDeviceId = id;
  writeLocalStorageDeviceId(id);
  writeCookieDeviceId(id);
  writeIdbDeviceId(id);
}

async function readAllDeviceIds() {
  const ids = [];
  const add = (id) => {
    if (isValidDeviceId(id) && ids.indexOf(id) === -1) {
      ids.push(id);
    }
  };
  add(cachedDeviceId);
  add(readLocalStorageDeviceId());
  add(readCookieDeviceId());
  const fromIdb = await Promise.race([
    readIdbDeviceId(),
    new Promise((resolve) => window.setTimeout(() => resolve(""), 80)),
  ]);
  add(fromIdb);
  return ids;
}

async function getDeviceId() {
  if (isValidDeviceId(cachedDeviceId)) {
    return cachedDeviceId;
  }
  const ids = await readAllDeviceIds();
  if (ids.length) {
    cachedDeviceId = ids[0];
    return ids[0];
  }
  const id = mintDeviceId();
  persistDeviceId(id);
  return id;
}

function adoptServerDeviceId(data) {
  if (data && data.banned) {
    return;
  }
  if (data && isValidDeviceId(data.deviceId)) {
    persistDeviceId(data.deviceId);
  }
}

function statusUrl() {
  return NAME_SAVE_URL + "?cb=" + String(Date.now());
}

function storedStatusName() {
  const stored = readStoredName();
  if (!stored || isJunkHolderName(stored)) {
    return "";
  }
  return stored;
}

function setBanCheckTimer() {
  window.clearInterval(banCheckTimer);
  const ms = ticketBanned ? BAN_CHECK_BANNED_MS : BAN_CHECK_MS;
  banCheckTimer = window.setInterval(checkTicketBan, ms);
}

function syncHolderNameToList() {
  if (stillShot || ticketBanned) {
    return;
  }
  const name = storedStatusName();
  if (!name) {
    return;
  }
  postHolderName(name);
}

function setTicketBanned(banned) {
  const next = Boolean(banned);
  const wasBanned = ticketBanned;
  const changed = next !== ticketBanned;
  ticketBanned = next;
  document.documentElement.classList.toggle("ticket-banned", ticketBanned);
  if (ticketBanned) {
    window.clearTimeout(nameSaveTimer);
  }
  if (changed) {
    setBanCheckTimer();
    if (wasBanned && !ticketBanned) {
      syncHolderNameToList();
    }
  }
}

function markTicketReady() {
  document.documentElement.classList.add("ticket-ready");
}

function postHolderName(value) {
  if (stillShot || ticketBanned) {
    return;
  }
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 48);
  if (isJunkHolderName(name)) {
    return;
  }
  Promise.all([getDeviceId(), readAllDeviceIds()])
    .then(([deviceId, deviceIds]) => {
      if (!deviceId) {
        return null;
      }
      return fetch(statusUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({
          name: name,
          deviceId: deviceId,
          deviceIds: deviceIds,
          userAgent: String(navigator.userAgent || "").slice(0, 180),
        }),
        keepalive: true,
      });
    })
    .then((response) => {
      if (!response) {
        return null;
      }
      if (response.status === 403) {
        setTicketBanned(true);
      }
      return response.json().catch(() => null);
    })
    .then((data) => {
      adoptServerDeviceId(data);
    })
    .catch(() => {
      // Ignore network failures; localStorage still holds the name on this phone.
    });
}

async function checkTicketBan() {
  if (stillShot) {
    markTicketReady();
    return;
  }
  const deviceIds = await readAllDeviceIds();
  const deviceId = deviceIds[0] || (await getDeviceId());
  if (!deviceId) {
    markTicketReady();
    return;
  }
  try {
    const response = await fetch(statusUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      credentials: "include",
      body: JSON.stringify({
        action: "status",
        deviceId: deviceId,
        deviceIds: deviceIds,
        name: storedStatusName(),
      }),
    });
    if (response.ok) {
      const data = await response.json();
      adoptServerDeviceId(data);
      setTicketBanned(Boolean(data && data.banned));
      if (!ticketBanned) {
        syncHolderNameToList();
      }
    }
  } catch {
    // Keep the last known state if the check fails.
  }
  markTicketReady();
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
checkTicketBan();
setBanCheckTimer();
window.addEventListener("pageshow", () => {
  checkTicketBan();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    checkTicketBan();
  }
});

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
