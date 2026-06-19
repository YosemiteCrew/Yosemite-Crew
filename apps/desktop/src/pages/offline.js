(function () {
  const params = new URLSearchParams(location.search);
  const reason = params.get("reason");
  if (reason) document.getElementById("detail").textContent = reason;

  let retried = false;
  const retry = function () {
    if (retried) return;
    retried = true;
    if (globalThis.ycDesktop) globalThis.ycDesktop.reload();
  };
  document.getElementById("retry").addEventListener("click", retry);
  document.getElementById("browser").addEventListener("click", function () {
    if (globalThis.ycDesktop) globalThis.ycDesktop.openInBrowser();
  });

  // Reconnect immediately when the network comes back.
  globalThis.addEventListener("online", retry);

  let secs = 20;
  const secsEl = document.getElementById("secs");
  const timer = setInterval(function () {
    secs -= 1;
    if (secs <= 0) {
      clearInterval(timer);
      retry();
      return;
    }
    secsEl.textContent = String(secs);
  }, 1000);
})();
