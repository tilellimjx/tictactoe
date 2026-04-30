/* Tic Tac Toe v2 — game logic, AI, score persistence, undo, audio, themes, stats.
 *
 * Vanilla ES6+; no build step. Loaded as a plain <script> in index.html.
 * Safe to require() from Jest (jsdom): UI startup is gated by DOMContentLoaded.
 *
 * The three NEW V2 features (per requirements §2.4):
 *   1. FR-W20 — Move History with Undo
 *   2. FR-W21 — Sound Effects with Mute Toggle
 *   3. FR-W22 — In-Game Stats Dashboard (win-rate, streaks, head-to-head)
 *
 * The three carried-over themes (Beach, Mountains, Desert — FR-W02) are
 * NOT counted as a "new" feature; they replace the v1 console UI's flat look.
 */

'use strict';

/* ============================================================
 * Constants
 * ============================================================ */
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // cols
  [0, 4, 8], [2, 4, 6]               // diagonals
];

const RESERVED_NAMES = ['ai', 'computer', 'ai (easy)', 'ai (medium)', 'ai (hard)'];
const NAME_REGEX = /^[A-Za-z0-9 _-]{1,20}$/;

const STORAGE_KEYS = {
  scores: 'tictactoe.scores.v2',
  scoresBackup: 'tictactoe.scores.v2.bak',
  theme: 'tictactoe.theme',
  muted: 'tictactoe.muted'
};

const SCHEMA_VERSION = 2;
const RECENT_OUTCOMES_CAP = 100;

const VALID_THEMES = ['beach', 'mountains', 'desert'];
const DEFAULT_THEME = 'beach';

/* ============================================================
 * Seedable RNG (mulberry32)
 * ============================================================ */
function createRng(seed) {
  if (seed === undefined || seed === null) {
    return Math.random;
  }
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
 * Board class — pure logic, no DOM
 * ============================================================ */
class Board {
  constructor(cells) {
    this.cells = cells ? cells.slice() : Array(9).fill(null);
  }

  clone() {
    return new Board(this.cells);
  }

  isValidMove(index) {
    return Number.isInteger(index) && index >= 0 && index < 9 && this.cells[index] === null;
  }

  applyMove(index, symbol) {
    if (!this.isValidMove(index)) return false;
    if (symbol !== 'X' && symbol !== 'O') return false;
    this.cells[index] = symbol;
    return true;
  }

  undoMove(index) {
    if (!Number.isInteger(index) || index < 0 || index >= 9) return false;
    this.cells[index] = null;
    return true;
  }

  emptyCells() {
    const result = [];
    for (let i = 0; i < 9; i++) {
      if (this.cells[i] === null) result.push(i);
    }
    return result;
  }

  isFull() {
    return this.cells.every(c => c !== null);
  }

  /** Returns { winner: 'X'|'O', line: [a,b,c] } or null. */
  checkWinner() {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      const v = this.cells[a];
      if (v && v === this.cells[b] && v === this.cells[c]) {
        return { winner: v, line };
      }
    }
    return null;
  }

  /** Outcome string: 'X', 'O', 'draw', or null (still playing). */
  getOutcome() {
    const w = this.checkWinner();
    if (w) return w.winner;
    if (this.isFull()) return 'draw';
    return null;
  }
}

/* ============================================================
 * AI strategies — Easy, Medium, Hard (Minimax)
 * ============================================================ */
const AI = {
  /** Easy: random over empty cells. */
  easy(board, _aiSymbol, rng) {
    const empties = board.emptyCells();
    if (empties.length === 0) return -1;
    const r = rng ? rng() : Math.random();
    return empties[Math.floor(r * empties.length)];
  },

  /** Medium: win > block > centre > opposite-corner > empty corner > random. */
  medium(board, aiSymbol, rng) {
    const opp = aiSymbol === 'X' ? 'O' : 'X';
    const empties = board.emptyCells();
    if (empties.length === 0) return -1;

    // 1. Win
    for (const i of empties) {
      const b = board.clone(); b.applyMove(i, aiSymbol);
      if (b.checkWinner()) return i;
    }
    // 2. Block
    for (const i of empties) {
      const b = board.clone(); b.applyMove(i, opp);
      if (b.checkWinner()) return i;
    }
    // 3. Centre
    if (board.cells[4] === null) return 4;
    // 4. Opposite corner
    const oppositeCorner = { 0: 8, 2: 6, 6: 2, 8: 0 };
    for (const c of [0, 2, 6, 8]) {
      if (board.cells[c] === opp && board.cells[oppositeCorner[c]] === null) {
        return oppositeCorner[c];
      }
    }
    // 5. Empty corner
    const corners = [0, 2, 6, 8].filter(c => board.cells[c] === null);
    if (corners.length > 0) return corners[0];
    // 6. Random
    const r = rng ? rng() : Math.random();
    return empties[Math.floor(r * empties.length)];
  },

  /** Hard: minimax with alpha-beta pruning and depth-aware scoring. */
  hard(board, aiSymbol) {
    const opp = aiSymbol === 'X' ? 'O' : 'X';

    function minimax(b, isMax, depth, alpha, beta) {
      const w = b.checkWinner();
      if (w) {
        if (w.winner === aiSymbol) return 10 - depth;
        return depth - 10;
      }
      if (b.isFull()) return 0;

      const empties = b.emptyCells();
      if (isMax) {
        let best = -Infinity;
        for (const i of empties) {
          b.cells[i] = aiSymbol;
          const v = minimax(b, false, depth + 1, alpha, beta);
          b.cells[i] = null;
          if (v > best) best = v;
          if (best > alpha) alpha = best;
          if (beta <= alpha) break;
        }
        return best;
      } else {
        let best = Infinity;
        for (const i of empties) {
          b.cells[i] = opp;
          const v = minimax(b, true, depth + 1, alpha, beta);
          b.cells[i] = null;
          if (v < best) best = v;
          if (best < beta) beta = best;
          if (beta <= alpha) break;
        }
        return best;
      }
    }

    const empties = board.emptyCells();
    if (empties.length === 0) return -1;

    // Work on a clone so we never mutate the input.
    const work = board.clone();
    let bestScore = -Infinity;
    let bestMove = empties[0];
    for (const i of empties) {
      work.cells[i] = aiSymbol;
      const score = minimax(work, false, 1, -Infinity, Infinity);
      work.cells[i] = null;
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
      // Tie-break: lowest index wins because we don't replace on equality.
    }
    return bestMove;
  },

  pick(difficulty, board, aiSymbol, rng) {
    switch (difficulty) {
      case 'easy': return AI.easy(board, aiSymbol, rng);
      case 'medium': return AI.medium(board, aiSymbol, rng);
      case 'hard': return AI.hard(board, aiSymbol);
      default: return AI.easy(board, aiSymbol, rng);
    }
  }
};

