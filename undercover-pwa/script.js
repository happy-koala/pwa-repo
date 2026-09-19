/* =========================================================================
 * Undercover PWA – Application logic
 *
 * A pure-vanilla-JS controller for a small party game ("Mr. White" /
 * "Undercover" / "Bürger"). The whole game lives in three "views" inside
 * index.html (#view-setup, #view-distribute, #view-done); we just toggle
 * their .is-active class to swap screens.
 *
 * Sensitive round data (chosen word pair, role assignments) is NEVER
 * persisted to localStorage / sessionStorage. Only the player's name list
 * is kept locally for convenience across sessions.
 *
 * UI strings are in German; code comments are in English.
 * ========================================================================= */

/* ------------------------------------------------------------------ *
 * 1. Built-in word pair list                                          *
 *    >= 40 thematically similar but distinguishable German pairs.    *
 *    Bürger (citizens) receive word A, Undercover receive word B.    *
 * ------------------------------------------------------------------ */
const WORD_PAIRS = [
  ["Kaffee", "Tee"],
  ["Sommer", "Winter"],
  ["Katze", "Hund"],
  ["Hose", "Rock"],
  ["Buch", "Zeitschrift"],
  ["Berg", "Hügel"],
  ["Suppe", "Eintopf"],
  ["Brücke", "Tunnel"],
  ["Mond", "Sonne"],
  ["Schwert", "Dolch"],
  ["Regen", "Schnee"],
  ["Tisch", "Schreibtisch"],
  ["Koffer", "Rucksack"],
  ["Kino", "Theater"],
  ["Burg", "Schloss"],
  ["Krone", "Diadem"],
  ["Vogel", "Fledermaus"],
  ["Löwe", "Tiger"],
  ["Gitarre", "Bass"],
  ["Geige", "Cello"],
  ["Pinsel", "Stift"],
  ["Tinte", "Bleistift"],
  ["Messer", "Gabel"],
  ["Schüssel", "Teller"],
  ["Kissen", "Decke"],
  ["Bett", "Couch"],
  ["Kerze", "Fackel"],
  ["Wolke", "Nebel"],
  ["Fluss", "See"],
  ["Meer", "Ozean"],
  ["Brot", "Brötchen"],
  ["Butter", "Margarine"],
  ["Käse", "Quark"],
  ["Apfel", "Birne"],
  ["Erdbeere", "Himbeere"],
  ["Zitrone", "Limette"],
  ["Schokolade", "Kakao"],
  ["Kuchen", "Torte"],
  ["Pizza", "Flammkuchen"],
  ["Auto", "Motorrad"],
  ["Bus", "Straßenbahn"],
  ["Zug", "U-Bahn"],
  ["Flugzeug", "Heißluftballon"],
  ["Rakete", "Satellit"],
  ["Uhr", "Wecker"],
  ["Karte", "Atlas"],
  ["Treppe", "Leiter"],
  ["Brille", "Monokel"],
  ["Hut", "Mütze"],
  ["Ring", "Kette"]
];

/* ------------------------------------------------------------------ *
 * 2. Local storage helpers                                            *
 * ------------------------------------------------------------------ */
const LS_PLAYERS_KEY = "undercover.players"; // non-sensitive: only names

