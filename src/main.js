import './styles/style.css';
import { createGame } from './game.js';

const start = () => {
  const game = createGame('game-root');
  // Stop the browser from scrolling / zooming / showing context menus while playing on touch devices.
  const root = document.getElementById('game-root');
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  window.__busColorJam = game; // handy for debugging in dev tools
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
