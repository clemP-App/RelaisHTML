/**
 * Logique métier partagée : parsing import, calcul cible relais, binômes, helpers.
 */
(function (global) {
  const S = global.EPSStorage;

  const MIN_GROUP = 2;
  const MAX_GROUP = 4;

  /**
   * Couleurs fixes par place dans le groupe (A, B, C, D) — identiques pour toutes les classes.
   * A vert, B rouge, C bleu, D rose.
   */
  const SLOT_COLORS = ["#16a34a", "#dc2626", "#2563eb", "#db2777"];

  function getSlotColor(slotIndex) {
    const n = SLOT_COLORS.length;
    return SLOT_COLORS[((slotIndex % n) + n) % n];
  }

  function studentSlotIndex(group, studentId) {
    if (!group || !group.students) return 0;
    const i = group.students.findIndex(function (s) {
      return s.id === studentId;
    });
    return i >= 0 ? i : 0;
  }

  function getStudentColorInGroup(group, studentId) {
    return getSlotColor(studentSlotIndex(group, studentId));
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Import : une ligne « Classe: … » puis des lignes
   * Nom;Prénom;N°Groupe;Perf 6s arrêté;Perf 6s lancé
   * Les élèves sont regroupés par numéro de groupe (2 à 4 élèves par groupe).
   * @param {string} text
   * @returns {{ name: string, groups: { students: { nom: string, prenom: string, perf6Arrete: number, perf6Lance: number }[] }[] }}
   */
  function parseClassImport(text) {
    /** Normalise copier-coller iOS / tableurs (séparateurs « pleine chasse », BOM). */
    const normalized = String(text == null ? "" : text)
      .replace(/\uFEFF/g, "")
      .replace(/\uFF1B/g, ";")
      .replace(/\uFF1A/g, ":");

    const lines = normalized
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => !/^#/.test(l));

    if (lines.length === 0) {
      throw new Error("Le texte est vide. Collez le bloc fourni par votre tableur ou votre liste.");
    }

    let className = "";
    /** @type {Map<number, { nom: string, prenom: string, perf6Arrete: number, perf6Lance: number }[]>} */
    const groupMap = new Map();
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const lower = line.toLowerCase();

      if (lower.startsWith("classe:")) {
        className = line.slice(line.indexOf(":") + 1).trim();
        if (!className) {
          throw new Error("Ligne " + lineNum + " : après « Classe: », indiquez un nom (ex. 5eA).");
        }
        continue;
      }

      const parts = line.split(";").map((p) => p.trim());
      if (parts.length !== 5) {
        throw new Error(
          "Ligne " +
            lineNum +
            ' : format attendu « Nom;Prénom;N°Groupe;Perf 6s arrêté;Perf 6s lancé » (5 champs). Reçu : « ' +
            line +
            " »"
        );
      }

      const nom = parts[0];
      const prenom = parts[1];
      const gNum = parseInt(parts[2], 10);
      const a = parseFloat(parts[3].replace(",", "."));
      const b = parseFloat(parts[4].replace(",", "."));

      if (!nom || !prenom) {
        throw new Error("Ligne " + lineNum + " : le nom et le prénom ne peuvent pas être vides.");
      }
      if (Number.isNaN(gNum) || gNum < 1) {
        throw new Error(
          "Ligne " + lineNum + " : le numéro de groupe doit être un entier ≥ 1 (ex. 1, 2, 3…)."
        );
      }
      if (Number.isNaN(a) || Number.isNaN(b)) {
        throw new Error(
          "Ligne " + lineNum + " : les performances 6 s doivent être des nombres (ex. 32 ou 32,5)."
        );
      }

      if (!groupMap.has(gNum)) {
        groupMap.set(gNum, []);
      }
      groupMap.get(gNum).push({
        nom,
        prenom,
        perf6Arrete: a,
        perf6Lance: b,
      });
    }

    if (!className) {
      throw new Error('Indiquez une ligne « Classe: NomDeLaClasse » en tête du bloc.');
    }

    if (groupMap.size === 0) {
      throw new Error("Aucune ligne élève trouvée (5 champs par ligne après la ligne « Classe: »).");
    }

    const sortedKeys = Array.from(groupMap.keys()).sort((x, y) => x - y);
    const groups = sortedKeys.map((k) => ({ students: groupMap.get(k) }));

    for (let i = 0; i < sortedKeys.length; i++) {
      const k = sortedKeys[i];
      const g = groupMap.get(k);
      const n = g.length;
      if (n < MIN_GROUP || n > MAX_GROUP) {
        throw new Error(
          "Le groupe " +
            k +
            " contient " +
            n +
            " élève(s). Chaque groupe doit compter entre " +
            MIN_GROUP +
            " et " +
            MAX_GROUP +
            " élèves."
        );
      }
    }

    return { name: className, groups };
  }

  /**
   * @param {import('./storage.js').Student} s1
   * @param {import('./storage.js').Student} s2
   * @param {'1-arrete-2-lance'|'2-arrete-1-lance'} startMode
   */
  function computeRelayTarget(s1, s2, startMode) {
    if (startMode === "1-arrete-2-lance") {
      return Number(s1.perf6Arrete) + Number(s2.perf6Lance);
    }
    return Number(s2.perf6Arrete) + Number(s1.perf6Lance);
  }

  /** Tous les binômes ordonnés (A→B, B→A, …) pour graphiques / légendes */
  function enumerateOrderedPairs(students) {
    const out = [];
    if (!students || students.length < 2) return out;
    for (let i = 0; i < students.length; i++) {
      for (let j = 0; j < students.length; j++) {
        if (i === j) continue;
        const a = students[i];
        const b = students[j];
        out.push({
          a: a,
          b: b,
          label: a.prenom + " " + a.nom + " → " + b.prenom + " " + b.nom,
        });
      }
    }
    return out;
  }

  /**
   * Ordres de relais possibles : 1er → 2e (A→B, B→A, …).
   * Hypothèse pédagogique : le 1er relayeur part toujours arrêté, le 2e lancé (cible = arrêté₁ + lancé₂).
   * @returns {{ value: string, label: string, startMode: string, id1: string, id2: string }[]}
   */
  function enumerateRelayChoices(students) {
    const pairs = enumerateOrderedPairs(students);
    return pairs.map(function (pair) {
      const a = pair.a;
      const b = pair.b;
      return {
        value: a.id + "|" + b.id,
        label: a.prenom + " " + a.nom + " → " + b.prenom + " " + b.nom,
        startMode: "1-arrete-2-lance",
        id1: a.id,
        id2: b.id,
      };
    });
  }

  function parseRelayChoiceValue(value) {
    if (!value || typeof value !== "string") return null;
    const parts = value.split("|");
    if (parts.length < 2) return null;
    let startMode = "1-arrete-2-lance";
    if (parts.length >= 3) {
      if (parts[2] === "1-arrete-2-lance" || parts[2] === "2-arrete-1-lance") {
        startMode = parts[2];
      }
    }
    return { relayeur1Id: parts[0], relayeur2Id: parts[1], startMode: startMode };
  }

  function findClass(state, classId) {
    return state.classes.find((c) => c.id === classId) || null;
  }

  function findGroup(classData, groupId) {
    if (!classData) return null;
    return classData.groups.find((g) => g.id === groupId) || null;
  }

  function findStudent(group, studentId) {
    if (!group) return null;
    return group.students.find((s) => s.id === studentId) || null;
  }

  function performancesForGroup(state, classId, groupId) {
    return state.performances.filter((p) => p.classId === classId && p.groupId === groupId);
  }

  function formatDateFr(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  global.EPSCore = {
    SLOT_COLORS,
    getSlotColor,
    getStudentColorInGroup,
    studentSlotIndex,
    escapeHtml,
    parseClassImport,
    computeRelayTarget,
    enumerateOrderedPairs,
    enumerateRelayChoices,
    parseRelayChoiceValue,
    findClass,
    findGroup,
    findStudent,
    performancesForGroup,
    formatDateFr,
    round1,
    MIN_GROUP,
    MAX_GROUP,
    uid: () => S.uid(),
  };
})(typeof window !== "undefined" ? window : globalThis);
