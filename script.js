/* script.js - Chess For All
   Uses chess.js and chessboard.js. Provides:
   - Hotseat (2-player) and AI mode (levels 1-10)
   - Side selection, Fischer Random option
   - Timers per side (minutes)
   - Move log, PGN, undo/reset
*/

/* Globals */
let board = null;
let game = new Chess();
let config = null;

let aiEnabled = false;
let aiLevel = 5;
let playerSide = 'white'; // when vs AI: which side player takes ('white' or 'black')
let humanPlaysWhite = true;
let timers = {white: 0, black: 0}; // seconds remaining (0 = unlimited)
let timerInterval = null;
let gameActive = false;

/* DOM */
const statusEl = () => document.getElementById('status');
const moveListEl = () => document.getElementById('moveList');
const pgnEl = () => document.getElementById('pgn');
const levelEl = () => document.getElementById('level');
const levelValEl = () => document.getElementById('levelVal');
const modeEl = () => document.getElementById('mode');
const timeEl = () => document.getElementById('time');
const randomizeEl = () => document.getElementById('randomize');

/* Map AI level to behavior */
function aiDepthForLevel(level){
  if(level <= 3) return 0;      // mostly random
  if(level <= 6) return 1;      // shallow
  if(level <= 8) return 2;
  return 3;                     // deepest (but still small to keep it fast in browser)
}

/* Initialize chessboard */
function initBoard() {
  const onDragStart = function(source, piece, position, orientation) {
    if (!gameActive) return false;
    if (game.game_over()) return false;
    // disallow dragging opponent's pieces in AI mode
    if (aiEnabled) {
      const turn = game.turn() === 'w' ? 'white' : 'black';
      if (turn !== playerSide) return false;
    }
    // in hotseat both can move
  };

  const onDrop = function(source, target, piece, newPos, oldPos, orientation) {
    // Attempt move
    const move = game.move({from: source, to: target, promotion: 'q'});
    if (move === null) {
      return 'snapback';
    } else {
      updateUI();
      // If AI enabled and it's AI's turn, make AI move after a short delay
      if (aiEnabled) {
        const turn = game.turn() === 'w' ? 'white' : 'black';
        if (turn !== playerSide && !game.game_over()) {
          setTimeout(() => aiMakeMove(), 300);
        }
      }
    }
  };

  const onSnapEnd = function() {
    board.position(game.fen());
  };

  config = {
    draggable: true,
    position: 'start',
    pieceTheme: 'https://unpkg.com/chessboardjs@1.0.0/www/img/chesspieces/wikipedia/{piece}.png',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
  };

  board = Chessboard('board', config);
}

/* Update move list, PGN, status, board */
function updateUI() {
  board.position(game.fen());
  updateMoveList();
  pgnEl().value = game.pgn();
  updateStatus();
  highlightLastMove();
}

function updateStatus() {
  if (game.in_checkmate()) {
    statusEl().textContent = 'Checkmate — ' + (game.turn() === 'w' ? 'Black' : 'White') + ' wins';
    stopTimers();
    gameActive = false;
  } else if (game.in_draw()) {
    statusEl().textContent = 'Draw';
    stopTimers();
    gameActive = false;
  } else {
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    statusEl().textContent = `${turn} to move` + (game.in_check() ? ' — Check!' : '');
  }
}

function updateMoveList() {
  const history = game.history({verbose:true});
  moveListEl().innerHTML = '';
  let html = '';
  for (let i = 0; i < history.length; i += 2) {
    const whiteMove = history[i] ? history[i].san : '';
    const blackMove = history[i+1] ? history[i+1].san : '';
    const moveNo = Math.floor(i/2) + 1;
    const li = document.createElement('li');
    li.innerHTML = `<strong>${moveNo}.</strong> ${whiteMove} ${blackMove ? '&nbsp;&nbsp;'+blackMove : ''}`;
    moveListEl().appendChild(li);
  }
  // scroll to bottom
  moveListEl().scrollTop = moveListEl().scrollHeight;
}

/* Highlight last move squares */
function highlightLastMove() {
  // remove old highlights
  document.querySelectorAll('.square-55d63').forEach(s => s.classList.remove('highlight'));
  const history = game.history({verbose:true});
  if (history.length === 0) return;
  const last = history[history.length - 1];
  const from = last.from;
  const to = last.to;
  const fromEl = document.querySelector('.square-' + from);
  const toEl = document.querySelector('.square-' + to);
  // chessboardjs uses classes like square-55d63 and a data-square attr — selecting via data-square
  const fromNode = document.querySelector('[data-square="' + from + '"]');
  const toNode = document.querySelector('[data-square="' + to + '"]');
  if (fromNode) fromNode.classList.add('highlight');
  if (toNode) toNode.classList.add('highlight');
}

