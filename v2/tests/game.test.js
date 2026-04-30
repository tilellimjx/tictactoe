/**
 * @jest-environment jsdom
 *
 * Test suite for Tic Tac Toe v2.
 *
 * Covers:
 *   - Board: init, all 8 win lines (X & O), draws, move validation, immutability.
 *   - AI: Easy (never picks occupied cell, deterministic with seeded RNG),
 *         Medium (blocks, takes win, centre, opposite-corner),
 *         Hard (Minimax never loses across many seeded games, no input mutation).
 *   - ScoreManager: round-trip persistence, increment counts, corruption recovery,
 *                    v1→v2 schema migration.
 *   - The three NEW V2 features (per requirements §2.4):
 *       Feature 1 (FR-W20) — Move History with Undo.
 *       Feature 2 (FR-W21) — Sound Effects with Mute Toggle.
 *       Feature 3 (FR-W22) — Stats Dashboard (win-rate, streaks, head-to-head).
 *   - Theme switching applies the correct CSS class / data-theme to <body> / <html>.
 *   - Name validation, sanitisation, and DOM-level smoke tests.
 */

const path = require('path');
const fs = require('fs');

const {
  Board,
  AI,
  ScoreManager,
  HistoryManager,
  GameController,
  ThemeManager,
  AudioManager,
  Stats,
  createRng,
  validateName,
  sanitizeName,
  WIN_LINES,
  STORAGE_KEYS,
  SCHEMA_VERSION,
  VALID_THEMES,
  DEFAULT_THEME
} = require('../app/game.js');

/* ----- helpers ----- */
function makeMockStorage() {
  const map = new Map();
  return {
    getItem: jest.fn(k => (map.has(k) ? map.get(k) : null)),
    setItem: jest.fn((k, v) => { map.set(k, String(v)); }),
    removeItem: jest.fn(k => { map.delete(k); }),
    clear: jest.fn(() => map.clear()),
    _map: map
  };
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

/* ============================================================
 * Board
 * ============================================================ */
describe('Board', () => {
  test('initialises 9 empty cells', () => {
    const b = new Board();
    expect(b.cells.length).toBe(9);
    expect(b.cells.every(c => c === null)).toBe(true);
  });

  test('detects all 8 winning lines for X', () => {
    expect(WIN_LINES.length).toBe(8);
    for (const line of WIN_LINES) {
      const b = new Board();
      line.forEach(i => b.applyMove(i, 'X'));
      const w = b.checkWinner();
      expect(w).not.toBeNull();
      expect(w.winner).toBe('X');
      expect(w.line).toEqual(line);
    }
  });

  test('detects all 8 winning lines for O', () => {
    for (const line of WIN_LINES) {
      const b = new Board();
      line.forEach(i => b.applyMove(i, 'O'));
      const w = b.checkWinner();
      expect(w).not.toBeNull();
      expect(w.winner).toBe('O');
    }
  });

  test('detects a draw on a full board with no winner', () => {
    // X O X
    // X O O
    // O X X
    const b = new Board();
    const layout = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    layout.forEach((s, i) => b.applyMove(i, s));
    expect(b.checkWinner()).toBeNull();
    expect(b.isFull()).toBe(true);
    expect(b.getOutcome()).toBe('draw');
  });

  test('rejects move on occupied cell', () => {
    const b = new Board();
    expect(b.applyMove(0, 'X')).toBe(true);
    expect(b.applyMove(0, 'O')).toBe(false);
    expect(b.cells[0]).toBe('X');
  });

  test('rejects move out of range / non-integer', () => {
    const b = new Board();
    expect(b.applyMove(-1, 'X')).toBe(false);
    expect(b.applyMove(9, 'X')).toBe(false);
    expect(b.applyMove(1.5, 'X')).toBe(false);
  });

  test('rejects move with invalid symbol', () => {
    const b = new Board();
    expect(b.applyMove(0, 'Z')).toBe(false);
    expect(b.cells[0]).toBe(null);
  });

  test('clone produces an independent copy', () => {
    const b = new Board();
    b.applyMove(0, 'X');
    const c = b.clone();
    c.applyMove(1, 'O');
    expect(b.cells[1]).toBe(null);
    expect(c.cells[1]).toBe('O');
  });
});

/* ============================================================
 * AI — Easy
 * ============================================================ */
describe('AI — Easy', () => {
  test('never picks an occupied cell over many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = new Board();
      [0, 2, 4, 6].forEach(i => b.applyMove(i, 'X'));
      const rng = createRng(seed);
      const move = AI.easy(b, 'O', rng);
      expect(b.cells[move]).toBe(null);
      expect(move).toBeGreaterThanOrEqual(0);
      expect(move).toBeLessThan(9);
    }
  });

  test('returns a valid index from empty cells', () => {
    const b = new Board();
    const rng = createRng(42);
    const move = AI.easy(b, 'X', rng);
    expect(move).toBeGreaterThanOrEqual(0);
    expect(move).toBeLessThan(9);
  });

  test('seeded RNG produces deterministic output', () => {
    const b = new Board();
    const m1 = AI.easy(b, 'X', createRng(7));
    const m2 = AI.easy(b, 'X', createRng(7));
    expect(m1).toBe(m2);
  });
});

