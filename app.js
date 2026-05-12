import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Remplissez ces valeurs avec votre projet Firebase.
const FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

const tournamentId = new URLSearchParams(window.location.search).get("tournoi") || "default";

const defaultTeams = [
  { id: uid(), name: "Panthers", city: "Lyon", logo: "" },
  { id: uid(), name: "Tigers", city: "Paris", logo: "" },
  { id: uid(), name: "Rockets", city: "Marseille", logo: "" },
  { id: uid(), name: "Falcons", city: "Bordeaux", logo: "" },
  { id: uid(), name: "Sharks", city: "Lille", logo: "" },
  { id: uid(), name: "Wolves", city: "Nantes", logo: "" },
  { id: uid(), name: "Bulls", city: "Toulouse", logo: "" },
  { id: uid(), name: "Eagles", city: "Nice", logo: "" },
];

const defaultState = () => ({
  teams: defaultTeams.map((team) => ({ ...team })),
  config: {
    format: "league",
    teamCount: 8,
    pointsRules: { win: 2, loss: 1, forfeit: 0 },
  },
  matches: [],
  rounds: [],
  bracket: {
    quarterFinals: [],
    semiFinals: [],
    final: [],
    winnerTeamId: null,
  },
});

const state = defaultState();
let db = null;
let tournamentRef = null;
let isApplyingRemoteState = false;

const els = {
  teamForm: document.getElementById("team-form"),
  teamId: document.getElementById("team-id"),
  teamName: document.getElementById("team-name"),
  teamCity: document.getElementById("team-city"),
  teamLogo: document.getElementById("team-logo"),
  teamSubmitBtn: document.getElementById("team-submit-btn"),
  teamCancelBtn: document.getElementById("team-cancel-btn"),
  teamsList: document.getElementById("teams-list"),
  configForm: document.getElementById("config-form"),
  tournamentFormat: document.getElementById("tournament-format"),
  teamCount: document.getElementById("team-count"),
  forfeitPoints: document.getElementById("forfeit-points"),
  matchesContainer: document.getElementById("matches-container"),
  standingsContainer: document.getElementById("standings-container"),
  bracketContainer: document.getElementById("bracket-container"),
  exportBtn: document.getElementById("export-btn"),
  importInput: document.getElementById("import-input"),
  resetBtn: document.getElementById("reset-btn"),
  toastContainer: document.getElementById("toast-container"),
  syncStatus: document.getElementById("sync-status"),
};

bootstrap().catch((error) => {
  console.error(error);
  notify("Erreur de demarrage Firebase. Verifiez la configuration.", "error");
});

async function bootstrap() {
  bindEvents();
  updateSyncStatus("Connexion Firebase...");
  initFirebase();
  await subscribeToTournament();
}

function bindEvents() {
  els.teamForm.addEventListener("submit", onTeamSubmit);
  els.teamCancelBtn.addEventListener("click", resetTeamForm);
  els.configForm.addEventListener("submit", onConfigSubmit);
  els.exportBtn.addEventListener("click", exportJSON);
  els.importInput.addEventListener("change", importJSON);
  els.resetBtn.addEventListener("click", resetTournament);
}

function hydrateConfigUI() {
  els.tournamentFormat.value = state.config.format;
  els.teamCount.value = state.config.teamCount;
  els.forfeitPoints.value = state.config.pointsRules.forfeit;
}

function onTeamSubmit(event) {
  event.preventDefault();
  const id = els.teamId.value;
  const name = els.teamName.value.trim();
  const city = els.teamCity.value.trim();
  const logo = els.teamLogo.value.trim();

  if (!name) {
    return notify("Le nom de l'equipe est obligatoire.", "error");
  }

  const duplicate = state.teams.some(
    (team) => team.name.toLowerCase() === name.toLowerCase() && team.id !== id
  );
  if (duplicate) {
    return notify("Nom d'equipe deja existant.", "error");
  }

  if (id) {
    const idx = state.teams.findIndex((team) => team.id === id);
    if (idx !== -1) {
      state.teams[idx] = { ...state.teams[idx], name, city, logo };
      notify("Equipe modifiee.", "success");
    }
  } else {
    state.teams.push({ id: uid(), name, city, logo });
    notify("Equipe ajoutee.", "success");
  }

  resetTeamForm();
  saveStateRemote();
  renderAll();
}

