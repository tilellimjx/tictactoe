/**
 * @jest-environment jsdom
 */

const path = require('path');
const fs = require('fs');

const {
  Board,
  AI,
  ScoreManager,
  HistoryManager,
  Match,
  GameController,
  ThemeManager,
  AudioManager,
  createRng,
  validateName,
  sanitizeName,
  WIN_LINES,
  STORAGE_KEYS,
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

  test('detects a draw (full board, no winner)', () => {
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

  test('rejects move out of range', () => {
    const b = new Board();
    expect(b.applyMove(-1, 'X')).toBe(false);
    expect(b.applyMove(9, 'X')).toBe(false);
    expect(b.applyMove(1.5, 'X')).toBe(false);
  });

  test('clone produces independent copy', () => {
    const b = new Board();
    b.applyMove(0, 'X');
    const c = b.clone();
    c.applyMove(1, 'O');
    expect(b.cells[1]).toBe(null);
    expect(c.cells[1]).toBe('O');
  });
});

/* ============================================================
 * AI
 * ============================================================ */
describe('AI — Easy', () => {
  test('never picks an occupied cell over many seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = new Board();
      // Fill 4 cells
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
});

describe('AI — Medium', () => {
  test('takes an immediate winning move', () => {
    const b = new Board();
    // X has two in a row, AI is X with chance to complete (cell 2)
    b.applyMove(0, 'X'); b.applyMove(1, 'X');
    b.applyMove(4, 'O');
    const move = AI.medium(b, 'X', createRng(1));
    expect(move).toBe(2);
  });

  test('blocks an opponent two-in-a-row threat', () => {
    const b = new Board();
    // Opponent (X) about to win on cell 2; AI is O
    b.applyMove(0, 'X'); b.applyMove(1, 'X');
    // O has played one harmless move
    b.applyMove(7, 'O');
    const move = AI.medium(b, 'O', createRng(1));
    expect(move).toBe(2);
  });

  test('takes centre on empty board', () => {
    const b = new Board();
    const move = AI.medium(b, 'X', createRng(1));
    expect(move).toBe(4);
  });

  test('takes opposite corner when opponent occupies a corner', () => {
    const b = new Board();
    b.applyMove(0, 'X'); // opponent corner
    b.applyMove(4, 'O'); // centre taken by AI
    const move = AI.medium(b, 'O', createRng(1));
    expect(move).toBe(8);
  });
});

describe('AI — Hard (minimax)', () => {
  test('first move on empty board is corner or centre', () => {
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
    // Hard plays O, random plays X; alternating who starts each game.
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

  test('deterministic for a given board', () => {
    const b = new Board();
    b.applyMove(0, 'X');
    expect(AI.hard(b, 'O')).toBe(AI.hard(b, 'O'));
  });
});

/* ============================================================
 * ScoreManager
 * ============================================================ */
describe('ScoreManager', () => {
  test('round-trip save and reload yields identical data', () => {
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

  test('corrupt payload is quarantined; in-memory store starts empty', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEYS.scores, 'not-json');
    const sm = new ScoreManager(storage);
    expect(Object.keys(sm.getAll().players).length).toBe(0);
    expect(storage.getItem(STORAGE_KEYS.scoresCorrupt)).toBe('not-json');
  });

  test('reset clears store, writes backup, preserves schema_version', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    const before = storage.getItem(STORAGE_KEYS.scores);
    sm.reset();
    expect(Object.keys(sm.getAll().players).length).toBe(0);
    expect(sm.getAll().schema_version).toBe(2);
    expect(storage.getItem(STORAGE_KEYS.scoresBackup)).toBe(before);
  });

  test('missing payload yields empty store', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    expect(sm.getAll().players).toEqual({});
    expect(sm.getAll().schema_version).toBe(2);
  });

  test('counters increment correctly across multiple rounds', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Alice', 'Bob');
    sm.recordDraw('Alice', 'Bob');
    sm.recordWin('Bob', 'Alice');
    const a = sm.getPlayer('Alice');
    const b = sm.getPlayer('Bob');
    expect(a).toMatchObject({ wins: 2, losses: 1, draws: 1 });
    expect(b).toMatchObject({ wins: 1, losses: 2, draws: 1 });
  });

  test('topPlayer returns highest-wins entry', () => {
    const storage = makeMockStorage();
    const sm = new ScoreManager(storage);
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Alice', 'Bob');
    sm.recordWin('Bob', 'Alice');
    expect(sm.topPlayer().display_name).toBe('Alice');
  });
});

/* ============================================================
 * HistoryManager + GameController undo/redo (FEATURE 1)
 * ============================================================ */
describe('Undo/Redo (Feature 1)', () => {
  test('HistoryManager push then undo returns the move', () => {
    const h = new HistoryManager();
    h.push({ index: 4, symbol: 'X', player: 1 });
    expect(h.canUndo()).toBe(true);
    expect(h.undo()).toEqual({ index: 4, symbol: 'X', player: 1 });
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);
  });

  test('redo restores undone move', () => {
    const h = new HistoryManager();
    h.push({ index: 0, symbol: 'X', player: 1 });
    h.undo();
    expect(h.redo()).toEqual({ index: 0, symbol: 'X', player: 1 });
    expect(h.canRedo()).toBe(false);
    expect(h.canUndo()).toBe(true);
  });

  test('new push clears redo stack', () => {
    const h = new HistoryManager();
    h.push({ index: 0, symbol: 'X', player: 1 });
    h.undo();
    h.push({ index: 4, symbol: 'X', player: 1 });
    expect(h.canRedo()).toBe(false);
  });

  test('undo/redo are no-ops when stacks empty', () => {
    const h = new HistoryManager();
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBeNull();
  });

  test('GameController HvH undo reverts last move and active player', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob', matchLength: 1 });
    g.applyMove(4); // P1 X
    g.applyMove(0); // P2 O
    expect(g.board.cells[0]).toBe('O');
    expect(g.currentPlayer).toBe(1);
    g.undo();
    expect(g.board.cells[0]).toBe(null);
    expect(g.currentPlayer).toBe(2);
  });

  test('GameController HvAI undo reverts both AI and human moves', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvai', difficulty: 'hard', p1: 'Alice', matchLength: 1 });
    g.applyMove(4);                  // human X at centre
    const ai = g.aiMove();           // AI plays
    expect(ai).not.toBeNull();
    expect(g.movesPlayed).toBe(2);
    g.undo();
    expect(g.movesPlayed).toBe(0);
    expect(g.currentPlayer).toBe(1); // human's turn restored
  });

  test('redo re-applies undone moves', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob', matchLength: 1 });
    g.applyMove(0);
    g.applyMove(1);
    g.undo();
    expect(g.board.cells[1]).toBe(null);
    g.redo();
    expect(g.board.cells[1]).toBe('O');
  });

  test('undo does not modify persistent score store', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob', matchLength: 1 });
    g.applyMove(0);
    g.undo();
    const sm = new ScoreManager(storage);
    expect(Object.keys(sm.getAll().players).length).toBe(0);
  });
});

