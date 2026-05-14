/**
 * Page bilan : classe → groupe (liste G1 — prénoms…) → détail d’un seul groupe, exports (toolbar).
 */
(function () {
  const S = window.EPSStorage;
  const C = window.EPSCore;

  const el = {
    alertRoot: document.getElementById("alert-root"),
    classSelect: document.getElementById("class-select"),
    bilanGroupSection: document.getElementById("bilan-group-section"),
    bilanGroupSelect: document.getElementById("bilan-group-select"),
    bilanBinomeWrap: document.getElementById("bilan-binome-wrap"),
    bilanBinomeFilter: document.getElementById("bilan-binome-filter"),
    bilanBinomeList: document.getElementById("bilan-binome-list"),
    globalSection: document.getElementById("global-chart-section"),
    groupsRoot: document.getElementById("groups-bilan-root"),
    modalRoot: document.getElementById("modal-root"),
  };

  window.EPSExportContext = window.EPSExportContext || {};
  window.EPSExportContext.getBilanClassId = function () {
    return el.classSelect && el.classSelect.value ? el.classSelect.value : "";
  };
  window.EPSExportContext.getBilanGroupId = function () {
    return el.bilanGroupSelect && el.bilanGroupSelect.value ? el.bilanGroupSelect.value : "";
  };

  let state = S.ensureSeed();
  const charts = {};

  function showAlert(type, message) {
    el.alertRoot.innerHTML = "";
    if (!message) return;
    const div = document.createElement("div");
    div.className = "alert alert--" + type;
    div.textContent = message;
    el.alertRoot.appendChild(div);
  }

  function persist() {
    if (!S.save(state)) {
      showAlert("error", "Sauvegarde impossible.");
      return false;
    }
    return true;
  }

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  function getSelectedClass() {
    return C.findClass(state, el.classSelect.value);
  }

  function groupOptionLabel(g) {
    const prenoms = g.students.map(function (s) {
      return s.prenom;
    });
    return prenoms.join(" - ");
  }

  function relayHtml(cls, perf) {
    const grp = C.findGroup(cls, perf.groupId);
    const a = C.findStudent(grp, perf.relayeur1Id);
    const b = C.findStudent(grp, perf.relayeur2Id);
    if (!a || !b) return "?";
    const ca = C.getStudentColorInGroup(grp, a.id);
    const cb = C.getStudentColorInGroup(grp, b.id);
    let h =
      '<span style="color:' +
      ca +
      ';font-weight:700">' +
      C.escapeHtml(a.prenom) +
      " " +
      C.escapeHtml(a.nom) +
      "</span> → " +
      '<span style="color:' +
      cb +
      ';font-weight:700">' +
      C.escapeHtml(b.prenom) +
      " " +
      C.escapeHtml(b.nom) +
      "</span>";
    if (perf.startMode === "2-arrete-1-lance") {
      h += ' <span class="text-muted">(ancien)</span>';
    }
    return h;
  }

  function appendColoredStudentName(container, grp, student) {
    const span = document.createElement("span");
    span.style.color = C.getStudentColorInGroup(grp, student.id);
    span.style.fontWeight = "700";
    span.textContent = student.prenom + " " + student.nom;
    container.appendChild(span);
  }

  function appendColoredBinomeButtonContent(btn, grp, s1, s2) {
    appendColoredStudentName(btn, grp, s1);
    btn.appendChild(document.createTextNode(" → "));
    appendColoredStudentName(btn, grp, s2);
  }

  function sortedPerfsForGroup(cls, groupId) {
    return C.performancesForGroup(state, cls.id, groupId).sort(function (a, b) {
      return new Date(a.dateISO) - new Date(b.dateISO);
    });
  }

  function statsFromChronoList(list) {
    if (list.length === 0) {
      return {
        list: list,
        best: null,
        last: null,
        first: null,
        progression: null,
        lastTarget: null,
        lastGap: null,
      };
    }
    const best = list.reduce(function (acc, p) {
      return p.distance > acc.distance ? p : acc;
    }, list[0]);
    const first = list[0];
    const last = list[list.length - 1];
    const progression = last.distance - first.distance;
    return {
      list: list,
      best: best,
      last: last,
      first: first,
      progression: progression,
      lastTarget: last.target,
      lastGap: last.gap,
    };
  }

  function statsForGroup(cls, groupId) {
    return statsFromChronoList(sortedPerfsForGroup(cls, groupId));
  }

  function statsForGroupWithBinomeFilter(cls, groupId, binomeKey) {
    let list = sortedPerfsForGroup(cls, groupId);
    if (binomeKey) {
      const segs = binomeKey.split("|");
      if (segs.length >= 2) {
        const id1 = segs[0];
        const id2 = segs[1];
        list = list.filter(function (p) {
          return p.relayeur1Id === id1 && p.relayeur2Id === id2;
        });
      }
    }
    return statsFromChronoList(list);
  }

  function isNearTarget(lastGap, lastTarget) {
    if (lastTarget == null || lastTarget === 0) return Math.abs(lastGap) < 1;
    return Math.abs(lastGap / lastTarget) < 0.06 || Math.abs(lastGap) < 1.5;
  }

  function isProgressing(progression, listLen) {
    return listLen >= 2 && progression > 0.5;
  }

  function openEditModal(perfId) {
    const perf = state.performances.find(function (p) {
      return p.id === perfId;
    });
    if (!perf) return;
    const cls = C.findClass(state, perf.classId);
    el.modalRoot.hidden = false;
    el.modalRoot.innerHTML = "";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "modal-title");

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML =
      '<h2 id="modal-title">Modifier la performance</h2>' +
      '<p class="text-muted" style="font-size:0.9rem" id="modal-relay-line"></p>' +
      "<p class=\"text-muted\" style=\"font-size:0.9rem\">" +
      C.formatDateFr(perf.dateISO) +
      "</p>" +
      '<label for="edit-dist">Distance réalisée</label>' +
      '<input type="number" id="edit-dist" step="0.1" min="0" />' +
      '<p class="field-hint">La cible et l’écart seront recalculés selon les relayeurs et le mode enregistré.</p>';

    modal.querySelector("#modal-relay-line").innerHTML = relayHtml(cls, perf);

    const inp = modal.querySelector("#edit-dist");
    inp.value = perf.distance;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "btn btn--secondary";
    btnCancel.textContent = "Annuler";

    const btnSave = document.createElement("button");
    btnSave.type = "button";
    btnSave.className = "btn btn--primary";
    btnSave.textContent = "Enregistrer";

    btnCancel.addEventListener("click", closeModal);
    backdrop.addEventListener("click", function (ev) {
      if (ev.target === backdrop) closeModal();
    });

    btnSave.addEventListener("click", function () {
      const grp = C.findGroup(cls, perf.groupId);
      const s1 = C.findStudent(grp, perf.relayeur1Id);
      const s2 = C.findStudent(grp, perf.relayeur2Id);
      if (!s1 || !s2) {
        showAlert("error", "Impossible de retrouver les élèves pour recalculer la cible.");
        return;
      }
      const d = parseFloat(String(inp.value).replace(",", "."));
      if (Number.isNaN(d) || d < 0) {
        showAlert("error", "Distance invalide.");
        return;
      }
      const target = C.computeRelayTarget(s1, s2, perf.startMode);
      perf.distance = d;
      perf.target = target;
      perf.gap = d - target;
      if (!persist()) return;
      closeModal();
      showAlert("success", "Performance mise à jour.");
      renderBilan();
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    modal.appendChild(actions);
    backdrop.appendChild(modal);
    el.modalRoot.appendChild(backdrop);
    inp.focus();
  }

  function closeModal() {
    el.modalRoot.hidden = true;
    el.modalRoot.innerHTML = "";
  }

  function deletePerf(perfId) {
    const perf = state.performances.find(function (p) {
      return p.id === perfId;
    });
    if (!perf) return;
    if (!window.confirm("Supprimer définitivement cette mesure ?")) return;
    state.performances = state.performances.filter(function (p) {
      return p.id !== perfId;
    });
    if (!persist()) return;
    showAlert("success", "Performance supprimée.");
    renderBilan();
  }

  function buildMiniChart(canvasId, list) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    const labels = list.map(function (_, i) {
      return String(i + 1);
    });
    const dist = list.map(function (p) {
      return p.distance;
    });
    const tgt = list.map(function (p) {
      return p.target;
    });

    charts[canvasId] = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Distance",
            data: dist,
            borderColor: "#2563eb",
            tension: 0.2,
            fill: false,
          },
          {
            label: "Cible",
            data: tgt,
            borderColor: "#d97706",
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 0 } },
          y: { beginAtZero: false },
        },
      },
    });
  }

  function buildGlobalChart(cls) {
    destroyChart("global");
    const canvas = document.getElementById("chart-global");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = [];
    const values = [];
    cls.groups.forEach(function (g, idx) {
      const st = statsForGroup(cls, g.id);
      labels.push("G" + (idx + 1));
      values.push(st.last ? st.last.distance : 0);
    });

    if (cls.groups.length === 0) {
      el.globalSection.style.display = "none";
      return;
    }
    el.globalSection.style.display = "block";

    charts.global = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Dernière distance",
            data: values,
            backgroundColor: "rgba(37, 99, 235, 0.55)",
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  function populateBilanGroupSelect(cls, preserveGroupId) {
    if (!el.bilanGroupSelect) return;
    const prev = preserveGroupId || el.bilanGroupSelect.value;
    el.bilanGroupSelect.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Choisir un groupe —";
    el.bilanGroupSelect.appendChild(empty);
    if (!cls) return;
    cls.groups.forEach(function (g, gIdx) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = "G" + (gIdx + 1) + " - " + groupOptionLabel(g);
      el.bilanGroupSelect.appendChild(opt);
    });
    if (prev && cls.groups.some(function (g) { return g.id === prev; })) {
      el.bilanGroupSelect.value = prev;
    } else {
      el.bilanGroupSelect.value = "";
    }
  }

  function populateBilanBinomeSelect(g) {
    if (!el.bilanBinomeFilter || !el.bilanBinomeWrap || !el.bilanBinomeList) return;
    const prev = el.bilanBinomeFilter.value;
    el.bilanBinomeList.innerHTML = "";

    function syncBinomePickVisual() {
      const v = el.bilanBinomeFilter.value;
      el.bilanBinomeList.querySelectorAll(".relay-pick-list__btn").forEach(function (btn) {
        const bv = btn.getAttribute("data-value") || "";
        const sel = bv === v;
        btn.classList.toggle("is-selected", sel);
        btn.setAttribute("aria-selected", sel ? "true" : "false");
      });
    }

    if (!g || g.students.length < 2) {
      el.bilanBinomeWrap.style.display = "none";
      el.bilanBinomeFilter.value = "";
      return;
    }
    el.bilanBinomeWrap.style.display = "block";

    const btnAll = document.createElement("button");
    btnAll.type = "button";
    btnAll.className = "relay-pick-list__btn";
    btnAll.setAttribute("data-value", "");
    btnAll.setAttribute("role", "option");
    btnAll.setAttribute("aria-selected", "false");
    btnAll.textContent = "Tous les binômes";
    btnAll.addEventListener("click", function () {
      el.bilanBinomeFilter.value = "";
      syncBinomePickVisual();
      showAlert("", "");
      const cls = getSelectedClass();
      renderGroupDetail(cls, el.bilanGroupSelect ? el.bilanGroupSelect.value : "");
    });
    el.bilanBinomeList.appendChild(btnAll);

    C.enumerateRelayChoices(g.students).forEach(function (c) {
      const a = C.findStudent(g, c.id1);
      const b = C.findStudent(g, c.id2);
      if (!a || !b) return;
      const val = c.id1 + "|" + c.id2;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "relay-pick-list__btn";
      btn.setAttribute("data-value", val);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");
      appendColoredBinomeButtonContent(btn, g, a, b);
      btn.addEventListener("click", function () {
        el.bilanBinomeFilter.value = val;
        syncBinomePickVisual();
        showAlert("", "");
        const cls = getSelectedClass();
        renderGroupDetail(cls, el.bilanGroupSelect ? el.bilanGroupSelect.value : "");
      });
      el.bilanBinomeList.appendChild(btn);
    });

    const validPrev =
      prev &&
      Array.from(el.bilanBinomeList.querySelectorAll(".relay-pick-list__btn")).some(function (b) {
        return (b.getAttribute("data-value") || "") === prev;
      });
    el.bilanBinomeFilter.value = validPrev ? prev : "";
    syncBinomePickVisual();
  }

  function renderGroupDetail(cls, groupId) {
    Object.keys(charts).forEach(function (k) {
      if (k.indexOf("chart-mini-") === 0) {
        destroyChart(k);
      }
    });
    el.groupsRoot.innerHTML = "";
    if (!cls || !groupId) {
      el.groupsRoot.innerHTML =
        '<p class="text-muted">Sélectionnez un groupe dans la liste ci-dessus pour afficher le détail.</p>';
      return;
    }
    const g = C.findGroup(cls, groupId);
    if (!g) {
      el.groupsRoot.innerHTML = '<p class="text-muted">Groupe introuvable.</p>';
      return;
    }
    const gIdx = cls.groups.findIndex(function (x) {
      return x.id === groupId;
    });
    const binomeKey = el.bilanBinomeFilter && el.bilanBinomeFilter.value ? el.bilanBinomeFilter.value : "";
    const st = statsForGroupWithBinomeFilter(cls, g.id, binomeKey);

    const section = document.createElement("section");
    section.className = "bilan-group";

    const head = document.createElement("div");
    head.className = "bilan-group__head";

    const h2 = document.createElement("h2");
    h2.textContent = "Groupe " + (gIdx + 1);
    head.appendChild(h2);

    if (st.list.length) {
      if (isNearTarget(st.lastGap, st.lastTarget)) {
        const b = document.createElement("span");
        b.className = "badge badge--near";
        b.textContent = "Proche de la cible";
        head.appendChild(b);
      }
      if (isProgressing(st.progression, st.list.length)) {
        const b2 = document.createElement("span");
        b2.className = "badge badge--progress";
        b2.textContent = "Progression";
        head.appendChild(b2);
      }
    }

    section.appendChild(head);

    const stats = document.createElement("div");
    stats.className = "bilan-stats";

    function addStat(label, val) {
      const d = document.createElement("div");
      d.className = "stat";
      d.innerHTML = label + "<b>" + val + "</b>";
      stats.appendChild(d);
    }

    if (st.list.length === 0) {
      addStat("Meilleure performance", "—");
      addStat("Dernière performance", "—");
      addStat("Performance cible (dernier relais)", "—");
      addStat("Écart à la cible", "—");
      addStat("Progression (1re → dernière)", "—");
    } else {
      addStat("Meilleure performance", C.round1(st.best.distance));
      addStat("Dernière performance", C.round1(st.last.distance));
      addStat("Cible (dernier enregistrement)", C.round1(st.lastTarget));
      addStat("Écart (dernier)", (st.lastGap >= 0 ? "+" : "") + C.round1(st.lastGap));
      addStat("Progression (1re → dernière)", (st.progression >= 0 ? "+" : "") + C.round1(st.progression));
    }

    section.appendChild(stats);

    const body = document.createElement("div");
    body.className = "bilan-body";

    const h3 = document.createElement("h3");
    h3.textContent = "Historique complet";
    body.appendChild(h3);

    if (st.list.length === 0) {
      const emptyHistMsg = binomeKey ? "Aucune mesure pour ce binôme." : "Aucune mesure pour ce groupe.";
      body.appendChild(document.createTextNode(emptyHistMsg));
    } else {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      const table = document.createElement("table");
      table.innerHTML =
        "<thead><tr>" +
        "<th>Date</th><th>Relais</th><th>Distance</th><th>Cible</th><th>Écart</th><th></th>" +
        "</tr></thead>";
      const tb = document.createElement("tbody");
      st.list
        .slice()
        .reverse()
        .forEach(function (p) {
          const tr = document.createElement("tr");

          const tdDate = document.createElement("td");
          tdDate.textContent = C.formatDateFr(p.dateISO);
          tr.appendChild(tdDate);

          const tdRelay = document.createElement("td");
          tdRelay.innerHTML = relayHtml(cls, p);
          tr.appendChild(tdRelay);

          const tdD = document.createElement("td");
          tdD.textContent = String(C.round1(p.distance));
          tr.appendChild(tdD);

          const tdT = document.createElement("td");
          tdT.textContent = String(C.round1(p.target));
          tr.appendChild(tdT);

          const tdG = document.createElement("td");
          tdG.textContent = (p.gap >= 0 ? "+" : "") + String(C.round1(p.gap));
          tr.appendChild(tdG);

          const tdAct = document.createElement("td");
          tdAct.className = "split-actions";

          const btnE = document.createElement("button");
          btnE.type = "button";
          btnE.className = "btn-icon";
          btnE.setAttribute("aria-label", "Modifier cette mesure");
          btnE.title = "Modifier";
          btnE.innerHTML = (window.EPSIcons && window.EPSIcons.edit) || "";
          btnE.addEventListener("click", function () {
            openEditModal(p.id);
          });

          const btnD = document.createElement("button");
          btnD.type = "button";
          btnD.className = "btn-icon btn-icon--danger";
          btnD.setAttribute("aria-label", "Supprimer cette mesure");
          btnD.title = "Supprimer";
          btnD.innerHTML = (window.EPSIcons && window.EPSIcons.trash) || "";
          btnD.addEventListener("click", function () {
            deletePerf(p.id);
          });

          tdAct.appendChild(btnE);
          tdAct.appendChild(btnD);
          tr.appendChild(tdAct);
          tb.appendChild(tr);
        });
      table.appendChild(tb);
      wrap.appendChild(table);
      body.appendChild(wrap);
    }

    const chartId = "chart-mini-" + g.id;
    const chartWrap = document.createElement("div");
    chartWrap.className = "mini-chart";
    chartWrap.innerHTML = '<canvas id="' + chartId + '"></canvas>';
    body.appendChild(chartWrap);

    section.appendChild(body);
    el.groupsRoot.appendChild(section);

    if (st.list.length) {
      buildMiniChart(chartId, st.list);
    }
  }

  function renderBilan() {
    Object.keys(charts).forEach(destroyChart);

    const prevClass = el.classSelect.value;
    const prevGroup = el.bilanGroupSelect ? el.bilanGroupSelect.value : "";

    el.classSelect.innerHTML = "";
    state.classes.forEach(function (c) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      el.classSelect.appendChild(opt);
    });

    if (prevClass && state.classes.some(function (c) { return c.id === prevClass; })) {
      el.classSelect.value = prevClass;
    }

    const cls = getSelectedClass();

    if (!el.bilanGroupSection || !el.bilanGroupSelect) {
      return;
    }

    if (!cls || cls.groups.length === 0) {
      el.bilanGroupSection.style.display = "none";
      el.globalSection.style.display = "none";
      if (el.bilanBinomeWrap) el.bilanBinomeWrap.style.display = "none";
      el.groupsRoot.innerHTML = '<p class="text-muted">Aucune classe ou aucun groupe.</p>';
      return;
    }

    el.bilanGroupSection.style.display = "block";
    populateBilanGroupSelect(cls, prevGroup);

    const gid = el.bilanGroupSelect.value;
    const gSel = gid && cls ? C.findGroup(cls, gid) : null;
    populateBilanBinomeSelect(gSel);

    buildGlobalChart(cls);

    if (el.bilanGroupSelect.value) {
      renderGroupDetail(cls, el.bilanGroupSelect.value);
    } else {
      renderGroupDetail(cls, "");
    }
  }

  el.classSelect.addEventListener("change", function () {
    showAlert("", "");
    if (el.bilanGroupSelect) el.bilanGroupSelect.value = "";
    if (el.bilanBinomeFilter) el.bilanBinomeFilter.value = "";
    renderBilan();
  });

  if (el.bilanGroupSelect) {
    el.bilanGroupSelect.addEventListener("change", function () {
      showAlert("", "");
      if (el.bilanBinomeFilter) el.bilanBinomeFilter.value = "";
      const cls = getSelectedClass();
      const gid = el.bilanGroupSelect.value;
      const g = gid && cls ? C.findGroup(cls, gid) : null;
      populateBilanBinomeSelect(g);
      renderGroupDetail(cls, gid);
    });
  }

  renderBilan();

  window.addEventListener("load", function () {
    renderBilan();
  });
})();