function resetTeamForm() {
  els.teamId.value = "";
  els.teamForm.reset();
  els.teamSubmitBtn.textContent = "Ajouter equipe";
  els.teamCancelBtn.classList.add("hidden");
}

function editTeam(teamId) {
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) return;
  els.teamId.value = team.id;
  els.teamName.value = team.name;
  els.teamCity.value = team.city || "";
  els.teamLogo.value = team.logo || "";
  els.teamSubmitBtn.textContent = "Modifier equipe";
  els.teamCancelBtn.classList.remove("hidden");
}

function deleteTeam(teamId) {
  const isInMatch = state.matches.some(
    (m) => m.teamAId === teamId || m.teamBId === teamId
  );
  if (isInMatch) {
    notify("Equipe deja utilisee dans un calendrier. Regenerer apres suppression.", "error");
  }
  state.teams = state.teams.filter((team) => team.id !== teamId);
  saveStateRemote();
  renderAll();
}

function onConfigSubmit(event) {
  event.preventDefault();
  state.config.format = els.tournamentFormat.value;
  state.config.teamCount = Number(els.teamCount.value) || state.teams.length;
  state.config.pointsRules.forfeit = Math.max(0, Number(els.forfeitPoints.value) || 0);
  generateTournament();
  notify("Calendrier genere.", "success");
}

function generateTournament() {
  const targetCount = Math.max(2, state.config.teamCount);
  const teams = state.teams.slice(0, targetCount);
  if (teams.length < 2) {
    notify("Au moins 2 equipes sont requises.", "error");
    return;
  }

  state.matches = [];
  state.rounds = [];
  state.bracket = { quarterFinals: [], semiFinals: [], final: [], winnerTeamId: null };

  if (state.config.format === "league") {
    const schedule = roundRobin(teams);
    state.rounds = schedule;
    state.matches = schedule.flatMap((round, idx) =>
      round.map((pair, pIdx) => createMatch(pair[0], pair[1], `Journee ${idx + 1}`, pIdx))
    );
  } else if (state.config.format === "groupsKnockout") {
    const groups = splitInGroups(teams, 2);
    const rounds = [];
    groups.forEach((groupTeams, groupIdx) => {
      const groupSchedule = roundRobin(groupTeams);
      groupSchedule.forEach((round, roundIdx) => {
        rounds.push({
          label: `Groupe ${groupIdx + 1} - Journee ${roundIdx + 1}`,
          pairs: round,
        });
      });
    });
    state.rounds = rounds;
    state.matches = rounds.flatMap((round, idx) =>
      round.pairs.map((pair, pIdx) => createMatch(pair[0], pair[1], round.label, idx * 10 + pIdx))
    );
  } else if (state.config.format === "knockout") {
    state.bracket.quarterFinals = buildKnockoutRound(teams, "Quart");
  }

  recomputeDerivedData();
  saveStateRemote();
  renderAll();
}

function createMatch(teamA, teamB, roundLabel, order) {
  return {
    id: uid(),
    roundLabel,
    order,
    teamAId: teamA.id,
    teamBId: teamB.id,
    scoreA: null,
    scoreB: null,
    finished: false,
    forfeitA: false,
    forfeitB: false,
  };
}

function roundRobin(teamList) {
  const teams = [...teamList];
  if (teams.length % 2 === 1) {
    teams.push({ id: "bye", name: "BYE" });
  }

  const rounds = [];
  const n = teams.length;
  for (let r = 0; r < n - 1; r += 1) {
    const pairs = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a.id !== "bye" && b.id !== "bye") {
        pairs.push([a, b]);
      }
    }
    rounds.push(pairs);
    teams.splice(1, 0, teams.pop());
  }
  return rounds;
}

function splitInGroups(teams, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  teams.forEach((team, index) => groups[index % groupCount].push(team));
  return groups.filter((g) => g.length > 1);
}