/* ============================================================
 * AI — Medium
 * ============================================================ */
describe('AI — Medium', () => {
  test('takes an immediate winning move', () => {
    const b = new Board();
    b.applyMove(0, 'X'); b.applyMove(1, 'X');
    b.applyMove(4, 'O');
    expect(AI.medium(b, 'X', createRng(1))).toBe(2);
  });

  test('blocks an opponent two-in-a-row threat', () => {
    const b = new Board();
    b.applyMove(0, 'X'); b.applyMove(1, 'X'); // threat
    b.applyMove(7, 'O');                       // own move
    expect(AI.medium(b, 'O', createRng(1))).toBe(2);
  });

  test('takes centre on empty board', () => {
    const b = new Board();
    expect(AI.medium(b, 'X', createRng(1))).toBe(4);
  });

  test('takes opposite corner when opponent occupies a corner', () => {
    const b = new Board();
    b.applyMove(0, 'X'); // opponent corner
    b.applyMove(4, 'O'); // centre taken
    expect(AI.medium(b, 'O', createRng(1))).toBe(8);
  });
});

/* ============================================================
 * AI — Hard (Minimax)
 * ============================================================ */
describe('AI — Hard (minimax)', () => {
  test('first move on empty board is a corner or centre', () => {
    const b = new Board();
    const move = AI.hard(b, 'X');
    expect([0, 2, 4, 6, 8]).toContain(move);
  });

  test('does not mutate input board', () => {
    const b = new Board();
    b.applyMove(4, 'X');
    const before = b.cells.slice();
    AI.hard(b, 'O');
    expect(b.cells).toEqual(before);
  });

  test('takes immediate win when available', () => {
    const b = new Board();
    b.applyMove(0, 'X'); b.applyMove(1, 'X');
    b.applyMove(3, 'O');
    expect(AI.hard(b, 'X')).toBe(2);
  });

  test('blocks opponent immediate win', () => {
    const b = new Board();
    b.applyMove(0, 'O'); b.applyMove(1, 'O');
    b.applyMove(4, 'X');
    expect(AI.hard(b, 'X')).toBe(2);
  });

  test('Hard AI never loses against random opponent (full game simulation, multiple seeds)', () => {
    let losses = 0;
    const games = 50;
    for (let seed = 1; seed <= games; seed++) {
      const board = new Board();
      const rng = createRng(seed);
      const aiSym = (seed % 2 === 0) ? 'X' : 'O';
      const humanSym = aiSym === 'X' ? 'O' : 'X';
      let turn = 'X';
      while (!board.checkWinner() && !board.isFull()) {
        let mv;
        if (turn === aiSym) {
          mv = AI.hard(board, aiSym);
        } else {
          const empties = board.emptyCells();
          mv = empties[Math.floor(rng() * empties.length)];
        }
        board.applyMove(mv, turn);
        turn = turn === 'X' ? 'O' : 'X';
      }
      const w = board.checkWinner();
      if (w && w.winner === humanSym) losses++;
    }
    expect(losses).toBe(0);
  });

  test('deterministic on a given board', () => {
    const b = new Board();
    b.applyMove(0, 'X');
    expect(AI.hard(b, 'O')).toBe(AI.hard(b, 'O'));
  });

  test('AI.pick dispatches to correct difficulty', () => {
    const b = new Board();
    expect([0, 2, 4, 6, 8]).toContain(AI.pick('hard', b, 'X'));
    expect(AI.pick('medium', b, 'X', createRng(1))).toBe(4);
    const easy = AI.pick('easy', b, 'X', createRng(1));
    expect(easy).toBeGreaterThanOrEqual(0);
    expect(easy).toBeLessThan(9);
  });
});

