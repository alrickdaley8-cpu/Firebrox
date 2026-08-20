const MAX_S = 8;

export const PALETTES = {
  spectrum: {
    name: 'Spectrum',
    colors: (n) => Array.from({ length: n }, (_, i) => hsl((i / n) * 360, 0.88, 0.62)),
  },
  fire: {
    name: 'Fire',
    colors: (n) => pick(n, [
      [255, 244, 214],
      [255, 206, 74],
      [255, 132, 28],
      [255, 64, 22],
      [196, 18, 46],
      [255, 92, 148],
    ]),
  },
  ice: {
    name: 'Ice',
    colors: (n) => pick(n, [
      [240, 252, 255],
      [160, 230, 255],
      [80, 190, 255],
      [64, 140, 255],
      [120, 90, 255],
      [210, 170, 255],
    ]),
  },
  toxic: {
    name: 'Toxic',
    colors: (n) => pick(n, [
      [210, 255, 70],
      [50, 255, 160],
      [0, 230, 255],
      [255, 70, 220],
      [255, 230, 40],
      [180, 255, 200],
    ]),
  },
  sunset: {
    name: 'Sunset',
    colors: (n) => pick(n, [
      [255, 214, 170],
      [255, 130, 90],
      [255, 70, 110],
      [170, 60, 180],
      [90, 40, 160],
      [255, 190, 70],
    ]),
  },
  vapor: {
    name: 'Vapor',
    colors: (n) => pick(n, [
      [255, 110, 210],
      [130, 230, 255],
      [190, 140, 255],
      [255, 230, 120],
      [90, 255, 210],
      [255, 150, 170],
    ]),
  },
  royal: {
    name: 'Royal',
    colors: (n) => pick(n, [
      [255, 214, 120],
      [255, 170, 60],
      [180, 90, 255],
      [90, 70, 220],
      [40, 180, 255],
      [255, 90, 140],
    ]),
  },
};