/* ============================================================
 * Score Manager — localStorage-backed persistence.
 *
 * Schema v2 extends the v1 flat-counter store with per-player
 * recent_outcomes / current_streak / best_streak fields and a
 * top-level head_to_head map (TR-005 / FR-W22).
 * ============================================================ */
class ScoreManager {
  constructor(storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.fallback = false;
    this.data = this._loadOrInit();
  }

  _emptyStore() {
    return { schema_version: SCHEMA_VERSION, players: {}, head_to_head: {} };
  }

  _isValid(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.schema_version !== 'number') return false;
    if (!obj.players || typeof obj.players !== 'object') return false;
    for (const key of Object.keys(obj.players)) {
      const p = obj.players[key];
      if (!p || typeof p !== 'object') return false;
      if (typeof p.display_name !== 'string') return false;
      for (const f of ['wins', 'losses', 'draws']) {
        if (typeof p[f] !== 'number' || p[f] < 0 || !Number.isFinite(p[f])) return false;
      }
    }
    return true;
  }

  _migrate(obj) {
    // v1 → v2 migration: fill in missing streak / head-to-head fields.
    if (!obj || typeof obj !== 'object') return obj;
    if (!obj.head_to_head || typeof obj.head_to_head !== 'object') {
      obj.head_to_head = {};
    }
    if (obj.players && typeof obj.players === 'object') {
      for (const key of Object.keys(obj.players)) {
        const p = obj.players[key];
        if (!p) continue;
        if (!Array.isArray(p.recent_outcomes)) p.recent_outcomes = [];
        if (!p.current_streak || typeof p.current_streak !== 'object') {
          p.current_streak = { type: null, count: 0 };
        }
        if (typeof p.best_streak !== 'number') p.best_streak = 0;
      }
    }
    obj.schema_version = SCHEMA_VERSION;
    return obj;
  }

  _loadOrInit() {
    if (!this.storage) {
      this.fallback = true;
      return this._emptyStore();
    }
    let raw;
    try {
      raw = this.storage.getItem(STORAGE_KEYS.scores);
    } catch (_) {
      this.fallback = true;
      return this._emptyStore();
    }
    if (raw === null || raw === undefined) {
      return this._emptyStore();
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      try { this.storage.setItem(STORAGE_KEYS.scoresBackup, raw); } catch (_) {}
      return this._emptyStore();
    }
    if (!this._isValid(parsed)) {
      try { this.storage.setItem(STORAGE_KEYS.scoresBackup, raw); } catch (_) {}
      return this._emptyStore();
    }
    // Valid base — migrate forward to fill any missing v2 fields.
    const migrated = this._migrate(parsed);
    // Persist the migration so subsequent loads are clean.
    try { this.storage.setItem(STORAGE_KEYS.scores, JSON.stringify(migrated)); } catch (_) {}
    return migrated;
  }

  _save() {
    if (!this.storage || this.fallback) return;
    try {
      this.storage.setItem(STORAGE_KEYS.scores, JSON.stringify(this.data));
    } catch (_) {
      this.fallback = true;
    }
  }

  _key(name) {
    return String(name || '').trim().toLowerCase();
  }

  _ensurePlayer(name) {
    const key = this._key(name);
    if (!this.data.players[key]) {
      this.data.players[key] = {
        display_name: name,
        wins: 0,
        losses: 0,
        draws: 0,
        recent_outcomes: [],
        current_streak: { type: null, count: 0 },
        best_streak: 0
      };
    }
    return this.data.players[key];
  }

  _appendOutcome(player, code) {
    if (!Array.isArray(player.recent_outcomes)) player.recent_outcomes = [];
    player.recent_outcomes.push(code);
    if (player.recent_outcomes.length > RECENT_OUTCOMES_CAP) {
      player.recent_outcomes.splice(0, player.recent_outcomes.length - RECENT_OUTCOMES_CAP);
    }
    if (!player.current_streak) player.current_streak = { type: null, count: 0 };
    if (player.current_streak.type === code) {
      player.current_streak.count += 1;
    } else {
      player.current_streak = { type: code, count: 1 };
    }
    if (code === 'W') {
      if (typeof player.best_streak !== 'number') player.best_streak = 0;
      if (player.current_streak.count > player.best_streak) {
        player.best_streak = player.current_streak.count;
      }
    }
  }

  _h2hKey(a, b) {
    const ka = this._key(a);
    const kb = this._key(b);
    return [ka, kb].sort().join('|');
  }

  _ensureH2H(a, b) {
    if (!this.data.head_to_head) this.data.head_to_head = {};
    const ka = this._key(a);
    const kb = this._key(b);
    const [first, second] = [ka, kb].sort();
    const key = `${first}|${second}`;
    if (!this.data.head_to_head[key]) {
      this.data.head_to_head[key] = {
        a: first, b: second,
        a_wins: 0, b_wins: 0, draws: 0
      };
    }
    return this.data.head_to_head[key];
  }

  recordWin(winner, loser) {
    const w = this._ensurePlayer(winner);
    const l = this._ensurePlayer(loser);
    w.wins += 1;
    l.losses += 1;
    this._appendOutcome(w, 'W');
    this._appendOutcome(l, 'L');
    const h2h = this._ensureH2H(winner, loser);
    if (h2h.a === this._key(winner)) h2h.a_wins += 1;
    else h2h.b_wins += 1;
    this._save();
  }

  recordDraw(p1, p2) {
    const a = this._ensurePlayer(p1);
    const b = this._ensurePlayer(p2);
    a.draws += 1;
    b.draws += 1;
    this._appendOutcome(a, 'D');
    this._appendOutcome(b, 'D');
    const h2h = this._ensureH2H(p1, p2);
    h2h.draws += 1;
    this._save();
  }

  getPlayer(name) {
    return this.data.players[this._key(name)] || null;
  }

  getAll() {
    return JSON.parse(JSON.stringify(this.data));
  }

  reset() {
    if (this.storage && !this.fallback) {
      try {
        const current = this.storage.getItem(STORAGE_KEYS.scores);
        if (current) this.storage.setItem(STORAGE_KEYS.scoresBackup, current);
      } catch (_) {}
    }
    this.data = this._emptyStore();
    this._save();
  }

  topPlayer() {
    const keys = Object.keys(this.data.players);
    if (keys.length === 0) return null;
    keys.sort((a, b) => {
      const pa = this.data.players[a];
      const pb = this.data.players[b];
      if (pb.wins !== pa.wins) return pb.wins - pa.wins;
      if (pa.losses !== pb.losses) return pa.losses - pb.losses;
      return pa.display_name.localeCompare(pb.display_name);
    });
    return this.data.players[keys[0]];
  }
}