function loadStoredPlayers() {
  try {
    const raw = localStorage.getItem(LS_PLAYERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveStoredPlayers(list) {
  try {
    localStorage.setItem(LS_PLAYERS_KEY, JSON.stringify(list));
  } catch {
    /* localStorage may be disabled – silently ignore */
  }
}

/* ------------------------------------------------------------------ *
 * 3. Application state (kept in memory only)                         *
 * ------------------------------------------------------------------ */
const state = {
  players: [],          // [{ name, role, word }]
  distributeIndex: 0,   // current player when handing off
  roundWordPair: null   // [wordA, wordB] chosen for the active round
};

/* ------------------------------------------------------------------ *
 * 4. DOM references                                                   *
 * ------------------------------------------------------------------ */
const dom = {
  views: {
    setup: document.getElementById("view-setup"),
    distribute: document.getElementById("view-distribute"),
    done: document.getElementById("view-done")
  },
  // Setup view
  addPlayerForm: document.getElementById("add-player-form"),
  playerInput: document.getElementById("player-name-input"),
  playerList: document.getElementById("player-list"),
  playerCountHint: document.getElementById("player-count-hint"),
  rolePreview: document.getElementById("role-preview"),
  startRoundBtn: document.getElementById("start-round-btn"),
  setupError: document.getElementById("setup-error"),
  segButtons: document.querySelectorAll(".seg-btn"),
  modeFixed: document.getElementById("mode-fixed"),
  modeRandom: document.getElementById("mode-random"),
  // Fixed mode inputs
  undercoverFixed: document.getElementById("undercover-fixed"),
  mrwhiteFixed: document.getElementById("mrwhite-fixed"),
  // Random mode inputs
  undercoverMin: document.getElementById("undercover-min"),
  undercoverMax: document.getElementById("undercover-max"),
  mrwhiteMin: document.getElementById("mrwhite-min"),
  mrwhiteMax: document.getElementById("mrwhite-max"),
  // Distribute view
  currentPlayerName: document.getElementById("current-player-name"),
  revealBtn: document.getElementById("reveal-role-btn"),
  roleReveal: document.getElementById("role-reveal"),
  roleTag: document.getElementById("role-tag"),
  roleWord: document.getElementById("role-word"),
  roleNote: document.getElementById("role-note"),
  ackBtn: document.getElementById("ack-btn"),
  progressText: document.getElementById("progress-text"),
  // Done view
  restartRoundBtn: document.getElementById("restart-round-btn"),
  backToSetupBtn: document.getElementById("back-to-setup-btn")
};

/* ------------------------------------------------------------------ *
 * 5. View switching                                                   *
 * ------------------------------------------------------------------ */
function showView(name) {
  for (const key of Object.keys(dom.views)) {
    dom.views[key].classList.toggle("is-active", key === name);
  }
  // Always reset scroll on view change
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ------------------------------------------------------------------ *
 * 6. Player list management                                          *
 * ------------------------------------------------------------------ */
function addPlayer(name) {
  const clean = name.trim();
  if (!clean) return false;
  if (state.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
    showError("Dieser Name ist bereits in der Liste.");
    return false;
  }
  state.players.push({ name: clean });
  hideError();
  return true;
}

function removePlayer(name) {
  state.players = state.players.filter((p) => p.name !== name);
  hideError();
}

function renderPlayerList() {
  dom.playerList.innerHTML = "";
  for (const p of state.players) {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = p.name;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-btn";
    btn.setAttribute("aria-label", `Spieler ${p.name} entfernen`);
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      removePlayer(p.name);
      renderPlayerList();
      saveStoredPlayers(state.players.map((x) => x.name));
      refreshSetupState();
    });

    li.appendChild(nameSpan);
    li.appendChild(btn);
    dom.playerList.appendChild(li);
  }
  dom.playerCountHint.textContent =
    state.players.length < 3
      ? "Mindestens 3 Spieler erforderlich."
      : `${state.players.length} Spieler bereit.`;
}

/* ------------------------------------------------------------------ *
 * 7. Role configuration & validation                                 *
 * ------------------------------------------------------------------ */
function getActiveMode() {
  const btn = document.querySelector(".seg-btn.is-active");
  return btn ? btn.dataset.mode : "fixed";
}

function readRoleConfig() {
  // Returns:
  //   { mode, getCount(playersCount) -> {undercover, mrWhite} }
  const mode = getActiveMode();
  if (mode === "fixed") {
    return {
      mode,
      undercover: parseInt(dom.undercoverFixed.value, 10) || 0,
      mrWhite: parseInt(dom.mrwhiteFixed.value, 10) || 0
    };
  }
  return {
    mode,
    undercoverMin: parseInt(dom.undercoverMin.value, 10) || 0,
    undercoverMax: parseInt(dom.undercoverMax.value, 10) || 0,
    mrWhiteMin: parseInt(dom.mrwhiteMin.value, 10) || 0,
    mrWhiteMax: parseInt(dom.mrwhiteMax.value, 10) || 0
  };
}

function pickRandomCount(min, max) {
  // Inclusive random integer in [min, max]; safe for min==max.
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Validate the role config against the current number of players.
 * Returns { ok: true, uc, mw, citizens } or { ok: false, message }.
 */
function validateConfig() {
  const cfg = readRoleConfig();
  const total = state.players.length;

  if (total < 3) {
    return { ok: false, message: "Es werden mindestens 3 Spieler benötigt." };
  }

  let uc, mw;
  if (cfg.mode === "fixed") {
    uc = cfg.undercover;
    mw = cfg.mrWhite;
  } else {
    if (cfg.undercoverMin > cfg.undercoverMax) {
      return { ok: false, message: "Undercover: Minimum darf nicht größer als Maximum sein." };
    }
    if (cfg.mrWhiteMin > cfg.mrWhiteMax) {
      return { ok: false, message: "Mr. White: Minimum darf nicht größer als Maximum sein." };
    }
    if (cfg.undercoverMax + cfg.mrWhiteMax >= total) {
      return {
        ok: false,
        message:
          "Auch im Maximum dürfen höchstens " +
          (total - 2) +
          " Undercover + Mr. White zusammen sein (mind. 2 Bürger)."
      };
    }
    // Pick a random combination within the configured ranges that still
    // leaves >= 2 citizens.
    for (let tries = 0; tries < 30; tries++) {
      uc = pickRandomCount(cfg.undercoverMin, cfg.undercoverMax);
      mw = pickRandomCount(cfg.mrWhiteMin, cfg.mrwhiteMax ?? cfg.mrWhiteMax);
      if (uc + mw <= total - 2) break;
    }
  }

  // Common checks (also apply to fixed mode)
  if (uc < 0 || mw < 0 || isNaN(uc) || isNaN(mw)) {
    return { ok: false, message: "Bitte gültige Zahlen eingeben." };
  }
  if (uc + mw >= total) {
    return {
      ok: false,
      message:
        `Bei ${total} Spielern bleiben nur ${total - (uc + mw)} Bürger übrig. ` +
        `Es müssen mindestens 2 Bürger sein – bitte Undercover und/oder Mr. White reduzieren.`
    };
  }

  return { ok: true, uc, mw, citizens: total - uc - mw };
}

/* ------------------------------------------------------------------ *
 * 8. Setup-view live preview / button enable state                   *
 * ------------------------------------------------------------------ */
function refreshSetupState() {
  const result = validateConfig();
  dom.rolePreview.innerHTML = "";

  if (state.players.length === 0) {
    dom.rolePreview.textContent = "Noch keine Spieler.";
    dom.startRoundBtn.disabled = true;
    return;
  }

  const cfg = readRoleConfig();
  if (cfg.mode === "fixed") {
    if (!result.ok) {
      dom.rolePreview.innerHTML =
        `Vorschau: <strong>Undercover ${cfg.undercover}</strong> · ` +
        `<strong>Mr. White ${cfg.mrWhite}</strong> · ` +
        `Bürger ${Math.max(0, state.players.length - cfg.undercover - cfg.mrWhite)}`;
    } else {
      dom.rolePreview.innerHTML =
        `Vorschau: <strong>Undercover ${result.uc}</strong> · ` +
        `<strong>Mr. White ${result.mw}</strong> · ` +
        `<strong>Bürger ${result.citizens}</strong>`;
    }
  } else {
    dom.rolePreview.innerHTML =
      `Zufallsbereich: Undercover ${cfg.undercoverMin}–${cfg.undercoverMax}, ` +
      `Mr. White ${cfg.mrWhiteMin}–${cfg.mrWhiteMax}. ` +
      `Wird beim Rundenstart ausgelost.`;
  }

  dom.startRoundBtn.disabled = !result.ok;
}

/* ------------------------------------------------------------------ *
 * 9. Error display helpers                                            *
 * ------------------------------------------------------------------ */
function showError(msg) {
  dom.setupError.textContent = msg;
  dom.setupError.hidden = false;
}

function hideError() {
  dom.setupError.hidden = true;
  dom.setupError.textContent = "";
}

/* ------------------------------------------------------------------ *
 * 10. Round start: pick word pair + assign roles                     *
 * ------------------------------------------------------------------ */
function shuffleArray(arr) {
  // Fisher–Yates in-place
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startRound() {
  const result = validateConfig();
  if (!result.ok) {
    showError(result.message);
    return;
  }
  hideError();

  // 1. Pick random word pair (a Bürger sees A, an Undercover sees B)
  const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  state.roundWordPair = pair;

  // 2. Build role pool: uc Undercovers, mw Mr. Whites, rest Bürger
  const rolePool = [];
  for (let i = 0; i < result.uc; i++) rolePool.push("undercover");
  for (let i = 0; i < result.mw; i++) rolePool.push("mrwhite");
  for (let i = 0; i < result.citizens; i++) rolePool.push("citizen");
  shuffleArray(rolePool);

  // 3. Shuffle player names so assignment order isn't tied to input order
  const playerNames = shuffleArray(state.players.map((p) => p.name));

  // 4. Assign roles + words
  state.players = playerNames.map((name, i) => {
    const role = rolePool[i];
    let word = null;
    if (role === "citizen") word = pair[0];
    else if (role === "undercover") word = pair[1];
    // Mr. White gets no word
    return { name, role, word };
  });

  // 5. Begin hand-off sequence
  state.distributeIndex = 0;
  showDistributeStep();
  showView("distribute");
}

/* ------------------------------------------------------------------ *
 * 11. Hand-off / reveal flow                                          *
 * ------------------------------------------------------------------ */
function showDistributeStep() {
  const i = state.distributeIndex;
  const player = state.players[i];
  if (!player) return;

  // Header
  dom.currentPlayerName.textContent = player.name;
  dom.progressText.textContent = `Spieler ${i + 1} von ${state.players.length}`;

  // Reset reveal panel for every new player
  dom.roleReveal.hidden = true;
  dom.roleReveal.classList.remove("is-white", "is-undercover");
  dom.roleTag.textContent = "";
  dom.roleWord.textContent = "";
  dom.roleNote.hidden = true;
  dom.roleNote.textContent = "";

  dom.revealBtn.hidden = false;
}

function revealCurrentRole() {
  const player = state.players[state.distributeIndex];
  if (!player) return;

  dom.revealBtn.hidden = true;
  dom.roleReveal.hidden = false;

  // Configure visual presentation per role
  if (player.role === "mrwhite") {
    dom.roleTag.textContent = "Mr. White";
    dom.roleWord.textContent = "Du bist Mr. White";
    dom.roleReveal.classList.add("is-white");
    dom.roleNote.hidden = false;
    dom.roleNote.textContent =
      "Du hast kein Wort. Versuche, dich unauffällig zu verhalten – oder das geheime Wort der anderen zu erraten.";
  } else if (player.role === "undercover") {
    dom.roleTag.textContent = "Undercover";
    dom.roleWord.textContent = player.word;
    dom.roleReveal.classList.add("is-undercover");
    dom.roleNote.hidden = true;
  } else {
    dom.roleTag.textContent = "Bürger";
    dom.roleWord.textContent = player.word;
    dom.roleNote.hidden = true;
  }
}

function acknowledgeAndAdvance() {
  // Hide the reveal panel and move on to the next player,
  // or finish when the last player has seen their role.
  dom.roleReveal.hidden = true;
  dom.roleReveal.classList.remove("is-white", "is-undercover");
  state.distributeIndex += 1;

  if (state.distributeIndex >= state.players.length) {
    // Done: forget the in-memory role/word assignments immediately.
    // (We just leave them in state for one final screen render.)
    showView("done");
    // Wipe sensitive state right away
    state.roundWordPair = null;
  } else {
    showDistributeStep();
  }
}

/* ------------------------------------------------------------------ *
 * 12. Event wiring                                                    *
 * ------------------------------------------------------------------ */
function wireEvents() {
  // Add player form
  dom.addPlayerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = dom.playerInput.value;
    if (addPlayer(value)) {
      dom.playerInput.value = "";
      dom.playerInput.focus();
      renderPlayerList();
      saveStoredPlayers(state.players.map((p) => p.name));
      refreshSetupState();
    }
  });

  // Segmented control – mode switch
  dom.segButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.segButtons.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      const mode = btn.dataset.mode;
      dom.modeFixed.hidden = mode !== "fixed";
      dom.modeRandom.hidden = mode !== "random";
      refreshSetupState();
    });
  });

  // Live re-validation when role inputs change
  [
    dom.undercoverFixed, dom.mrwhiteFixed,
    dom.undercoverMin, dom.undercoverMax,
    dom.mrwhiteMin, dom.mrwhiteMax
  ].forEach((inp) => {
    inp.addEventListener("input", () => {
      hideError();
      refreshSetupState();
    });
  });

  // Start round
  dom.startRoundBtn.addEventListener("click", startRound);

  // Reveal flow
  dom.revealBtn.addEventListener("click", revealCurrentRole);
  dom.ackBtn.addEventListener("click", acknowledgeAndAdvance);

  // Done view
  dom.restartRoundBtn.addEventListener("click", startRound);
  dom.backToSetupBtn.addEventListener("click", () => {
    // Drop sensitive state before returning to setup
    state.players = [];
    state.distributeIndex = 0;
    state.roundWordPair = null;
    renderPlayerList();
    refreshSetupState();
    showView("setup");
  });
}

/* ------------------------------------------------------------------ *
 * 13. Service Worker registration                                     *
 * ------------------------------------------------------------------ */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Register relative to this document so it works from any path.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.warn("Service Worker registration failed:", err));
  });
}

/* ------------------------------------------------------------------ *
 * 14. Bootstrap                                                       *
 * ------------------------------------------------------------------ */
function init() {
  // Restore previously saved player names for convenience.
  const stored = loadStoredPlayers();
  state.players = stored.map((name) => ({ name }));
  renderPlayerList();
  refreshSetupState();
  wireEvents();
  registerServiceWorker();
  showView("setup");
}

document.addEventListener("DOMContentLoaded", init);