/* ============================================================
 * ScoreManager
 * ============================================================ */
describe('ScoreManager', () => {
  test('round-trip: save & reload yields identical data', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    sm.recordDraw('Alice', 'Bob');
    const sm2 = new ScoreManager(storage);
    expect(sm2.getPlayer('alice')).toMatchObject({ display_name: 'Alice', wins: 1, draws: 1 });
    expect(sm2.getPlayer('Bob')).toMatchObject({ display_name: 'Bob', losses: 1, draws: 1 });
  });

  test('case-insensitive key, preserves display casing', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    expect(sm.getPlayer('alice').display_name).toBe('Alice');
    expect(sm.getPlayer('ALICE').display_name).toBe('Alice');
  });

  test('AI difficulty entries are tracked separately', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('AI (Easy)', 'Alice');
    sm.recordWin('AI (Hard)', 'Alice');
    expect(sm.getPlayer('AI (Easy)').wins).toBe(1);
    expect(sm.getPlayer('AI (Hard)').wins).toBe(1);
  });

  test('corrupt JSON is quarantined; in-memory store starts empty', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.scores, 'not-json');
    const sm = new ScoreManager(storage);
    expect(Object.keys(sm.getAll().players).length).toBe(0);
    expect(storage.getItem(STORAGE_KEYS.scoresBackup)).toBe('not-json');
  });

  test('schema-invalid payload is also quarantined', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.scores, JSON.stringify({ schema_version: 'bad' }));
    const sm = new ScoreManager(storage);
    expect(Object.keys(sm.getAll().players).length).toBe(0);
    expect(storage.getItem(STORAGE_KEYS.scoresBackup)).toMatch(/schema_version/);
  });

  test('reset clears store, writes backup, preserves schema_version', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    const before = storage.getItem(STORAGE_KEYS.scores);
    sm.reset();
    expect(Object.keys(sm.getAll().players).length).toBe(0);
    expect(sm.getAll().schema_version).toBe(SCHEMA_VERSION);
    expect(storage.getItem(STORAGE_KEYS.scoresBackup)).toBe(before);
  });

  test('missing payload yields empty store', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    expect(sm.getAll().players).toEqual({});
    expect(sm.getAll().schema_version).toBe(SCHEMA_VERSION);
  });

  test('counters increment correctly across multiple rounds', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Alice', 'Bob');
    sm.recordDraw('Alice', 'Bob');
    sm.recordWin('Bob', 'Alice');
    expect(sm.getPlayer('Alice')).toMatchObject({ wins: 2, losses: 1, draws: 1 });
    expect(sm.getPlayer('Bob')).toMatchObject({ wins: 1, losses: 2, draws: 1 });
  });

  test('topPlayer returns highest-wins entry', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Bob', 'Alice');
    expect(sm.topPlayer().display_name).toBe('Alice');
  });

  test('v1 → v2 schema migration adds streak and head_to_head fields', () => {
    const storage = makeMockStorage();
    // Simulate a v1-shaped payload (no streak/h2h fields).
    const v1 = {
      schema_version: 1,
      players: {
        alice: { display_name: 'Alice', wins: 2, losses: 1, draws: 0 }
      }
    };
    storage.setItem(STORAGE_KEYS.scores, JSON.stringify(v1));
    const sm = new ScoreManager(storage);
    const a = sm.getPlayer('Alice');
    expect(a.wins).toBe(2);
    expect(Array.isArray(a.recent_outcomes)).toBe(true);
    expect(a.current_streak).toEqual({ type: null, count: 0 });
    expect(a.best_streak).toBe(0);
    expect(sm.getAll().head_to_head).toEqual({});
    // Migrated payload re-saved with new schema_version
    const reloaded = JSON.parse(storage.getItem(STORAGE_KEYS.scores));
    expect(reloaded.schema_version).toBe(SCHEMA_VERSION);
  });
});