/* ============================================================
 * Stats Dashboard helpers (FR-W22)
 *
 * Pure functions over a ScoreManager-shaped payload — no DOM.
 * ============================================================ */
const Stats = {
  /** Per-player overview rows including win-rate %. */
  perPlayerRows(data) {
    if (!data || !data.players) return [];
    return Object.keys(data.players).map(key => {
      const p = data.players[key];
      const total = (p.wins || 0) + (p.losses || 0) + (p.draws || 0);
      const winRate = total === 0 ? 0 : (p.wins / total) * 100;
      return {
        key,
        display_name: p.display_name,
        wins: p.wins || 0,
        losses: p.losses || 0,
        draws: p.draws || 0,
        played: total,
        win_rate: winRate,
        current_streak: p.current_streak || { type: null, count: 0 },
        best_streak: p.best_streak || 0
      };
    });
  },

  /** Compute current streak from a recent_outcomes-style array. */
  computeCurrentStreak(outcomes) {
    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      return { type: null, count: 0 };
    }
    const last = outcomes[outcomes.length - 1];
    let count = 0;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      if (outcomes[i] === last) count += 1;
      else break;
    }
    return { type: last, count };
  },

  /** Compute best (longest) historical winning streak from outcomes. */
  computeBestWinStreak(outcomes) {
    if (!Array.isArray(outcomes)) return 0;
    let best = 0, run = 0;
    for (const c of outcomes) {
      if (c === 'W') { run += 1; if (run > best) best = run; }
      else run = 0;
    }
    return best;
  },

  /** Format a streak object as e.g. "W3" / "L2" / "D1" / "—". */
  formatStreak(streak) {
    if (!streak || !streak.type || !streak.count) return '—';
    return `${streak.type}${streak.count}`;
  },

  /** Format a win rate; 0 games → "—". */
  formatWinRate(played, winRate) {
    if (!played) return '—';
    return `${winRate.toFixed(1)}%`;
  },

  /** Aggregate: total rounds played all-time, total draws. */
  aggregateRounds(data) {
    if (!data || !data.players) return { totalRounds: 0, totalDraws: 0 };
    let wins = 0, draws = 0;
    for (const key of Object.keys(data.players)) {
      const p = data.players[key];
      wins += (p.wins || 0);
      draws += (p.draws || 0);
    }
    // Each round has exactly one winner OR is a draw counted on both players,
    // so totalRounds = sum(wins) + sum(draws)/2.
    return {
      totalRounds: wins + Math.floor(draws / 2),
      totalDraws: Math.floor(draws / 2)
    };
  },

  /** Head-to-head rows from a head_to_head map. */
  headToHeadRows(data) {
    if (!data || !data.head_to_head) return [];
    const rows = [];
    const players = (data && data.players) || {};
    for (const key of Object.keys(data.head_to_head)) {
      const r = data.head_to_head[key];
      const aName = (players[r.a] && players[r.a].display_name) || r.a;
      const bName = (players[r.b] && players[r.b].display_name) || r.b;
      rows.push({
        key, a_key: r.a, b_key: r.b,
        a_name: aName, b_name: bName,
        a_wins: r.a_wins || 0,
        b_wins: r.b_wins || 0,
        draws: r.draws || 0
      });
    }
    return rows;
  },

  /** Sort overview rows by a column key, ascending or descending. */
  sortRows(rows, column, asc) {
    const dir = asc ? 1 : -1;
    const out = rows.slice();
    out.sort((x, y) => {
      let xv = x[column];
      let yv = y[column];
      if (xv == null) xv = '';
      if (yv == null) yv = '';
      if (typeof xv === 'string' && typeof yv === 'string') {
        return xv.localeCompare(yv) * dir;
      }
      return (xv - yv) * dir;
    });
    return out;
  }
};