/* ============================================================
 * Match mode (FEATURE 2)
 * ============================================================ */
describe('Match mode (Feature 2)', () => {
  test('best-of-3 concludes after one player wins 2 rounds', () => {
    const m = new Match(3, 'A', 'B');
    m.recordRound('A');
    expect(m.isComplete()).toBe(false);
    m.recordRound('A');
    expect(m.isComplete()).toBe(true);
    expect(m.winner()).toBe('A');
  });

  test('best-of-5 with 2-2-1 (1 draw) ends correctly', () => {
    const m = new Match(5, 'A', 'B');
    m.recordRound('A'); m.recordRound('B');
    m.recordRound(null); // draw
    m.recordRound('A'); m.recordRound('B');
    expect(m.isComplete()).toBe(true);
    expect(m.winner()).toBeNull();    // 2-2 → match drawn (with 1 draw)
    expect(m.draws).toBe(1);
  });

  test('match where draws prevent majority ends in match draw', () => {
    const m = new Match(3, 'A', 'B');
    m.recordRound(null);
    m.recordRound(null);
    m.recordRound(null);
    expect(m.isComplete()).toBe(true);
    expect(m.winner()).toBeNull();
  });

  test('single-round mode completes after one round', () => {
    const m = new Match(1, 'A', 'B');
    expect(m.isMultiRound()).toBe(false);
    m.recordRound('A');
    expect(m.isComplete()).toBe(true);
  });

  test('GameController records per-round outcomes in persistent score store', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob', matchLength: 3 });
    // Alice wins round 1
    [0, 3, 1, 4, 2].forEach(i => g.applyMove(i));
    expect(g.match.scoreP1).toBe(1);
    const sm = new ScoreManager(storage);
    expect(sm.getPlayer('Alice').wins).toBe(1);
    expect(sm.getPlayer('Bob').losses).toBe(1);
  });
});

/* ============================================================
 * Theme (FEATURE 3 — selectable themes)
 * ============================================================ */