/* ============================================================
 * FEATURE 1 — Move History with Undo (FR-W20)
 * ============================================================ */
describe('Feature 1 — Move History with Undo (FR-W20)', () => {
  test('HistoryManager push then undo returns the move', () => {
    const h = new HistoryManager();
    const move = { index: 4, symbol: 'X', player: 1 };
    h.push(move);
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toEqual(move);
    expect(h.canUndo()).toBe(false);
  });

  test('undo on empty history is a no-op (does not throw)', () => {
    const h = new HistoryManager();
    expect(() => h.undo()).not.toThrow();
    expect(h.undo()).toBeNull();
  });

  test('GameController HvH undo reverts last move and switches active player', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob' });
    g.applyMove(4); // P1 X
    g.applyMove(0); // P2 O
    expect(g.board.cells[0]).toBe('O');
    expect(g.currentPlayer).toBe(1);
    expect(g.undo()).toBe(true);
    expect(g.board.cells[0]).toBe(null);
    expect(g.currentPlayer).toBe(2);
  });

  test('GameController HvAI undo reverts BOTH AI and human moves (returns to human decision)', () => {
    const g = new GameController({ storage: makeMockStorage(), rng: createRng(1) });
    g.configure({ mode: 'hvai', difficulty: 'hard', p1: 'Alice' });
    g.applyMove(4);                  // human X at centre
    const ai = g.aiMove();           // AI plays
    expect(ai).not.toBeNull();
    expect(g.movesPlayed).toBe(2);
    expect(g.undo()).toBe(true);
    expect(g.movesPlayed).toBe(0);
    expect(g.currentPlayer).toBe(1); // human's turn restored
    expect(g.board.cells.every(c => c === null)).toBe(true);
  });

  test('undo is rejected after the round has ended', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    [0, 3, 1, 4, 2].forEach(i => g.applyMove(i)); // A wins top row
    expect(g.roundOver).toBe(true);
    expect(g.undo()).toBe(false);
  });

  test('undo does not modify the persistent score store', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob' });
    g.applyMove(0);
    g.undo();
    const sm2 = new ScoreManager(storage);
    expect(Object.keys(sm2.getAll().players).length).toBe(0);
  });
});

/* ============================================================
 * FEATURE 2 — Sound Effects with Mute Toggle (FR-W21)
 * ============================================================ */
