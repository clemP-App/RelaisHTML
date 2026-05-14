/**
 * Export CSV / PDF et partage — chargé uniquement sur la page Bilan.
 * Dépend : js/storage.js, js/core.js — PDF : jsPDF + autotable (CDN au premier export).
 */
(function (global) {
  const S = global.EPSStorage;
  const C = global.EPSCore;

  function csvEscape(v) {
    if (v == null) return "";
    const s = String(v);
    if (/[;"'\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function buildFullCSV(state) {
    const rows = [];
    rows.push(
      [
        "type",
        "classe_id",
        "classe_nom",
        "groupe_index",
        "eleve_id",
        "nom",
        "prenom",
        "perf_6s_arrete",
        "perf_6s_lance",
      ].join(";")
    );
    state.classes.forEach(function (cls) {
      cls.groups.forEach(function (g, gi) {
        g.students.forEach(function (stu) {
          rows.push(
            [
              "eleve",
              cls.id,
              csvEscape(cls.name),
              gi + 1,
              stu.id,
              csvEscape(stu.nom),
              csvEscape(stu.prenom),
              stu.perf6Arrete,
              stu.perf6Lance,
            ].join(";")
          );
        });
      });
    });
    rows.push(
      [
        "type",
        "perf_id",
        "classe_id",
        "groupe_id",
        "relayeur1_id",
        "relayeur2_id",
        "start_mode",
        "cible",
        "distance",
        "ecart",
        "date_iso",
      ].join(";")
    );
    state.performances.forEach(function (p) {
      rows.push(
        [
          "performance",
          p.id,
          p.classId,
          p.groupId,
          p.relayeur1Id,
          p.relayeur2Id,
          p.startMode,
          p.target,
          p.distance,
          p.gap,
          p.dateISO,
        ].join(";")
      );
    });
    return "\uFEFF" + rows.join("\n");
  }

  function relayTextForPdf(cls, perf) {
    const grp = C.findGroup(cls, perf.groupId);
    const a = C.findStudent(grp, perf.relayeur1Id);
    const b = C.findStudent(grp, perf.relayeur2Id);
    if (!a || !b) return "?";
    return a.prenom + " " + a.nom + " → " + b.prenom + " " + b.nom;
  }

  function ensureJsPDF(callback) {
    if (global.jspdf && global.jspdf.jsPDF) {
      callback(null);
      return;
    }
    const s1 = document.createElement("script");
    s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s1.onload = function () {
      const s2 = document.createElement("script");
      s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
      s2.onload = function () {
        callback(null);
      };
      s2.onerror = function () {
        callback(new Error("Impossible de charger jsPDF AutoTable."));
      };
      document.head.appendChild(s2);
    };
    s1.onerror = function () {
      callback(new Error("Impossible de charger jsPDF."));
    };
    document.head.appendChild(s1);
  }

  function exportBilanPdf(state, classId, onDone) {
    const cls = C.findClass(state, classId);
    if (!cls) {
      if (onDone) onDone(new Error("Classe introuvable."));
      return;
    }
    ensureJsPDF(function (err) {
      if (err) {
        if (onDone) onDone(err);
        return;
      }
      try {
        const jsPDF = global.jspdf.jsPDF;
        const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
        doc.setFontSize(16);
        doc.text("Bilan EPS Relais — " + cls.name, 14, 16);
        doc.setFontSize(9);
        doc.text("Généré le " + new Date().toLocaleString("fr-FR"), 14, 23);
        let y = 30;
        cls.groups.forEach(function (g, gi) {
          if (y > 250) {
            doc.addPage();
            y = 16;
          }
          doc.setFontSize(12);
          doc.text("Groupe " + (gi + 1) + " (" + g.students.length + " élèves)", 14, y);
          y += 6;
          const perfs = C.performancesForGroup(state, cls.id, g.id).sort(function (a, b) {
            return new Date(a.dateISO) - new Date(b.dateISO);
          });
          const body = perfs.map(function (p) {
            return [
              C.formatDateFr(p.dateISO),
              relayTextForPdf(cls, p),
              String(C.round1(p.distance)),
              String(C.round1(p.target)),
              (p.gap >= 0 ? "+" : "") + String(C.round1(p.gap)),
            ];
          });
          doc.autoTable({
            startY: y,
            head: [["Date", "Relais (1er → 2e)", "Distance", "Cible", "Écart"]],
            body: body.length ? body : [["—", "Aucune mesure", "", "", ""]],
            styles: { fontSize: 8, cellPadding: 1.5 },
            headStyles: { fillColor: [37, 99, 235] },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 10;
        });
        const safeName = cls.name.replace(/[^\w\u00C0-\u024f-]+/g, "_").slice(0, 40);
        doc.save("bilan-eps-relais-" + safeName + ".pdf");
        if (onDone) onDone(null);
      } catch (e) {
        if (onDone) onDone(e);
      }
    });
  }

  function buildGroupPerformanceCSV(state, classId, groupId) {
    const cls = C.findClass(state, classId);
    const grp = C.findGroup(cls, groupId);
    if (!cls || !grp) return "";
    const rows = [];
    rows.push(["classe", csvEscape(cls.name)].join(";"));
    rows.push(["groupe_id", groupId].join(";"));
    rows.push("nom;prenom;perf_6s_arrete;perf_6s_lance");
    grp.students.forEach(function (s) {
      rows.push([csvEscape(s.nom), csvEscape(s.prenom), s.perf6Arrete, s.perf6Lance].join(";"));
    });
    rows.push("");
    rows.push("date;relayeur1_id;relayeur2_id;start_mode;cible;distance;ecart");
    const perfs = C.performancesForGroup(state, classId, groupId).sort(function (a, b) {
      return new Date(a.dateISO) - new Date(b.dateISO);
    });
    perfs.forEach(function (p) {
      rows.push(
        [p.dateISO, p.relayeur1Id, p.relayeur2Id, p.startMode, p.target, p.distance, p.gap].join(";")
      );
    });
    return "\uFEFF" + rows.join("\n");
  }

  async function tryShareFile(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const file = new File([blob], filename, { type: mime });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Export EPS Relais",
          text: "Fichier exporté depuis EPS Relais",
        });
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return true;
      }
    }
    return false;
  }

  function makeToolbarBtn(id, title, iconHtml, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = "btn btn--toolbar";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.innerHTML =
      '<span class="btn--toolbar__ico">' + iconHtml + '</span><span class="btn--toolbar__txt">' + label + "</span>";
    b.addEventListener("click", onClick);
    return b;
  }

  function initExportToolbar() {
    const host = document.getElementById("export-toolbar-host");
    const I = global.EPSIcons;
    if (!host || !I) return;
    if (host.getAttribute("data-initialized") === "1") return;
    host.setAttribute("data-initialized", "1");

    host.appendChild(
      makeToolbarBtn("export-csv-full", "Télécharger toutes les données (CSV)", I.csv, "CSV tout", function () {
        const st = S.load();
        downloadText("eps-relais-export-complet.csv", buildFullCSV(st), "text/csv;charset=utf-8");
      })
    );

    host.appendChild(
      makeToolbarBtn(
        "export-csv-bilan-group",
        "CSV du groupe affiché",
        I.csv,
        "CSV groupe",
        function () {
          const st = S.load();
          const classId =
            global.EPSExportContext && global.EPSExportContext.getBilanClassId
              ? global.EPSExportContext.getBilanClassId()
              : "";
          const groupId =
            global.EPSExportContext && global.EPSExportContext.getBilanGroupId
              ? global.EPSExportContext.getBilanGroupId()
              : "";
          if (!classId || !groupId) {
            window.alert("Sélectionnez une classe puis un groupe dans la liste.");
            return;
          }
          const csv = buildGroupPerformanceCSV(st, classId, groupId);
          if (!csv) {
            window.alert("Groupe introuvable.");
            return;
          }
          downloadText("eps-relais-groupe.csv", csv, "text/csv;charset=utf-8");
        }
      )
    );

    host.appendChild(
      makeToolbarBtn(
        "export-pdf-bilan",
        "Exporter le bilan de la classe sélectionnée (PDF)",
        I.pdf,
        "PDF bilan",
        function () {
          const st = S.load();
          const classId =
            global.EPSExportContext && global.EPSExportContext.getBilanClassId
              ? global.EPSExportContext.getBilanClassId()
              : "";
          if (!classId) {
            window.alert("Sélectionnez une classe.");
            return;
          }
          exportBilanPdf(st, classId, function (err) {
            if (err) window.alert(err.message || String(err));
          });
        }
      )
    );

    host.appendChild(
      makeToolbarBtn(
        "export-share-csv",
        "Partager ou enregistrer le CSV complet",
        I.share,
        "Partager",
        async function () {
          const st = S.load();
          const csv = buildFullCSV(st);
          const ok = await tryShareFile("eps-relais-export.csv", csv, "text/csv;charset=utf-8");
          if (!ok) {
            downloadText("eps-relais-export-complet.csv", csv, "text/csv;charset=utf-8");
          }
        }
      )
    );
  }

  global.EPSExport = {
    buildFullCSV,
    downloadText,
    exportBilanPdf,
    buildGroupPerformanceCSV,
    initExportToolbar,
  };

  function boot() {
    initExportToolbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