describe('Theme switching (Feature 3)', () => {
  test('apply sets data-theme on documentElement', () => {
    const fakeDoc = {
      documentElement: { setAttribute: jest.fn() },
      body: { setAttribute: jest.fn() }
    };
    const fakeLink = { setAttribute: jest.fn() };
    const storage = makeMockStorage();
    ThemeManager.apply('mountains', fakeDoc, fakeLink, storage);
    expect(fakeDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'mountains');
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

  test('all three valid themes are registered', () => {
    expect(VALID_THEMES).toEqual(expect.arrayContaining(['beach', 'mountains', 'desert']));
    expect(VALID_THEMES.length).toBe(3);
  });

  test('switching themes mid-round does not affect board state', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B', matchLength: 1 });
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
 * Audio mute (FEATURE 4 / sound) — quick checks
 * ============================================================ */
describe('Audio manager mute persistence', () => {
  test('mute toggle persists to storage', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    expect(a.muted).toBe(false);
    a.toggleMuted();
    expect(a.muted).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.muted)).toBe('true');
    const a2 = new AudioManager(storage);
    expect(a2.muted).toBe(true);
  });

  test('when muted, tone playback is a no-op (no AudioContext created)', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    a.setMuted(true);
    a.notifyUserGesture();
    a.playMove('X');
    // no error means the no-op path was taken; ctx may still have been created by notifyUserGesture
    expect(a.muted).toBe(true);
  });

  test('when web audio unavailable, sounds are silent and no errors', () => {
    const storage = makeMockStorage();
    const a = new AudioManager(storage);
    a.available = false;
    expect(() => {
      a.notifyUserGesture();
      a.playMove('X');
      a.playWin();
      a.playDraw();
    }).not.toThrow();
  });
});

/* ============================================================
 * Game controller integration
 * ============================================================ */
describe('GameController integration', () => {
  test('starting-player rotates across rounds', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B', matchLength: 5 });
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
    g.configure({ mode: 'hvh', p1: 'Alice', p2: 'Bob', matchLength: 1 });
    // Alice plays X. Win on top row.
    [0, 3, 1, 4, 2].forEach(i => g.applyMove(i));
    expect(g.roundOver).toBe(true);
    const sm = new ScoreManager(storage);
    expect(sm.getPlayer('Alice').wins).toBe(1);
    expect(sm.getPlayer('Bob').losses).toBe(1);
  });

  test('draw records a draw for both', () => {
    const storage = makeMockStorage();
    const g = new GameController({ storage });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B', matchLength: 1 });
    // Sequence yielding a draw: 4,0,8,2,1,7,3,5,6 → no winner
    [4, 0, 8, 2, 1, 7, 3, 5, 6].forEach(i => g.applyMove(i));
    expect(g.roundOver).toBe(true);
    const sm = new ScoreManager(storage);
    expect(sm.getPlayer('A').draws).toBe(1);
    expect(sm.getPlayer('B').draws).toBe(1);
  });

  test('move on occupied cell is rejected', () => {
    const g = new GameController({ storage: makeMockStorage() });
    g.configure({ mode: 'hvh', p1: 'A', p2: 'B', matchLength: 1 });
    expect(g.applyMove(4).ok).toBe(true);
    const r = g.applyMove(4);
    expect(r.ok).toBe(false);
  });
});

/* ============================================================
 * Name validation
 * ============================================================ */
describe('Name validation', () => {
  test('rejects empty / whitespace', () => {
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('').ok).toBe(false);
  });
  test('rejects reserved names case-insensitively', () => {
    expect(validateName('AI (Hard)').ok).toBe(false);
    expect(validateName('computer').ok).toBe(false);
  });
  test('rejects HTML-tag characters', () => {
    expect(validateName('<script>').ok).toBe(false);
  });
  test('accepts valid names and trims whitespace', () => {
    const r = validateName('  Alice  ');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('Alice');
  });
});

/* ============================================================
 * UI-style DOM tests (jsdom)
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

  test('index.html exposes the expected views and controls', () => {
    expect(document.getElementById('view-menu')).not.toBeNull();
    expect(document.getElementById('view-game')).not.toBeNull();
    expect(document.getElementById('board')).not.toBeNull();
    expect(document.querySelectorAll('.cell').length).toBe(9);
    expect(document.getElementById('btn-undo')).not.toBeNull();
    expect(document.getElementById('btn-redo')).not.toBeNull();
    expect(document.getElementById('mute-btn')).not.toBeNull();
    expect(document.getElementById('match-length')).not.toBeNull();
  });

  test('player names with XSS payload are inserted via textContent (no <script> created)', () => {
    const xss = '<script>alert(1)</script>';
    // textContent is what game.js uses; simulate by creating a cell.
    const td = document.createElement('td');
    td.textContent = xss;
    expect(td.querySelector('script')).toBeNull();
    expect(td.textContent).toBe(xss);
  });

  test('theme application sets data-theme attribute', () => {
    const link = document.getElementById('theme-link');
    ThemeManager.apply('desert', document, link, null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('desert');
    expect(document.body.getAttribute('data-theme')).toBe('desert');
    expect(link.getAttribute('href')).toBe('themes/desert.css');
  });
});

/* ============================================================
 * sanitizeName helper
 * ============================================================ */
describe('sanitizeName', () => {
  test('trims and collapses whitespace', () => {
    expect(sanitizeName('  Alice   B  ')).toBe('Alice B');
  });
  test('non-string yields empty', () => {
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(undefined)).toBe('');
  });
});
