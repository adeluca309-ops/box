/**
 * BOX — MVP (no wallet)
 * - 1 vote per device (localStorage)
 * - Total lock after vote
 * - Countdown 24h from publish
 * - Auto-settle: majority (tie -> ALIVE)
 * - Leaderboard: latest 12 votes (local)
 */

// ====== CONFIG ======
// Set this to the exact time you publish (UTC recommended).
const PUBLISH_TIME_ISO = "2026-02-05T18:00:00Z"; // <-- CHANGE THIS
const ROUND_HOURS = 24;

// Change this to reset for everyone locally (new "season")
const STORAGE_KEY = "box_mvp_clean_v1";
// =====================

const $ = (id) => document.getElementById(id);

const aliveBtn = $("aliveBtn");
const deadBtn = $("deadBtn");
const postVote = $("postVote");
const errorEl = $("error");

const roundState = $("roundState");
const statusDot = $("statusDot");
const statusText = $("statusText");
const outcomeText = $("outcomeText");
const outcomeLine = $("outcomeLine");

const countdownEl = $("countdown");
const roundInfoEl = $("roundInfo");

const totalVotesEl = $("totalVotes");
const alivePctEl = $("alivePct");
const deadPctEl = $("deadPct");
const aliveBar = $("aliveBar");
const deadBar = $("deadBar");

const leaderboardEl = $("leaderboard");

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { votes: [], voted: false, settled: false, outcome: null };
  try {
    const s = JSON.parse(raw);
    if (!Array.isArray(s.votes)) s.votes = [];
    if (typeof s.voted !== "boolean") s.voted = false;
    if (typeof s.settled !== "boolean") s.settled = false;
    if (!("outcome" in s)) s.outcome = null;
    return s;
  } catch {
    return { votes: [], voted: false, settled: false, outcome: null };
  }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function setError(msg) {
  if (!msg) {
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    return;
  }
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function computeTotals(votes) {
  const alive = votes.filter(v => v.side === "ALIVE").length;
  const dead = votes.filter(v => v.side === "DEAD").length;
  return { alive, dead, total: alive + dead };
}

function pickOutcome(alive, dead) {
  return alive >= dead ? "ALIVE" : "DEAD";
}

function shortId(len = 10) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const publishMs = new Date(PUBLISH_TIME_ISO).getTime();
const endMs = publishMs + ROUND_HOURS * 60 * 60 * 1000;

function isOpen(nowMs) {
  return nowMs < endMs;
}

function formatCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function render() {
  const now = Date.now();
  const state = loadState();
  const open = isOpen(now);

  // Round info line
  const endDate = new Date(endMs);
  roundInfoEl.textContent = `Round ends: ${endDate.toUTCString().replace("GMT","UTC")}`;

  // Auto-settle
  if (!open && !state.settled) {
    const totals = computeTotals(state.votes);
    state.outcome = pickOutcome(totals.alive, totals.dead);
    state.settled = true;
    saveState(state);
  }

  // Status
  if (open) {
    roundState.textContent = "Round open";
    statusText.textContent = "OPEN";
    statusDot.className = "dot dotOpen";
    outcomeText.textContent = "UNKNOWN (box closed)";
    outcomeLine.classList.add("hidden");
  } else {
    roundState.textContent = "Round settled";
    statusText.textContent = "SETTLED";
    statusDot.className = "dot dotSet";
    outcomeText.textContent = state.outcome ?? "UNKNOWN";
    outcomeLine.classList.remove("hidden");
    outcomeLine.textContent = `Box opened. Outcome: ${state.outcome ?? "UNKNOWN"}`;
  }

  // Countdown
  const diff = endMs - now;
  if (diff <= 0) {
    countdownEl.textContent = `BOX OPENED: ${state.outcome ?? "UNKNOWN"}`;
  } else {
    countdownEl.textContent = `BOX OPENS IN ${formatCountdown(diff)}`;
  }

  // Vote lock
  const canVote = open && !state.voted;
  aliveBtn.disabled = !canVote;
  deadBtn.disabled = !canVote;

  if (state.voted) postVote.classList.remove("hidden");
  else postVote.classList.add("hidden");

  // Stats
  const totals = computeTotals(state.votes);
  totalVotesEl.textContent = totals.total;

  const alivePct = totals.total ? Math.round((totals.alive / totals.total) * 100) : 0;
  const deadPct = totals.total ? 100 - alivePct : 0;

  alivePctEl.textContent = `${alivePct}%`;
  deadPctEl.textContent = `${deadPct}%`;

  aliveBar.style.width = `${alivePct}%`;
  deadBar.style.width = `${deadPct}%`;

  // Leaderboard (latest 12)
  if (state.votes.length === 0) {
    leaderboardEl.classList.add("muted");
    leaderboardEl.textContent = "No votes yet.";
  } else {
    leaderboardEl.classList.remove("muted");
    const latest = [...state.votes].sort((a,b) => b.ts - a.ts).slice(0, 12);
    leaderboardEl.innerHTML = latest.map(v => {
      const cls = v.side === "ALIVE" ? "sideAlive" : "sideDead";
      return `
        <div class="row">
          <div class="mono">${v.id}</div>
          <div class="${cls}">${v.side}</div>
        </div>
      `;
    }).join("");
  }
}

function vote(side) {
  setError(null);
  const now = Date.now();
  const state = loadState();

  if (!isOpen(now)) {
    setError("Box is opening. Voting closed.");
    return;
  }
  if (state.voted) {
    setError("You already observed the box.");
    return;
  }

  state.votes.push({ id: shortId(10), side, ts: now });
  state.voted = true;
  saveState(state);
  render();
}

aliveBtn.addEventListener("click", () => vote("ALIVE"));
deadBtn.addEventListener("click", () => vote("DEAD"));

render();
setInterval(render, 1000);
