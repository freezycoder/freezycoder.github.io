const DEFAULT_HOLDER_NAME = "Guzman Macho";
const NAME_STORAGE_KEY = "ticket-ui-holder-name";
const nameEl = document.querySelector(".user-name");
const nameInput = document.getElementById("ticket-name");

function normalizeHolderName(value) {
  const trimmed = String(value || "").replace(/\s+/g, " ").trim();
  return trimmed || DEFAULT_HOLDER_NAME;
}

function readStoredName() {
  if (stillShot) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(NAME_STORAGE_KEY);
    if (raw === null || raw === "") {
      return null;
    }
    return normalizeHolderName(raw);
  } catch {
    return null;
  }
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

applyHolderName(readStoredName() || DEFAULT_HOLDER_NAME, false);

if (nameInput) {
  nameInput.addEventListener("input", () => {
    applyHolderName(nameInput.value, true);
  });
  nameInput.addEventListener("change", () => {
    applyHolderName(nameInput.value, true);
    nameInput.value = normalizeHolderName(nameInput.value);
  });
}