function buildKnockoutRound(teams, roundName) {
  const slots = nearestPowerOfTwo(teams.length);
  const padded = [...teams];
  while (padded.length < slots) {
    padded.push({ id: `bye-${uid()}`, name: "BYE" });
  }

  const pairs = [];
  for (let i = 0; i < padded.length; i += 2) {
    pairs.push({
      id: uid(),
      stage: roundName,
      teamAId: padded[i].id,
      teamBId: padded[i + 1].id,
      scoreA: null,
      scoreB: null,
      finished: padded[i].name === "BYE" || padded[i + 1].name === "BYE",
    });
  }
  return pairs;
}

function recomputeDerivedData() {
  if (state.config.format === "groupsKnockout" || state.config.format === "knockout") {
    computeBracket();
  }
}

function computeBracket() {
  const ranking = computeStandings();
  if (!ranking.length) return;

  if (state.config.format === "groupsKnockout") {
    const top8 = ranking.slice(0, Math.min(8, ranking.length)).map((r) => findTeam(r.teamId));
    if (top8.length >= 4) {
      state.bracket.quarterFinals = knockoutPairing(top8, "Quart");
      resolveNextRounds();
    }
  }

  if (state.config.format === "knockout") {
    resolveNextRounds();
  }
}

function knockoutPairing(teams, stage) {
  const pairs = [];
  for (let i = 0; i < teams.length / 2; i += 1) {
    const a = teams[i];
    const b = teams[teams.length - 1 - i];
    pairs.push({
      id: uid(),
      stage,
      teamAId: a.id,
      teamBId: b.id,
      scoreA: null,
      scoreB: null,
      finished: false,
    });
  }
  return pairs;
}

function resolveNextRounds() {
  const qWinners = collectWinners(state.bracket.quarterFinals);
  state.bracket.semiFinals = qWinners.length >= 2 ? knockoutPairing(qWinners, "Demi") : [];

  const sWinners = collectWinners(state.bracket.semiFinals);
  state.bracket.final = sWinners.length === 2 ? knockoutPairing(sWinners, "Finale") : [];

  const fWinner = collectWinners(state.bracket.final);
  state.bracket.winnerTeamId = fWinner.length === 1 ? fWinner[0].id : null;
}

function collectWinners(matches) {
  return matches
    .filter((m) => m.finished && Number.isInteger(m.scoreA) && Number.isInteger(m.scoreB))
    .map((m) => (m.scoreA > m.scoreB ? findTeam(m.teamAId) : findTeam(m.teamBId)))
    .filter(Boolean);
}

function computeStandings() {
  const table = state.teams.reduce((acc, team) => {
    acc[team.id] = {
      teamId: team.id,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      points: 0,
      diff: 0,
    };
    return acc;
  }, {});

  state.matches
    .filter((match) => match.finished && Number.isInteger(match.scoreA) && Number.isInteger(match.scoreB))
    .forEach((match) => {
      const rowA = table[match.teamAId];
      const rowB = table[match.teamBId];
      if (!rowA || !rowB) return;

      rowA.played += 1;
      rowB.played += 1;
      rowA.pointsFor += match.scoreA;
      rowA.pointsAgainst += match.scoreB;
      rowB.pointsFor += match.scoreB;
      rowB.pointsAgainst += match.scoreA;

      const isForfeit = match.forfeitA || match.forfeitB;
      if (match.scoreA > match.scoreB) {
        rowA.wins += 1;
        rowB.losses += 1;
        rowA.points += state.config.pointsRules.win;
        rowB.points += isForfeit ? state.config.pointsRules.forfeit : state.config.pointsRules.loss;
      } else if (match.scoreB > match.scoreA) {
        rowB.wins += 1;
        rowA.losses += 1;
        rowB.points += state.config.pointsRules.win;
        rowA.points += isForfeit ? state.config.pointsRules.forfeit : state.config.pointsRules.loss;
      }
    });

  const ranking = Object.values(table).map((row) => ({
    ...row,
    diff: row.pointsFor - row.pointsAgainst,
  }));

  ranking.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });

  return ranking;
}