describe('Feature 2 — Sound Effects with Mute Toggle (FR-W21)', () => {
  test('default is muted on first run (no persisted value)', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    expect(a.muted).toBe(true);
  });

  test('mute toggle persists to storage', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    expect(a.muted).toBe(true);                  // default muted
    a.toggleMuted();                             // unmute
    expect(a.muted).toBe(false);
    expect(storage.getItem(STORAGE_KEYS.muted)).toBe('false');
    const a2 = new AudioManager(storage);
    expect(a2.muted).toBe(false);
  });

  test('persisted muted=true is restored', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.muted, 'true');
    const a = new AudioManager(storage);
    expect(a.muted).toBe(true);
  });

  test('when muted, tone playback is a no-op (no errors raised)', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    a.setMuted(true);
    a.notifyUserGesture();
    expect(() => {
      a.playMove('X');
      a.playWin();
      a.playDraw();
      a.playInvalid();
    }).not.toThrow();
  });

  test('when web audio unavailable, sounds are silent and no errors', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    a.available = false;
    a.setMuted(false);
    expect(() => {
      a.notifyUserGesture();
      a.playMove('X');
      a.playWin();
      a.playDraw();
      a.playInvalid();
    }).not.toThrow();
  });

  test('all four required sound-event methods exist', () => {
    const a = new AudioManager(makeMockStorage());
    // FR-W21: move, win, draw, invalid
    expect(typeof a.playMove).toBe('function');
    expect(typeof a.playWin).toBe('function');
    expect(typeof a.playDraw).toBe('function');
    expect(typeof a.playInvalid).toBe('function');
  });
});

/* ============================================================
 * FEATURE 3 — Stats Dashboard (FR-W22)
 * ============================================================ */
