// Shared constants. Kept free of imports so any module can use it without cycles.

export const GAME_W = 540;
export const GAME_H = 960;

export const SAVE_KEY = 'bus-color-jam:save:v1'; // key stays the same: old saves are migrated in place (see SaveManager)
export const SAVE_VERSION = 2;
export const HINT_COST = 15;
export const BOOST_COST = { vip: 60, pax: 40, colors: 40 }; // coin price of the three boosters
export const START_COINS = 100;
export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 500];

export const FONT = '"Trebuchet MS","Arial Rounded MT Bold","Segoe UI",Roboto,Arial,sans-serif';

// The 10 gameplay colours (Red, Yellow, Blue, Green, Pink, Orange, Purple, Grey, Brown, Sky Blue). A bus and its passengers use EXACTLY the same `main` value.
// `main` = base paint, `dark` = shaded side / rim, `light` = highlight, `label` = readable name.
export const COLORS = {
  red:    { main: 0xe8302f, dark: 0x9a1414, light: 0xff8a86, css: '#e8302f', label: 'Red' },
  yellow: { main: 0xffb515, dark: 0xb57d00, light: 0xffd966, css: '#ffb515', label: 'Yellow' },
  blue:   { main: 0x2f7bff, dark: 0x1648b8, light: 0x90b8ff, css: '#2f7bff', label: 'Blue' },
  green:  { main: 0x33c344, dark: 0x1c8a2a, light: 0x8fe89a, css: '#33c344', label: 'Green' },
  pink:   { main: 0xf452ab, dark: 0xa82a70, light: 0xff9fd0, css: '#f452ab', label: 'Pink' },
  orange: { main: 0xff7a12, dark: 0xb24800, light: 0xffb070, css: '#ff7a12', label: 'Orange' },
  purple: { main: 0x9a2fc0, dark: 0x61177f, light: 0xcf82e6, css: '#9a2fc0', label: 'Purple' },
  grey:   { main: 0x8b93a3, dark: 0x565e6e, light: 0xc4cad6, css: '#8b93a3', label: 'Grey' },
  brown:  { main: 0x8a5530, dark: 0x55331a, light: 0xc79670, css: '#8a5530', label: 'Brown' },
  sky:    { main: 0x2fc4f5, dark: 0x0f86b0, light: 0x98e6ff, css: '#2fc4f5', label: 'Sky Blue' },
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
  platformTop: 198,
  platformBottom: 318,
  slotY: 420,
  slotH: 104,
  roadTop: 516, // dispatch road (perspective) top / bottom edge
  roadBottom: 900,
  laneTop: 604,
  laneGap: 56,
  laneMaxVisible: 5,
  controlsY: 912,
};
