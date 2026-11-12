import './styles/style.css';
import { createGame } from './game.js';
import { adManager } from './systems/AdManager.js';

const start = () => {
  const game = createGame('game-root');
  // Stop the browser from scrolling / zooming / showing context menus while playing on touch devices.
  const root = document.getElementById('game-root');
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  window.__busColorJam = game; // handy for debugging in dev tools
  window.__adManager = adManager;

  // Initialize AdMob (Banner & Interstitial)
  adManager.init();

  // Show an Interstitial ad automatically every 2.5 minutes during active play
  setInterval(() => {
    adManager.onLevelComplete();
  }, 150000);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