/* ============================================================
 * Move history — undo (FR-W20)
 * ============================================================ */
class HistoryManager {
  constructor() {
    this.undoStack = []; // entries: { index, symbol, player, timestamp }
  }
  push(move) {
    this.undoStack.push(move);
  }
  canUndo() { return this.undoStack.length > 0; }
  undo() {
    if (!this.canUndo()) return null;
    return this.undoStack.pop();
  }
  size() { return this.undoStack.length; }
  clear() { this.undoStack.length = 0; }
  toArray() { return this.undoStack.slice(); }
}

/* ============================================================
 * Theme manager (FR-W02)
 * ============================================================ */
const ThemeManager = {
  apply(theme, doc, linkEl, storage) {
    const t = VALID_THEMES.includes(theme) ? theme : DEFAULT_THEME;
    if (doc && doc.documentElement) {
      doc.documentElement.setAttribute('data-theme', t);
    }
    if (doc && doc.body) {
      doc.body.setAttribute('data-theme', t);
    }
    if (linkEl) {
      linkEl.setAttribute('href', `themes/${t}.css`);
    }
    if (storage) {
      try { storage.setItem(STORAGE_KEYS.theme, t); } catch (_) {}
    }
    return t;
  },

  load(storage) {
    if (!storage) return DEFAULT_THEME;
    let v = null;
    try { v = storage.getItem(STORAGE_KEYS.theme); } catch (_) { return DEFAULT_THEME; }
    return VALID_THEMES.includes(v) ? v : DEFAULT_THEME;
  }
};

/* ============================================================
 * Audio manager (FR-W21) — procedural Web Audio; mute persisted
 * ============================================================ */
class AudioManager {
  constructor(storage) {
    this.storage = storage;
    // Default = muted on first run (per FR-W21).
    this.muted = true;
    this.firstGesture = false;
    this.ctx = null;
    if (storage) {
      try {
        const v = storage.getItem(STORAGE_KEYS.muted);
        if (v === 'false') this.muted = false;
        else if (v === 'true') this.muted = true;
      } catch (_) {}
    }
    this.available = typeof globalThis !== 'undefined' &&
      (typeof globalThis.AudioContext !== 'undefined' ||
        typeof globalThis.webkitAudioContext !== 'undefined');
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.storage) {
      try { this.storage.setItem(STORAGE_KEYS.muted, String(this.muted)); } catch (_) {}
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  notifyUserGesture() {
    this.firstGesture = true;
    this._ensureCtx();
  }

  _ensureCtx() {
    if (!this.available || this.ctx) return;
    try {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new Ctor();
    } catch (_) {
      this.available = false;
    }
  }

  _tone(freq, duration, type) {
    if (this.muted || !this.available || !this.firstGesture) return;
    this._ensureCtx();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.02);
    } catch (e) {
      console.error('audio playback error:', e);
    }
  }

  playMove(symbol) { this._tone(symbol === 'X' ? 660 : 440, 0.12, 'sine'); }
  playWin() { this._tone(880, 0.4, 'triangle'); }
  playDraw() { this._tone(330, 0.4, 'sine'); }
  playInvalid() { this._tone(120, 0.12, 'square'); }
  playThemeChange() { this._tone(550, 0.15, 'sine'); }
}

/* ============================================================
 * Name validation / sanitisation
 * ============================================================ */
