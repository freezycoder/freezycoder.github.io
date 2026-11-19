const LIST_URL = "https://bgouomixhexlpqninhgj.supabase.co/functions/v1/ticket-holders";
const TOKEN_KEY = "ticket-holders-list-token";
const REFRESH_MS = 20000;

const gateEl = document.getElementById("gate");
const listPanelEl = document.getElementById("list-panel");
const unlockForm = document.getElementById("unlock-form");
const secretInput = document.getElementById("list-secret");
const gateStatusEl = document.getElementById("gate-status");
const listStatusEl = document.getElementById("list-status");
const holdersEl = document.getElementById("holders");
const countLabelEl = document.getElementById("count-label");
const updatedLabelEl = document.getElementById("updated-label");
const refreshBtn = document.getElementById("refresh-btn");
const lockBtn = document.getElementById("lock-btn");

let refreshTimer = 0;
let inFlight = false;
let banInFlight = false;

function readStoredSecret() {
  try {
    const value = window.localStorage.getItem(TOKEN_KEY);
    return value ? value.trim() : "";
  } catch {
    return "";
  }
}

function writeStoredSecret(value) {
  try {
    window.localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // Private mode can block storage; the list still works for this visit.
  }
}

function clearStoredSecret() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore storage failures when locking.
  }
}

function setStatus(el, message, isError) {
  if (!el) {
    return;
  }
  el.textContent = message;
  el.classList.toggle("error", Boolean(isError));
}

function showGate(message, isError) {
  if (gateEl) {
    gateEl.hidden = false;
  }
  if (listPanelEl) {
    listPanelEl.hidden = true;
  }
  window.clearInterval(refreshTimer);
  refreshTimer = 0;
  setStatus(gateStatusEl, message || "", isError);
}

function showList() {
  if (gateEl) {
    gateEl.hidden = true;
  }
  if (listPanelEl) {
    listPanelEl.hidden = false;
  }
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (mins < 1) {
    relative = "just now";
  } else if (mins < 60) {
    relative = mins + " min ago";
  } else if (mins < 48 * 60) {
    const hours = Math.round(mins / 60);
    relative = hours + "h ago";
  }
  const absolute = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return relative === absolute ? relative : relative + " · " + absolute;
}

function deviceSuffix(deviceId) {
  const id = String(deviceId || "");
  if (id.length < 4) {
    return id;
  }
  return id.slice(-4);
}

function withDuplicateSuffixes(holders) {
  const counts = {};
  holders.forEach((holder) => {
    const name = String(holder && holder.name ? holder.name : "").trim() || "Unknown";
    counts[name] = (counts[name] || 0) + 1;
  });
  return holders.map((holder) => {
    const name = String(holder && holder.name ? holder.name : "").trim() || "Unknown";
    const suffix = counts[name] > 1 ? deviceSuffix(holder.device_id) : "";
    return { holder: holder, name: name, suffix: suffix };
  });
}

function isHolderBanned(holder) {
  if (!holder) {
    return false;
  }
  if (holder.banned === true) {
    return true;
  }
  return Boolean(holder.banned_at);
}

function renderHolders(holders) {
  const rows = withDuplicateSuffixes(Array.isArray(holders) ? holders : []);
  if (holdersEl) {
    holdersEl.replaceChildren();
    rows.forEach((row) => {
      const banned = isHolderBanned(row.holder);
      const item = document.createElement("li");
      item.className = banned ? "holder is-banned" : "holder";

      const top = document.createElement("div");
      top.className = "holder-top";

      const title = document.createElement("div");
      title.className = "holder-name";
      title.textContent = row.name;
      if (row.suffix) {
        const idSpan = document.createElement("span");
        idSpan.className = "holder-id";
        idSpan.textContent = " · " + row.suffix;
        title.appendChild(idSpan);
      }
      top.appendChild(title);
      if (banned) {
        const badge = document.createElement("span");
        badge.className = "ban-badge";
        badge.textContent = "Banned";
        top.appendChild(badge);
      }

      const times = document.createElement("div");
      times.className = "holder-times";
      const first = document.createElement("div");
      first.textContent = "First seen " + formatWhen(row.holder.first_seen);
      const last = document.createElement("div");
      last.textContent = "Last seen " + formatWhen(row.holder.last_seen);
      times.append(first, last);

      const actions = document.createElement("div");
      actions.className = "holder-actions";
      const banBtn = document.createElement("button");
      banBtn.type = "button";
      banBtn.setAttribute("data-device-id", String(row.holder.device_id || ""));
      if (banned) {
        banBtn.className = "unban";
        banBtn.textContent = "Unban";
      } else {
        banBtn.className = "ban";
        banBtn.textContent = "Ban";
      }
      actions.appendChild(banBtn);

      item.append(top, times, actions);
      holdersEl.appendChild(item);
    });
  }
  if (countLabelEl) {
    const n = rows.length;
    countLabelEl.textContent = n === 1 ? "1 name" : n + " names";
  }
}

