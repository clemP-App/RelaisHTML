/**
 * Enregistrement du service worker (HTTPS ou localhost uniquement).
 */
(function () {
  if (!("serviceWorker" in navigator)) return;
  var host = location.hostname;
  var allowed =
    location.protocol === "https:" || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (!allowed) return;

  function register() {
    var swUrl = new URL("sw.js", location.href).href;
    var scope = new URL("./", location.href).href;
    navigator.serviceWorker.register(swUrl, { scope: scope }).catch(function (err) {
      console.warn("[EPS Relais] Service worker :", err);
    });
  }

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
})();