function renderAll() {
  renderTeams();
  renderMatches();
  renderStandings();
  renderBracket();
}

function renderTeams() {
  if (!state.teams.length) {
    els.teamsList.innerHTML = "<p>Aucune equipe.</p>";
    return;
  }

  els.teamsList.innerHTML = state.teams
    .map(
      (team) => `
      <article class="team-item">
        <img class="team-logo" src="${team.logo || "https://via.placeholder.com/48?text=B"}" alt="Logo ${escapeHtml(
        team.name
      )}" />
        <div class="team-meta">
          <strong>${escapeHtml(team.name)}</strong><br />
          <small>${escapeHtml(team.city || "Ville non renseignee")}</small>
        </div>
        <div class="team-controls">
          <button type="button" class="secondary" data-action="edit-team" data-id="${team.id}">Modifier</button>
          <button type="button" class="danger" data-action="delete-team" data-id="${team.id}">Supprimer</button>
        </div>
      </article>
    `
    )
    .join("");

  els.teamsList.querySelectorAll("[data-action='edit-team']").forEach((button) =>
    button.addEventListener("click", () => editTeam(button.dataset.id))
  );

  els.teamsList.querySelectorAll("[data-action='delete-team']").forEach((button) =>
    button.addEventListener("click", () => deleteTeam(button.dataset.id))
  );
}

function renderMatches() {
  if (!state.matches.length) {
    els.matchesContainer.innerHTML = "<p>Aucun match genere pour ce format.</p>";
    return;
  }

  const grouped = groupBy(state.matches, "roundLabel");
  els.matchesContainer.innerHTML = Object.entries(grouped)
    .map(([label, matches]) => {
      const rows = matches
        .sort((a, b) => a.order - b.order)
        .map((match) => {
          const teamA = findTeam(match.teamAId);
          const teamB = findTeam(match.teamBId);
          return `
            <div class="match">
              <div><strong>${escapeHtml(teamA?.name || "Equipe A")}</strong> vs <strong>${escapeHtml(
            teamB?.name || "Equipe B"
          )}</strong></div>
              <div>
                <label for="a-${match.id}">A</label>
                <input id="a-${match.id}" class="score-input" type="number" min="0" step="1" value="${
            Number.isInteger(match.scoreA) ? match.scoreA : ""
          }" data-match-id="${match.id}" data-side="A" />
              </div>
              <div>
                <label for="b-${match.id}">B</label>
                <input id="b-${match.id}" class="score-input" type="number" min="0" step="1" value="${
            Number.isInteger(match.scoreB) ? match.scoreB : ""
          }" data-match-id="${match.id}" data-side="B" />
              </div>
              <div class="actions">
                <button type="button" data-action="finish-match" data-id="${match.id}">Termine</button>
                <span class="status-badge ${match.finished ? "status-finished" : ""}">${
            match.finished ? "Termine" : "A jouer"
          }</span>
              </div>
            </div>
          `;
        })
        .join("");
      return `<section class="match-round"><h3>${escapeHtml(label)}</h3>${rows}</section>`;
    })
    .join("");

  els.matchesContainer.querySelectorAll("input[data-match-id]").forEach((input) => {
    input.addEventListener("change", onScoreInput);
  });

  els.matchesContainer.querySelectorAll("[data-action='finish-match']").forEach((button) => {
    button.addEventListener("click", () => markMatchFinished(button.dataset.id));
  });
}

function onScoreInput(event) {
  const matchId = event.target.dataset.matchId;
  const side = event.target.dataset.side;
  const value = event.target.value;
  const parsed = value === "" ? null : Number(value);

  if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
    notify("Score invalide : entier >= 0 requis.", "error");
    event.target.value = "";
    return;
  }

  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return;

  if (side === "A") match.scoreA = parsed;
  if (side === "B") match.scoreB = parsed;

  match.finished = false;
  saveStateRemote();
  renderStandings();
  renderBracket();
}

function markMatchFinished(matchId) {
  const match = state.matches.find((m) => m.id === matchId);
  if (!match) return;
  if (!Number.isInteger(match.scoreA) || !Number.isInteger(match.scoreB)) {
    return notify("Saisissez les deux scores avant de terminer le match.", "error");
  }

  match.finished = true;
  recomputeDerivedData();
  saveStateRemote();
  renderAll();
}