/* Start new game */
function startGame() {
  // Mode and settings
  aiEnabled = (modeEl().value === 'ai');
  aiLevel = parseInt(levelEl().value, 10);
  const sideChoice = document.querySelector('input[name="side"]:checked').value;
  humanPlaysWhite = true;

  if (aiEnabled) {
    if (sideChoice === 'random') {
      playerSide = Math.random() < 0.5 ? 'white' : 'black';
    } else {
      playerSide = sideChoice;
    }
    humanPlaysWhite = (playerSide === 'white');
  } else {
    playerSide = 'white'; // not used in hotseat
    humanPlaysWhite = true;
  }

  // Time control
  const minutes = Math.max(0, parseInt(timeEl().value || '0', 10));
  if (minutes === 0) { timers.white = 0; timers.black = 0; } else { timers.white = timers.black = minutes * 60; }

  // Randomize starting position (Chess960)
  if (randomizeEl().checked) {
    const fen = generateChess960FEN();
    game = new Chess(fen);
    board.position(fen);
  } else {
    game = new Chess();
    board.start();
  }

  // Orientation for player's side: show player's perspective at bottom when vs AI
  if (aiEnabled) {
    board.orientation(playerSide === 'white' ? 'white' : 'black');
  } else {
    board.orientation('white');
  }

  gameActive = true;
  updateUI();
  startTimers();

  // If AI plays white, make AI move immediately
  if (aiEnabled && game.turn() === (playerSide === 'white' ? 'b' : 'w')) {
    setTimeout(() => aiMakeMove(), 350);
  }
}

/* Reset fully to initial state */
function resetGame() {
  stopTimers();
  game = new Chess();
  board.start();
  board.orientation('white');
  timers.white = timers.black = 0;
  gameActive = false;
  updateUI();
  statusEl().textContent = 'Idle';
  pgnEl().value = '';
}

/* Undo last move (or last two in AI mode) */
function undoMove() {
  if (!game) return;
  if (aiEnabled) {
    // undo twice to revert player's move and AI reply (if present)
    game.undo();
    game.undo();
  } else {
    game.undo();
  }
  updateUI();
}

/* TIMERS */
function startTimers() {
  stopTimers();
  if (timers.white === 0 && timers.black === 0) return; // unlimited
  timerInterval = setInterval(() => {
    if (!gameActive) return;
    const side = (game.turn() === 'w') ? 'white' : 'black';
    if (timers[side] > 0) {
      timers[side]--;
      updateTimerDisplays();
      if (timers[side] <= 0) {
        // time out: other side wins
        statusEl().textContent = `Time out — ${(side === 'white') ? 'Black' : 'White'} wins`;
        gameActive = false;
        stopTimers();
      }
    }
  }, 1000);
  updateTimerDisplays();
}

function stopTimers() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplays() {
  const format = (s) => {
    if (s === 0) return '--:--';
    const m = Math.floor(s/60); const sec = s%60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  document.getElementById('whiteTimer').textContent = format(timers.white);
  document.getElementById('blackTimer').textContent = format(timers.black);
}

/* AI: choose move */
function aiMakeMove() {
  if (game.game_over()) return;
  const level = aiLevel;
  const depth = aiDepthForLevel(level);

  let move = null;
  if (depth === 0) {
    // mostly random, but prefer captures
    const moves = game.moves({verbose:true});
    // prefer captures
    const captures = moves.filter(m => m.captured);
    if (captures.length && Math.random() < 0.7) move = captures[Math.floor(Math.random()*captures.length)].san;
    else move = moves[Math.floor(Math.random()*moves.length)].san;
    game.move(move);
  } else {
    // minimax with alpha-beta on material + piece square tables
    const best = minimaxRoot(depth, game.turn() === 'w');
    if (best && best.move) {
      game.move(best.move);
    } else {
      // fallback random
      const moves = game.moves();
      game.move(moves[Math.floor(Math.random()*moves.length)]);
    }
  }

  updateUI();
}

/* Minimax implementation */
const pieceValues = { p:100, n:320, b:330, r:500, q:900, k:20000 };
function evaluateBoard(g) {
  const board = g.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece) {
        const val = pieceValues[piece.type] || 0;
        score += (piece.color === 'w') ? val : -val;
      }
    }
  }
  return score;
}

