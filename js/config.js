// ============ FIREBROX — static configuration & balance ============
// World is a 540 x 960 portrait arena. Player at the bottom, enemy at the top.

export const SIDES = { PLAYER: 'player', ENEMY: 'enemy' };
export const otherSide = (s) => (s === SIDES.PLAYER ? SIDES.ENEMY : SIDES.PLAYER);

export const ARENA = {
  W: 540,
  H: 960,
  RIVER_TOP: 446,       // river band: y in [446, 514]
  RIVER_BOT: 514,
  BRIDGES: [{ x: 110, w: 66 }, { x: 430, w: 66 }],
  POCKET_TOP: 248,      // when an enemy princess tower falls you may deploy
  POCKET_BOT: 712,      //   in "the pocket" on that side
};

export const TOWERS = {
  princess: { hp: 1400, dmg: 50, hitSpeed: 0.8, range: 148, r: 26 },
  king:     { hp: 2400, dmg: 60, hitSpeed: 1.0, range: 155, r: 34 },
};

export const TOWER_POS = {
  enemyPrincessL:  { x: 110, y: 232 },
  enemyPrincessR:  { x: 430, y: 232 },
  enemyKing:       { x: 270, y: 112 },
  playerPrincessL: { x: 110, y: 728 },
  playerPrincessR: { x: 430, y: 728 },
  playerKing:      { x: 270, y: 848 },
};

export const ELIXIR = { MAX: 10, START: 5, RATE: 1 / 2.8 }; // 1 elixir per 2.8s

export const MATCH = { TIME: 180, DOUBLE_AT: 120, OT: 60 };

// ------------------------------------------------------------------
// Card definitions. type 'unit' spawns creature(s); 'spell' is instant.
// range/sight/speed are in pixels & px/s. r = body radius (collision).
// ------------------------------------------------------------------
export const CARDS = {
  knight: {
    key: 'knight', name: 'Knight', icon: '🗡️', cost: 3, type: 'unit',
    count: 1, hp: 620, dmg: 75, hitSpeed: 1.1, range: 16, sight: 100,
    speed: 46, r: 11, flying: false, targetsBuildings: false, canHitAir: false,
    splash: 0, color: '#c7ccd4',
  },
  archers: {
    key: 'archers', name: 'Archers', icon: '🏹', cost: 3, type: 'unit',
    count: 2, hp: 105, dmg: 42, hitSpeed: 1.2, range: 115, sight: 132,
    speed: 52, r: 9, flying: false, targetsBuildings: false, canHitAir: true,
    splash: 0, color: '#f2a5c0',
  },
  giant: {
    key: 'giant', name: 'Giant', icon: '🧌', cost: 5, type: 'unit',
    count: 1, hp: 1550, dmg: 95, hitSpeed: 1.5, range: 16, sight: 90,
    speed: 34, r: 15, flying: false, targetsBuildings: true, canHitAir: false,
    splash: 0, color: '#d29a63',
  },
  musketeer: {
    key: 'musketeer', name: 'Musketeer', icon: '🔫', cost: 4, type: 'unit',
    count: 1, hp: 150, dmg: 95, hitSpeed: 1.0, range: 125, sight: 145,
    speed: 48, r: 10, flying: false, targetsBuildings: false, canHitAir: true,
    splash: 0, color: '#8e63d2',
  },
  minipekka: {
    key: 'minipekka', name: 'Mini PEKKA', icon: '🤺', cost: 4, type: 'unit',
    count: 1, hp: 340, dmg: 205, hitSpeed: 1.7, range: 16, sight: 90,
    speed: 58, r: 10, flying: false, targetsBuildings: false, canHitAir: false,
    splash: 0, color: '#5b6079',
  },
  skeletons: {
    key: 'skeletons', name: 'Skeletons', icon: '💀', cost: 1, type: 'unit',
    count: 3, hp: 32, dmg: 32, hitSpeed: 1.0, range: 14, sight: 85,
    speed: 62, r: 8, flying: false, targetsBuildings: false, canHitAir: false,
    splash: 0, color: '#f0f0f0',
  },
  babydragon: {
    key: 'babydragon', name: 'Baby Dragon', icon: '🐉', cost: 4, type: 'unit',
    count: 1, hp: 520, dmg: 68, hitSpeed: 1.6, range: 95, sight: 115,
    speed: 42, r: 12, flying: true, targetsBuildings: false, canHitAir: true,
    splash: 36, color: '#79c96e',
  },
  fireball: {
    key: 'fireball', name: 'Fireball', icon: '🔥', cost: 4, type: 'spell',
    dmg: 176, radius: 48, towerScale: 0.4, castDelay: 0.45, color: '#ff8c3a',
  },
};

// The 8-card deck both players use.
export const DECK = [
  'knight', 'archers', 'giant', 'musketeer',
  'minipekka', 'skeletons', 'babydragon', 'fireball',
];

// Projectile visuals/behaviour per attacker kind.
export const PROJECTILES = {
  arrow:  { speed: 480, w: 2.5 },
  bolt:   { speed: 700, w: 4 },
  flame:  { speed: 280, w: 7 },
};