describe('Feature 3 — Stats Dashboard (FR-W22)', () => {
  function buildSm() {
    return new ScoreManager(makeMockStorage());
  }

  test('Stats.perPlayerRows includes a win-rate %', () => {
    const sm = buildSm();
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Alice', 'Bob');
    sm.recordDraw('Alice', 'Bob');
    const rows = Stats.perPlayerRows(sm.getAll());
    const alice = rows.find(r => r.display_name === 'Alice');
    expect(alice.played).toBe(3);
    // 2 wins out of 3 played → 66.6...%
    expect(alice.win_rate).toBeCloseTo(66.6666, 1);
  });

  test('win-rate handles zero games (returns 0, not NaN)', () => {
    const rows = Stats.perPlayerRows({ players: {
      ghost: { display_name: 'Ghost', wins: 0, losses: 0, draws: 0 }
    } });
    expect(rows[0].win_rate).toBe(0);
    expect(Number.isFinite(rows[0].win_rate)).toBe(true);
    expect(Stats.formatWinRate(rows[0].played, rows[0].win_rate)).toBe('—');
  });

  test('current streak is computed from recent_outcomes', () => {
    expect(Stats.computeCurrentStreak(['L', 'W', 'W', 'W'])).toEqual({ type: 'W', count: 3 });
    expect(Stats.computeCurrentStreak(['W', 'L', 'L'])).toEqual({ type: 'L', count: 2 });
    expect(Stats.computeCurrentStreak(['D'])).toEqual({ type: 'D', count: 1 });
    expect(Stats.computeCurrentStreak([])).toEqual({ type: null, count: 0 });
  });

  test('best (longest) winning streak is correctly identified', () => {
    expect(Stats.computeBestWinStreak(['W', 'W', 'L', 'W', 'W', 'W', 'L'])).toBe(3);
    expect(Stats.computeBestWinStreak(['L', 'L'])).toBe(0);
    expect(Stats.computeBestWinStreak([])).toBe(0);
  });

  test('ScoreManager records per-game outcomes and updates current/best streak', () => {
    const sm = buildSm();
    sm.recordWin('Alice', 'Bob');           // A: W
    sm.recordWin('Alice', 'Bob');           // A: WW  best=2
    sm.recordWin('Bob', 'Alice');           // A: WWL → streak resets to L1
    const a = sm.getPlayer('Alice');
    expect(a.recent_outcomes).toEqual(['W', 'W', 'L']);
    expect(a.current_streak).toEqual({ type: 'L', count: 1 });
    expect(a.best_streak).toBe(2);
    const b = sm.getPlayer('Bob');
    expect(b.current_streak).toEqual({ type: 'W', count: 1 });
    expect(b.best_streak).toBe(1);
  });

  test('head-to-head records are created and updated correctly', () => {
    const sm = buildSm();
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Bob', 'Alice');
    sm.recordDraw('Alice', 'Bob');
    const rows = Stats.headToHeadRows(sm.getAll());
    expect(rows).toHaveLength(1);
    const r = rows[0];
    // Keys are sorted alphabetically — alice|bob (a=alice, b=bob)
    expect(r.a_key).toBe('alice');
    expect(r.b_key).toBe('bob');
    expect(r.a_wins).toBe(1);
    expect(r.b_wins).toBe(1);
    expect(r.draws).toBe(1);
  });

  test('head-to-head matches a brute-force reference computation', () => {
    const sm = buildSm();
    const events = [
      ['win', 'Alice', 'Bob'],
      ['win', 'Carol', 'Alice'],
      ['draw', 'Alice', 'Bob'],
      ['win', 'Bob', 'Alice'],
      ['draw', 'Bob', 'Carol'],
      ['win', 'Alice', 'Bob']
    ];
    for (const [type, x, y] of events) {
      if (type === 'win') sm.recordWin(x, y);
      else sm.recordDraw(x, y);
    }
    // Reference brute-force counts:
    const ref = {};
    for (const [type, x, y] of events) {
      const [a, b] = [x.toLowerCase(), y.toLowerCase()].sort();
      const key = `${a}|${b}`;
      if (!ref[key]) ref[key] = { a, b, a_wins: 0, b_wins: 0, draws: 0 };
      if (type === 'draw') ref[key].draws += 1;
      else {
        // x is winner
        if (a === x.toLowerCase()) ref[key].a_wins += 1;
        else ref[key].b_wins += 1;
      }
    }
    const rows = Stats.headToHeadRows(sm.getAll());
    expect(rows.length).toBe(Object.keys(ref).length);
    for (const r of rows) {
      const k = `${r.a_key}|${r.b_key}`;
      expect(ref[k]).toBeDefined();
      expect(r.a_wins).toBe(ref[k].a_wins);
      expect(r.b_wins).toBe(ref[k].b_wins);
      expect(r.draws).toBe(ref[k].draws);
    }
  });

  test('aggregate rounds counts each round once even though both players are debited', () => {
    const sm = buildSm();
    sm.recordWin('Alice', 'Bob');           // 1 win (counted once)
    sm.recordDraw('Alice', 'Bob');          // 1 draw (debited to both → /2)
    sm.recordDraw('Alice', 'Bob');          // 1 draw
    const agg = Stats.aggregateRounds(sm.getAll());
    expect(agg.totalRounds).toBe(3);
    expect(agg.totalDraws).toBe(2);
  });

  test('Stats.sortRows sorts ascending and descending', () => {
    const rows = [
      { display_name: 'Bob',   wins: 1 },
      { display_name: 'Alice', wins: 3 },
      { display_name: 'Carol', wins: 2 }
    ];
    const desc = Stats.sortRows(rows, 'wins', false);
    expect(desc.map(r => r.display_name)).toEqual(['Alice', 'Carol', 'Bob']);
    const asc = Stats.sortRows(rows, 'wins', true);
    expect(asc.map(r => r.display_name)).toEqual(['Bob', 'Carol', 'Alice']);
    const byName = Stats.sortRows(rows, 'display_name', true);
    expect(byName.map(r => r.display_name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  test('Stats.formatStreak handles empty / valid', () => {
    expect(Stats.formatStreak({ type: null, count: 0 })).toBe('—');
    expect(Stats.formatStreak({ type: 'W', count: 3 })).toBe('W3');
    expect(Stats.formatStreak(null)).toBe('—');
  });

  test('empty score store yields zero overview rows (empty-state cue)', () => {
    const sm = buildSm();
    expect(Stats.perPlayerRows(sm.getAll())).toEqual([]);
  });
});

/* ============================================================
 * Theme switching (FR-W02 — three carried-over themes)
 * ============================================================ */
describe('Theme switching (FR-W02)', () => {
  test('apply sets data-theme on documentElement and body', () => {
    const fakeDoc = {
      documentElement: { setAttribute: jest.fn() },
      body: { setAttribute: jest.fn() }
    };
    const fakeLink = { setAttribute: jest.fn() };
    const storage = makeMockStorage();
    ThemeManager.apply('mountains', fakeDoc, fakeLink, storage);
    expect(fakeDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'mountains');
    expect(fakeDoc.body.setAttribute).toHaveBeenCalledWith('data-theme', 'mountains');
    expect(fakeLink.setAttribute).toHaveBeenCalledWith('href', 'themes/mountains.css');
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe('mountains');
  });

  test('apply with unknown theme falls back to default', () => {
    const fakeDoc = {
      documentElement: { setAttribute: jest.fn() },
      body: { setAttribute: jest.fn() }
    };
    const result = ThemeManager.apply('alien-planet', fakeDoc, null, null);
    expect(result).toBe(DEFAULT_THEME);
    expect(fakeDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', DEFAULT_THEME);
  });

  test('load returns default when nothing persisted', () => {
    const storage = makeMockStorage();
    expect(ThemeManager.load(storage)).toBe(DEFAULT_THEME);
  });

  test('load returns persisted value when valid', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.theme, 'desert');
    expect(ThemeManager.load(storage)).toBe('desert');
  });

  test('load returns default when persisted value is invalid', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.theme, 'something-else');
    expect(ThemeManager.load(storage)).toBe(DEFAULT_THEME);
  });

  test('all three valid themes are registered (Beach / Mountains / Desert)', () => {
    expect(VALID_THEMES).toEqual(expect.arrayContaining(['beach', 'mountains', 'desert']));
    expect(VALID_THEMES.length).toBe(3);
    expect(DEFAULT_THEME).toBe('beach');
  });

  test('switching themes mid-round does not affect board state', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    g.applyMove(4);
    const before = g.board.cells.slice();
    const fakeDoc = {
      documentElement: { setAttribute: jest.fn() },
      body: { setAttribute: jest.fn() }
    };
    ThemeManager.apply('desert', fakeDoc, null, null);
    expect(g.board.cells).toEqual(before);
  });
});

