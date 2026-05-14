/**
 * Icônes SVG (viewBox 24×24, sans taille fixe — le CSS dimensionne).
 * Injection nav / titres / boutons sur toutes les pages.
 */
(function (global) {
  global.EPSIcons = {
    navClass:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    navPerf:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    navBilan:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16V9"/><path d="M12 16v-5"/><path d="M17 16V5"/></svg>',
    logo:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
    import:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    table:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="14" height="18" rx="2"/><path d="M3 9h14"/><path d="M9 21V9"/></svg>',
    chrono:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    chart:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16V10"/><path d="M12 16V6"/><path d="M17 16v-3"/></svg>',
    csv:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>',
    pdf:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12h4"/></svg>',
    share:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>',
    play:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
    save:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    trash:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    edit:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  };

  function injectNavIcons() {
    const I = global.EPSIcons;
    if (!I) return;
    if (document.body.getAttribute("data-nav-icons") === "1") return;
    document.body.setAttribute("data-nav-icons", "1");
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      if (a.querySelector(".nav-links__ico")) return;
      const href = a.getAttribute("href") || "";
      let icon = I.navClass;
      if (href.indexOf("performance") >= 0) icon = I.navPerf;
      else if (href.indexOf("bilan") >= 0) icon = I.navBilan;
      const span = document.createElement("span");
      span.className = "nav-links__ico";
      span.innerHTML = icon;
      const text = document.createElement("span");
      text.className = "nav-links__text";
      text.textContent = a.textContent.trim();
      a.textContent = "";
      a.appendChild(span);
      a.appendChild(text);
    });
    const title = document.querySelector(".site-title");
    if (title && I.logo && !title.querySelector(".site-title__ico")) {
      const wrap = document.createElement("span");
      wrap.className = "site-title__row";
      const ico = document.createElement("span");
      ico.className = "site-title__ico";
      ico.innerHTML = I.logo;
      ico.setAttribute("aria-hidden", "true");
      const rest = document.createElement("span");
      rest.innerHTML = title.innerHTML;
      title.innerHTML = "";
      wrap.appendChild(ico);
      wrap.appendChild(rest);
      title.appendChild(wrap);
    }
  }

  function injectSectionIcons() {
    const I = global.EPSIcons;
    if (!I) return;
    if (document.body.getAttribute("data-section-icons") === "1") return;
    document.body.setAttribute("data-section-icons", "1");
    document.querySelectorAll("[data-icon]").forEach(function (el) {
      const key = el.getAttribute("data-icon");
      if (!I[key] || el.querySelector(".section-ico")) return;
      const wrap = document.createElement("span");
      wrap.className = "section-ico";
      wrap.innerHTML = I[key];
      wrap.setAttribute("aria-hidden", "true");
      el.insertBefore(wrap, el.firstChild);
    });
    document.querySelectorAll("[data-btn-icon]").forEach(function (el) {
      const key = el.getAttribute("data-btn-icon");
      if (!I[key] || el.querySelector(".inject-ico")) return;
      const span = document.createElement("span");
      span.className = "inject-ico";
      span.setAttribute("aria-hidden", "true");
      span.innerHTML = I[key];
      el.insertBefore(span, el.firstChild);
    });
  }

  function boot() {
    injectNavIcons();
    injectSectionIcons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
