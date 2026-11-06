const wordInput = document.getElementById("banner-word");

function applyBannerWord(value, persist) {
  const word = normalizeBannerWord(value);
  if (!word) {
    if (persist && !stillShot) {
      try {
        window.localStorage.removeItem(WORD_STORAGE_KEY);
      } catch {
        // Safari private mode can block storage.
      }
    }
    if (wordInput && document.activeElement !== wordInput) {
      wordInput.value = secretWord;
    }
    return;
  }
  secretWord = word;
  if (bannerText && !bannerText.classList.contains("time-mode")) {
    bannerText.textContent = secretWord;
  }
  if (wordInput && document.activeElement !== wordInput) {
    wordInput.value = word;
  }
  if (persist && !stillShot) {
    try {
      window.localStorage.setItem(WORD_STORAGE_KEY, word);
    } catch {
      // Safari private mode can block storage; word still applies in-page.
    }
  }
}

if (wordInput) {
  wordInput.value = secretWord;
  wordInput.addEventListener("input", () => {
    applyBannerWord(wordInput.value, true);
  });
  wordInput.addEventListener("change", () => {
    applyBannerWord(wordInput.value, true);
    wordInput.value = secretWord;
  });
}