export const PRESETS = [
  {
    id: 'genesis',
    name: 'Genesis',
    blurb: 'Colonies that split, merge, and breathe.',
    species: 4,
    count: 2400,
    rMax: 86,
    force: 280,
    damp: 4.2,
    beta: 0.3,
    temp: 0,
    trail: 0.74,
    glow: 1,
    wrap: true,
    palette: 'spectrum',
    matrix: [
      [0.92, 0.28, -0.52, 0.12],
      [-0.22, 0.84, 0.42, -0.58],
      [0.38, -0.32, 0.74, 0.22],
      [-0.18, 0.48, -0.36, 0.9],
    ],
  },
  {
    id: 'serpents',
    name: 'Serpents',
    blurb: 'Each color hunts the next. Lines of pursuit.',
    species: 6,
    count: 2800,
    rMax: 78,
    force: 310,
    damp: 3.6,
    beta: 0.28,
    temp: 0,
    trail: 0.82,
    glow: 0.95,
    wrap: true,
    palette: 'toxic',
    matrix: cyclicChase(6),
  },
  {
    id: 'cells',
    name: 'Cells',
    blurb: 'Membranes, nuclei, and restless cytoplasm.',
    species: 5,
    count: 2600,
    rMax: 92,
    force: 250,
    damp: 5.1,
    beta: 0.34,
    temp: 0,
    trail: 0.68,
    glow: 1.05,
    wrap: true,
    palette: 'sunset',
    matrix: [
      [1.0, -0.15, 0.55, -0.7, 0.1],
      [0.35, 0.82, -0.45, 0.2, -0.3],
      [-0.55, 0.4, 0.78, 0.15, 0.35],
      [0.2, -0.6, 0.25, 0.88, -0.2],
      [-0.1, 0.3, -0.4, 0.45, 0.7],
    ],
  },
  {
    id: 'nebula',
    name: 'Nebula',
    blurb: 'Slow galaxies folding in on themselves.',
    species: 4,
    count: 3200,
    rMax: 120,
    force: 160,
    damp: 2.8,
    beta: 0.26,
    temp: 4,
    trail: 0.88,
    glow: 1.15,
    wrap: true,
    palette: 'royal',
    matrix: [
      [0.7, 0.35, 0.15, -0.2],
      [0.2, 0.65, 0.4, 0.1],
      [-0.15, 0.3, 0.8, 0.25],
      [0.4, -0.25, 0.2, 0.55],
    ],
  },
  {
    id: 'koi',
    name: 'Koi',
    blurb: 'Two families. One chases. One holds the pond.',
    species: 2,
    count: 1800,
    rMax: 100,
    force: 240,
    damp: 3.8,
    beta: 0.3,
    temp: 2,
    trail: 0.8,
    glow: 1.1,
    wrap: true,
    palette: 'fire',
    matrix: [
      [0.22, 0.95],
      [-0.55, 0.7],
    ],
  },
  {
    id: 'crystal',
    name: 'Crystal',
    blurb: 'Symmetric laws freeze into lattices.',
    species: 4,
    count: 2200,
    rMax: 70,
    force: 200,
    damp: 6.4,
    beta: 0.38,
    temp: 0,
    trail: 0.55,
    glow: 0.9,
    wrap: true,
    palette: 'ice',
    matrix: [
      [0.85, -0.4, 0.3, -0.25],
      [-0.4, 0.85, -0.25, 0.3],
      [0.3, -0.25, 0.85, -0.4],
      [-0.25, 0.3, -0.4, 0.85],
    ],
  },
  {
    id: 'predators',
    name: 'Predators',
    blurb: 'Asymmetric hunger. Food webs in motion.',
    species: 5,
    count: 2500,
    rMax: 84,
    force: 300,
    damp: 3.9,
    beta: 0.29,
    temp: 3,
    trail: 0.76,
    glow: 1,
    wrap: true,
    palette: 'vapor',
    matrix: predatorWeb(5),
  },
  {
    id: 'atoms',
    name: 'Atoms',
    blurb: 'Heavy cores. Orbiting shells. Occasional ions.',
    species: 3,
    count: 2000,
    rMax: 96,
    force: 270,
    damp: 4.6,
    beta: 0.32,
    temp: 0,
    trail: 0.7,
    glow: 1.08,
    wrap: true,
    palette: 'ice',
    matrix: [
      [0.9, -0.15, 0.05],
      [1.0, -0.45, 0.35],
      [0.55, 0.4, -0.2],
    ],
  },
  {
    id: 'foam',
    name: 'Foam',
    blurb: 'Mostly repulsion. Bubbles, films, and froth.',
    species: 4,
    count: 3000,
    rMax: 74,
    force: 220,
    damp: 5.4,
    beta: 0.36,
    temp: 6,
    trail: 0.6,
    glow: 0.92,
    wrap: true,
    palette: 'spectrum',
    matrix: [
      [0.15, -0.7, -0.35, 0.2],
      [-0.55, 0.2, -0.65, -0.25],
      [-0.3, -0.5, 0.18, -0.6],
      [0.25, -0.4, -0.55, 0.12],
    ],
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    blurb: 'Tessellated neighborhoods with sharp borders.',
    species: 6,
    count: 3400,
    rMax: 64,
    force: 230,
    damp: 5.8,
    beta: 0.33,
    temp: 0,
    trail: 0.5,
    glow: 0.88,
    wrap: true,
    palette: 'royal',
    matrix: mosaic(6),
  },
  {
    id: 'mitosis',
    name: 'Mitosis',
    blurb: 'Blobs that pinch, split, and hunt their twins.',
    species: 4,
    count: 2100,
    rMax: 88,
    force: 265,
    damp: 4.0,
    beta: 0.31,
    temp: 1,
    trail: 0.73,
    glow: 1.02,
    wrap: true,
    palette: 'sunset',
    matrix: [
      [0.96, -0.62, 0.48, -0.12],
      [0.55, 0.2, -0.7, 0.35],
      [-0.4, 0.72, 0.88, -0.28],
      [0.18, -0.22, 0.4, 0.65],
    ],
  },
  {
    id: 'broth',
    name: 'Broth',
    blurb: 'Primordial soup. Turn the heat and wait.',
    species: 7,
    count: 3600,
    rMax: 70,
    force: 190,
    damp: 3.2,
    beta: 0.27,
    temp: 10,
    trail: 0.78,
    glow: 0.9,
    wrap: true,
    palette: 'toxic',
    matrix: broth(7),
  },
];

export const RAND_MODES = [
  { id: 'life', name: 'Life-biased' },
  { id: 'wild', name: 'Wild' },
  { id: 'clusters', name: 'Clusters' },
  { id: 'chains', name: 'Chains' },
  { id: 'symmetry', name: 'Symmetry' },
  { id: 'predators', name: 'Predators' },
];