function sanitizeName(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

function validateName(name) {
  const trimmed = sanitizeName(name);
  if (trimmed.length === 0) return { ok: false, error: 'Name cannot be empty.' };
  if (trimmed.length > 20) return { ok: false, error: 'Name must be at most 20 characters.' };
  if (!NAME_REGEX.test(trimmed)) return { ok: false, error: 'Only letters, digits, spaces, hyphens, and underscores are allowed.' };
  if (RESERVED_NAMES.includes(trimmed.toLowerCase())) {
    return { ok: false, error: 'That name is reserved. Please choose another.' };
  }
  return { ok: true, value: trimmed };
}

/* ============================================================
 * Game controller — orchestrates a round
 * ============================================================ */
class GameController {
  constructor(opts) {
    opts = opts || {};
    this.scoreManager = opts.scoreManager || new ScoreManager(opts.storage);
    this.history = new HistoryManager();
    this.board = new Board();
    this.mode = 'hvh';            // 'hvh' or 'hvai'
    this.difficulty = 'easy';
    this.p1 = 'Player 1';
    this.p2 = 'Player 2';
    this.firstPlayer = 1;          // 1 or 2 — moves first this round (plays X)
    this.currentPlayer = 1;
    this.symbols = { 1: 'X', 2: 'O' };
    this.roundOver = false;
    this.movesPlayed = 0;
    this.rng = opts.rng || Math.random;
  }

  configure({ mode, difficulty, p1, p2 }) {
    this.mode = mode === 'hvai' ? 'hvai' : 'hvh';
    this.difficulty = difficulty || 'easy';
    this.p1 = p1 || 'Player 1';
    if (this.mode === 'hvai') {
      this.p2 = `AI (${this.difficulty.charAt(0).toUpperCase()}${this.difficulty.slice(1)})`;
    } else {
      this.p2 = p2 || 'Player 2';
    }
    this.firstPlayer = 1;
    this.startRound();
  }

  startRound() {
    this.board = new Board();
    this.history.clear();
    this.roundOver = false;
    this.movesPlayed = 0;
    this.currentPlayer = this.firstPlayer;
    // Symbols: whoever starts plays X.
    this.symbols = this.firstPlayer === 1
      ? { 1: 'X', 2: 'O' }
      : { 1: 'O', 2: 'X' };
  }

  rotateFirstPlayer() {
    this.firstPlayer = this.firstPlayer === 1 ? 2 : 1;
  }

  currentPlayerName() {
    return this.currentPlayer === 1 ? this.p1 : this.p2;
  }

  currentSymbol() {
    return this.symbols[this.currentPlayer];
  }

  isAITurn() {
    return this.mode === 'hvai' && this.currentPlayer === 2;
  }

  /** Apply a move for the current player. Returns { ok, outcome|reason }. */
  applyMove(index) {
    if (this.roundOver) return { ok: false, reason: 'round-over' };
    const symbol = this.currentSymbol();
    if (!this.board.applyMove(index, symbol)) {
      return { ok: false, reason: 'invalid' };
    }
    this.history.push({
      index, symbol,
      player: this.currentPlayer,
      playerName: this.currentPlayerName(),
      timestamp: Date.now()
    });
    this.movesPlayed += 1;
    const outcome = this.board.getOutcome();
    if (outcome) {
      this.roundOver = true;
      this._recordOutcome(outcome);
      return { ok: true, outcome };
    }
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    return { ok: true, outcome: null };
  }

  aiMove() {
    if (!this.isAITurn() || this.roundOver) return null;
    const sym = this.currentSymbol();
    const idx = AI.pick(this.difficulty, this.board, sym, this.rng);
    if (idx < 0) return null;
    return { index: idx, result: this.applyMove(idx) };
  }

  /**
   * FR-W20 Undo:
   *   - HvH mode: revert exactly one move.
   *   - HvAI mode: revert two moves (the AI's last move + the human's preceding move),
   *     so the human is returned to their decision point.
   *   - Disabled when history is empty or the round is over.
   */
  undo() {
    if (this.roundOver) return false;
    if (!this.history.canUndo()) return false;
    let undone = 0;
    const reverts = this.mode === 'hvai' ? 2 : 1;
    for (let i = 0; i < reverts; i++) {
      if (!this.history.canUndo()) break;
      const move = this.history.undo();
      this.board.undoMove(move.index);
      this.currentPlayer = move.player;
      this.movesPlayed -= 1;
      undone += 1;
    }
    return undone > 0;
  }

  _recordOutcome(outcome) {
    if (outcome === 'draw') {
      this.scoreManager.recordDraw(this.p1, this.p2);
      return;
    }
    // outcome is 'X' or 'O' — figure out which player owns it.
    const winningPlayer = this.symbols[1] === outcome ? 1 : 2;
    const winnerName = winningPlayer === 1 ? this.p1 : this.p2;
    const loserName = winningPlayer === 1 ? this.p2 : this.p1;
    this.scoreManager.recordWin(winnerName, loserName);
  }

  startNextRound() {
    this.rotateFirstPlayer();
    this.startRound();
  }

  forfeit() {
    // Forfeits are NOT recorded; just reset round state.
    this.roundOver = true;
  }
}

/* ============================================================
 * UI Controller — DOM glue. Only constructed at DOMContentLoaded.
 * ============================================================ */
class UIController {
  constructor(doc) {
    this.doc = doc;
    this.storage = (typeof localStorage !== 'undefined') ? localStorage : null;
    this.scoreManager = new ScoreManager(this.storage);
    this.audio = new AudioManager(this.storage);
    this.controller = new GameController({ scoreManager: this.scoreManager });
    this.themeLink = doc.getElementById('theme-link');
    this.roundStart = 0;
    this.statsSort = { column: 'wins', asc: false };
    this._wire();
    this._initTheme();
    this._renderTopPlayer();
    this._renderMute();
  }

  _initTheme() {
    const t = ThemeManager.load(this.storage);
    ThemeManager.apply(t, this.doc, this.themeLink, this.storage);
    this._highlightThemeBtn(t);
  }

  _highlightThemeBtn(theme) {
    const btns = this.doc.querySelectorAll('.theme-btn');
    btns.forEach(b => {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-choice') === theme ? 'true' : 'false');
    });
  }

  _renderMute() {
    const btn = this.doc.getElementById('mute-btn');
    if (!btn) return;
    btn.textContent = this.audio.muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', this.audio.muted ? 'Unmute sound effects' : 'Mute sound effects');
  }

  _wire() {
    const $ = id => this.doc.getElementById(id);

    // First-gesture audio init
    this.doc.addEventListener('click', () => this.audio.notifyUserGesture(), { once: true });
    this.doc.addEventListener('keydown', () => this.audio.notifyUserGesture(), { once: true });

    // Theme buttons
    this.doc.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-theme-choice');
        ThemeManager.apply(t, this.doc, this.themeLink, this.storage);
        this._highlightThemeBtn(t);
        this.audio.playThemeChange();
      });
    });

    // Mute toggle
    const muteBtn = $('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.audio.toggleMuted();
        this._renderMute();
      });
    }

    // Menu
    $('btn-hvh').addEventListener('click', () => { this.pendingMode = 'hvh'; this._show('view-names'); this._renderNames(); });
    $('btn-hvai').addEventListener('click', () => { this.pendingMode = 'hvai'; this._show('view-difficulty'); });
    $('btn-stats').addEventListener('click', () => { this._renderStats(); this._show('view-stats'); });
    $('btn-reset').addEventListener('click', () => this._confirmReset());
    $('btn-help').addEventListener('click', () => this._show('view-help'));

    // Difficulty
    this.doc.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.pendingDifficulty = btn.getAttribute('data-difficulty');
        this._show('view-names');
        this._renderNames();
      });
    });
    $('diff-back').addEventListener('click', () => this._show('view-menu'));

    // Names form
    $('names-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this._submitNames();
    });
    $('names-back').addEventListener('click', () => this._show('view-menu'));

    // Game
    this.doc.querySelectorAll('.cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.getAttribute('data-index'), 10);
        this._humanCellClick(idx);
      });
    });

    $('btn-undo').addEventListener('click', () => this._handleUndo());
    $('btn-forfeit').addEventListener('click', () => this._confirmForfeit());
    $('btn-menu').addEventListener('click', () => this._show('view-menu'));

    // End-of-round panel
    $('btn-play-again').addEventListener('click', () => this._playAgain());
    $('btn-end-menu').addEventListener('click', () => this._show('view-menu'));
    $('btn-end-stats').addEventListener('click', () => { this._renderStats(); this._show('view-stats'); });

    // Stats / help back
    $('stats-back').addEventListener('click', () => this._show('view-menu'));
    $('help-back').addEventListener('click', () => this._show('view-menu'));

    // Modal
    $('modal-no').addEventListener('click', () => this._hideModal());

    // Keyboard shortcuts
    this.doc.addEventListener('keydown', (e) => {
      const gameView = this.doc.getElementById('view-game');
      if (gameView && !gameView.classList.contains('hidden')) {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && e.key && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          this._handleUndo();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this._confirmForfeit();
        } else if (e.key && /^[1-9]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          this._humanCellClick(idx);
        }
      }
    });

    // Persist on unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        // ScoreManager._save is called after each round; this is just a safety net.
        try { this.scoreManager._save(); } catch (_) {}
      });
    }
  }

  _renderNames() {
    const p2Row = this.doc.getElementById('p2-row');
    if (this.pendingMode === 'hvai') {
      p2Row.classList.add('hidden');
    } else {
      p2Row.classList.remove('hidden');
    }
  }

  _submitNames() {
    const p1Input = this.doc.getElementById('p1-name');
    const p2Input = this.doc.getElementById('p2-name');
    const p1Err = this.doc.getElementById('p1-error');
    const p2Err = this.doc.getElementById('p2-error');
    p1Err.textContent = '';
    p2Err.textContent = '';
    const r1 = validateName(p1Input.value);
    if (!r1.ok) { p1Err.textContent = r1.error; return; }
    let p2Name = 'Player 2';
    if (this.pendingMode === 'hvh') {
      const r2 = validateName(p2Input.value);
      if (!r2.ok) { p2Err.textContent = r2.error; return; }
      if (r2.value.toLowerCase() === r1.value.toLowerCase()) {
        p2Err.textContent = 'Player 2 name must differ from Player 1.';
        return;
      }
      p2Name = r2.value;
    }
    this.controller.configure({
      mode: this.pendingMode,
      difficulty: this.pendingDifficulty,
      p1: r1.value,
      p2: p2Name
    });
    this._enterGame();
  }

  _enterGame() {
    this.roundStart = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    this._show('view-game');
    this._renderGame();
    if (this.controller.isAITurn()) this._scheduleAI();
  }

  _renderGame() {
    const cells = this.doc.querySelectorAll('.cell');
    cells.forEach(cell => {
      const i = parseInt(cell.getAttribute('data-index'), 10);
      const v = this.controller.board.cells[i];
      if (v) {
        cell.setAttribute('data-symbol', v);
        cell.textContent = '';  // CSS ::before renders the themed symbol
      } else {
        cell.removeAttribute('data-symbol');
        cell.textContent = '';
      }
      cell.classList.remove('win-cell', 'shake');
      cell.disabled = !!v || this.controller.roundOver || this.controller.isAITurn();
    });
    const w = this.controller.board.checkWinner();
    if (w) {
      w.line.forEach(i => cells[i].classList.add('win-cell'));
    }
    const banner = this.doc.getElementById('turn-banner');
    if (this.controller.roundOver) {
      banner.textContent = 'Round over.';
    } else if (this.controller.isAITurn()) {
      banner.textContent = 'AI is thinking…';
    } else {
      const name = this.controller.currentPlayerName();
      const sym = this.controller.currentSymbol();
      banner.textContent = `${name}'s turn (${sym})`;
    }
    this.doc.getElementById('btn-undo').disabled = !this.controller.history.canUndo() || this.controller.roundOver || this.controller.isAITurn();
    this.doc.getElementById('btn-forfeit').disabled = this.controller.isAITurn() || this.controller.roundOver;
  }

  _humanCellClick(idx) {
    if (this.controller.isAITurn() || this.controller.roundOver) return;
    if (!this.controller.board.isValidMove(idx)) {
      this.audio.playInvalid();
      const cells = this.doc.querySelectorAll('.cell');
      if (cells[idx]) {
        cells[idx].classList.add('shake');
        setTimeout(() => cells[idx] && cells[idx].classList.remove('shake'), 250);
      }
      const status = this.doc.getElementById('status-line');
      if (status) status.textContent = 'Cell is already taken — choose an empty cell.';
      return;
    }
    const symBefore = this.controller.currentSymbol();
    const r = this.controller.applyMove(idx);
    if (r.ok) this.audio.playMove(symBefore);
    this._afterMove(r);
  }

  _afterMove(result) {
    this._renderGame();
    if (result && result.outcome) {
      this._endRound(result.outcome);
    } else if (this.controller.isAITurn()) {
      this._scheduleAI();
    }
  }

  _scheduleAI() {
    setTimeout(() => {
      const symBefore = this.controller.currentSymbol();
      const r = this.controller.aiMove();
      if (r && r.result && r.result.ok) this.audio.playMove(symBefore);
      this._afterMove(r ? r.result : null);
    }, 200);
  }

  _handleUndo() {
    if (this.controller.undo()) {
      this._renderGame();
    }
  }

  _endRound(outcome) {
    if (outcome === 'draw') this.audio.playDraw();
    else this.audio.playWin();
    this._showEndPanel(outcome);
  }

  _showEndPanel(outcome) {
    const $ = id => this.doc.getElementById(id);
    let msg;
    if (outcome === 'draw') {
      msg = "It's a draw! Well played by both sides.";
    } else {
      const winningPlayer = this.controller.symbols[1] === outcome ? 1 : 2;
      const winnerName = winningPlayer === 1 ? this.controller.p1 : this.controller.p2;
      msg = `🎉 ${winnerName} (${outcome}) wins! Congratulations!`;
    }
    $('end-message').textContent = msg;
    const dur = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.roundStart) / 1000;
    const mm = String(Math.floor(dur / 60)).padStart(2, '0');
    const ss = String(Math.floor(dur % 60)).padStart(2, '0');
    $('end-stats').textContent = `Moves: ${this.controller.movesPlayed} · Duration: ${mm}:${ss}`;
    this._renderTopPlayer();
    this._show('view-end');
  }

  _playAgain() {
    this.controller.startNextRound();
    this._enterGame();
  }

  /* -------------- Stats Dashboard (FR-W22) -------------- */
  _renderStats() {
    const data = this.scoreManager.getAll();
    const overview = this.doc.getElementById('stats-overview');
    const h2hWrap = this.doc.getElementById('stats-h2h');
    const aggregate = this.doc.getElementById('stats-aggregate');
    const empty = this.doc.getElementById('stats-empty');

    overview.textContent = '';
    h2hWrap.textContent = '';
    aggregate.textContent = '';

    const rows = Stats.perPlayerRows(data);
    if (rows.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    // Sort
    const sorted = Stats.sortRows(rows, this.statsSort.column, this.statsSort.asc);

    // Per-player overview table
    const table = this.doc.createElement('table');
    table.className = 'stats-table';
    const thead = this.doc.createElement('thead');
    const trH = this.doc.createElement('tr');
    const cols = [
      { key: 'display_name', label: 'Player' },
      { key: 'wins', label: 'Wins' },
      { key: 'losses', label: 'Losses' },
      { key: 'draws', label: 'Draws' },
      { key: 'played', label: 'Played' },
      { key: 'win_rate', label: 'Win Rate' },
      { key: 'current_streak', label: 'Current Streak' },
      { key: 'best_streak', label: 'Best Streak' }
    ];
    cols.forEach(c => {
      const th = this.doc.createElement('th');
      th.textContent = c.label;
      th.scope = 'col';
      th.setAttribute('data-sort-key', c.key);
      th.tabIndex = 0;
      th.addEventListener('click', () => {
        if (this.statsSort.column === c.key) this.statsSort.asc = !this.statsSort.asc;
        else { this.statsSort.column = c.key; this.statsSort.asc = false; }
        this._renderStats();
      });
      trH.appendChild(th);
    });
    thead.appendChild(trH);
    table.appendChild(thead);

    const tbody = this.doc.createElement('tbody');
    sorted.forEach(r => {
      const tr = this.doc.createElement('tr');
      const cells = [
        r.display_name,
        String(r.wins),
        String(r.losses),
        String(r.draws),
        String(r.played),
        Stats.formatWinRate(r.played, r.win_rate),
        Stats.formatStreak(r.current_streak),
        String(r.best_streak)
      ];
      cells.forEach(v => {
        const td = this.doc.createElement('td');
        td.textContent = v;          // textContent — XSS safe
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    overview.appendChild(table);

    // Head-to-head
    const h2hRows = Stats.headToHeadRows(data);
    if (h2hRows.length > 0) {
      const h = this.doc.createElement('h3');
      h.textContent = 'Head-to-Head';
      h2hWrap.appendChild(h);
      const t2 = this.doc.createElement('table');
      t2.className = 'stats-table';
      const thead2 = this.doc.createElement('thead');
      const tr2 = this.doc.createElement('tr');
      ['Matchup', 'A wins', 'Draws', 'B wins'].forEach(label => {
        const th = this.doc.createElement('th');
        th.textContent = label;
        tr2.appendChild(th);
      });
      thead2.appendChild(tr2);
      t2.appendChild(thead2);
      const tbody2 = this.doc.createElement('tbody');
      h2hRows.forEach(r => {
        const tr = this.doc.createElement('tr');
        const cells = [
          `${r.a_name} vs ${r.b_name}`,
          String(r.a_wins),
          String(r.draws),
          String(r.b_wins)
        ];
        cells.forEach(v => {
          const td = this.doc.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
        tbody2.appendChild(tr);
      });
      t2.appendChild(tbody2);
      h2hWrap.appendChild(t2);
    }

    // Aggregate
    const agg = Stats.aggregateRounds(data);
    aggregate.textContent =
      `Total rounds played: ${agg.totalRounds} · Total draws: ${agg.totalDraws}`;
  }

  _renderTopPlayer() {
    const top = this.scoreManager.topPlayer();
    const el = this.doc.getElementById('top-player');
    if (!el) return;
    el.textContent = top
      ? `Top: ${top.display_name} — ${top.wins} win${top.wins === 1 ? '' : 's'}`
      : 'No scores recorded yet.';
  }

  _confirmReset() {
    this._showModal('This will permanently delete all scores. Are you sure?', () => {
      this.scoreManager.reset();
      this._renderTopPlayer();
      this._showToast('Scores reset.');
    });
  }

  _confirmForfeit() {
    this._showModal('Forfeit this round? Your progress will not be saved as a win or loss.', () => {
      this.controller.forfeit();
      this._show('view-menu');
    });
  }

  _showModal(message, onYes) {
    const m = this.doc.getElementById('modal');
    this.doc.getElementById('modal-message').textContent = message;
    const yesBtn = this.doc.getElementById('modal-yes');
    const newYes = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYes, yesBtn);
    newYes.addEventListener('click', () => {
      this._hideModal();
      onYes();
    });
    m.classList.remove('hidden');
  }

  _hideModal() {
    const m = this.doc.getElementById('modal');
    if (m) m.classList.add('hidden');
  }

  _showToast(msg) {
    const t = this.doc.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2200);
  }

  _show(id) {
    ['view-menu', 'view-difficulty', 'view-names', 'view-game', 'view-end',
     'view-stats', 'view-help'].forEach(v => {
      const el = this.doc.getElementById(v);
      if (!el) return;
      if (v === id) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
    if (id === 'view-menu') this._renderTopPlayer();
  }
}

/* ============================================================
 * Bootstrap (UI only; safe to require() in Jest)
 * ============================================================ */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      // Only auto-init when the expected DOM is present.
      if (document.getElementById('view-menu')) {
        window.__ttt_ui = new UIController(document);
      }
    } catch (e) {
      console.error('UI init failed:', e);
    }
  });
}

/* ============================================================
 * Exports for Jest (CommonJS) — ignored by browsers as <script>.
 * ============================================================ */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Board,
    AI,
    ScoreManager,
    HistoryManager,
    GameController,
    ThemeManager,
    AudioManager,
    UIController,
    Stats,
    createRng,
    sanitizeName,
    validateName,
    WIN_LINES,
    STORAGE_KEYS,
    SCHEMA_VERSION,
    VALID_THEMES,
    DEFAULT_THEME
  };
}