/* ============================================================
 * GameController integration
 * ============================================================ */
describe('GameController integration', () => {
  test('starting-player rotates across rounds', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    expect(g.firstPlayer).toBe(1);
    expect(g.symbols[1]).toBe('X');
    g.startNextRound();
    expect(g.firstPlayer).toBe(2);
    expect(g.symbols[2]).toBe('X');
    g.startNextRound();
    expect(g.firstPlayer).toBe(1);
  });

  test('win records wins/losses in the score store', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob' });
    [0, 3, 1, 4, 2].forEach(i => g.applyMove(i));
    expect(g.roundOver).toBe(true);
    const sm = new ScoreManager(storage);
    expect(sm.getPlayer('Alice').wins).toBe(1);
    expect(sm.getPlayer('Bob').losses).toBe(1);
  });

  test('draw records a draw for both players', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    [4, 0, 8, 2, 1, 7, 3, 5, 6].forEach(i => g.applyMove(i));
    expect(g.roundOver).toBe(true);
    expect(g.board.getOutcome()).toBe('draw');
    const sm = new ScoreManager(storage);
    expect(sm.getPlayer('A').draws).toBe(1);
    expect(sm.getPlayer('B').draws).toBe(1);
  });

  test('move on occupied cell is rejected', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    expect(g.applyMove(4).ok).toBe(true);
    const r = g.applyMove(4);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('invalid');
  });

  test('full HvAI round (Hard) never produces a human win across many seeds', () => {
    let humanWins = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = new GameController({ storage: makeMockStorage(), rng: createRng(seed) });
      g.configure({ mode: 'hvai', difficulty: 'hard', p1: 'Human' });
      // Human plays "randomly" via this seeded RNG
      const rng = createRng(seed * 31 + 7);
      while (!g.roundOver) {
        if (g.isAITurn()) {
          g.aiMove();
        } else {
          const empties = g.board.emptyCells();
          const idx = empties[Math.floor(rng() * empties.length)];
          g.applyMove(idx);
        }
      }
      const winner = g.board.checkWinner();
      if (winner) {
        const winningSym = winner.winner;
        const humanSym = g.symbols[1];
        if (winningSym === humanSym) humanWins += 1;
      }
    }
    expect(humanWins).toBe(0);
  });

  test('forfeit produces no score change and ends the round', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B' });
    g.applyMove(0);
    g.forfeit();
    expect(g.roundOver).toBe(true);
    const sm2 = new ScoreManager(storage);
    expect(Object.keys(sm2.getAll().players).length).toBe(0);
  });
});

