/* Tic Tac Toe v2 — game logic, AI, score persistence, undo/redo, match mode, themes, audio.
 * Vanilla ES6+; no build step. Loaded as a plain <script> in index.html.
 * Safe to require() from Jest (jsdom): UI startup is gated by DOMContentLoaded.
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
  scores: 'tictactoe_scores',
  scoresBackup: 'tictactoe_scores_backup',
  scoresCorrupt: 'tictactoe_scores_corrupt_backup',
  theme: 'tictactoe_theme',
  muted: 'tictactoe_muted'
};

const SCHEMA_VERSION = 2;
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
 * AI strategies
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

  /** Hard: minimax with alpha-beta and depth-aware scoring. */
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
      // Tie-break: lowest index already wins because we don't replace on equality.
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
 * Score Manager — localStorage-backed persistence
 * ============================================================ */
class ScoreManager {
  constructor(storage) {
    // storage is a localStorage-like object with getItem/setItem/removeItem.
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.fallback = false;
    this.data = this._loadOrInit();
  }

  _emptyStore() {
    return { schema_version: SCHEMA_VERSION, players: {} };
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
    try {
      const parsed = JSON.parse(raw);
      if (this._isValid(parsed)) {
        return parsed;
      }
      // Quarantine
      try { this.storage.setItem(STORAGE_KEYS.scoresCorrupt, raw); } catch (_) {}
      return this._emptyStore();
    } catch (_) {
      try { this.storage.setItem(STORAGE_KEYS.scoresCorrupt, raw); } catch (_) {}
      return this._emptyStore();
    }
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
      this.data.players[key] = { display_name: name, wins: 0, losses: 0, draws: 0 };
    }
    return this.data.players[key];
  }

  recordWin(winner, loser) {
    const w = this._ensurePlayer(winner);
    const l = this._ensurePlayer(loser);
    w.wins += 1;
    l.losses += 1;
    this._save();
  }

  recordDraw(p1, p2) {
    const a = this._ensurePlayer(p1);
    const b = this._ensurePlayer(p2);
    a.draws += 1;
    b.draws += 1;
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
 * Move history — undo/redo
 * ============================================================ */
class HistoryManager {
  constructor() {
    this.undoStack = []; // entries: { index, symbol }
    this.redoStack = [];
  }
  push(move) {
    this.undoStack.push(move);
    this.redoStack.length = 0;
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  undo() {
    if (!this.canUndo()) return null;
    const m = this.undoStack.pop();
    this.redoStack.push(m);
    return m;
  }
  redo() {
    if (!this.canRedo()) return null;
    const m = this.redoStack.pop();
    this.undoStack.push(m);
    return m;
  }
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

/* ============================================================
 * Match (best-of-N) state machine
 * ============================================================ */
class Match {
  constructor(length, p1Name, p2Name) {
    this.length = Math.max(1, parseInt(length, 10) || 1);
    this.p1 = p1Name;
    this.p2 = p2Name;
    this.rounds = []; // { winner: name|null (null=draw) }
    this.scoreP1 = 0;
    this.scoreP2 = 0;
    this.draws = 0;
  }

  isMultiRound() {
    return this.length > 1;
  }

  recordRound(winnerName) {
    if (winnerName === this.p1) {
      this.scoreP1 += 1;
      this.rounds.push({ winner: this.p1 });
    } else if (winnerName === this.p2) {
      this.scoreP2 += 1;
      this.rounds.push({ winner: this.p2 });
    } else {
      this.draws += 1;
      this.rounds.push({ winner: null });
    }
  }

  isComplete() {
    if (!this.isMultiRound()) return this.rounds.length >= 1;
    const needed = Math.floor(this.length / 2) + 1;
    if (this.scoreP1 >= needed || this.scoreP2 >= needed) return true;
    if (this.rounds.length >= this.length) return true;
    // Cannot-catch-up condition: even if remaining rounds all go to trailer, leader still wins.
    const remaining = this.length - this.rounds.length;
    if (this.scoreP1 > this.scoreP2 + remaining) return true;
    if (this.scoreP2 > this.scoreP1 + remaining) return true;
    return false;
  }

  /** Winner name, or null for draw. Only meaningful when isComplete() is true. */
  winner() {
    if (this.scoreP1 > this.scoreP2) return this.p1;
    if (this.scoreP2 > this.scoreP1) return this.p2;
    return null;
  }
}

/* ============================================================
 * Theme manager
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
 * Audio manager (procedural Web Audio; mute persisted)
 * ============================================================ */
class AudioManager {
  constructor(storage) {
    this.storage = storage;
    this.muted = false;
    this.firstGesture = false;
    this.ctx = null;
    if (storage) {
      try {
        const v = storage.getItem(STORAGE_KEYS.muted);
        this.muted = v === 'true';
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
    } catch (_) { /* swallow */ }
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
    this.match = null;
    this.roundOver = false;
    this.movesPlayed = 0;
    this.rng = opts.rng || Math.random;
  }

  configure({ mode, difficulty, p1, p2, matchLength }) {
    this.mode = mode === 'hvai' ? 'hvai' : 'hvh';
    this.difficulty = difficulty || 'easy';
    this.p1 = p1 || 'Player 1';
    if (this.mode === 'hvai') {
      this.p2 = `AI (${this.difficulty.charAt(0).toUpperCase()}${this.difficulty.slice(1)})`;
    } else {
      this.p2 = p2 || 'Player 2';
    }
    this.firstPlayer = 1;
    this.match = new Match(matchLength || 1, this.p1, this.p2);
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

  /** Human or AI move. Returns { ok, outcome }. */
  applyMove(index) {
    if (this.roundOver) return { ok: false, reason: 'round-over' };
    const symbol = this.currentSymbol();
    if (!this.board.applyMove(index, symbol)) {
      return { ok: false, reason: 'invalid' };
    }
    this.history.push({ index, symbol, player: this.currentPlayer });
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

  /** Undo; in HvAI mode, undoes both AI's last move and the human's previous move. */
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

  redo() {
    if (this.roundOver) return false;
    if (!this.history.canRedo()) return false;
    let redone = 0;
    const steps = this.mode === 'hvai' ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      if (!this.history.canRedo()) break;
      const move = this.history.redo();
      this.board.applyMove(move.index, move.symbol);
      this.currentPlayer = move.player === 1 ? 2 : 1;
      this.movesPlayed += 1;
      redone += 1;
    }
    return redone > 0;
  }

  _recordOutcome(outcome) {
    if (outcome === 'draw') {
      this.scoreManager.recordDraw(this.p1, this.p2);
      if (this.match) this.match.recordRound(null);
      return;
    }
    // outcome is 'X' or 'O' — figure out which player owns it.
    const winningPlayer = this.symbols[1] === outcome ? 1 : 2;
    const winnerName = winningPlayer === 1 ? this.p1 : this.p2;
    const loserName = winningPlayer === 1 ? this.p2 : this.p1;
    this.scoreManager.recordWin(winnerName, loserName);
    if (this.match) this.match.recordRound(winnerName);
  }

  startNextRound() {
    this.rotateFirstPlayer();
    this.startRound();
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
    this.matchLength = 1;
    this.roundStart = 0;
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
    if (!this.audio.available) {
      btn.style.display = 'none';
      return;
    }
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
        // Re-render board cells (no-op since CSS does the work)
      });
    });

    // Mute
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
    $('btn-scores').addEventListener('click', () => { this._renderScores(); this._show('view-scores'); });
    $('btn-reset').addEventListener('click', () => this._confirmReset());
    $('btn-help').addEventListener('click', () => this._show('view-help'));
    $('match-length').addEventListener('change', (e) => { this.matchLength = parseInt(e.target.value, 10) || 1; });

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
    $('btn-redo').addEventListener('click', () => this._handleRedo());
    $('btn-forfeit').addEventListener('click', () => this._confirmForfeit());
    $('btn-menu').addEventListener('click', () => this._show('view-menu'));

    // End
    $('btn-play-again').addEventListener('click', () => this._playAgain());
    $('btn-next-round').addEventListener('click', () => this._playAgain());
    $('btn-end-menu').addEventListener('click', () => this._show('view-menu'));

    // Match end
    $('btn-new-match').addEventListener('click', () => {
      this.controller.configure({
        mode: this.controller.mode,
        difficulty: this.controller.difficulty,
        p1: this.controller.p1,
        p2: this.controller.p2,
        matchLength: this.matchLength
      });
      this._enterGame();
    });
    $('btn-match-menu').addEventListener('click', () => this._show('view-menu'));

    // Scores back / help back
    $('scores-back').addEventListener('click', () => this._show('view-menu'));
    $('help-back').addEventListener('click', () => this._show('view-menu'));

    // Modal
    $('modal-no').addEventListener('click', () => this._hideModal());

    // Keyboard shortcuts
    this.doc.addEventListener('keydown', (e) => {
      if (this.doc.getElementById('view-game').classList.contains('hidden')) return;
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this._handleUndo();
      } else if (isMod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        this._handleRedo();
      }
    });
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
      p2: p2Name,
      matchLength: this.matchLength
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
        cell.textContent = '';  // CSS ::before renders symbol
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
    this.doc.getElementById('btn-undo').disabled = !this.controller.history.canUndo() || this.controller.roundOver;
    this.doc.getElementById('btn-redo').disabled = !this.controller.history.canRedo() || this.controller.roundOver;
    this.doc.getElementById('btn-forfeit').disabled = this.controller.isAITurn() || this.controller.roundOver;
    this._renderMatchStrip();
  }

  _renderMatchStrip() {
    const strip = this.doc.getElementById('match-strip');
    if (!strip) return;
    const m = this.controller.match;
    if (!m || !m.isMultiRound()) {
      strip.classList.add('hidden');
      strip.textContent = '';
      return;
    }
    strip.classList.remove('hidden');
    const drawSuffix = m.draws > 0 ? ` (${m.draws} draw${m.draws === 1 ? '' : 's'})` : '';
    strip.textContent = `Best of ${m.length} — ${m.p1} ${m.scoreP1} — ${m.scoreP2} ${m.p2}${drawSuffix}`;
  }

  _humanCellClick(idx) {
    if (this.controller.isAITurn() || this.controller.roundOver) return;
    if (!this.controller.board.isValidMove(idx)) {
      this.audio.playInvalid();
      const cells = this.doc.querySelectorAll('.cell');
      cells[idx].classList.add('shake');
      setTimeout(() => cells[idx].classList.remove('shake'), 200);
      this.doc.getElementById('status-line').textContent = 'Cell is already taken.';
      return;
    }
    const r = this.controller.applyMove(idx);
    if (r.ok) this.audio.playMove(this.controller.symbols[this.controller.currentPlayer === 1 ? 2 : 1]);
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
      const r = this.controller.aiMove();
      if (r && r.result && r.result.ok) {
        this.audio.playMove(this.controller.symbols[this.controller.currentPlayer === 1 ? 2 : 1]);
      }
      this._afterMove(r ? r.result : null);
    }, 200);
  }

  _handleUndo() {
    if (this.controller.undo()) {
      this._renderGame();
    }
  }

  _handleRedo() {
    if (this.controller.redo()) {
      this._renderGame();
    }
  }

  _endRound(outcome) {
    if (outcome === 'draw') this.audio.playDraw();
    else this.audio.playWin();
    const m = this.controller.match;
    if (m && m.isMultiRound() && !m.isComplete()) {
      // Show end-of-round panel with "Next Round"
      this._showEndPanel(outcome, /*matchInProgress=*/true);
    } else if (m && m.isMultiRound() && m.isComplete()) {
      this._showMatchEnd();
    } else {
      this._showEndPanel(outcome, /*matchInProgress=*/false);
    }
  }

  _showEndPanel(outcome, matchInProgress) {
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
    $('btn-play-again').classList.toggle('hidden', matchInProgress);
    $('btn-next-round').classList.toggle('hidden', !matchInProgress);
    this._renderEndScoreboard();
    this._show('view-end');
  }

  _renderEndScoreboard() {
    const wrap = this.doc.getElementById('end-scoreboard');
    wrap.textContent = '';
    const all = this.scoreManager.getAll();
    const players = Object.values(all.players);
    if (players.length === 0) { wrap.textContent = 'No scores yet.'; return; }
    const table = this.doc.createElement('table');
    const thead = this.doc.createElement('thead');
    const trH = this.doc.createElement('tr');
    ['Player', 'Wins', 'Losses', 'Draws'].forEach(h => {
      const th = this.doc.createElement('th');
      th.textContent = h;
      trH.appendChild(th);
    });
    thead.appendChild(trH);
    table.appendChild(thead);
    const tbody = this.doc.createElement('tbody');
    players.sort((a, b) => b.wins - a.wins).forEach(p => {
      const tr = this.doc.createElement('tr');
      [p.display_name, p.wins, p.losses, p.draws].forEach(v => {
        const td = this.doc.createElement('td');
        td.textContent = String(v);   // textContent — sanitisation
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  _showMatchEnd() {
    const m = this.controller.match;
    const $ = id => this.doc.getElementById(id);
    const winner = m.winner();
    $('match-result').textContent = winner
      ? `🏆 ${winner} wins the match (${m.scoreP1}–${m.scoreP2})${m.draws ? ` with ${m.draws} draw${m.draws === 1 ? '' : 's'}` : ''}!`
      : `Match drawn (${m.scoreP1}–${m.scoreP2}, ${m.draws} draw${m.draws === 1 ? '' : 's'}).`;
    const list = $('match-rounds');
    list.textContent = '';
    m.rounds.forEach((r, i) => {
      const li = this.doc.createElement('li');
      li.textContent = `Round ${i + 1}: ${r.winner ? r.winner + ' won' : 'Draw'}`;
      list.appendChild(li);
    });
    this._show('view-match-end');
  }

  _playAgain() {
    this.controller.startNextRound();
    this._enterGame();
  }

  _renderScores() {
    const wrap = this.doc.getElementById('scores-table');
    wrap.textContent = '';
    const all = this.scoreManager.getAll();
    const players = Object.values(all.players);
    if (players.length === 0) {
      wrap.textContent = 'No scores recorded yet.';
      return;
    }
    const table = this.doc.createElement('table');
    const thead = this.doc.createElement('thead');
    const trH = this.doc.createElement('tr');
    ['Player', 'Wins', 'Losses', 'Draws', 'Played'].forEach(h => {
      const th = this.doc.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      trH.appendChild(th);
    });
    thead.appendChild(trH);
    table.appendChild(thead);
    const tbody = this.doc.createElement('tbody');
    players.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return a.display_name.localeCompare(b.display_name);
    }).forEach(p => {
      const tr = this.doc.createElement('tr');
      [p.display_name, p.wins, p.losses, p.draws, p.wins + p.losses + p.draws].forEach(v => {
        const td = this.doc.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
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
    this._showModal('Forfeit this round?', () => {
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
    ['view-menu', 'view-difficulty', 'view-names', 'view-game', 'view-end', 'view-match-end', 'view-scores', 'view-help']
      .forEach(v => {
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
      // Only auto-init when the expected DOM is present (i.e., index.html, not a bare jsdom doc).
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
    Match,
    GameController,
    ThemeManager,
    AudioManager,
    UIController,
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
