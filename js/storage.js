/**
 * Persistance localStorage — classes et performances.
 * Clé unique : eps_relais_v1
 */
(function (global) {
  const STORAGE_KEY = "eps_relais_v1";

  /** @typedef {{ id: string, nom: string, prenom: string, perf6Arrete: number, perf6Lance: number }} Student */
  /** @typedef {{ id: string, students: Student[] }} Group */
  /** @typedef {{ id: string, name: string, groups: Group[] }} ClassData */
  /** @typedef {{ id: string, classId: string, groupId: string, relayeur1Id: string, relayeur2Id: string, startMode: '1-arrete-2-lance'|'2-arrete-1-lance', target: number, distance: number, gap: number, dateISO: string }} PerformanceRecord */

  /**
   * @returns {{ classes: ClassData[], performances: PerformanceRecord[] }}
   */
  function emptyState() {
    return { classes: [], performances: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyState();
      if (!Array.isArray(parsed.classes)) parsed.classes = [];
      if (!Array.isArray(parsed.performances)) parsed.performances = [];
      return parsed;
    } catch (e) {
      console.warn("EPS Relais: lecture localStorage impossible", e);
      return emptyState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error("EPS Relais: écriture localStorage impossible", e);
      return false;
    }
  }

  /** Génère un identifiant unique court */
  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Données d'exemple si aucune classe (première visite).
   */
  function seedSample() {
    const cId = uid();
    const g1 = uid();
    const g2 = uid();
    const s = [
      { id: uid(), nom: "Dupont", prenom: "Lucas", perf6Arrete: 32, perf6Lance: 38 },
      { id: uid(), nom: "Martin", prenom: "Emma", perf6Arrete: 30, perf6Lance: 36 },
      { id: uid(), nom: "Bernard", prenom: "Noah", perf6Arrete: 31, perf6Lance: 37 },
      { id: uid(), nom: "Petit", prenom: "Lina", perf6Arrete: 29, perf6Lance: 35 },
      { id: uid(), nom: "Robert", prenom: "Hugo", perf6Arrete: 33, perf6Lance: 39 },
      { id: uid(), nom: "Durand", prenom: "Chloé", perf6Arrete: 28, perf6Lance: 34 },
    ];
    return {
      classes: [
        {
          id: cId,
          name: "5e A (exemple)",
          groups: [
            { id: g1, students: [s[0], s[1], s[2]] },
            { id: g2, students: [s[3], s[4], s[5]] },
          ],
        },
      ],
      performances: [],
    };
  }

  function ensureSeed() {
    const state = load();
    if (state.classes.length === 0) {
      const sample = seedSample();
      save(sample);
      return sample;
    }
    return state;
  }

  global.EPSStorage = {
    STORAGE_KEY,
    load,
    save,
    emptyState,
    uid,
    ensureSeed,
    seedSample,
  };
})(typeof window !== "undefined" ? window : globalThis);
