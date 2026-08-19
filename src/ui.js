// HUD / overlay management.
import { state, stats, UPGRADES, buyUpgrade } from './state.js';
import { RESOURCES, ECONOMIES } from './universe.js';

const $ = (id) => document.getElementById(id);

const BAR_DEFS = [
  { key: 'life', label: 'Life Support', color: '#63e6ff', max: () => 100 },
  { key: 'hazardProtection', label: 'Hazard Protection', color: '#ff9f43', max: () => 100 },
  { key: 'jetpack', label: 'Jetpack', color: '#c48fff', modes: ['surface'], max: () => 100 },
  { key: 'shipHealth', label: 'Ship Integrity', color: '#9dffc4', modes: ['space'], max: () => 100 },
  { key: 'shields', label: 'Deflector Shield', color: '#ffe066', modes: ['space'], max: () => stats.shieldMax },
  { key: 'launchFuel', label: 'Launch Thrusters', color: '#ff7de0', max: () => 100 },
];

export const ui = {
  mode: 'space',
  onTradeClose: null,

  init() {
    this.buildBars();
    this.buildInventory();
    this.radarCanvas = $('radar');
    this.radarCtx = this.radarCanvas.getContext('2d');
    this.compassCanvas = $('compass');
    this.compassCtx = this.compassCanvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    for (const c of [this.radarCanvas, this.compassCanvas]) {
      const w = c.clientWidth || parseInt(c.getAttribute('width'), 10);
      const h = c.clientHeight || parseInt(c.getAttribute('height'), 10);
      c.width = w * scale; c.height = h * scale;
    }
    $('btn-trade-close').onclick = () => this.closeTrade();
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
    $('hud-nanites').textContent = Math.floor(state.nanites).toLocaleString();
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
      if (!visible) continue;
      const max = b.max();
      const v = Math.max(0, Math.min(max, state[b.key] ?? 0));
      const pct = (v / max) * 100;
      el.querySelector('.bar-fill').style.width = pct + '%';
      el.querySelector('.bar-val').textContent = Math.round(v) + (b.key === 'shields' ? '' : '%');
      el.classList.toggle('critical', pct < 22);
    }

    for (const k of Object.keys(RESOURCES)) {
      const el = document.querySelector(`[data-qt="${k}"]`);
      if (el) {
        const q = Math.floor(state.inventory[k] || 0);
        el.textContent = k === 'warpcell' ? q : `${q}`;
        el.parentElement.classList.toggle('full', q >= stats.stackLimit);
      }
    }

    $('radar-wrap').classList.toggle('hidden', this.mode !== 'space');
    $('compass-wrap').classList.toggle('hidden', this.mode !== 'surface');
  },

  log(msg, kind = '') {
    const line = document.createElement('div');
    line.className = 'log-line ' + kind;
    line.innerHTML = msg;
    $('log').appendChild(line);
    setTimeout(() => line.remove(), 4600);
    while ($('log').children.length > 7) $('log').firstChild.remove();
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
    $('target-sub').innerHTML = sub || '';
    $('scan-bar').style.display = scanPct == null ? 'none' : '';
    if (scanPct != null) $('scan-bar').querySelector('i').style.width = (scanPct * 100) + '%';
  },

  // ---------------------------------------------------------- radar
  radar(contacts) {
    if (this.mode !== 'space') return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width, h = this.radarCanvas.height;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 4;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(99,230,255,0.28)';
    ctx.lineWidth = 1.2;
    for (const r of [R, R * 0.66, R * 0.33]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

    const maxRange = 26000;
    for (const c of contacts) {
      const d = Math.hypot(c.x, c.y);
      const scaled = Math.min(1, Math.log10(1 + d / 40) / Math.log10(1 + maxRange / 40));
      const ang = Math.atan2(c.x, -c.y);
      const px = cx + Math.sin(ang) * scaled * R;
      const py = cy - Math.cos(ang) * scaled * R;
      ctx.fillStyle = c.color;
      const size = c.kind === 'star' ? 4.5 : c.kind === 'planet' ? 3.6 : c.kind === 'station' ? 3.2 : 3;
      ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
      if (c.kind === 'hostile') {
        ctx.strokeStyle = '#ff4d4d';
        ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke();
      }
      // above/below marker
      if (Math.abs(c.z) > d * 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(px - 1, py + (c.z > 0 ? -9 : 6), 2, 3);
      }
    }
    // ship
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 5); ctx.lineTo(cx + 4, cy + 5);
    ctx.closePath(); ctx.fill();
  },

  // ---------------------------------------------------------- compass
  compass(yaw, waypoints) {
    if (this.mode !== 'surface') return;
    const ctx = this.compassCtx;
    const w = this.compassCanvas.width, h = this.compassCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    const span = 140; // degrees visible
    const pxPerDeg = w / span;

    ctx.strokeStyle = 'rgba(99,230,255,0.25)';
    ctx.beginPath(); ctx.moveTo(0, h - 4); ctx.lineTo(w, h - 4); ctx.stroke();

    ctx.font = `${11 * (window.devicePixelRatio || 1)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    for (let d = 0; d < 360; d += 15) {
      let delta = ((d - heading + 540) % 360) - 180;
      if (Math.abs(delta) > span / 2) continue;
      const x = w / 2 + delta * pxPerDeg;
      const major = d % 45 === 0;
      ctx.strokeStyle = major ? 'rgba(220,245,255,0.85)' : 'rgba(160,200,225,0.4)';
      ctx.beginPath(); ctx.moveTo(x, h - 4); ctx.lineTo(x, h - (major ? 14 : 9)); ctx.stroke();
      if (major) {
        const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[d];
        ctx.fillStyle = 'rgba(230,248,255,0.9)';
        ctx.fillText(label, x, h - 19);
      }
    }
    for (const wp of waypoints) {
      const bearing = ((wp.bearing * 180 / Math.PI) % 360 + 360) % 360;
      let delta = ((bearing - heading + 540) % 360) - 180;
      const clamped = Math.max(-span / 2, Math.min(span / 2, delta));
      const x = w / 2 + clamped * pxPerDeg;
      ctx.fillStyle = wp.color;
      ctx.beginPath();
      ctx.moveTo(x, 6); ctx.lineTo(x - 5, 15); ctx.lineTo(x + 5, 15);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(230,248,255,0.85)';
      ctx.fillText(`${wp.label} ${Math.round(wp.dist)}m`, x, 30);
    }
    // centre marker
    ctx.strokeStyle = '#ff9f43';
    ctx.beginPath(); ctx.moveTo(w / 2, h - 2); ctx.lineTo(w / 2, h - 20); ctx.stroke();
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

  damageFlash() {
    const el = $('damage-vignette');
    el.style.transition = 'none';
    el.style.opacity = '0.85';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 500ms ease-out';
      el.style.opacity = '0';
    });
  },

  renderDiscoveries() {
    const items = Object.entries(state.discoveries).sort((a, b) => b[1].when - a[1].when);
    const counts = items.reduce((acc, [, d]) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {});
    $('disc-summary').innerHTML = `
      <span>${counts.system || 0} systems</span>
      <span>${counts.planet || 0} planets</span>
      <span>${counts.creature || 0} lifeforms</span>
      <span>${counts.ruin || 0} ruins</span>
      <span>${state.kills} pirates downed</span>
      <span>${state.lightYears.toFixed(1)} ly travelled</span>`;
    $('discovery-list').innerHTML = items.length
      ? items.map(([, d]) => `<div class="disc"><span>${d.name}</span><span>${d.type}</span></div>`).join('')
      : '<div class="empty">No discoveries logged. Go find something.</div>';
  },

  // ---------------------------------------------------------- station trade
  openTrade(system, onClose) {
    this.onTradeClose = onClose;
    $('trade').classList.remove('hidden');
    $('trade-title').textContent = `${system.name} SPACE STATION`;
    $('trade-sub').textContent = `${system.economy} economy · ${system.wealth} · conflict ${system.danger}`;
    this.tradeSystem = system;
    this.renderTrade();
  },

  closeTrade() {
    $('trade').classList.add('hidden');
    this.onTradeClose?.();
  },

  renderTrade() {
    const sys = this.tradeSystem;
    const econ = ECONOMIES[sys.economy] || { buy: 1, sell: 1, wants: [] };
    const rows = Object.entries(RESOURCES).filter(([k]) => k !== 'warpcell').map(([k, r]) => {
      const wanted = econ.wants.includes(k);
      const price = Math.round(r.value * econ.sell * (wanted ? 1.35 : 1));
      const held = Math.floor(state.inventory[k] || 0);
      return `<tr>
        <td><span class="dot" style="background:${r.color}"></span>${r.label}</td>
        <td class="mono">${held}</td>
        <td class="mono">${price}${wanted ? ' <em>+demand</em>' : ''}</td>
        <td>
          <button data-sell="${k}" data-amt="10" ${held < 10 ? 'disabled' : ''}>Sell 10</button>
          <button data-sell="${k}" data-amt="all" ${held < 1 ? 'disabled' : ''}>Sell all</button>
        </td>
      </tr>`;
    }).join('');
    $('trade-market').innerHTML = `<table><thead><tr><th>Resource</th><th>Held</th><th>Unit price</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;

    const wcPrice = Math.round(RESOURCES.warpcell.value * (econ.buy || 1));
    $('trade-buy').innerHTML = `
      <div class="buy-row">
        <span>Warp Cell — ${wcPrice} units</span>
        <button data-buy="warpcell">Buy</button>
      </div>
      <div class="buy-row">
        <span>Full repair &amp; refuel — 800 units</span>
        <button data-buy="repair">Buy</button>
      </div>`;

    $('trade-upgrades').innerHTML = Object.entries(UPGRADES).map(([k, up]) => {
      const rank = state.upgrades[k] || 0;
      const maxed = rank >= up.max;
      const cost = maxed ? 0 : up.cost(rank);
      return `<div class="upg">
        <div class="upg-head"><b>${up.label}</b><span class="pips">${'▮'.repeat(rank)}${'▯'.repeat(up.max - rank)}</span></div>
        <div class="upg-desc">${up.desc}</div>
        <button data-upg="${k}" ${maxed || state.units < cost ? 'disabled' : ''}>${maxed ? 'MAX' : cost.toLocaleString() + ' units'}</button>
      </div>`;
    }).join('');

    $('trade-units').textContent = Math.floor(state.units).toLocaleString();

    $('trade').querySelectorAll('[data-sell]').forEach((btn) => {
      btn.onclick = () => {
        const k = btn.dataset.sell;
        const held = Math.floor(state.inventory[k] || 0);
        const amt = btn.dataset.amt === 'all' ? held : Math.min(10, held);
        if (amt <= 0) return;
        const price = Math.round(RESOURCES[k].value * econ.sell * (econ.wants.includes(k) ? 1.35 : 1));
        state.inventory[k] -= amt;
        state.units += amt * price;
        this.log(`Sold ${amt} ${RESOURCES[k].label} for ${(amt * price).toLocaleString()} units`, 'good');
        this.renderTrade();
      };
    });
    $('trade').querySelectorAll('[data-buy]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.buy === 'warpcell') {
          if (state.units < wcPrice) return this.log('Not enough units', 'bad');
          state.units -= wcPrice;
          state.inventory.warpcell = (state.inventory.warpcell || 0) + 1;
          this.log('Purchased 1 Warp Cell', 'good');
        } else {
          if (state.units < 800) return this.log('Not enough units', 'bad');
          state.units -= 800;
          state.shipHealth = 100; state.shields = stats.shieldMax;
          state.launchFuel = 100; state.life = 100; state.hazardProtection = 100;
          this.log('Ship fully repaired and refuelled', 'good');
        }
        this.renderTrade();
      };
    });
    $('trade').querySelectorAll('[data-upg]').forEach((btn) => {
      btn.onclick = () => {
        const res = buyUpgrade(btn.dataset.upg);
        if (res === 'ok') this.log(`${UPGRADES[btn.dataset.upg].label} upgraded`, 'good');
        else if (res === 'poor') this.log('Not enough units', 'bad');
        this.renderTrade();
      };
    });
  },
};