/* ============================================================
 * Name validation
 * ============================================================ */
describe('Name validation', () => {
  test('rejects empty / whitespace input', () => {
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('').ok).toBe(false);
  });
  test('rejects reserved names case-insensitively', () => {
    expect(validateName('AI (Hard)').ok).toBe(false);
    expect(validateName('computer').ok).toBe(false);
    expect(validateName('AI').ok).toBe(false);
  });
  test('rejects HTML-tag and other invalid characters', () => {
    expect(validateName('<script>').ok).toBe(false);
    expect(validateName('Bob!').ok).toBe(false);
  });
  test('accepts valid names and trims whitespace', () => {
    const r = validateName('  Alice  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Alice');
  });
  test('rejects names longer than 20 characters', () => {
    expect(validateName('A'.repeat(21)).ok).toBe(false);
  });
});

describe('sanitizeName', () => {
  test('trims and collapses whitespace', () => {
    expect(sanitizeName('  Alice   B  ')).toBe('Alice B');
  });
  test('non-string yields empty', () => {
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(undefined)).toBe('');
    expect(sanitizeName(42)).toBe('');
  });
});

/* ============================================================
 * UI / DOM smoke tests (jsdom)
 * ============================================================ */
describe('UI / DOM behaviour (jsdom)', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
    document.documentElement.innerHTML = html
      .replace(/<!DOCTYPE html>/i, '')
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '');
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  test('index.html exposes the expected views, board cells, and controls', () => {
    expect(document.getElementById('view-menu')).not.toBeNull();
    expect(document.getElementById('view-game')).not.toBeNull();
    expect(document.getElementById('view-stats')).not.toBeNull();
    expect(document.getElementById('view-help')).not.toBeNull();
    expect(document.getElementById('board')).not.toBeNull();
    expect(document.querySelectorAll('.cell').length).toBe(9);
    expect(document.getElementById('btn-undo')).not.toBeNull();   // FR-W20
    expect(document.getElementById('mute-btn')).not.toBeNull();   // FR-W21
    expect(document.getElementById('btn-stats')).not.toBeNull();  // FR-W22
    expect(document.querySelectorAll('.theme-btn').length).toBe(3); // FR-W02
  });

  test('symbol values rendered via textContent are XSS-safe', () => {
    const xss = '<script>alert(1)</script>';
    const td = document.createElement('td');
    td.textContent = xss;
    expect(td.querySelector('script')).toBeNull();
    expect(td.textContent).toBe(xss);
  });

  test('theme application sets data-theme attribute on document and body', () => {
    const link = document.getElementById('theme-link');
    ThemeManager.apply('desert', document, link, null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('desert');
    expect(document.body.getAttribute('data-theme')).toBe('desert');
    expect(link.getAttribute('href')).toBe('themes/desert.css');
  });
});