export function randomizeMatrix(species, mode, rng = Math.random) {
  const s = species;
  const m = zeros(s);
  const r = () => rng();
  const signed = () => r() * 2 - 1;

  if (mode === 'wild') {
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) m[i][j] = signed();
    }
  } else if (mode === 'clusters') {
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        m[i][j] = i === j ? 0.45 + r() * 0.5 : signed() * 0.7;
      }
    }
  } else if (mode === 'chains') {
    for (let i = 0; i < s; i++) {
      m[i][i] = 0.12 + r() * 0.2;
      m[i][(i + 1) % s] = 0.65 + r() * 0.35;
      m[i][(i - 1 + s) % s] = -0.25 - r() * 0.5;
      if (s > 3 && r() < 0.4) m[i][(i + 2) % s] = signed() * 0.4;
    }
  } else if (mode === 'symmetry') {
    for (let i = 0; i < s; i++) {
      for (let j = i; j < s; j++) {
        const v = i === j ? 0.3 + r() * 0.6 : signed();
        m[i][j] = v;
        m[j][i] = v;
      }
    }
  } else if (mode === 'predators') {
    for (let i = 0; i < s; i++) {
      m[i][i] = 0.35 + r() * 0.45;
      m[i][(i + 1) % s] = 0.7 + r() * 0.3;
      m[(i + 1) % s][i] = -0.75 - r() * 0.2;
      if (r() < 0.35) m[i][(i + 2) % s] = signed() * 0.45;
    }
  } else {
    for (let i = 0; i < s; i++) {
      for (let j = 0; j < s; j++) {
        if (i === j) m[i][j] = 0.2 + r() * 0.7;
        else if (r() < 0.22) m[i][j] = 0;
        else m[i][j] = signed();
      }
    }
  }
  return m;
}

export function mutateMatrix(matrix, rng = Math.random) {
  return matrix.map((row) =>
    row.map((v) => {
      let n = v + gauss(rng) * 0.14;
      if (rng() < 0.08) n = 0;
      return clamp(n, -1, 1);
    }),
  );
}

export function symmetrizeMatrix(matrix) {
  const s = matrix.length;
  const out = zeros(s);
  for (let i = 0; i < s; i++) {
    for (let j = 0; j < s; j++) {
      const v = (matrix[i][j] + matrix[j][i]) * 0.5;
      out[i][j] = v;
    }
  }
  return out;
}

export function hashMatrix(matrix) {
  let h = 2166136261;
  for (const row of matrix) {
    for (const v of row) {
      h ^= Math.round((v + 1) * 500);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6).toUpperCase();
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hsl(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((hp / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 60) [r, g, b] = [c, x, 0];
  else if (hp < 120) [r, g, b] = [x, c, 0];
  else if (hp < 180) [r, g, b] = [0, c, x];
  else if (hp < 240) [r, g, b] = [0, x, c];
  else if (hp < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function cyclicChase(s) {
  const m = zeros(s);
  for (let i = 0; i < s; i++) {
    m[i][i] = 0.16;
    m[i][(i + 1) % s] = 0.95;
    m[i][(i - 1 + s) % s] = 0.28;
    m[i][(i + 2) % s] = -0.42;
  }
  return m;
}

function predatorWeb(s) {
  const m = zeros(s);
  for (let i = 0; i < s; i++) {
    m[i][i] = 0.55;
    m[i][(i + 1) % s] = 0.9;
    m[(i + 1) % s][i] = -0.72;
    m[i][(i + 2) % s] = -0.18;
  }
  return m;
}

function mosaic(s) {
  const m = zeros(s);
  for (let i = 0; i < s; i++) {
    for (let j = 0; j < s; j++) {
      if (i === j) m[i][j] = 0.92;
      else if (Math.abs(i - j) === 1 || Math.abs(i - j) === s - 1) m[i][j] = -0.55;
      else m[i][j] = -0.08;
    }
  }
  return m;
}

function broth(s) {
  const m = zeros(s);
  for (let i = 0; i < s; i++) {
    for (let j = 0; j < s; j++) {
      if (i === j) m[i][j] = 0.25;
      else m[i][j] = ((i * 7 + j * 13) % 11) / 11 * 1.6 - 0.8;
    }
  }
  return m;
}

function pick(n, swatches) {
  if (n <= swatches.length) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const idx = t * (swatches.length - 1);
      const a = Math.floor(idx);
      const b = Math.min(swatches.length - 1, a + 1);
      const f = idx - a;
      out.push(mix(swatches[a], swatches[b], f));
    }
    return out;
  }
  return Array.from({ length: n }, (_, i) => swatches[i % swatches.length]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function zeros(s) {
  return Array.from({ length: s }, () => Array(s).fill(0));
}

function gauss(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

void MAX_S;
