// HUD / overlay management.
import { state } from './state.js';
import { RESOURCES } from './universe.js';

const $ = (id) => document.getElementById(id);

const BAR_DEFS = [
  { key: 'life', label: 'Life Support', color: '#63e6ff' },
  { key: 'hazardProtection', label: 'Hazard Protection', color: '#ff9f43' },
  { key: 'jetpack', label: 'Jetpack', color: '#c48fff', modes: ['surface'] },
  { key: 'shipHealth', label: 'Ship Integrity', color: '#9dffc4', modes: ['space'] },
  { key: 'shields', label: 'Deflector Shield', color: '#ffe066', modes: ['space'] },
  { key: 'launchFuel', label: 'Launch Thrusters', color: '#ff7de0' },
];

export const ui = {
  mode: 'space',

  init() {
    this.buildBars();
    this.buildInventory();
  },

  buildBars() {
    $('bars').innerHTML = BAR_DEFS.map((b) => `
      <div class="bar" data-bar="${b.key}">
        <div class="bar-head"><span>${b.label}</span><span class="bar-val">100%</span></div>
        <div class="bar-track"><div class="bar-fill" style="background:${b.color}"></div></div>
      </div>`).join('');
  },

  buildInventory() {
    const keys = Object.keys(RESOURCES);
    $('inventory').innerHTML = keys.map((k) => `
      <div class="slot" data-res="${k}">
        <div class="ico" style="color:${RESOURCES[k].color}">${RESOURCES[k].icon}</div>
        <div class="qt" data-qt="${k}">0</div>
        <div class="nm">${RESOURCES[k].label}</div>
      </div>`).join('');
  },

  flashSlot(key) {
    const el = document.querySelector(`.slot[data-res="${key}"]`);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  },

  update(info) {
    $('hud-units').textContent = Math.floor(state.units).toLocaleString();
    $('hud-disc').textContent = Object.keys(state.discoveries).length;
    $('hud-ly').textContent = state.lightYears.toFixed(1) + ' ly';
    $('hud-mode').textContent = this.mode.toUpperCase();

    if (info) {
      $('hud-system').textContent = info.system || '—';
      $('hud-planet-label').textContent = info.planetLabel || 'Location';
      $('hud-planet').textContent = info.planet || 'Deep Space';
      $('hud-conditions').innerHTML = info.conditions || '';
    }

    for (const b of BAR_DEFS) {
      const el = document.querySelector(`.bar[data-bar="${b.key}"]`);
      if (!el) continue;
      const visible = !b.modes || b.modes.includes(this.mode);
      el.style.display = visible ? '' : 'none';
      const v = Math.max(0, Math.min(100, state[b.key] ?? 0));
      el.querySelector('.bar-fill').style.width = v + '%';
      el.querySelector('.bar-val').textContent = Math.round(v) + '%';
    }

    for (const k of Object.keys(RESOURCES)) {
      const el = document.querySelector(`[data-qt="${k}"]`);
      if (el) el.textContent = Math.floor(state.inventory[k] || 0);
    }
  },

  log(msg, kind = '') {
    const line = document.createElement('div');
    line.className = 'log-line ' + kind;
    line.textContent = msg;
    $('log').appendChild(line);
    setTimeout(() => line.remove(), 4200);
    while ($('log').children.length > 6) $('log').firstChild.remove();
  },

  prompt(text) {
    const el = $('prompt');
    if (!text) { el.classList.add('hidden'); return; }
    el.innerHTML = text;
    el.classList.remove('hidden');
  },

  target(name, sub, scanPct) {
    const el = $('target-info');
    if (!name) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('target-name').textContent = name;
    $('target-sub').textContent = sub || '';
    $('scan-bar').style.display = scanPct == null ? 'none' : '';
    if (scanPct != null) $('scan-bar').querySelector('i').style.width = (scanPct * 100) + '%';
  },

  showHUD(v) { $('hud').classList.toggle('hidden', !v); },

  loading(text) {
    if (!text) { $('loading').classList.add('hidden'); return; }
    $('load-text').textContent = text;
    $('loading').classList.remove('hidden');
  },

  warpFlash(duration = 700) {
    const el = $('warp-flash');
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${duration}ms ease-out`;
      el.style.opacity = '0';
    });
  },

  renderDiscoveries() {
    const items = Object.entries(state.discoveries).sort((a, b) => b[1].when - a[1].when);
    $('discovery-list').innerHTML = items.length
      ? items.map(([, d]) => `<div class="disc"><span>${d.name}</span><span>${d.type}</span></div>`).join('')
      : '<div class="empty">No discoveries logged. Go find something.</div>';
  },
};