async function setHolderBan(deviceId, banned) {
  const secret = readStoredSecret();
  if (!secret) {
    showGate("Paste the list token or PIN.", false);
    return;
  }
  if (banInFlight) {
    return;
  }
  const id = String(deviceId || "").trim();
  if (!id) {
    setStatus(listStatusEl, "Could not ban: missing device id.", true);
    return;
  }
  banInFlight = true;
  setStatus(listStatusEl, banned ? "Banning…" : "Unbanning…", false);
  try {
    for (let i = 0; i < 40 && inFlight; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    const response = await fetch(LIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + secret,
      },
      body: JSON.stringify({
        action: banned ? "ban" : "unban",
        deviceId: id,
      }),
    });
    if (response.status === 401) {
      const error = new Error("unauthorized");
      error.code = "unauthorized";
      throw error;
    }
    if (!response.ok) {
      throw new Error("ban failed");
    }
    for (let i = 0; i < 20 && inFlight; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    }
    await loadHolders(secret, false);
  } catch (error) {
    const unauthorized = error && error.code === "unauthorized";
    if (unauthorized) {
      clearStoredSecret();
      showGate("Wrong token or PIN.", true);
    } else {
      setStatus(listStatusEl, "Could not update ban. Try again.", true);
    }
  } finally {
    banInFlight = false;
  }
}

async function fetchHolders(secret) {
  const response = await fetch(LIST_URL, {
    headers: { Authorization: "Bearer " + secret },
  });
  if (response.status === 401) {
    const error = new Error("unauthorized");
    error.code = "unauthorized";
    throw error;
  }
  if (!response.ok) {
    throw new Error("list failed");
  }
  const data = await response.json();
  return Array.isArray(data.holders) ? data.holders : [];
}

async function loadHolders(secret, fromUnlock) {
  if (inFlight) {
    return;
  }
  inFlight = true;
  if (fromUnlock) {
    setStatus(gateStatusEl, "Unlocking…", false);
  } else {
    setStatus(listStatusEl, "Refreshing…", false);
  }
  try {
    const holders = await fetchHolders(secret);
    writeStoredSecret(secret);
    showList();
    renderHolders(holders);
    if (updatedLabelEl) {
      updatedLabelEl.textContent =
        "Updated " +
        new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    setStatus(listStatusEl, "", false);
    setStatus(gateStatusEl, "", false);
  } catch (error) {
    const unauthorized = error && error.code === "unauthorized";
    if (unauthorized) {
      clearStoredSecret();
      showGate("Wrong token or PIN.", true);
    } else if (fromUnlock) {
      setStatus(gateStatusEl, "Could not load names. Try again.", true);
    } else {
      setStatus(listStatusEl, "Refresh failed. Names below may be stale.", true);
    }
  } finally {
    inFlight = false;
  }
}

function startAutoRefresh(secret) {
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    loadHolders(secret, false);
  }, REFRESH_MS);
}

if (holdersEl) {
  holdersEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const btn = target.closest("button.ban, button.unban");
    if (!btn || !holdersEl.contains(btn)) {
      return;
    }
    const id = btn.getAttribute("data-device-id") || "";
    const shouldBan = btn.classList.contains("ban");
    setHolderBan(id, shouldBan);
  });
}

if (unlockForm) {
  unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const secret = String(secretInput && secretInput.value ? secretInput.value : "").trim();
    if (!secret) {
      setStatus(gateStatusEl, "Paste the list token or PIN.", true);
      return;
    }
    loadHolders(secret, true).then(() => {
      if (!listPanelEl || listPanelEl.hidden) {
        return;
      }
      startAutoRefresh(secret);
    });
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    const secret = readStoredSecret();
    if (!secret) {
      showGate("Paste the list token or PIN.", false);
      return;
    }
    loadHolders(secret, false);
  });
}

if (lockBtn) {
  lockBtn.addEventListener("click", () => {
    clearStoredSecret();
    if (secretInput) {
      secretInput.value = "";
    }
    showGate("PIN forgotten on this device.", false);
  });
}

const stored = readStoredSecret();
if (stored) {
  showList();
  loadHolders(stored, false).then(() => {
    if (!listPanelEl || listPanelEl.hidden) {
      return;
    }
    startAutoRefresh(stored);
  });
} else {
  showGate("", false);
}
