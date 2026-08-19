// Planet surface mode: walk around a procedurally generated world.
import * as THREE from 'three';
import { Noise } from './noise.js';
import { RNG, hash3 } from './rng.js';
import { input } from './input.js';
import { state, addResource, discover, spendResources, hasResources } from './state.js';
import { ui } from './ui.js';
import { buildShip, radialSprite } from './assets3d.js';
import { makeName } from './universe.js';
import { audio } from './audio.js';

const CHUNK = 128;
const SEG = 28;
const VIEW = 3;           // chunk radius
const EYE = 1.7;
const GRAV = 19;

export class SurfaceMode {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 6000);
    this.chunks = new Map();
    this.props = [];
    this.creatures = [];
    this.raycaster = new THREE.Raycaster();
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.launchRequest = false;
    this.mineTarget = null;
    this.scanTimer = 0;

    this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
    this.sun.position.set(300, 600, 200);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#404040', 1.1);
    this.scene.add(this.hemi);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK * (VIEW * 2 + 3), CHUNK * (VIEW * 2 + 3)),
      new THREE.MeshStandardMaterial({ color: '#1f6f8f', transparent: true, opacity: 0.72, roughness: 0.15, metalness: 0.3 })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);

    this.ship = buildShip();
    this.ship.scale.setScalar(1.6);
    this.scene.add(this.ship);

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
      new THREE.MeshBasicMaterial({ color: '#ffbb44' })
    );
    this.beam.visible = false;
    this.scene.add(this.beam);

    this.impact = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffd27a', 64, 2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    this.impact.scale.setScalar(1.2);
    this.impact.visible = false;
    this.scene.add(this.impact);

    this.propGeo = {
      rock: new THREE.DodecahedronGeometry(1, 0),
      crystal: new THREE.OctahedronGeometry(1, 0),
      trunk: new THREE.CylinderGeometry(0.16, 0.28, 1, 6),
      leaf: new THREE.IcosahedronGeometry(1, 0),
      pod: new THREE.SphereGeometry(1, 8, 6),
    };
  }

  // -------------------------------------------------- world setup
  setPlanet(planet, system) {
    this.planet = planet;
    this.system = system;
    this.noise = new Noise(planet.seed);
    const rng = new RNG(planet.seed ^ 0xabcd);
    const b = planet.biome;
    this.amp = b.amp * rng.float(0.8, 1.35);
    this.mountain = rng.float(0.6, 1.5);
    this.waterLevel = planet.biomeKey === 'ocean' ? 8 : rng.float(-26, -2);
    this.palette = b.ground.map((c) => new THREE.Color(c));
    this.rockColor = new THREE.Color(b.rock);
    this.floraColor = new THREE.Color().setHSL(rng.float(0, 1), rng.float(0.4, 0.9), rng.float(0.35, 0.6));
    this.crystalColor = new THREE.Color().setHSL(rng.float(0, 1), 0.85, 0.6);

    this.scene.background = new THREE.Color(b.sky);
    this.scene.fog = new THREE.FogExp2(new THREE.Color(b.fog), 0.0022);
    this.hemi.color.set(b.sky);
    this.hemi.groundColor.set(b.ground[1]);
    this.sun.color.set(system.starColor);
    this.water.material.color.set(planet.biomeKey === 'toxic' ? '#7fbf3f' : planet.biomeKey === 'volcanic' ? '#ff5a1f' : '#1f6f8f');

    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.02, flatShading: true });
    this.rockMat = new THREE.MeshStandardMaterial({ color: this.rockColor, roughness: 1, flatShading: true });
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: this.crystalColor, roughness: 0.15, metalness: 0.3,
      emissive: this.crystalColor, emissiveIntensity: 0.45, flatShading: true,
    });
    this.trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: 1 });
    this.leafMat = new THREE.MeshStandardMaterial({ color: this.floraColor, roughness: 0.85, flatShading: true });

    // clear world
    for (const key of [...this.chunks.keys()]) this.removeChunk(key);
    for (const c of this.creatures) this.scene.remove(c.mesh);
    this.creatures = [];

    // spawn
    this.pos.set(rng.float(-200, 200), 0, rng.float(-200, 200));
    this.ensureChunks(true);
    const h = this.height(this.pos.x, this.pos.z);
    this.pos.y = h + EYE + 0.2;
    this.ship.position.set(this.pos.x + 7, this.height(this.pos.x + 7, this.pos.z + 4) + 1.4, this.pos.z + 4);
    this.ship.rotation.y = rng.float(0, Math.PI * 2);
    this.vel.set(0, 0, 0);
    this.yaw = rng.float(0, Math.PI * 2);
    this.pitch = -0.05;
    this.spawnCreatures();
  }

  // -------------------------------------------------- terrain
  height(x, z) {
    const n = this.noise;
    const base = n.fbm2(x * 0.0016, z * 0.0016, 5) * 42;
    const mask = Math.max(0, n.noise2D(x * 0.00035 + 40, z * 0.00035 - 20));
    const mountains = n.ridged2(x * 0.0035, z * 0.0035, 4) * 60 * mask * this.mountain;
    const detail = n.fbm2(x * 0.02, z * 0.02, 3) * 1.6;
    return (base + mountains + detail) * this.amp;
  }

  chunkKey(cx, cz) { return cx + ',' + cz; }

  buildChunk(cx, cz) {
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const c = new THREE.Color();
    const heights = [];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + ox;
      const z = pos.getZ(i) + oz;
      const h = this.height(x, z);
      pos.setY(i, h);
      heights.push(h);
    }
    // colour by height + slope
    for (let i = 0; i < pos.count; i++) {
      const h = heights[i];
      const t = THREE.MathUtils.clamp((h + 30) / 110, 0, 1);
      c.copy(this.palette[0]).lerp(this.palette[1], t);
      if (t > 0.55) c.lerp(this.rockColor, (t - 0.55) * 2);
      if (t > 0.85) c.lerp(new THREE.Color('#f2f7ff'), (t - 0.85) * 3);
      if (h < this.waterLevel + 3) c.lerp(new THREE.Color('#c9bf94'), 0.45);
      const j = 0.94 + ((hash3(i, cx, cz) % 100) / 100) * 0.12;
      colors[i * 3] = c.r * j; colors[i * 3 + 1] = c.g * j; colors[i * 3 + 2] = c.b * j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(ox, 0, oz);
    this.scene.add(mesh);

    const props = this.scatterProps(cx, cz);
    this.chunks.set(this.chunkKey(cx, cz), { mesh, props });
  }

  scatterProps(cx, cz) {
    const rng = new RNG(hash3(cx, cz, this.planet.seed));
    const out = [];
    const density = 10 + this.planet.flora * 14;
    const count = Math.floor(density);
    for (let i = 0; i < count; i++) {
      const x = cx * CHUNK + rng.float(-CHUNK / 2, CHUNK / 2);
      const z = cz * CHUNK + rng.float(-CHUNK / 2, CHUNK / 2);
      const y = this.height(x, z);
      if (y < this.waterLevel + 1) continue;

      const roll = rng.next();
      let obj, res, amount, label;
      if (roll < 0.4) {
        // rock
        const s = rng.float(0.8, 3.2);
        obj = new THREE.Mesh(this.propGeo.rock, this.rockMat);
        obj.scale.set(s, s * rng.float(0.6, 1.3), s);
        obj.rotation.set(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6));
        obj.position.set(x, y + s * 0.4, z);
        res = 'ferrite'; amount = rng.int(14, 32); label = 'Ferrite Deposit';
      } else if (roll < 0.58) {
        const s = rng.float(0.7, 2.1);
        obj = new THREE.Mesh(this.propGeo.crystal, this.crystalMat);
        obj.scale.set(s * 0.6, s * rng.float(1.6, 3), s * 0.6);
        obj.rotation.y = rng.float(0, 6);
        obj.position.set(x, y + s * 1.1, z);
        const kinds = ['dihydrogen', 'sodium', ...this.planet.resources];
        res = rng.pick(kinds); amount = rng.int(10, 26);
        label = res === 'dihydrogen' ? 'Di-hydrogen Crystal' : res === 'sodium' ? 'Sodium Formation' : 'Mineral Formation';
      } else if (roll < 0.62 + this.planet.flora * 0.3) {
        // tree / plant
        const g = new THREE.Group();
        const hgt = rng.float(2.5, 8) * (0.5 + this.planet.flora);
        const trunk = new THREE.Mesh(this.propGeo.trunk, this.trunkMat);
        trunk.scale.set(1, hgt, 1);
        trunk.position.y = hgt / 2;
        g.add(trunk);
        const canopyCount = rng.int(1, 3);
        for (let k = 0; k < canopyCount; k++) {
          const leaf = new THREE.Mesh(rng.chance(0.5) ? this.propGeo.leaf : this.propGeo.pod, this.leafMat);
          const ls = rng.float(1, 2.4);
          leaf.scale.set(ls, ls * rng.float(0.5, 1.2), ls);
          leaf.position.set(rng.float(-0.8, 0.8), hgt + rng.float(-0.6, 0.8), rng.float(-0.8, 0.8));
          g.add(leaf);
        }
        g.position.set(x, y, z);
        obj = g;
        res = 'carbon'; amount = rng.int(12, 28); label = 'Flora';
      } else {
        continue;
      }
      obj.userData = { res, amount, label, hp: 1.0 };
      this.scene.add(obj);
      out.push(obj);
      this.props.push(obj);
    }
    return out;
  }

  removeChunk(key) {
    const ch = this.chunks.get(key);
    if (!ch) return;
    this.scene.remove(ch.mesh);
    ch.mesh.geometry.dispose();
    for (const p of ch.props) {
      this.scene.remove(p);
      const i = this.props.indexOf(p);
      if (i >= 0) this.props.splice(i, 1);
    }
    this.chunks.delete(key);
  }

  ensureChunks(immediate = false) {
    const pcx = Math.round(this.pos.x / CHUNK);
    const pcz = Math.round(this.pos.z / CHUNK);
    const wanted = new Set();
    const todo = [];
    for (let dx = -VIEW; dx <= VIEW; dx++) {
      for (let dz = -VIEW; dz <= VIEW; dz++) {
        const key = this.chunkKey(pcx + dx, pcz + dz);
        wanted.add(key);
        if (!this.chunks.has(key)) todo.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      }
    }
    todo.sort((a, b) => a[2] - b[2]);
    const budget = immediate ? todo.length : 2;
    for (let i = 0; i < Math.min(budget, todo.length); i++) this.buildChunk(todo[i][0], todo[i][1]);
    for (const key of [...this.chunks.keys()]) if (!wanted.has(key)) this.removeChunk(key);
    this.water.position.set(pcx * CHUNK, this.waterLevel, pcz * CHUNK);
  }

  // -------------------------------------------------- creatures
  spawnCreatures() {
    const n = Math.round(this.planet.fauna * 9);
    const rng = new RNG(this.planet.seed ^ 0x77);
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const col = new THREE.Color().setHSL(rng.float(0, 1), rng.float(0.4, 0.9), rng.float(0.4, 0.65));
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, flatShading: true });
      const bodyS = rng.float(0.6, 2.2);
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(bodyS, 1), mat);
      g.add(body);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(bodyS * 0.55, 1), mat);
      head.position.set(0, bodyS * 0.7, bodyS * 0.8);
      g.add(head);
      for (const s of [-1, 1]) {
        for (const f of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(bodyS * 0.1, bodyS * 0.08, bodyS * 1.2, 5), mat);
          leg.position.set(s * bodyS * 0.5, -bodyS * 0.7, f * bodyS * 0.5);
          g.add(leg);
        }
      }
      const eyeMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffcf5c', emissiveIntensity: 0.7 });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(bodyS * 0.12, 6, 5), eyeMat);
        eye.position.set(s * bodyS * 0.22, bodyS * 0.85, bodyS * 1.2);
        g.add(eye);
      }
      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(30, 220);
      g.position.set(this.pos.x + Math.cos(a) * d, 0, this.pos.z + Math.sin(a) * d);
      this.scene.add(g);
      this.creatures.push({
        mesh: g,
        size: bodyS,
        name: makeName(rng, false) + ' ' + rng.pick(['Prime', 'Minor', 'Rex', 'Vulpis', 'Gryph', 'Nox']),
        temperament: rng.pick(['Docile', 'Skittish', 'Curious', 'Territorial']),
        speed: rng.float(2, 7),
        dir: rng.float(0, Math.PI * 2),
        timer: 0,
        hop: rng.float(0, 6),
        key: 'cr:' + this.planet.seed + ':' + i,
      });
    }
  }

  updateCreatures(dt) {
    for (const c of this.creatures) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.timer = 1.5 + Math.random() * 3.5;
        c.dir += (Math.random() - 0.5) * 2.4;
      }
      const away = c.mesh.position.distanceTo(this.pos);
      if (away > 420) {
        const a = Math.random() * Math.PI * 2;
        c.mesh.position.set(this.pos.x + Math.cos(a) * 200, 0, this.pos.z + Math.sin(a) * 200);
      }
      const sp = c.speed * (c.temperament === 'Skittish' && away < 25 ? 2.2 : 1);
      let dir = c.dir;
      if (c.temperament === 'Skittish' && away < 25) {
        dir = Math.atan2(c.mesh.position.z - this.pos.z, c.mesh.position.x - this.pos.x);
      } else if (c.temperament === 'Curious' && away < 60) {
        dir = Math.atan2(this.pos.z - c.mesh.position.z, this.pos.x - c.mesh.position.x);
      }
      c.mesh.position.x += Math.cos(dir) * sp * dt;
      c.mesh.position.z += Math.sin(dir) * sp * dt;
      c.hop += dt * (3 + sp);
      const ground = this.height(c.mesh.position.x, c.mesh.position.z);
      c.mesh.position.y = ground + c.size * 1.3 + Math.abs(Math.sin(c.hop)) * c.size * 0.35;
      c.mesh.rotation.y = -dir + Math.PI / 2;
    }
  }

  // -------------------------------------------------- player
  update(dt) {
    const m = input.consumeMouse();
    this.yaw -= m.x * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - m.y * 0.0022, -1.45, 1.45);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.down('KeyW')) wish.add(forward);
    if (input.down('KeyS')) wish.sub(forward);
    if (input.down('KeyD')) wish.add(right);
    if (input.down('KeyA')) wish.sub(right);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(sprint ? 17 : 8.5);

    const accel = this.grounded ? 12 : 4;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * accel);

    // jump + jetpack
    if (input.down('Space')) {
      if (this.grounded) {
        this.vel.y = 8.5;
        this.grounded = false;
      } else if (state.jetpack > 0) {
        this.vel.y += 26 * dt;
        state.jetpack = Math.max(0, state.jetpack - dt * 22);
      }
    }
    this.vel.y -= GRAV * dt;

    this.pos.addScaledVector(this.vel, dt);

    const ground = this.height(this.pos.x, this.pos.z);
    const floor = Math.max(ground, this.waterLevel - 1.2) + EYE;
    if (this.pos.y <= floor) {
      this.pos.y = floor;
      this.vel.y = 0;
      this.grounded = true;
      state.jetpack = Math.min(100, state.jetpack + dt * 32);
    } else {
      this.grounded = false;
      if (!input.down('Space')) state.jetpack = Math.min(100, state.jetpack + dt * 10);
    }

    this.camera.position.copy(this.pos);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    this.sun.position.copy(this.pos).add(new THREE.Vector3(320, 620, 180));
    this.sun.target.position.copy(this.pos);
    this.sun.target.updateMatrixWorld();

    audio.hum(Math.min(0.35, this.vel.length() / 60));
    this.ensureChunks();
    this.updateCreatures(dt);
    this.updateHazards(dt);
    this.updateTool(dt);
  }

  updateHazards(dt) {
    const b = this.planet.biome;
    if (b.hazard !== 'None') {
      state.hazardProtection = Math.max(0, state.hazardProtection - dt * 1.6);
      if (state.hazardProtection <= 0) {
        state.life = Math.max(0, state.life - dt * 4);
        if (state.life <= 0) {
          state.life = 30; state.hazardProtection = 50;
          this.pos.copy(this.ship.position).add(new THREE.Vector3(0, 3, 0));
          ui.log('LIFE SUPPORT FAILURE — emergency recovery at ship', 'bad');
        } else if (Math.random() < dt * 2) {
          ui.log('WARNING: hazard protection depleted', 'bad');
        }
      }
    } else {
      state.hazardProtection = Math.min(100, state.hazardProtection + dt * 3);
    }
    // underwater / life support drain
    if (this.pos.y < this.waterLevel) {
      state.life = Math.max(0, state.life - dt * 6);
    } else {
      state.life = Math.min(100, state.life + dt * 1.2);
    }

    if (input.down('KeyR')) {
      if (state.hazardProtection < 95 && hasResources({ sodium: 10 })) {
        spendResources({ sodium: 10 });
        state.hazardProtection = Math.min(100, state.hazardProtection + 50);
        ui.log('Hazard protection recharged with Sodium', 'good');
        input.keys.delete('KeyR');
      }
    }
  }

  updateTool(dt) {
    this.beam.visible = false;
    this.impact.visible = false;
    this.launchRequest = false;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position.clone();
    this.raycaster.set(origin, dir);
    this.raycaster.far = 26;

    let tName = null, tSub = '', scanPct = null, prompt = '';

    // ship prompt
    const shipDist = this.ship.position.distanceTo(this.pos);
    if (shipDist < 14) {
      prompt = state.launchFuel >= 20
        ? 'Press <b>E</b> to launch'
        : 'Launch thrusters need fuel — <b>refuel with 20 Di-hydrogen (press G)</b>';
      if (input.down('KeyE') && state.launchFuel >= 20) {
        this.launchRequest = true;
        input.keys.delete('KeyE');
      }
      if (input.down('KeyG') && hasResources({ dihydrogen: 20 })) {
        spendResources({ dihydrogen: 20 });
        state.launchFuel = Math.min(100, state.launchFuel + 50);
        ui.log('Launch thrusters refuelled', 'good');
        input.keys.delete('KeyG');
      }
    }

    // creature scanning
    let nearestCreature = null, ncd = 60;
    for (const c of this.creatures) {
      const d = c.mesh.position.distanceTo(this.pos);
      const toC = c.mesh.position.clone().sub(origin).normalize();
      if (d < ncd && toC.dot(dir) > 0.93) { nearestCreature = c; ncd = d; }
    }

    const hits = this.raycaster.intersectObjects(this.props, true);
    let hitProp = null;
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData?.res && o.parent) o = o.parent;
      if (o?.userData?.res) hitProp = { obj: o, point: hits[0].point };
    }

    if (hitProp) {
      const u = hitProp.obj.userData;
      tName = u.label.toUpperCase();
      tSub = `${u.res.toUpperCase()} · ${Math.round(u.hp * 100)}%`;
      if (input.mouseDown) {
        this.beam.visible = true;
        const end = hitProp.point;
        const mid = origin.clone().lerp(end, 0.5);
        this.beam.position.copy(mid);
        this.beam.scale.set(1, origin.distanceTo(end), 1);
        this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.impact.visible = true;
        this.impact.position.copy(end);
        this.impact.scale.setScalar(0.9 + Math.random() * 0.7);

        u.hp -= dt * 1.5;
        if (u.hp <= 0) {
          addResource(u.res, u.amount);
          ui.flashSlot(u.res);
          ui.log(`+${u.amount} ${u.res}`, 'good');
          audio.pickup();
          this.scene.remove(hitProp.obj);
          const i = this.props.indexOf(hitProp.obj);
          if (i >= 0) this.props.splice(i, 1);
          for (const ch of this.chunks.values()) {
            const j = ch.props.indexOf(hitProp.obj);
            if (j >= 0) ch.props.splice(j, 1);
          }
        }
      }
    } else if (nearestCreature) {
      const known = state.discoveries[nearestCreature.key];
      tName = known ? nearestCreature.name.toUpperCase() : 'UNKNOWN LIFEFORM';
      tSub = known ? `${nearestCreature.temperament} · catalogued` : `${Math.round(ncd)} m · hold F to scan`;
      if (input.down('KeyF') && !known) {
        this.scanTimer += dt;
        scanPct = Math.min(1, this.scanTimer / 1.1);
        if (this.scanTimer < dt * 1.5) audio.scan();
        if (this.scanTimer > 1.1) {
          this.scanTimer = 0;
          discover(nearestCreature.key, nearestCreature.name, 'creature');
          ui.log(`LIFEFORM CATALOGUED — ${nearestCreature.name} (${nearestCreature.temperament}) +400 units`, 'good');
          audio.discovery();
        }
      } else this.scanTimer = 0;
    } else {
      this.scanTimer = 0;
    }

    ui.prompt(prompt);
    ui.target(tName, tSub, scanPct);
  }

  info() {
    const p = this.planet;
    const alt = Math.round(this.pos.y - this.waterLevel);
    return {
      system: this.system.name,
      planetLabel: 'Planet',
      planet: `${p.name} · ${p.biome.label}`,
      conditions: `Hazard: ${p.biome.hazard} · Weather: ${p.weather}<br>Sentinels: ${p.sentinels} · Altitude: ${alt} m<br>Coords: ${Math.round(this.pos.x)}, ${Math.round(this.pos.z)}`,
    };
  }
}