function minimaxRoot(depth, isWhite) {
  const moves = game.moves({verbose:true});
  let bestMove = null;
  let bestScore = isWhite ? -Infinity : Infinity;

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    game.move(m.san);
    const score = minimax(depth - 1, -Infinity, Infinity, !isWhite);
    game.undo();
    if (isWhite) {
      if (score > bestScore) { bestScore = score; bestMove = m; }
    } else {
      if (score < bestScore) { bestScore = score; bestMove = m; }
    }
  }
  return { move: bestMove ? bestMove.san : null, score: bestScore };
}

function minimax(depth, alpha, beta, isWhiteTurn) {
  if (depth === 0) return evaluateBoard(game);
  const moves = game.moves({verbose:true});
  if (isWhiteTurn) {
    let maxEval = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      game.move(moves[i].san);
      const evalScore = minimax(depth - 1, alpha, beta, false);
      game.undo();
      if (evalScore > maxEval) maxEval = evalScore;
      if (evalScore > alpha) alpha = evalScore;
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let i = 0; i < moves.length; i++) {
      game.move(moves[i].san);
      const evalScore = minimax(depth - 1, alpha, beta, true);
      game.undo();
      if (evalScore < minEval) minEval = evalScore;
      if (evalScore < beta) beta = evalScore;
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

/* Chess960 FEN generator for randomized start (only back-rank randomized) */
function generateChess960FEN(){
  // Start with array of 8 squares
  const pieces = new Array(8).fill(null);
  // place bishops on opposite color squares
  const lightSquares = [0,2,4,6];
  const darkSquares = [1,3,5,7];
  const b1 = lightSquares[Math.floor(Math.random()*lightSquares.length)];
  const b2 = darkSquares[Math.floor(Math.random()*darkSquares.length)];
  pieces[b1] = 'b';
  pieces[b2] = 'b';
  // place queen
  const freeIndexes = [];
  for (let i=0;i<8;i++) if (!pieces[i]) freeIndexes.push(i);
  const qIndex = freeIndexes.splice(Math.floor(Math.random()*freeIndexes.length),1)[0];
  pieces[qIndex] = 'q';
  // place knights
  const free2 = [];
  for (let i=0;i<8;i++) if (!pieces[i]) free2.push(i);
  const n1 = free2.splice(Math.floor(Math.random()*free2.length),1)[0];
  const n2 = free2.splice(Math.floor(Math.random()*free2.length),1)[0];
  pieces[n1] = 'n';
  pieces[n2] = 'n';
  // place rooks and king with king between rooks
  const remaining = [];
  for (let i=0;i<8;i++) if (!pieces[i]) remaining.push(i);
  // remaining length should be 3
  remaining.sort((a,b)=>a-b);
  // pick positions such that king between rooks: choose any permutation of r,k,r with king index between
  // easiest: assign rooks to first and last, king to middle
  pieces[remaining[0]] = 'r';
  pieces[remaining[1]] = 'k';
  pieces[remaining[2]] = 'r';
  // build FEN: white back rank, pawns, empty ranks, black pawns, black back rank reversed
  const whiteBack = pieces.map(p => p.toUpperCase()).join('');
  const whitePawns = 'PPPPPPPP';
  const empty = '8';
  const blackPawns = 'pppppppp';
  const blackBack = pieces.slice().reverse().map(p => p).join(''); // black uses lowercase reversed order
  // black back must be lowercase and reflect mirrored pieces
  const blackBackLower = pieces.slice().reverse().map(p=>p).join('');
  const fen = `${whiteBack}/${whitePawns}/${empty}/${empty}/${empty}/${empty}/${blackPawns}/${blackBackLower} w KQkq - 0 1`;
  return fen;
}

/* Hook up DOM events */
function attachListeners() {
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('undoBtn').addEventListener('click', () => { undoMove(); updateUI(); });

  levelEl().addEventListener('input', () => {
    levelValEl().textContent = levelEl().value;
  });

  // toggle ai-controls visibility
  modeEl().addEventListener('change', () => {
    const aiControls = document.querySelectorAll('.ai-controls');
    if (modeEl().value === 'ai') {
      aiControls.forEach(n => n.style.display = 'flex');
    } else {
      aiControls.forEach(n => n.style.display = 'none');
    }
  });

  // initialize visibility according to default
  const ev = new Event('change'); modeEl().dispatchEvent(ev);
}

/* Initialize on DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  initBoard();
  attachListeners();
  updateUI();
  statusEl().textContent = 'Idle';
});
