/**
 * Page performance : choix relais (liste tactile), chrono 12 s, graphique, couleurs par poste A–D.
 */
(function () {
  const S = window.EPSStorage;
  const C = window.EPSCore;

  const DURATION_MS = 12000;

  /** Une couleur distincte par binôme ordonné (A→B ≠ B→A) sur le graphique. */
  const BINOME_LINE_COLORS = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#db2777",
    "#ca8a04",
    "#7c3aed",
    "#0891b2",
    "#ea580c",
    "#4f46e5",
    "#0d9488",
    "#be185d",
    "#9333ea",
  ];

  const el = {
    alertRoot: document.getElementById("alert-root"),
    classSelect: document.getElementById("class-select"),
    groupSelect: document.getElementById("group-select"),
    relayList: document.getElementById("relay-config-list"),
    relayValue: document.getElementById("relay-value"),
    chronoDisplay: document.getElementById("chrono-display"),
    btnStartChrono: document.getElementById("btn-start-chrono"),
    chronoDistanceBlock: document.getElementById("chrono-distance-block"),
    chronoDistance: document.getElementById("chrono-distance"),
    btnSaveChrono: document.getElementById("btn-save-chrono"),
    directDistance: document.getElementById("direct-distance"),
    btnSaveDirect: document.getElementById("btn-save-direct"),
    historyList: document.getElementById("history-list"),
    relayChoiceStats: document.getElementById("relay-choice-stats"),
  };

  let state = S.ensureSeed();
  let chartInstance = null;
  let chronoRaf = null;
  let chronoStart = 0;
  let chronoRunning = false;

  function showAlert(type, message) {
    el.alertRoot.innerHTML = "";
    if (!message) return;
    const div = document.createElement("div");
    div.className = "alert alert--" + type;
    div.textContent = message;
    el.alertRoot.appendChild(div);
    if (type === "success") {
      setTimeout(function () {
        if (div.parentNode) div.remove();
      }, 4000);
    }
  }

  function persist() {
    if (!S.save(state)) {
      showAlert("error", "Sauvegarde impossible (stockage local).");
      return false;
    }
    return true;
  }

  function getSelectedClass() {
    return C.findClass(state, el.classSelect.value);
  }

  function getSelectedGroup() {
    const cls = getSelectedClass();
    return C.findGroup(cls, el.groupSelect.value);
  }

  function rebuildRelayLegend(grp) {
    const legend = document.getElementById("relay-legend");
    if (!legend) return;
    legend.innerHTML = "";
    if (!grp || grp.students.length === 0) {
      legend.style.display = "none";
      return;
    }
    legend.style.display = "flex";
    const letters = ["A", "B", "C", "D"];
    grp.students.forEach(function (s, i) {
      const item = document.createElement("span");
      item.className = "relay-legend__item";
      const chip = document.createElement("span");
      chip.className = "relay-legend__chip";
      chip.style.background = C.getSlotColor(i);
      chip.title = "Poste " + letters[i];
      const lab = document.createElement("span");
      lab.innerHTML =
        "<strong>" +
        letters[i] +
        "</strong> · " +
        C.escapeHtml(s.prenom) +
        " " +
        C.escapeHtml(s.nom);
      item.appendChild(chip);
      item.appendChild(lab);
      legend.appendChild(item);
    });
  }

  function refreshClassSelect() {
    const prev = el.classSelect.value;
    el.classSelect.innerHTML = "";
    state.classes.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      el.classSelect.appendChild(opt);
    });
    if (state.classes.length === 0) {
      el.classSelect.disabled = true;
      return;
    }
    el.classSelect.disabled = false;
    if (prev && state.classes.some(function (x) { return x.id === prev; })) {
      el.classSelect.value = prev;
    }
  }

  function refreshGroupSelect() {
    const cls = getSelectedClass();
    const prev = el.groupSelect.value;
    el.groupSelect.innerHTML = "";
    if (!cls) return;
    cls.groups.forEach(function (g, idx) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = "Groupe " + (idx + 1) + " (" + g.students.length + " él.)";
      el.groupSelect.appendChild(opt);
    });
    if (prev && cls.groups.some(function (g) { return g.id === prev; })) {
      el.groupSelect.value = prev;
    }
  }

  function appendColoredName(container, grp, student) {
    const span = document.createElement("span");
    span.style.color = C.getStudentColorInGroup(grp, student.id);
    span.style.fontWeight = "700";
    span.textContent = student.prenom + " " + student.nom;
    container.appendChild(span);
  }

  function setRelaySelection(value) {
    el.relayValue.value = value || "";
    if (!el.relayList) return;
    el.relayList.querySelectorAll(".relay-pick-list__btn").forEach(function (btn) {
      const v = btn.getAttribute("data-value");
      const sel = v === el.relayValue.value;
      btn.classList.toggle("is-selected", sel);
      btn.setAttribute("aria-selected", sel ? "true" : "false");
    });
  }

  function rebuildRelayConfig() {
    const grp = getSelectedGroup();
    const prev = el.relayValue.value;
    let prevKey = prev;
    if (prev && prev.indexOf("|") >= 0) {
      const segs = prev.split("|");
      if (segs.length >= 2) prevKey = segs[0] + "|" + segs[1];
    }
    if (!el.relayList) return;
    el.relayList.innerHTML = "";
    if (!grp || grp.students.length < 2) {
      el.relayList.innerHTML = '<p class="text-muted" style="margin:0">— Au moins 2 élèves requis —</p>';
      el.relayValue.value = "";
      rebuildRelayLegend(null);
      updateTarget();
      return;
    }
    rebuildRelayLegend(grp);
    const choices = C.enumerateRelayChoices(grp.students);
    choices.forEach(function (c) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "relay-pick-list__btn";
      btn.setAttribute("data-value", c.value);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");

      const a = C.findStudent(grp, c.id1);
      const b = C.findStudent(grp, c.id2);
      if (!a || !b) return;

      appendColoredName(btn, grp, a);
      btn.appendChild(document.createTextNode(" → "));
      appendColoredName(btn, grp, b);

      btn.addEventListener("click", function () {
        setRelaySelection(c.value);
        updateTarget();
        renderHistory();
      });
      el.relayList.appendChild(btn);
    });

    let found = false;
    if (prevKey) {
      el.relayList.querySelectorAll(".relay-pick-list__btn").forEach(function (btn) {
        if (btn.getAttribute("data-value") === prevKey) {
          setRelaySelection(prevKey);
          found = true;
        }
      });
    }
    if (!found && choices.length) {
      setRelaySelection(choices[0].value);
    }
    updateTarget();
  }

  function getRelayChoice() {
    const grp = getSelectedGroup();
    if (!grp || grp.students.length < 2) return null;
    const parsed = C.parseRelayChoiceValue(el.relayValue.value);
    if (!parsed) return null;
    const s1 = C.findStudent(grp, parsed.relayeur1Id);
    const s2 = C.findStudent(grp, parsed.relayeur2Id);
    if (!s1 || !s2 || s1.id === s2.id) return null;
    return { s1: s1, s2: s2, startMode: parsed.startMode };
  }

  function updateTarget() {
    updateRelayChoiceStats();
  }

  function fillRelayLine(container, cls, perf) {
    container.textContent = "";
    const grp = C.findGroup(cls, perf.groupId);
    const a = C.findStudent(grp, perf.relayeur1Id);
    const b = C.findStudent(grp, perf.relayeur2Id);
    if (!a || !b) {
      container.textContent = "?";
      return;
    }
    appendColoredName(container, grp, a);
    container.appendChild(document.createTextNode(" → "));
    appendColoredName(container, grp, b);
    if (perf.startMode === "2-arrete-1-lance") {
      const note = document.createElement("span");
      note.className = "text-muted";
      note.style.fontSize = "0.85rem";
      note.textContent = " (ancien format)";
      container.appendChild(note);
    }
  }

  function shortPerfLabel(p, index) {
    try {
      const d = new Date(p.dateISO);
      if (!Number.isNaN(d.getTime())) {
        return (
          "#" +
          (index + 1) +
          " " +
          d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
          " " +
          d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        );
      }
    } catch (_) {}
    return "Essai " + (index + 1);
  }

  function updateRelayChoiceStats() {
    const box = el.relayChoiceStats;
    if (!box) return;
    const cls = getSelectedClass();
    const grp = getSelectedGroup();
    const choice = getRelayChoice();
    if (!cls || !grp || !choice) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    const target = C.computeRelayTarget(choice.s1, choice.s2, choice.startMode);
    const all = C.performancesForGroup(state, cls.id, grp.id);
    const matching = all.filter(function (p) {
      return p.relayeur1Id === choice.s1.id && p.relayeur2Id === choice.s2.id;
    });
    box.hidden = false;
    if (matching.length === 0) {
      box.innerHTML =
        '<div class="relay-choice-stats__grid">' +
        '<span>Meilleure réalisée : <strong>—</strong></span>' +
        "<span>Cible : <strong>" +
        C.round1(target) +
        "</strong></span>" +
        '<span>Écart : <strong>—</strong></span>' +
        "</div>";
      return;
    }
    const best = matching.reduce(function (acc, p) {
      return p.distance > acc.distance ? p : acc;
    }, matching[0]);
    const gap = C.round1(best.distance - target);
    const gapTxt = (gap >= 0 ? "+" : "") + gap;
    box.innerHTML =
      '<div class="relay-choice-stats__grid">' +
      "<span>Meilleure réalisée : <strong>" +
      C.round1(best.distance) +
      "</strong></span>" +
      "<span>Cible : <strong>" +
      C.round1(target) +
      "</strong></span>" +
      "<span>Écart : <strong>" +
      gapTxt +
      "</strong></span>" +
      "</div>";
  }

  function renderHistory() {
    const cls = getSelectedClass();
    const grp = getSelectedGroup();
    el.historyList.innerHTML = "";
    if (!cls || !grp) {
      el.historyList.innerHTML = '<li class="text-muted">Aucune donnée.</li>';
      updateChart([]);
      updateRelayChoiceStats();
      return;
    }
    const list = C.performancesForGroup(state, cls.id, grp.id).sort(function (a, b) {
      return new Date(a.dateISO) - new Date(b.dateISO);
    });
    if (list.length === 0) {
      el.historyList.innerHTML = '<li class="text-muted">Aucune performance pour ce groupe.</li>';
      updateChart([]);
      updateRelayChoiceStats();
      return;
    }
    list.forEach(function (p) {
      const li = document.createElement("li");
      const head = document.createElement("strong");
      head.textContent = C.formatDateFr(p.dateISO);
      li.appendChild(head);
      li.appendChild(document.createTextNode(" — "));
      const relaySpan = document.createElement("span");
      fillRelayLine(relaySpan, cls, p);
      li.appendChild(relaySpan);
      const gapTxt = (p.gap >= 0 ? "+" : "") + C.round1(p.gap);
      const br = document.createElement("br");
      li.appendChild(br);
      li.appendChild(
        document.createTextNode(
          "Distance : " + C.round1(p.distance) + " · Cible : " + C.round1(p.target) + " · Écart : " + gapTxt
        )
      );
      el.historyList.appendChild(li);
    });
    updateChart(list);
    updateRelayChoiceStats();
  }

  function updateChart(perfList) {
    const canvas = document.getElementById("chart-perf");
    if (!canvas || typeof Chart === "undefined") return;

    const grp = getSelectedGroup();
    if (!grp || grp.students.length < 2) {
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      return;
    }

    const pairs = C.enumerateOrderedPairs(grp.students);
    const labels = perfList.map(function (p, i) {
      return shortPerfLabel(p, i);
    });

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (perfList.length === 0) {
      return;
    }

    const datasets = pairs.map(function (pair, idx) {
      const lineColor = BINOME_LINE_COLORS[idx % BINOME_LINE_COLORS.length];
      return {
        label: pair.a.prenom + " → " + pair.b.prenom,
        data: perfList.map(function (p) {
          if (p.relayeur1Id === pair.a.id && p.relayeur2Id === pair.b.id) {
            return p.distance;
          }
          return null;
        }),
        borderColor: lineColor,
        pointBackgroundColor: lineColor,
        backgroundColor: "transparent",
        tension: 0.25,
        spanGaps: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 2,
      };
    });

    chartInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 11 } },
          },
        },
        scales: {
          y: { beginAtZero: false },
          x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
        },
      },
    });
  }

  function playBeep() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
      setTimeout(function () {
        ctx.close();
      }, 400);
    } catch (e) {
      console.warn("Bip audio indisponible", e);
    }
  }

  function stopChronoVisual(finished) {
    chronoRunning = false;
    if (chronoRaf) {
      cancelAnimationFrame(chronoRaf);
      chronoRaf = null;
    }
    el.btnStartChrono.disabled = false;
    if (finished) {
      el.chronoDisplay.textContent = "12,00 s";
      playBeep();
      el.chronoDistanceBlock.style.display = "block";
      el.chronoDistance.value = "";
      el.chronoDistance.focus();
    }
  }

  function chronoFrame() {
    if (!chronoRunning) return;
    const elapsed = Math.min(DURATION_MS, Date.now() - chronoStart);
    const sec = elapsed / 1000;
    el.chronoDisplay.textContent = sec.toFixed(2).replace(".", ",") + " s";
    if (elapsed >= DURATION_MS) {
      stopChronoVisual(true);
      return;
    }
    chronoRaf = requestAnimationFrame(chronoFrame);
  }

  function startChrono() {
    if (chronoRunning) return;
    el.chronoDistanceBlock.style.display = "none";
    chronoRunning = true;
    el.btnStartChrono.disabled = true;
    chronoStart = Date.now();
    el.chronoDisplay.textContent = "0,00 s";
    chronoRaf = requestAnimationFrame(chronoFrame);
  }

  function recordPerformance(distanceRaw) {
    const cls = getSelectedClass();
    const grp = getSelectedGroup();
    const choice = getRelayChoice();
    if (!cls || !grp || !choice) {
      showAlert("error", "Choisissez une combinaison relais dans la liste.");
      return false;
    }
    const d = parseFloat(String(distanceRaw).replace(",", "."));
    if (Number.isNaN(d) || d < 0) {
      showAlert("error", "Indiquez une distance valide (nombre positif).");
      return false;
    }
    const target = C.computeRelayTarget(choice.s1, choice.s2, choice.startMode);
    const gap = d - target;
    const rec = {
      id: S.uid(),
      classId: cls.id,
      groupId: grp.id,
      relayeur1Id: choice.s1.id,
      relayeur2Id: choice.s2.id,
      startMode: choice.startMode,
      target: target,
      distance: d,
      gap: gap,
      dateISO: new Date().toISOString(),
    };
    state.performances.push(rec);
    if (!persist()) return false;
    showAlert("success", "Performance enregistrée.");
    renderHistory();
    return true;
  }

  el.classSelect.addEventListener("change", function () {
    refreshGroupSelect();
    rebuildRelayConfig();
    updateTarget();
    renderHistory();
  });

  el.groupSelect.addEventListener("change", function () {
    rebuildRelayConfig();
    updateTarget();
    renderHistory();
  });

  el.btnStartChrono.addEventListener("click", function () {
    showAlert("", "");
    if (!getRelayChoice()) {
      showAlert("error", "Sélectionnez un relais dans la liste.");
      return;
    }
    startChrono();
  });

  el.btnSaveChrono.addEventListener("click", function () {
    showAlert("", "");
    recordPerformance(el.chronoDistance.value);
  });

  el.btnSaveDirect.addEventListener("click", function () {
    showAlert("", "");
    recordPerformance(el.directDistance.value);
    if (el.directDistance.value) el.directDistance.value = "";
  });

  function applyQueryParams() {
    try {
      const q = new URLSearchParams(window.location.search).get("class");
      if (q && state.classes.some(function (c) { return c.id === q; })) {
        el.classSelect.value = q;
      }
    } catch (_) {}
  }

  refreshClassSelect();
  applyQueryParams();
  refreshGroupSelect();
  rebuildRelayConfig();
  updateTarget();
  renderHistory();

  window.addEventListener("load", function () {
    renderHistory();
  });
})();
