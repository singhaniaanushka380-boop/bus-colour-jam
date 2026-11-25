# BUS COLOR JAM – 3D (Phaser + Three.js + Vite)

Tap toy vehicles out of a jammed parking grid, park them in 4 bays (+1 VIP bay) and let the waiting passengers board.

## Rules
- **Vehicles**: small cars (4 or 8 seats), minivans (12 or 16) and coaches (24, 32 or 40). The white roof arrow shows the driving direction: 0/90/180/270 degrees or one of the four 45-degree diagonals. A vehicle drives out along its arrow only if every cell ahead (and, for diagonals, the two corner cells beside each step) is free.
- **Fast flow**: tapping a vehicle sends it to a bay immediately (no waiting for earlier vehicles to finish boarding); a vehicle leaves the instant its last seat is taken.
- **Tap a vehicle**: if the way ahead is clear it drives out and parks in a free bay; otherwise it bumps and shakes.
- **Boarding**: only the FRONT passenger of the winding queue boards, and only a parked vehicle of the same colour with a free seat. Chain reaction: the next passenger tries at once.
- **A full vehicle** closes its doors, drives away and frees the bay.
- **Win**: all passengers boarded, all vehicles gone (3 stars if no help + few mistakes, coins reward). **Lose**: every open bay is full and nobody can board → "Out of Space!" with *Revive (unlock VIP)* or *Retry*.
- **Boosters (coins)**: VIP Slot (60), Shuffle People (40), Shuffle Colors (40). Hint costs 15.
- **Mystery vehicles** (grey "?") show their colour once nothing blocks them. **Tunnels** push a new vehicle out when the cell in front clears.
- 200 levels, all generated with a proven solution (`npm run verify` style check: `node tools/verify-levels.mjs`). Boosters never make a solvable level unsolvable.

## Run
```
npm install
npm run dev
npm run build      # production build in dist/
```

## Deploy on Vercel
Import the GitHub repo, Framework preset **Vite**, build `npm run build`, output `dist`. No backend needed. Progress is saved in LocalStorage (old v1 saves are migrated).

## Structure
- `src/systems/PuzzleValidator.js` – pure rules engine, solver, hint, boosters
- `src/data/levelFormat.js`, `src/data/levels.js` – level format and the 200 levels
- `tools/generate-levels.mjs`, `tools/verify-levels.mjs` – level generator and verifier
- `src/three/Models.js` – vehicles, garage, stickmen; `src/three/TerminalStage.js` – 3D scene, camera, animation (tunables `LIGHT`, `CAMERA`)
- `src/scenes/*`, `src/ui/*` – Phaser menus, HUD, dialogs; `src/systems/AudioManager.js` – synthesized Web Audio sound
