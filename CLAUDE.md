# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no package.json — open `index.html` directly or serve it statically.

## Running / testing

There is no build, test, or lint tooling in this repo. To run the game:

```bash
# Just open it
start index.html       # Windows
open index.html         # macOS
xdg-open index.html     # Linux

# Or serve it statically (avoids any local-file restrictions)
python3 -m http.server 8000
npx serve .
php -S localhost:8000
```

Then verify changes manually in the browser by playing the game (move/rotate/drop pieces, clear lines, trigger pause and game over).

## Architecture

Three files, no modules/bundler:

- `index.html` — DOM structure: main `<canvas id="board">` (300×600, i.e. `COLS×BLOCK` × `ROWS×BLOCK`), a side panel (`#score`, `#lines`, `#level`, `#next-canvas`), and an `#overlay` used for both PAUSE and GAME OVER states.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, in one file, global scope (no classes/modules).

### Core state

Module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) hold all game state — there is no central state object or framework.

- `board`: `ROWS × COLS` matrix; each cell is `0` (empty) or a piece-color index `1–8`.
- `PIECES`: the 7 standard tetromino shapes plus an 8th challenge piece (`N`, a 3×3 "nut" ring with an empty center cell), as square matrices of color indices; `current`/`next` are `{ type, shape, x, y }`. The hole is just a `0` cell — `collide`/`merge`/`draw` already skip falsy cells, so no special-casing was needed to support it.
- Rotation (`rotateCW`) is a transpose, not shape-specific rotation tables — works because all piece matrices are square.

### Game loop and flow

```
init() → createBoard(), next = randomPiece(), spawn(), requestAnimationFrame(loop)
loop(ts) → accumulate dt; if dt ≥ dropInterval, advance piece or lockPiece(); draw(); re-schedule
keydown → move / tryRotate() / softDrop() / hardDrop() / togglePause()
```

`spawn()` promotes `next` to `current` and generates a new `next`; if the new `current` immediately collides, `endGame()` fires.

### Key mechanics worth knowing before editing

- **Collision** (`collide`): checks board bounds and existing fixed blocks for a given shape/offset.
- **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns before giving up on the rotation.
- **Line clear** (`clearLines`): scans bottom-up, splices full rows out and unshifts empty rows at top; re-checks the same row index after a splice (`r++`) since rows shift down.
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
- **Leveling/speed**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
- **Ghost piece** (`ghostY`): projects `current` straight down until collision, drawn at `globalAlpha = 0.2`.

### Tunable constants (top of `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, also update the `#board` canvas `width`/`height` in `index.html` to match (`COLS×BLOCK`, `ROWS×BLOCK`).

The README (in Spanish) contains the same architectural breakdown in more detail and is kept in sync with this file — update both if behavior changes.
