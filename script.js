(function loadTicketScripts() {
  const files = ["script-1.js", "script-2.js", "script-3.js"];
  function next(index) {
    if (index >= files.length) {
      return;
    }
    const script = document.createElement("script");
    script.src = files[index];
    script.onload = () => next(index + 1);
    document.body.appendChild(script);
  }
  next(0);
})();
