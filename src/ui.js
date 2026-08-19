// HUD / overlay management.
import { state, stats, UPGRADES, SHIPS, DEFAULT_SETTINGS, buyUpgrade, buyShip, renameDiscovery } from './state.js';
import { RESOURCES, ECONOMIES } from './universe.js';
import { RECIPES, canCraft, craft } from './crafting.js';
import * as missions from './missions.js';

const $ = (id) => document.getElementById(id);

const BAR_DEFS = [
  { key: 'life', label: 'Life Support', color: '#63e6ff', max: () => 100 },
  { key: 'hazardProtection', label: 'Hazard Protection', color: '#ff9f43', max: () => 100 },
  { key: 'suitShield', label: 'Exosuit Shield', color: '#7dffd0', modes: ['surface'], max: () => stats.suitShieldMax },
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
    this.cache();
    this.last = {};
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
    $('btn-craft-close').onclick = () => this.closeCraft();
    $('btn-settings-close').onclick = () => this.closeSettings();
    $('btn-settings-reset').onclick = () => {
      Object.assign(state.settings, DEFAULT_SETTINGS);
      this.renderSettings();
      this.onSettingsChange?.();
    };
    document.querySelectorAll('#trade .tab').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('#trade .tab').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('#trade .tab-page').forEach((p) => {
          p.classList.toggle('hidden', p.dataset.page !== btn.dataset.tab);
        });
      };
    });
  },

  // Cache every HUD node once — the loop then only touches what changed.
  cache() {
    this.refs = {
      units: $('hud-units'), nanites: $('hud-nanites'), disc: $('hud-disc'),
      ly: $('hud-ly'), mode: $('hud-mode'), system: $('hud-system'),
      planetLabel: $('hud-planet-label'), planet: $('hud-planet'), conditions: $('hud-conditions'),
      radarWrap: $('radar-wrap'), compassWrap: $('compass-wrap'),
      missionTracker: $('mission-tracker'), missionList: $('mission-list'),
      sentinelAlert: $('sentinel-alert'), sentinelPips: $('sentinel-pips'),
      bars: {}, slots: {},
    };
    for (const b of BAR_DEFS) {
      const el = document.querySelector(`.bar[data-bar="${b.key}"]`);
      this.refs.bars[b.key] = { el, fill: el.querySelector('.bar-fill'), val: el.querySelector('.bar-val') };
    }
    for (const k of Object.keys(RESOURCES)) {
      const qt = document.querySelector(`[data-qt="${k}"]`);
      this.refs.slots[k] = { qt, slot: qt.parentElement };
    }
  },

  set(node, key, value) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    node.textContent = value;
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
    const r = this.refs;
    this.set(r.units, 'units', Math.floor(state.units).toLocaleString());
    this.set(r.nanites, 'nanites', Math.floor(state.nanites).toLocaleString());
    this.set(r.disc, 'disc', String(Object.keys(state.discoveries).length));
    this.set(r.ly, 'ly', state.lightYears.toFixed(1) + ' ly');
    this.set(r.mode, 'mode', this.mode.toUpperCase());

    if (info) {
      this.set(r.system, 'system', info.system || '—');
      this.set(r.planetLabel, 'planetLabel', info.planetLabel || 'Location');
      this.set(r.planet, 'planet', info.planet || 'Deep Space');
      const cond = info.conditions || '';
      if (this.last.conditions !== cond) {
        this.last.conditions = cond;
        r.conditions.innerHTML = cond;
      }
    }

    for (const b of BAR_DEFS) {
      const ref = r.bars[b.key];
      if (!ref) continue;
      const visible = !b.modes || b.modes.includes(this.mode);
      if (this.last['vis:' + b.key] !== visible) {
        this.last['vis:' + b.key] = visible;
        ref.el.style.display = visible ? '' : 'none';
      }
      if (!visible) continue;
      const max = b.max();
      const v = Math.max(0, Math.min(max, state[b.key] ?? 0));
      const pct = Math.round((v / max) * 1000) / 10;
      if (this.last['bar:' + b.key] !== pct) {
        this.last['bar:' + b.key] = pct;
        ref.fill.style.width = pct + '%';
        ref.val.textContent = Math.round(v) + (b.key === 'shields' ? '' : '%');
        ref.el.classList.toggle('critical', pct < 22);
      }
    }

    const limit = stats.stackLimit;
    for (const k of Object.keys(RESOURCES)) {
      const ref = r.slots[k];
      const q = Math.floor(state.inventory[k] || 0);
      if (this.last['inv:' + k] !== q) {
        this.last['inv:' + k] = q;
        ref.qt.textContent = q;
        ref.slot.classList.toggle('full', q >= limit);
      }
    }

    // mission tracker
    const sig = state.missions.map((m) => `${m.key}:${m.progress}`).join('|');
    if (this.last.missionSig !== sig) {
      this.last.missionSig = sig;
      r.missionTracker.classList.toggle('hidden', state.missions.length === 0);
      r.missionList.innerHTML = state.missions.map((m) => {
        const done = m.progress >= m.target;
        return `<div class="mission ${done ? 'done' : ''}">
          <div class="m-title">${m.title}</div>
          <div class="m-desc">${m.desc}</div>
          <div class="m-bar"><i style="width:${Math.min(100, (m.progress / m.target) * 100)}%"></i></div>
          <div class="m-foot">${m.progress}/${m.target}${done ? ' — return to a station' : ''}</div>
        </div>`;
      }).join('');
    }

    // sentinel alert
    const lvl = info?.sentinelLevel || 0;
    if (this.last.sentinelLvl !== lvl) {
      this.last.sentinelLvl = lvl;
      r.sentinelAlert.classList.toggle('hidden', lvl <= 0);
      r.sentinelPips.textContent = '▲'.repeat(lvl);
    }

    if (this.last.hudMode !== this.mode) {
      this.last.hudMode = this.mode;
      r.radarWrap.classList.toggle('hidden', this.mode !== 'space');
      r.compassWrap.classList.toggle('hidden', this.mode !== 'surface');
    }
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

  missionDone(m) {
    this.log(`MISSION READY — ${m.title} · claim at any station`, 'good');
  },

  // ---------------------------------------------------------- crafting
  openCraft(onClose) {
    this.onCraftClose = onClose;
    $('craft').classList.remove('hidden');
    this.renderCraft();
  },
  closeCraft() {
    $('craft').classList.add('hidden');
    this.onCraftClose?.();
  },
  renderCraft() {
    $('craft-list').innerHTML = RECIPES.map((r, i) => {
      const ok = canCraft(r);
      const cost = Object.entries(r.cost).map(([k, v]) => `${v} ${RESOURCES[k]?.label || k}`).join(' + ');
      return `<div class="recipe ${ok ? '' : 'locked'}">
        <div class="r-head">${r.label}</div>
        <div class="r-desc">${r.desc}</div>
        <div class="r-cost">${cost}</div>
        <button data-craft="${i}" ${ok ? '' : 'disabled'}>Craft</button>
      </div>`;
    }).join('');
    $('craft-list').querySelectorAll('[data-craft]').forEach((btn) => {
      btn.onclick = () => {
        const r = RECIPES[Number(btn.dataset.craft)];
        const result = craft(r);
        if (result) {
          this.log(`${r.label} — ${result}`, 'good');
          for (const k of Object.keys(r.out || {})) this.flashSlot(k);
        } else this.log('Missing materials', 'bad');
        this.renderCraft();
      };
    });
  },

  // ---------------------------------------------------------- settings
  openSettings(onClose) {
    this.onSettingsClose = onClose;
    $('settings').classList.remove('hidden');
    this.renderSettings();
  },
  closeSettings() {
    $('settings').classList.add('hidden');
    this.onSettingsClose?.();
  },
  renderSettings() {
    const s = state.settings;
    const rows = [
      { key: 'fov', label: 'Field of view', min: 60, max: 110, step: 1 },
      { key: 'sensitivity', label: 'Mouse sensitivity', min: 0.25, max: 3, step: 0.05 },
      { key: 'bloom', label: 'Bloom intensity', min: 0, max: 2, step: 0.05 },
      { key: 'renderScale', label: 'Render scale', min: 0.5, max: 2, step: 0.05 },
      { key: 'music', label: 'Music volume', min: 0, max: 1, step: 0.05 },
      { key: 'sfx', label: 'Effects volume', min: 0, max: 1, step: 0.05 },
    ];
    $('settings-list').innerHTML = rows.map((r) => `
      <div class="setting">
        <label>${r.label}<span class="mono" data-out="${r.key}">${Number(s[r.key]).toFixed(2)}</span></label>
        <input type="range" data-set="${r.key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${s[r.key]}" />
      </div>`).join('') + `
      <div class="setting toggle">
        <label>Invert mouse Y</label>
        <input type="checkbox" data-toggle="invertY" ${s.invertY ? 'checked' : ''} />
      </div>
      <div class="setting toggle">
        <label>Shadows</label>
        <input type="checkbox" data-toggle="shadows" ${s.shadows ? 'checked' : ''} />
      </div>`;

    $('settings-list').querySelectorAll('[data-set]').forEach((el) => {
      el.oninput = () => {
        state.settings[el.dataset.set] = Number(el.value);
        const out = $('settings-list').querySelector(`[data-out="${el.dataset.set}"]`);
        if (out) out.textContent = Number(el.value).toFixed(2);
        this.onSettingsChange?.();
      };
    });
    $('settings-list').querySelectorAll('[data-toggle]').forEach((el) => {
      el.onchange = () => {
        state.settings[el.dataset.toggle] = el.checked;
        this.onSettingsChange?.();
      };
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
      ? items.map(([k, d]) => `<div class="disc">
          <input class="disc-name" data-rename="${k}" value="${String(d.name).replace(/"/g, '&quot;')}" />
          <span>${d.type}</span>
        </div>`).join('')
      : '<div class="empty">No discoveries logged. Go find something.</div>';
    $('discovery-list').querySelectorAll('[data-rename]').forEach((el) => {
      el.onchange = () => {
        renameDiscovery(el.dataset.rename, el.value);
        this.log(`Renamed to ${el.value}`, 'good');
      };
    });
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

    // ---- mission board
    const board = missions.generateBoard(sys);
    const active = new Set(state.missions.map((m) => m.key));
    const claimable = state.missions.filter((m) => missions.isComplete(m));
    $('trade-missions').innerHTML = `
      ${claimable.length ? `<div class="panel-title">Ready to claim</div>` + claimable.map((m) => `
        <div class="mission-row done">
          <div><b>${m.title}</b><span>${m.desc} — complete</span></div>
          <button data-claim="${m.key}">Claim ${m.reward.units.toLocaleString()} units</button>
        </div>`).join('') : ''}
      <div class="panel-title" style="margin-top:10px">Available contracts</div>
      ${board.map((m) => `
        <div class="mission-row">
          <div><b>${m.title}</b><span>${m.desc} · ${m.giver}</span></div>
          <button data-accept="${m.key}" ${active.has(m.key) ? 'disabled' : ''}>
            ${active.has(m.key) ? 'Accepted' : `${m.reward.units.toLocaleString()} u + ${m.reward.nanites} nanites`}
          </button>
        </div>`).join('')}`;

    $('trade-missions').querySelectorAll('[data-accept]').forEach((btn) => {
      btn.onclick = () => {
        const m = board.find((x) => x.key === btn.dataset.accept);
        const res = missions.accept(m);
        if (res === 'full') this.log('Mission log is full (4 max)', 'bad');
        else if (res === 'ok') {
          this.log(`ACCEPTED — ${m.title}`, 'good');
          missions.syncGather();
        }
        this.renderTrade();
      };
    });
    $('trade-missions').querySelectorAll('[data-claim]').forEach((btn) => {
      btn.onclick = () => {
        const m = state.missions.find((x) => x.key === btn.dataset.claim);
        const done = missions.claim(m);
        if (done) this.log(`MISSION COMPLETE — ${done.title} · +${done.reward.units.toLocaleString()} units, +${done.reward.nanites} nanites`, 'good');
        else this.log('Cannot claim — deliver the goods first', 'bad');
        this.renderTrade();
      };
    });

    // ---- shipyard
    $('trade-ships').innerHTML = Object.entries(SHIPS).map(([k, def]) => {
      const owned = state.ownedShips.includes(k);
      const active2 = state.ship === k;
      return `<div class="shipcard ${active2 ? 'active' : ''}">
        <div class="s-head">${def.label}</div>
        <div class="s-desc">${def.desc}</div>
        <div class="s-stats">
          <span>Speed ${def.speed.toFixed(2)}×</span>
          <span>Damage ${def.damage.toFixed(2)}×</span>
          <span>Shield ${def.shield.toFixed(2)}×</span>
          <span>Cargo ${def.cargo >= 0 ? '+' : ''}${def.cargo}</span>
          <span>Warp +${def.warp} ly</span>
        </div>
        <button data-ship="${k}" ${active2 ? 'disabled' : ''}>
          ${active2 ? 'In use' : owned ? 'Switch' : def.price.toLocaleString() + ' units'}
        </button>
      </div>`;
    }).join('');
    $('trade-ships').querySelectorAll('[data-ship]').forEach((btn) => {
      btn.onclick = () => {
        const res = buyShip(btn.dataset.ship);
        if (res === 'poor') this.log('Not enough units for that ship', 'bad');
        else this.log(`Now flying the ${SHIPS[btn.dataset.ship].label}`, 'good');
        this.renderTrade();
      };
    });

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
