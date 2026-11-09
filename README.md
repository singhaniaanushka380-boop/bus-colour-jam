# 🚌 BUS COLOR JAM

An original casual puzzle game: **park the colourful buses, match the waiting passengers, and clear the traffic jam.**
Built with **Phaser 3 + Vite**, 100 % procedural art and synthesised audio (no image/sound files, nothing copyrighted),
saved in **LocalStorage**, ready for **Vercel**.

## How to play

* Passengers wait in queues at the top. Only the **front passenger of each queue** can board.
* Buses wait in lanes at the bottom. **Tap the front bus of a lane** to park it in a free parking slot.
  Buses behind it are blocked until it moves.
* A parked bus is boarded automatically by front passengers of the **same colour**. A full bus drives away and frees its slot.
* 🔒 **Padlocked slots** open after the shown number of buses has left.
* Park wisely: if every slot is full and nobody can board, it's a **Traffic Jam** and you must retry.
* **Win** by boarding every passenger.

| Tool | What it does |
|------|--------------|
| Undo | Takes back your last bus (free, but counts as help) |
| Hint (15 coins) | Solves the puzzle from the current position and points at a bus that still leads to victory |
| Restart | Starts the level again |
| Pause | Resume, restart, level map, menu, sound & music toggles |

**Stars:** ⭐⭐⭐ no help used (Perfect: +25 coins) · ⭐⭐ up to 2 helps · ⭐ otherwise.
**Challenge levels** (10, 15, 20, 25, 30) pay **double coins**. Replaying a cleared level pays half.
**Daily reward:** 7-day streak (50 → 500 coins), claimable once per day from the menu gift button.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
npm run verify     # re-checks that all 30 levels are valid AND solvable
```

Requires Node.js 18+.

## Deploy to Vercel

**Option A - Git (recommended)**
1. Push this folder to a GitHub/GitLab/Bitbucket repository.
2. In Vercel choose **Add New → Project** and import the repository.
3. Vercel detects **Vite** automatically. Confirm: Build Command `npm run build`, Output Directory `dist`, Install Command `npm install`.
4. Click **Deploy**. Every push to the main branch redeploys.

**Option B - CLI**
```bash
npm i -g vercel
vercel          # first deploy (preview)
vercel --prod   # production deploy
```

`vercel.json` is included (long-term caching for hashed assets, basic security headers). `vite.config.js` uses
`base: './'`, so all asset paths work on the root domain **and** on any sub-path. No backend or environment
variables are needed.

## Project structure

```
bus-color-jam/
├── index.html · package.json · vite.config.js · vercel.json · README.md
├── public/               favicon.svg, manifest.webmanifest, assets/
├── tools/
│   ├── generate-levels.mjs   builds & verifies levels with the solver -> src/data/levels.js
│   └── verify-levels.mjs     CI-style check of every level
└── src/
    ├── main.js · game.js · config.js
    ├── scenes/    Boot · Loading · Menu · LevelSelect · Game · LevelComplete
    ├── objects/   Bus · Passenger · ParkingSlot · PassengerQueue
    ├── systems/   GameManager · LevelManager · SaveManager · AudioManager · PuzzleValidator
    ├── data/      levels.js (30 levels) · levelFormat.js (parser/validator)
    ├── ui/        HUD · UIManager (buttons, dialogs, particles) · TextureFactory (all art)
    └── styles/    style.css
```

### Architecture notes
* **`PuzzleValidator.js`** is pure JavaScript (no Phaser): the rules, a depth-first **solver** and a full state-space analyser.
  The game uses it for rules, game-over detection and hints; the Node tools use it to prove every level is solvable.
* **GameScene** applies a move to the logical state first, receives a list of events (`park`, `board`, `depart`, `unlock`)
  and animates them one after another. Undo/restart simply rebuild the view from a saved state snapshot.
* **TextureFactory** draws every bus, passenger (4 looks × 8 colours), icon and background with Phaser Graphics at start-up.
* **AudioManager** synthesises all sound effects and the background loop with the Web Audio API (unlocked on first tap).
* **SaveManager** stores coins, stars, unlocked level, settings and the daily streak under one versioned LocalStorage key
  and falls back to memory if storage is blocked.

## Adding levels

Levels are plain data in `src/data/levels.js`:

```js
{ id: 31, name: 'My Level', tip: '', challenge: false,
  slots: [0, 0, 0, 2],                       // 0 = open slot, 2 = padlock until 2 buses depart
  lanes: [['r3', 'b2'], ['g2', 'r3'], ['b2']], // waiting buses, front first: colour letter + seats
  queues: ['rrrbbgg', 'rrrbbgg'] }           // passengers, front first
```
Colour letters: `r`ed `b`lue `g`reen `y`ellow `p`urple `o`range `k`pink `c`yan.
The number of passengers of each colour must equal the seats of that colour. Then run `npm run verify`.
To generate solver-checked levels automatically, add a row to `SPECS` in `tools/generate-levels.mjs` and run
`npm run generate-levels` (note: this rewrites `levels.js`).

## Troubleshooting
* **No sound?** Browsers start audio after the first tap/click. Check Sound/Music in the pause or settings menu.
* **Progress lost?** Private/incognito windows or blocked site data prevent LocalStorage; progress then lasts for the session only.
* **Reset everything:** Menu → Settings → Reset Progress.

## Originality
BUS COLOR JAM is an original game: its name, logo, characters, buses, UI, sounds, animations and level layouts are all
created for this project. It shares only the broad "match passengers to buses" idea with the genre.
