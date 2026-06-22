'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#5c7cfa', // J - blue
  '#ffb74d', // L - orange
  '#bfa15a', // N - tuerca (bronce)
  '#ff5252', // power-up: bomba
  '#ffeb3b', // power-up: rayo
  '#ec407a', // power-up: tinte
  '#26c6da', // power-up: gravedad
  '#7e57c2', // power-up: congelar
];

const POWERUP_GLYPHS = ['', '', '', '', '', '', '', '', '', 'B', 'R', 'T', 'G', 'C'];
const POWERUP_TYPES = ['bomb', 'lightning', 'dye', 'gravity', 'freeze'];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const POWERUP_FREQUENCY = 5;
const POWERUP_SCORE = 50;
const FREEZE_DURATION_MS = 5000;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeSwitch = document.getElementById('theme-switch');
const skinSelect = document.getElementById('skin-select');
const freezeSection = document.getElementById('freeze-section');
const freezeValueEl = document.getElementById('freeze-value');
const pauseMenu = document.getElementById('pause-menu');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const startLevelSelect = document.getElementById('start-level-select');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const highScoresListEl = document.getElementById('highscores-list');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const gameOverExtra = document.getElementById('gameover-extra');
const playerNameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');

const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId,
    nextIsPowerUp, freezeUntil, startLevel = 1, combo, bestCombo, maxLines, scoreSaved, currentSkin;

function getGridColor() {
  return getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeSwitch.checked = isLight;
  localStorage.setItem('tetris-theme', isLight ? 'light' : 'dark');
}

function initTheme() {
  applyTheme(localStorage.getItem('tetris-theme') === 'light');
  themeSwitch.addEventListener('change', () => applyTheme(themeSwitch.checked));
}

function loadHighScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    if (Array.isArray(raw)) return raw;
  } catch (e) { /* ignore corrupt data */ }
  return [];
}

function saveHighScores(list) {
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  return list;
}

function resetHighScores() {
  localStorage.removeItem(HIGHSCORES_KEY);
  renderHighScores();
}

function loadStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY));
    if (raw && typeof raw === 'object') {
      return { bestCombo: raw.bestCombo || 0, maxLines: raw.maxLines || 0 };
    }
  } catch (e) { /* ignore corrupt data */ }
  return { bestCombo: 0, maxLines: 0 };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function renderHighScores(highlightScore) {
  const list = loadHighScores();
  highScoresListEl.innerHTML = '';
  let highlighted = false;
  list.forEach(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.name} — ${entry.score.toLocaleString()}`;
    if (!highlighted && highlightScore !== undefined && entry.score === highlightScore) {
      li.classList.add('highscore-highlight');
      highlighted = true;
    }
    highScoresListEl.appendChild(li);
  });
}

function renderStats() {
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLines;
}

function applySkin(skin) {
  currentSkin = skin;
  document.body.classList.toggle('skin-neon', skin === 'neon');
  document.body.classList.toggle('skin-pastel', skin === 'pastel');
  document.body.classList.toggle('skin-pixel', skin === 'pixel');
  localStorage.setItem('tetris-skin', skin);
  if (skinSelect.value !== skin) skinSelect.value = skin;
  draw();
  drawNext();
}

function initSkin() {
  const saved = localStorage.getItem('tetris-skin') || 'retro';
  applySkin(saved);
  skinSelect.value = currentSkin;
  skinSelect.addEventListener('change', () => applySkin(skinSelect.value));
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPowerUpPiece() {
  const idx = Math.floor(Math.random() * POWERUP_TYPES.length);
  const type = 9 + idx;
  const shape = [[type]];
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0, powerUp: POWERUP_TYPES[idx] };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (Math.floor(prevLines / POWERUP_FREQUENCY) < Math.floor(lines / POWERUP_FREQUENCY)) {
      nextIsPowerUp = true;
    }
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.powerUp) activatePowerUp(current.powerUp, current.x, current.y);
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > bestCombo) bestCombo = combo;
  } else {
    combo = 0;
  }
  renderStats();
  spawn();
}

function activatePowerUp(name, x, y) {
  switch (name) {
    case 'bomb': powerUpBomb(x, y); break;
    case 'lightning': powerUpLightning(x, y); break;
    case 'dye': powerUpDye(); break;
    case 'gravity': powerUpGravity(); break;
    case 'freeze': powerUpFreeze(); break;
  }
  score += POWERUP_SCORE * level;
  updateHUD();
}

function powerUpBomb(x, y) {
  for (let r = y - 1; r <= y + 1; r++) {
    if (r < 0 || r >= ROWS) continue;
    for (let c = x - 1; c <= x + 1; c++) {
      if (c < 0 || c >= COLS) continue;
      board[r][c] = 0;
    }
  }
}

function powerUpLightning(x, y) {
  for (let c = 0; c < COLS; c++) board[y][c] = 0;
  for (let r = 0; r < ROWS; r++) board[r][x] = 0;
}

function powerUpDye() {
  const counts = {};
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
  const keys = Object.keys(counts);
  if (keys.length === 0) return;
  let bestColor = null, bestCount = -1;
  for (const k of keys) {
    if (counts[k] > bestCount) { bestCount = counts[k]; bestColor = Number(k); }
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === bestColor) board[r][c] = 0;
}

function powerUpGravity() {
  for (let c = 0; c < COLS; c++) {
    const colVals = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) colVals.push(board[r][c]);
    }
    const startRow = ROWS - colVals.length;
    for (let r = 0; r < ROWS; r++) {
      board[r][c] = (r < startRow) ? 0 : colVals[r - startRow];
    }
  }
}

function powerUpFreeze() {
  freezeUntil = performance.now() + FREEZE_DURATION_MS;
}

function spawn() {
  current = next;
  if (nextIsPowerUp) {
    next = randomPowerUpPiece();
    nextIsPowerUp = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function updateFreezeIndicator(remainingMs) {
  freezeSection.classList.remove('hidden');
  freezeValueEl.textContent = Math.ceil(remainingMs / 1000) + 's';
}

function hideFreezeIndicator() {
  freezeSection.classList.add('hidden');
}

function lightenColor(hexColor, amount) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const psize = size - 2;
  context.globalAlpha = alpha ?? 1;

  if (currentSkin === 'neon') {
    context.shadowBlur = 12;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(px, py, psize, psize);
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, psize, 4);
  } else if (currentSkin === 'pastel') {
    const pastelColor = lightenColor(color, 0.4);
    context.fillStyle = pastelColor;
    const radius = Math.max(2, size * 0.18);
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(px, py, psize, psize, radius);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(px + radius, py);
      context.arcTo(px + psize, py, px + psize, py + psize, radius);
      context.arcTo(px + psize, py + psize, px, py + psize, radius);
      context.arcTo(px, py + psize, px, py, radius);
      context.arcTo(px, py, px + psize, py, radius);
      context.closePath();
      context.fill();
    }
    context.fillStyle = 'rgba(255,255,255,0.25)';
    context.fillRect(px, py, psize, 4);
  } else if (currentSkin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px, py, psize, psize);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, psize, 4);
    const half = psize / 2;
    context.fillStyle = lightenColor(color, 0.25);
    context.fillRect(px, py, half, half);
    context.fillRect(px + half, py + half, psize - half, psize - half);
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.fillRect(px + half, py, psize - half, half);
    context.fillRect(px, py + half, half, psize - half);
  } else {
    // retro (default)
    context.fillStyle = color;
    context.fillRect(px, py, psize, psize);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, psize, 4);
  }

  const glyph = POWERUP_GLYPHS[colorIndex];
  if (glyph) {
    context.fillStyle = '#ffffff';
    context.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getGridColor();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.classList.remove('hidden');
  pauseMenu.classList.add('hidden');
  pauseControlsList.classList.add('hidden');

  if (lines > maxLines) maxLines = lines;
  if (combo > bestCombo) bestCombo = combo;
  saveStats({ bestCombo, maxLines });
  renderStats();

  scoreSaved = false;
  playerNameInput.value = '';
  gameOverExtra.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function saveCurrentScore() {
  if (scoreSaved) return;
  const name = playerNameInput.value.trim() || 'Jugador';
  const list = loadHighScores();
  list.push({ name, score });
  saveHighScores(list);
  scoreSaved = true;
  gameOverExtra.classList.add('hidden');
  renderHighScores(score);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    pauseControlsList.classList.add('hidden');
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    restartBtn.classList.add('hidden');
    startLevelSelect.value = String(startLevel);
    pauseMenu.classList.remove('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  const frozen = freezeUntil && ts < freezeUntil;
  if (frozen) {
    updateFreezeIndicator(freezeUntil - ts);
  } else {
    if (freezeUntil) { freezeUntil = 0; hideFreezeIndicator(); }
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  nextIsPowerUp = false;
  freezeUntil = 0;
  combo = 0;
  const stats = loadStats();
  bestCombo = stats.bestCombo;
  maxLines = stats.maxLines;
  scoreSaved = false;
  hideFreezeIndicator();
  gameOverExtra.classList.add('hidden');
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  restartBtn.classList.remove('hidden');
  pauseMenu.classList.add('hidden');
  pauseControlsList.classList.add('hidden');
  renderStats();
  renderHighScores();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  startLevel = Number(startLevelSelect.value);
  init();
});
toggleControlsBtn.addEventListener('click', () => {
  pauseControlsList.classList.toggle('hidden');
});
startLevelSelect.addEventListener('change', () => {
  startLevel = Number(startLevelSelect.value);
});
resetScoresBtn.addEventListener('click', resetHighScores);
saveScoreBtn.addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
});

initTheme();
init();
initSkin();
