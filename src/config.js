// Shared constants. Kept free of imports so any module can use it without cycles.

export const GAME_W = 540;
export const GAME_H = 960;

export const SAVE_KEY = 'bus-color-jam:save:v1';
export const HINT_COST = 15;
export const START_COINS = 100;
export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 500];

export const FONT = '"Trebuchet MS","Arial Rounded MT Bold","Segoe UI",Roboto,Arial,sans-serif';

// Passenger / bus palette. `main` is the base paint, `dark` the shaded side, `light` the highlight.
export const COLORS = {
  red:    { main: 0xff4d5e, dark: 0xc42a3c, light: 0xff9aa4, css: '#ff4d5e' },
  blue:   { main: 0x3d8bff, dark: 0x2158c4, light: 0x9cc4ff, css: '#3d8bff' },
  green:  { main: 0x3ed16a, dark: 0x1f9a45, light: 0x9cf0b4, css: '#3ed16a' },
  yellow: { main: 0xffd23f, dark: 0xd9a413, light: 0xffec9a, css: '#ffd23f' },
  purple: { main: 0xa566ff, dark: 0x6f35c9, light: 0xd2b0ff, css: '#a566ff' },
  orange: { main: 0xff9a3c, dark: 0xd16a14, light: 0xffc995, css: '#ff9a3c' },
  pink:   { main: 0xff7ac8, dark: 0xc94a98, light: 0xffb9e3, css: '#ff7ac8' },
  cyan:   { main: 0x2fd8e8, dark: 0x139aa8, light: 0x9af0f7, css: '#2fd8e8' },
};
export const COLOR_NAMES = Object.keys(COLORS);

export const UI_COLORS = {
  green: 0x3ed16a,
  blue: 0x3d8bff,
  orange: 0xff9a3c,
  red: 0xff4d5e,
  purple: 0xa566ff,
  gray: 0x8c96b0,
  navy: 0x1b2a52,
};

// Gameplay layout (design resolution is GAME_W x GAME_H, scaled to fit any screen).
export const LAYOUT = {
  queueY: 178,
  queueRowGap: 52,
  queueX: 62,
  queueSpacing: 34,
  queueVisible: 12,
  slotY: 418,
  slotH: 92,
  laneTop: 602,
  laneGap: 58,
  laneMaxVisible: 5,
  controlsY: 912,
};