function renderStandings() {
  const ranking = computeStandings();
  if (!ranking.length) {
    els.standingsContainer.innerHTML = "<p>Pas de classement disponible.</p>";
    return;
  }

  const rows = ranking
    .map((row, idx) => {
      const team = findTeam(row.teamId);
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(team?.name || "Equipe")}</td>
          <td>${row.played}</td>
          <td>${row.wins}</td>
          <td>${row.losses}</td>
          <td>${row.pointsFor}</td>
          <td>${row.pointsAgainst}</td>
          <td>${row.diff}</td>
          <td>${row.points}</td>
        </tr>
      `;
    })
    .join("");

  els.standingsContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th><th>Equipe</th><th>J</th><th>V</th><th>D</th><th>PM</th><th>PE</th><th>Diff</th><th>Pts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderBracket() {
  const sections = [];

  if (state.bracket.quarterFinals.length) {
    sections.push(renderBracketStage("Quarts", state.bracket.quarterFinals));
  }
  if (state.bracket.semiFinals.length) {
    sections.push(renderBracketStage("Demi-finales", state.bracket.semiFinals));
  }
  if (state.bracket.final.length) {
    sections.push(renderBracketStage("Finale", state.bracket.final));
  }

  if (!sections.length) {
    els.bracketContainer.innerHTML = "<p>Le bracket apparaitra quand des matchs eliminatoires seront disponibles.</p>";
    return;
  }

  const winner = findTeam(state.bracket.winnerTeamId);
  const winnerHTML = winner ? `<div class="winner-banner">Vainqueur du tournoi : ${escapeHtml(winner.name)}</div>` : "";
  els.bracketContainer.innerHTML = sections.join("") + winnerHTML;

  // Attach stage score listeners for editable bracket matches.
  els.bracketContainer.querySelectorAll("input[data-stage-match-id]").forEach((input) => {
    input.addEventListener("change", onStageScoreInput);
  });
  els.bracketContainer.querySelectorAll("[data-action='finish-stage-match']").forEach((button) => {
    button.addEventListener("click", () => finishStageMatch(button.dataset.id, button.dataset.stage));
  });
}

function renderBracketStage(title, matches) {
  const rows = matches
    .map((match) => {
      const teamA = findTeam(match.teamAId);
      const teamB = findTeam(match.teamBId);
      return `
        <div class="match">
          <div><strong>${escapeHtml(teamA?.name || "Equipe A")}</strong> vs <strong>${escapeHtml(
        teamB?.name || "Equipe B"
      )}</strong></div>
          <div>
            <label for="sa-${match.id}">A</label>
            <input id="sa-${match.id}" class="score-input" type="number" min="0" step="1" value="${
        Number.isInteger(match.scoreA) ? match.scoreA : ""
      }" data-stage-match-id="${match.id}" data-side="A" data-stage="${match.stage}" />
          </div>
          <div>
            <label for="sb-${match.id}">B</label>
            <input id="sb-${match.id}" class="score-input" type="number" min="0" step="1" value="${
        Number.isInteger(match.scoreB) ? match.scoreB : ""
      }" data-stage-match-id="${match.id}" data-side="B" data-stage="${match.stage}" />
          </div>
          <div class="actions">
            <button type="button" data-action="finish-stage-match" data-id="${match.id}" data-stage="${
        match.stage
      }">Termine</button>
            <span class="status-badge ${match.finished ? "status-finished" : ""}">${match.finished ? "Termine" : "A jouer"}</span>
          </div>
        </div>
      `;
    })
    .join("");
  return `<section class="match-round"><h3>${escapeHtml(title)}</h3>${rows}</section>`;
}

function onStageScoreInput(event) {
  const stage = event.target.dataset.stage;
  const id = event.target.dataset.stageMatchId;
  const side = event.target.dataset.side;
  const parsed = event.target.value === "" ? null : Number(event.target.value);

  if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
    notify("Score invalide : entier >= 0 requis.", "error");
    event.target.value = "";
    return;
  }

  const list = stageList(stage);
  const match = list.find((m) => m.id === id);
  if (!match) return;
  if (side === "A") match.scoreA = parsed;
  if (side === "B") match.scoreB = parsed;
  match.finished = false;
  saveStateRemote();
}

function finishStageMatch(id, stage) {
  const list = stageList(stage);
  const match = list.find((m) => m.id === id);
  if (!match) return;

  if (!Number.isInteger(match.scoreA) || !Number.isInteger(match.scoreB)) {
    return notify("Saisissez les deux scores avant de terminer le match.", "error");
  }
  if (match.scoreA === match.scoreB) {
    return notify("Egalite interdite en phase finale.", "error");
  }

  match.finished = true;
  resolveNextRounds();
  saveStateRemote();
  renderBracket();
}

function stageList(stage) {
  if (stage === "Quart") return state.bracket.quarterFinals;
  if (stage === "Demi") return state.bracket.semiFinals;
  return state.bracket.final;
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tournament-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  notify("Export JSON effectue.", "success");
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      validateImportedState(imported);
      Object.assign(state, imported);
      saveStateRemote();
      hydrateConfigUI();
      renderAll();
      notify("Import JSON reussi.", "success");
    } catch (error) {
      notify(`Import impossible: ${error.message}`, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetTournament() {
  if (!window.confirm("Confirmer la reinitialisation complete du tournoi ?")) return;
  Object.assign(state, defaultState());
  hydrateConfigUI();
  generateTournament();
  notify("Tournoi reinitialise.", "success");
}

function validateImportedState(data) {
  if (!data || typeof data !== "object") throw new Error("Fichier invalide.");
  if (!Array.isArray(data.teams)) throw new Error("Liste d'equipes manquante.");
  if (!data.config || !data.config.pointsRules) throw new Error("Configuration manquante.");
}

function findTeam(teamId) {
  return state.teams.find((team) => team.id === teamId);
}

function notify(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function initFirebase() {
  const hasMissingConfig = Object.values(FIREBASE_CONFIG).some((v) => String(v).includes("REPLACE_ME"));
  if (hasMissingConfig) {
    throw new Error("Configuration Firebase incomplete.");
  }
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  tournamentRef = doc(db, "tournaments", tournamentId);
}

async function subscribeToTournament() {
  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) {
    Object.assign(state, defaultState());
    generateTournament();
    await saveStateRemote(true);
  }

  onSnapshot(
    tournamentRef,
    (snapshot) => {
      if (!snapshot.exists()) return;
      const remoteData = snapshot.data();
      isApplyingRemoteState = true;
      Object.assign(state, sanitizeRemoteState(remoteData));
      hydrateConfigUI();
      recomputeDerivedData();
      renderAll();
      isApplyingRemoteState = false;
      updateSyncStatus(`Synchronise (tournoi: ${tournamentId})`);
    },
    (error) => {
      console.error(error);
      updateSyncStatus("Erreur de synchronisation");
      notify("Synchronisation Firebase echouee.", "error");
    }
  );
}

async function saveStateRemote(isInitial = false) {
  if (!tournamentRef || isApplyingRemoteState) return;
  const payload = {
    ...state,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(tournamentRef, payload, { merge: !isInitial });
    updateSyncStatus(`Synchronise (tournoi: ${tournamentId})`);
  } catch (error) {
    console.error(error);
    notify("Echec d'ecriture Firebase.", "error");
    updateSyncStatus("Erreur d'ecriture");
  }
}

function sanitizeRemoteState(data) {
  const base = defaultState();
  return {
    teams: Array.isArray(data.teams) ? data.teams : base.teams,
    config: data.config || base.config,
    matches: Array.isArray(data.matches) ? data.matches : [],
    rounds: Array.isArray(data.rounds) ? data.rounds : [],
    bracket: data.bracket || base.bracket,
  };
}

function updateSyncStatus(text) {
  if (els.syncStatus) {
    els.syncStatus.textContent = text;
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const groupKey = item[key];
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function nearestPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
