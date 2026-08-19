// Planet surface mode: a streaming, living procedural world you walk around in.
import * as THREE from 'three';
import { Noise } from './noise.js';
import { RNG, hash3 } from './rng.js';
import { input } from './input.js';
import { state, stats, addResource, discover, spendResources, hasResources } from './state.js';
import { ui } from './ui.js';
import {
  buildShip, radialSprite, buildMonolith, buildCrashedShip, buildOutpost,
  makeStarfield, buildSentinel, buildAurora, buildPortal,
} from './assets3d.js';
import * as missions from './missions.js';
import { makeName, loreLine } from './universe.js';
import { audio } from './audio.js';

const CHUNK = 140;
const SEG_NEAR = 44;
const SEG_FAR = 14;
const VIEW = 4;
const EYE = 1.7;

export class SurfaceMode {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 9000);
    this.chunks = new Map();
    this.props = [];
    this.structures = [];
    this.creatures = [];
    this.raycaster = new THREE.Raycaster();
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.launchRequest = false;
    this.scanTimer = 0;
    this.time = 0;
    this.dayT = 0.28;
    this.sentinels = [];
    this.wanted = 0;
    this.wantedCool = 0;
    this.sentinelSpawnTimer = 0;
    this.toolCooldown = 0;
    this.bolts = [];
    this.boltPool = [];
    this.hitTimer = 0;
    this.deaths = 0;
    this.portal = null;
    this.portalRequest = null;
    this.portalHold = 0;
    this.bob = 0;
    this.stepTimer = 0;

    this.sun = new THREE.DirectionalLight('#ffffff', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = -120; cam.right = 120; cam.top = 120; cam.bottom = -120;
    cam.near = 1; cam.far = 900;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#404040', 1.0);
    this.scene.add(this.hemi);

    this.moonLight = new THREE.DirectionalLight('#8fb4ff', 0.25);
    this.scene.add(this.moonLight);

    this.stars = makeStarfield(2500, 3000, 21);
    this.scene.add(this.stars);

    this.aurora = buildAurora('#7dffd0');
    this.aurora.visible = false;
    this.scene.add(this.aurora);

    // shooting stars
    this.meteors = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.6, 26, 4, 6),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })
      );
      m.visible = false;
      this.scene.add(m);
      this.meteors.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
    }

    // multi-tool bolts
    this.boltGeo = new THREE.CapsuleGeometry(0.06, 1.1, 4, 6);
    this.boltMat = new THREE.MeshBasicMaterial({ color: '#9dffc4' });
    this.boltMatHostile = new THREE.MeshBasicMaterial({ color: '#ff5a3c' });
    this.sentinelPing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ff4d4d', 64, 2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }));
    this.sentinelPing.visible = false;
    this.scene.add(this.sentinelPing);

    // water with animated waves
    this.waterUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#1f6f8f') } };
    const waterGeo = new THREE.PlaneGeometry(CHUNK * (VIEW * 2 + 3), CHUNK * (VIEW * 2 + 3), 64, 64);
    waterGeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
      color: '#1f6f8f', transparent: true, opacity: 0.78, roughness: 0.12, metalness: 0.45,
    }));
    this.water.receiveShadow = false;
    this.water.material.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.waterUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed.y += sin(position.x * 0.08 + uTime * 1.3) * 0.35
                        + cos(position.z * 0.11 + uTime * 0.9) * 0.3;`
      );
    };
    this.scene.add(this.water);

    this.ship = buildShip();
    this.ship.scale.setScalar(1.7);
    this.scene.add(this.ship);
    this.shipLight = new THREE.PointLight('#8fdcff', 1.2, 60, 2);
    this.scene.add(this.shipLight);

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 6),
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

    // weather particles
    const wCount = 2600;
    const wPos = new Float32Array(wCount * 3);
    for (let i = 0; i < wCount; i++) {
      wPos[i * 3] = (Math.random() - 0.5) * 90;
      wPos[i * 3 + 1] = Math.random() * 50;
      wPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const wGeo = new THREE.BufferGeometry();
    wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
    this.weather = new THREE.Points(wGeo, new THREE.PointsMaterial({
      color: '#cfefff', size: 0.35, transparent: true, opacity: 0.6, depthWrite: false,
    }));
    this.weather.frustumCulled = false;
    this.weather.visible = false;
    this.scene.add(this.weather);
    this.weatherVel = 1;

    this.propGeo = {
      rock: new THREE.DodecahedronGeometry(1, 0),
      boulder: new THREE.IcosahedronGeometry(1, 1),
      crystal: new THREE.OctahedronGeometry(1, 0),
      trunk: new THREE.CylinderGeometry(0.16, 0.3, 1, 7),
      leaf: new THREE.IcosahedronGeometry(1, 0),
      pod: new THREE.SphereGeometry(1, 10, 8),
      cap: new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      cone: new THREE.ConeGeometry(1, 1, 7),
      torus: new THREE.TorusGeometry(1, 0.24, 8, 16),
    };
  }

  // -------------------------------------------------- world setup
  setPlanet(planet, system) {
    this.planet = planet;
    this.system = system;
    this.noise = new Noise(planet.seed);
    const rng = new RNG(planet.seed ^ 0xabcd);
    const b = planet.biome;
    this.amp = b.amp * rng.float(0.85, 1.4);
    this.mountain = rng.float(0.7, 1.6);
    this.waterLevel = planet.biomeKey === 'ocean' ? rng.float(0, 6) : rng.float(-28, -2);
    this.gravity = 19 * planet.gravity;
    this.palette = b.ground.map((c) => new THREE.Color(c));
    this.rockColor = new THREE.Color(b.rock);
    this.floraColor = new THREE.Color().setHSL(rng.float(0, 1), rng.float(0.45, 0.95), rng.float(0.35, 0.6));
    this.floraColor2 = new THREE.Color().setHSL(rng.float(0, 1), rng.float(0.45, 0.95), rng.float(0.4, 0.65));
    this.crystalColor = new THREE.Color().setHSL(rng.float(0, 1), 0.9, 0.62);
    this.skyDay = new THREE.Color(b.sky);
    this.skyNight = new THREE.Color(b.night);
    this.fogDay = new THREE.Color(b.fog);
    this.dayT = rng.float(0.15, 0.55);

    this.scene.background = this.skyDay.clone();
    this.scene.fog = new THREE.FogExp2(this.fogDay.clone(), 0.0019);
    this.sun.color.set(system.starColor);
    this.water.material.color.set(b.water);

    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 });
    this.rockMat = new THREE.MeshStandardMaterial({ color: this.rockColor, roughness: 1, flatShading: true });
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: this.crystalColor, roughness: 0.12, metalness: 0.35,
      emissive: this.crystalColor, emissiveIntensity: 0.6, flatShading: true,
    });
    this.trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a34', roughness: 1 });
    this.leafMat = new THREE.MeshStandardMaterial({ color: this.floraColor, roughness: 0.85, flatShading: true });
    this.leafMat2 = new THREE.MeshStandardMaterial({ color: this.floraColor2, roughness: 0.8, flatShading: true });

    // weather setup
    const wet = ['Heavy Rain', 'Storms'].includes(planet.weather);
    const dusty = ['Dust Haze', 'Windy'].includes(planet.weather);
    const frozen = planet.biomeKey === 'frozen' || planet.biomeKey === 'crystalline';
    this.weather.visible = wet || dusty || frozen;
    this.weatherVel = wet ? 34 : frozen ? 6 : 3;
    this.weather.material.color.set(frozen ? '#ffffff' : wet ? '#9fd8ff' : b.fog);
    this.weather.material.size = frozen ? 0.55 : wet ? 0.32 : 0.4;
    this.weather.material.opacity = dusty ? 0.35 : 0.65;

    this.auroraActive = ['frozen', 'exotic', 'crystalline', 'crimson'].includes(planet.biomeKey) || rng.chance(0.25);
    this.aurora.children.forEach((r) => r.material.color.set(this.crystalColor));

    // sentinels
    for (const s2 of this.sentinels) this.scene.remove(s2.mesh);
    this.sentinels = [];
    this.wanted = 0;
    this.wantedCool = 0;
    this.sentinelAggression = { Passive: 0.25, Low: 0.6, Aggressive: 1.25 }[planet.sentinels] ?? 0.5;
    for (const b2 of this.bolts) { b2.mesh.visible = false; this.boltPool.push(b2); }
    this.bolts.length = 0;
    state.suitShield = stats.suitShieldMax;

    // clear world
    for (const key of [...this.chunks.keys()]) this.removeChunk(key);
    for (const c of this.creatures) this.scene.remove(c.mesh);
    this.creatures = [];

    // ancient portal — one per planet, on roughly a third of worlds
    if (this.portal) { this.scene.remove(this.portal); this.portal = null; }
    this.hasPortal = rng.chance(0.34);
    this.portalGlyphs = Array.from({ length: 6 }, () => '0123456789ABCDEF'[rng.int(0, 15)]).join('');
    this.portalTargetSystem = rng.int(0, 100000);
    this.portalTargetPlanet = rng.int(0, 5);

    this.pos.set(rng.float(-300, 300), 0, rng.float(-300, 300));
    this.ensureChunks(true);
    this.pos.y = this.height(this.pos.x, this.pos.z) + EYE + 0.2;
    const sx = this.pos.x + 8, sz = this.pos.z + 5;
    this.ship.position.set(sx, this.height(sx, sz) + 1.6, sz);
    this.ship.rotation.set(0, rng.float(0, Math.PI * 2), 0);
    this.vel.set(0, 0, 0);
    this.yaw = rng.float(0, Math.PI * 2);
    this.pitch = -0.05;
    if (this.hasPortal) {
      const pa = rng.float(0, Math.PI * 2);
      const pd = rng.float(90, 260);
      const px = this.pos.x + Math.cos(pa) * pd;
      const pz = this.pos.z + Math.sin(pa) * pd;
      const portal = buildPortal(this.crystalColor.getStyle());
      portal.position.set(px, this.height(px, pz), pz);
      portal.rotation.y = rng.float(0, Math.PI * 2);
      portal.userData.glyphs = this.portalGlyphs;   // keep the builder's refs (inner disc)
      this.scene.add(portal);
      this.portal = portal;
    }

    this.spawnCreatures();
    state.visitedPlanets[planet.seed] = true;
  }

  // -------------------------------------------------- terrain
  height(x, z) {
    const n = this.noise;
    const base = n.fbm2(x * 0.0016, z * 0.0016, 5) * 44;
    const mask = Math.max(0, n.noise2D(x * 0.00035 + 40, z * 0.00035 - 20));
    const mountains = n.ridged2(x * 0.0035, z * 0.0035, 4) * 66 * mask * this.mountain;
    const plateau = Math.max(0, n.noise2D(x * 0.0009 - 15, z * 0.0009 + 8)) * 16;
    const detail = n.fbm2(x * 0.02, z * 0.02, 3) * 1.8;
    return (base + mountains + plateau + detail) * this.amp;
  }

  chunkKey(cx, cz) { return cx + ',' + cz; }

  buildChunk(cx, cz, ring) {
    const seg = ring <= 1 ? SEG_NEAR : ring <= 2 ? Math.round(SEG_NEAR * 0.6) : SEG_FAR;
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const c = new THREE.Color();
    const snow = new THREE.Color('#f2f7ff');
    const sand = new THREE.Color('#c9bf94');

    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.height(pos.getX(i) + ox, pos.getZ(i) + oz));
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;

    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i);
      const slope = 1 - nrm.getY(i);
      const t = THREE.MathUtils.clamp((h + 30) / 120, 0, 1);
      c.copy(this.palette[0]).lerp(this.palette[1], t);
      if (t > 0.5) c.lerp(this.palette[2], (t - 0.5) * 1.4);
      if (slope > 0.32) c.lerp(this.rockColor, Math.min(1, (slope - 0.32) * 3));
      if (t > 0.88) c.lerp(snow, (t - 0.88) * 4);
      if (h < this.waterLevel + 3.5) c.lerp(sand, 0.5);
      const j = 0.93 + ((hash3(i, cx, cz) % 100) / 100) * 0.14;
      colors[i * 3] = c.r * j; colors[i * 3 + 1] = c.g * j; colors[i * 3 + 2] = c.b * j;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mesh = new THREE.Mesh(geo, this.terrainMat);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.scene.add(mesh);

    const props = ring <= 3 ? this.scatterProps(cx, cz) : [];
    const structures = ring <= 2 ? this.scatterStructures(cx, cz) : [];
    this.chunks.set(this.chunkKey(cx, cz), { mesh, props, structures, ring });
  }

  makeFlora(rng, style, x, y, z) {
    const g = new THREE.Group();
    const scale = 0.6 + this.planet.flora * 0.9;
    if (style === 'tree') {
      const h = rng.float(3, 10) * scale;
      const trunk = new THREE.Mesh(this.propGeo.trunk, this.trunkMat);
      trunk.scale.set(1, h, 1); trunk.position.y = h / 2; g.add(trunk);
      for (let k = 0; k < rng.int(1, 3); k++) {
        const leaf = new THREE.Mesh(rng.chance(0.5) ? this.propGeo.leaf : this.propGeo.pod, rng.chance(0.5) ? this.leafMat : this.leafMat2);
        const ls = rng.float(1.1, 2.6) * scale;
        leaf.scale.set(ls, ls * rng.float(0.5, 1.2), ls);
        leaf.position.set(rng.float(-0.9, 0.9), h + rng.float(-0.6, 0.9), rng.float(-0.9, 0.9));
        g.add(leaf);
      }
    } else if (style === 'mushroom') {
      const h = rng.float(1.6, 6) * scale;
      const stem = new THREE.Mesh(this.propGeo.trunk, this.trunkMat);
      stem.scale.set(1.6, h, 1.6); stem.position.y = h / 2; g.add(stem);
      const cap = new THREE.Mesh(this.propGeo.cap, rng.chance(0.5) ? this.leafMat : this.leafMat2);
      const cs = rng.float(1.4, 3.4) * scale;
      cap.scale.set(cs, cs * rng.float(0.5, 1.0), cs);
      cap.position.y = h;
      g.add(cap);
    } else if (style === 'cactus') {
      const h = rng.float(1.8, 5) * scale;
      const body = new THREE.Mesh(this.propGeo.trunk, this.leafMat);
      body.scale.set(2.2, h, 2.2); body.position.y = h / 2; g.add(body);
      for (const s of [-1, 1]) {
        if (!rng.chance(0.6)) continue;
        const arm = new THREE.Mesh(this.propGeo.trunk, this.leafMat);
        arm.scale.set(1.4, h * 0.45, 1.4);
        arm.position.set(s * 0.8, h * 0.6, 0);
        arm.rotation.z = s * 0.6;
        g.add(arm);
      }
    } else if (style === 'spike') {
      const h = rng.float(1.4, 4.5) * scale;
      const spike = new THREE.Mesh(this.propGeo.cone, this.leafMat);
      spike.scale.set(rng.float(0.4, 1.1), h, rng.float(0.4, 1.1));
      spike.position.y = h / 2;
      g.add(spike);
    } else if (style === 'crystal') {
      const h = rng.float(1.6, 5) * scale;
      const shard = new THREE.Mesh(this.propGeo.crystal, this.crystalMat);
      shard.scale.set(rng.float(0.4, 0.9), h, rng.float(0.4, 0.9));
      shard.position.y = h * 0.6;
      g.add(shard);
    } else { // orb
      const h = rng.float(1.2, 3.6) * scale;
      const stalk = new THREE.Mesh(this.propGeo.trunk, this.trunkMat);
      stalk.scale.set(0.7, h, 0.7); stalk.position.y = h / 2; g.add(stalk);
      const orb = new THREE.Mesh(this.propGeo.pod, this.leafMat2);
      const os = rng.float(0.7, 1.7) * scale;
      orb.scale.setScalar(os);
      orb.position.y = h + os * 0.4;
      g.add(orb);
      const ring = new THREE.Mesh(this.propGeo.torus, this.leafMat);
      ring.scale.setScalar(os * 1.4);
      ring.rotation.x = rng.float(0, 3);
      ring.position.y = h + os * 0.4;
      g.add(ring);
    }
    g.position.set(x, y, z);
    g.rotation.y = rng.float(0, Math.PI * 2);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  scatterProps(cx, cz) {
    const rng = new RNG(hash3(cx, cz, this.planet.seed));
    const out = [];
    const count = Math.floor(12 + this.planet.flora * 16);
    for (let i = 0; i < count; i++) {
      const x = cx * CHUNK + rng.float(-CHUNK / 2, CHUNK / 2);
      const z = cz * CHUNK + rng.float(-CHUNK / 2, CHUNK / 2);
      const y = this.height(x, z);
      if (y < this.waterLevel + 1) continue;

      const roll = rng.next();
      let obj, res, amount, label;
      if (roll < 0.36) {
        const s = rng.float(0.8, 3.6);
        obj = new THREE.Mesh(rng.chance(0.5) ? this.propGeo.rock : this.propGeo.boulder, this.rockMat);
        obj.scale.set(s, s * rng.float(0.6, 1.3), s);
        obj.rotation.set(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6));
        obj.position.set(x, y + s * 0.4, z);
        obj.castShadow = obj.receiveShadow = true;
        res = 'ferrite'; amount = rng.int(16, 38); label = 'Ferrite Deposit';
      } else if (roll < 0.56) {
        const s = rng.float(0.7, 2.3);
        obj = new THREE.Mesh(this.propGeo.crystal, this.crystalMat);
        obj.scale.set(s * 0.6, s * rng.float(1.6, 3.2), s * 0.6);
        obj.rotation.y = rng.float(0, 6);
        obj.position.set(x, y + s * 1.1, z);
        obj.castShadow = true;
        const kinds = ['dihydrogen', 'sodium', ...this.planet.resources];
        res = rng.pick(kinds); amount = rng.int(12, 30);
        label = res === 'dihydrogen' ? 'Di-hydrogen Crystal'
          : res === 'sodium' ? 'Sodium Formation'
            : res === 'chromatic' ? 'Chromatic Vein' : 'Mineral Formation';
      } else if (roll < 0.6 + this.planet.flora * 0.34) {
        obj = this.makeFlora(rng, this.planet.biome.floraStyle, x, y, z);
        res = 'carbon'; amount = rng.int(14, 32); label = 'Flora';
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

  scatterStructures(cx, cz) {
    const rng = new RNG(hash3(cx + 7777, cz - 313, this.planet.seed));
    const out = [];
    const chance = 0.18 * this.planet.ruins;
    if (!rng.chance(chance)) return out;

    // find dry, reasonably flat ground inside the chunk
    let x = 0, z = 0, y = -Infinity;
    for (let attempt = 0; attempt < 6; attempt++) {
      const tx = cx * CHUNK + rng.float(-CHUNK * 0.42, CHUNK * 0.42);
      const tz = cz * CHUNK + rng.float(-CHUNK * 0.42, CHUNK * 0.42);
      const ty = this.height(tx, tz);
      const slope = Math.abs(ty - this.height(tx + 6, tz)) + Math.abs(ty - this.height(tx, tz + 6));
      if (ty > this.waterLevel + 2 && slope < 6) { x = tx; z = tz; y = ty; break; }
      if (ty > y) { x = tx; z = tz; y = ty; }
    }
    if (y < this.waterLevel + 2) return out;

    const kind = rng.pick(['monolith', 'crash', 'outpost']);
    let obj;
    if (kind === 'monolith') obj = buildMonolith(rng, this.crystalColor.getStyle());
    else if (kind === 'crash') obj = buildCrashedShip(rng);
    else obj = buildOutpost(rng, this.crystalColor.getStyle());
    obj.position.set(x, y, z);
    obj.rotation.y = rng.float(0, Math.PI * 2);
    obj.userData = {
      structure: kind,
      key: `st:${this.planet.seed}:${cx}:${cz}`,
      name: kind === 'monolith' ? 'Ancient Monolith' : kind === 'crash' ? 'Crashed Freighter' : 'Abandoned Outpost',
      lore: loreLine(rng),
      loot: kind === 'crash'
        ? { chromatic: rng.int(25, 60), platinum: rng.int(20, 50) }
        : kind === 'outpost'
          ? { sodium: rng.int(30, 70), dihydrogen: rng.int(30, 70) }
          : { chromatic: rng.int(15, 40) },
      used: !!state.discoveries[`st:${this.planet.seed}:${cx}:${cz}`],
    };
    this.scene.add(obj);
    out.push(obj);
    this.structures.push(obj);
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
    for (const s of ch.structures || []) {
      this.scene.remove(s);
      const i = this.structures.indexOf(s);
      if (i >= 0) this.structures.splice(i, 1);
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
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        if (!this.chunks.has(key)) todo.push([pcx + dx, pcz + dz, dx * dx + dz * dz, ring]);
      }
    }
    todo.sort((a, b) => a[2] - b[2]);
    const budget = immediate ? todo.length : 2;
    for (let i = 0; i < Math.min(budget, todo.length); i++) {
      this.buildChunk(todo[i][0], todo[i][1], todo[i][3]);
    }
    for (const key of [...this.chunks.keys()]) if (!wanted.has(key)) this.removeChunk(key);
    this.water.position.set(pcx * CHUNK, this.waterLevel, pcz * CHUNK);
  }

  // -------------------------------------------------- creatures
  spawnCreatures() {
    const n = Math.round(this.planet.fauna * 11);
    const rng = new RNG(this.planet.seed ^ 0x77);
    for (let i = 0; i < n; i++) {
      const flying = rng.chance(0.25);
      const g = new THREE.Group();
      const col = new THREE.Color().setHSL(rng.float(0, 1), rng.float(0.4, 0.95), rng.float(0.35, 0.65));
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, flatShading: true });
      const s = rng.float(0.5, 2.6);

      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
      body.scale.set(1, rng.float(0.7, 1.2), rng.float(1, 1.6));
      g.add(body);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.55, 1), mat);
      head.position.set(0, s * 0.7, s * 0.9);
      g.add(head);

      if (flying) {
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.ConeGeometry(s * 0.9, s * 2.4, 4), mat);
          wing.rotation.z = side * Math.PI / 2;
          wing.position.set(side * s * 1.2, s * 0.2, 0);
          g.add(wing);
          wing.userData.wing = side;
        }
      } else {
        for (const side of [-1, 1]) {
          for (const f of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.1, s * 0.07, s * 1.3, 5), mat);
            leg.position.set(side * s * 0.55, -s * 0.75, f * s * 0.55);
            g.add(leg);
          }
        }
      }
      const eyeMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', emissive: '#ffd166', emissiveIntensity: 1.1 });
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.13, 8, 6), eyeMat);
        eye.position.set(side * s * 0.24, s * 0.88, s * 1.25);
        g.add(eye);
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });

      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(30, 240);
      g.position.set(this.pos.x + Math.cos(a) * d, 0, this.pos.z + Math.sin(a) * d);
      this.scene.add(g);
      this.creatures.push({
        mesh: g, size: s, flying,
        name: makeName(rng, false) + ' ' + rng.pick(['Prime', 'Minor', 'Rex', 'Vulpis', 'Gryph', 'Nox', 'Ferox', 'Pica']),
        temperament: rng.pick(['Docile', 'Skittish', 'Curious', 'Territorial']),
        diet: rng.pick(['Herbivore', 'Carnivore', 'Oxide Eater', 'Photosynthetic']),
        weight: Math.round(s * rng.float(40, 160)),
        speed: rng.float(2, 8),
        dir: rng.float(0, Math.PI * 2),
        timer: 0, hop: rng.float(0, 6),
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
      if (away > 460) {
        const a = Math.random() * Math.PI * 2;
        c.mesh.position.set(this.pos.x + Math.cos(a) * 220, 0, this.pos.z + Math.sin(a) * 220);
      }
      let dir = c.dir;
      let sp = c.speed;
      if (c.temperament === 'Skittish' && away < 28) {
        dir = Math.atan2(c.mesh.position.z - this.pos.z, c.mesh.position.x - this.pos.x);
        sp *= 2.3;
      } else if (c.temperament === 'Curious' && away < 60) {
        dir = Math.atan2(this.pos.z - c.mesh.position.z, this.pos.x - c.mesh.position.x);
      } else if (c.fed && away > 6 && away < 90) {
        dir = Math.atan2(this.pos.z - c.mesh.position.z, this.pos.x - c.mesh.position.x);
      } else if (c.temperament === 'Territorial' && away < 22) {
        dir = Math.atan2(this.pos.z - c.mesh.position.z, this.pos.x - c.mesh.position.x);
        sp *= 1.6;
      }
      c.mesh.position.x += Math.cos(dir) * sp * dt;
      c.mesh.position.z += Math.sin(dir) * sp * dt;
      c.hop += dt * (3 + sp);
      const ground = this.height(c.mesh.position.x, c.mesh.position.z);
      if (c.flying) {
        c.mesh.position.y = ground + 9 + Math.sin(c.hop * 0.6) * 3.5;
        c.mesh.children.forEach((ch) => {
          if (ch.userData.wing) ch.rotation.x = Math.sin(c.hop * 3) * 0.6;
        });
      } else {
        c.mesh.position.y = ground + c.size * 1.35 + Math.abs(Math.sin(c.hop)) * c.size * 0.4;
      }
      c.mesh.rotation.y = -dir + Math.PI / 2;
    }
  }

  // -------------------------------------------------- sentinels & combat
  raiseWanted(amount, reason) {
    const before = Math.floor(this.wanted);
    this.wanted = Math.min(3, this.wanted + amount * this.sentinelAggression);
    this.wantedCool = 14;
    const now = Math.floor(this.wanted);
    if (now > before && now >= 1) {
      ui.log(now === 1
        ? 'SENTINELS ALERTED — drones inbound'
        : `SENTINEL ESCALATION — level ${now}`, 'bad');
      audio.error();
      this.sentinelSpawnTimer = 0;
    }
  }

  spawnSentinel() {
    const mesh = buildSentinel(1 + Math.random() * 0.4);
    const a = Math.random() * Math.PI * 2;
    const d = 50 + Math.random() * 60;
    mesh.position.set(this.pos.x + Math.cos(a) * d, 0, this.pos.z + Math.sin(a) * d);
    mesh.position.y = this.height(mesh.position.x, mesh.position.z) + 12;
    this.scene.add(mesh);
    this.sentinels.push({ mesh, hp: 28, cooldown: 1 + Math.random(), bob: Math.random() * 6 });
  }

  updateSentinels(dt) {
    // wanted level decays when you keep your head down
    this.wantedCool -= dt;
    if (this.wantedCool <= 0 && this.wanted > 0) {
      this.wanted = Math.max(0, this.wanted - dt * 0.12);
      if (this.wanted <= 0 && this.sentinels.length === 0) ui.log('Sentinels have lost interest', 'good');
    }

    const wantLevel = Math.floor(this.wanted);
    const desired = wantLevel === 0 ? 0 : wantLevel * 2;
    this.sentinelSpawnTimer -= dt;
    if (this.sentinels.length < desired && this.sentinelSpawnTimer <= 0) {
      this.sentinelSpawnTimer = 2.4;
      this.spawnSentinel();
    }

    for (let i = this.sentinels.length - 1; i >= 0; i--) {
      const s = this.sentinels[i];
      const toPlayer = this.pos.clone().sub(s.mesh.position);
      const d = toPlayer.length();
      toPlayer.normalize();
      s.bob += dt * 2.4;

      // hover, keep 14-26m away
      const speed = d > 26 ? 13 : d < 12 ? -9 : 3;
      s.mesh.position.addScaledVector(toPlayer, speed * dt);
      const ground = this.height(s.mesh.position.x, s.mesh.position.z);
      const targetY = Math.max(ground + 9, this.pos.y + 4) + Math.sin(s.bob) * 0.8;
      s.mesh.position.y += (targetY - s.mesh.position.y) * Math.min(1, dt * 2.5);
      this._lookAtHelper(s.mesh, this.pos);

      s.cooldown -= dt;
      if (s.cooldown <= 0 && d < 42) {
        s.cooldown = 1.3 + Math.random() * 0.9;
        const from = s.mesh.position.clone();
        const aim = this.pos.clone().sub(from).normalize();
        this.fireBolt(from, aim, true, 9);
      }

      if (d > 420) { this.scene.remove(s.mesh); this.sentinels.splice(i, 1); }
    }
  }

  _lookAtHelper(obj, target) {
    const m = new THREE.Matrix4().lookAt(obj.position, target, new THREE.Vector3(0, 1, 0));
    obj.quaternion.setFromRotationMatrix(m);
  }

  fireBolt(origin, dir, hostile, dmg) {
    let b = this.boltPool.pop();
    if (!b) {
      const mesh = new THREE.Mesh(this.boltGeo, hostile ? this.boltMatHostile : this.boltMat);
      this.scene.add(mesh);
      b = { mesh, vel: new THREE.Vector3(), life: 0, dmg: 0, hostile: false };
    }
    b.mesh.material = hostile ? this.boltMatHostile : this.boltMat;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    b.vel.copy(dir).multiplyScalar(hostile ? 60 : 110);
    b.life = 2.2;
    b.dmg = dmg;
    b.hostile = hostile;
    this.bolts.push(b);
    audio.blip(hostile ? 200 : 640, 0.05, 'square', 0.13);
  }

  updateBolts(dt) {
    const seg = (p, a, b) => {
      const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
      const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
      const len2 = abx * abx + aby * aby + abz * abz;
      let t = len2 > 0 ? (apx * abx + apy * aby + apz * abz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const prev = b.mesh.position.clone();
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      let dead = b.life <= 0;

      if (!dead && b.mesh.position.y < this.height(b.mesh.position.x, b.mesh.position.z)) dead = true;

      if (!dead && b.hostile) {
        if (seg(this.pos, prev, b.mesh.position) < 1.5) {
          dead = true;
          this.damagePlayer(b.dmg);
        }
      } else if (!dead) {
        for (const s of this.sentinels) {
          if (seg(s.mesh.position, prev, b.mesh.position) < 2.2) {
            dead = true;
            s.hp -= b.dmg * stats.toolDamage;
            if (s.hp <= 0) this.killSentinel(s);
            break;
          }
        }
      }
      if (dead) { b.mesh.visible = false; this.boltPool.push(b); this.bolts.splice(i, 1); }
    }

    // player fire
    this.toolCooldown -= dt;
    if (input.mouseRight && this.toolCooldown <= 0) {
      this.toolCooldown = 0.16;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const from = this.camera.position.clone().addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.2, 0));
      this.fireBolt(from, dir, false, 11);
      this.raiseWanted(0.02);
    }
  }

  killSentinel(s) {
    this.scene.remove(s.mesh);
    const i = this.sentinels.indexOf(s);
    if (i >= 0) this.sentinels.splice(i, 1);
    state.sentinelKills++;
    state.nanites += 25;
    addResource('ferrite', 20);
    ui.flashSlot('ferrite');
    ui.log('SENTINEL DESTROYED — +25 nanites, +20 Ferrite', 'good');
    audio.sweep(500, 80, 0.4, 'sawtooth', 0.25);
    for (const m of missions.event('kill_sentinel')) ui.missionDone(m);
    this.raiseWanted(0.5);
  }

  damagePlayer(dmg) {
    this.hitTimer = 0.6;
    ui.damageFlash();
    if (state.suitShield > 0) {
      state.suitShield = Math.max(0, state.suitShield - dmg);
      audio.blip(160, 0.1, 'square', 0.2);
    } else {
      state.life = Math.max(0, state.life - dmg * 0.9);
      audio.blip(95, 0.16, 'square', 0.26);
      if (state.life <= 0) this.playerDown();
    }
  }

  playerDown() {
    state.life = 40;
    state.suitShield = stats.suitShieldMax * 0.5;
    state.hazardProtection = Math.max(state.hazardProtection, 40);
    this.deaths++;
    this.wanted = 0;
    for (const s of this.sentinels) this.scene.remove(s.mesh);
    this.sentinels = [];
    this.pos.copy(this.ship.position).add(new THREE.Vector3(0, 4, 0));
    this.vel.set(0, 0, 0);
    // drop a slice of cargo
    for (const k of ['carbon', 'ferrite', 'sodium', 'dihydrogen']) {
      state.inventory[k] = Math.floor((state.inventory[k] || 0) * 0.75);
    }
    ui.log('EXOSUIT FAILURE — revived at your ship, some cargo lost', 'bad');
    ui.warpFlash(600);
  }

  // -------------------------------------------------- day / night / weather
  updateSky(dt) {
    this.time += dt;
    this.dayT = (this.dayT + dt / this.planet.dayLength) % 1;
    const ang = this.dayT * Math.PI * 2;
    const sunHeight = Math.sin(ang);
    const dayFactor = THREE.MathUtils.clamp(sunHeight * 1.6 + 0.35, 0, 1);

    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.6, sunHeight, Math.sin(ang) * 0.45).normalize();
    this.sun.position.copy(this.pos).addScaledVector(sunDir, 300);
    this.sun.target.position.copy(this.pos);
    this.sun.target.updateMatrixWorld();
    this.sun.intensity = 2.9 * dayFactor;

    const sunset = THREE.MathUtils.clamp(1 - Math.abs(sunHeight) * 3.2, 0, 1);
    const sky = this.skyNight.clone().lerp(this.skyDay, dayFactor);
    sky.lerp(new THREE.Color('#ff7a3d'), sunset * 0.45);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(this.fogDay).lerp(this.skyNight, 1 - dayFactor).lerp(new THREE.Color('#ff8a4d'), sunset * 0.3);

    this.hemi.intensity = 0.25 + dayFactor * 0.95;
    this.hemi.color.copy(sky);
    this.hemi.groundColor.copy(this.palette[1]);
    this.moonLight.intensity = 0.3 * (1 - dayFactor);
    this.moonLight.position.copy(this.pos).add(new THREE.Vector3(-200, 260, -150));

    this.stars.position.copy(this.pos);
    this.stars.material.uniforms.uOpacity.value = 1 - dayFactor;
    this.stars.visible = dayFactor < 0.95;
    this.shipLight.position.copy(this.ship.position).add(new THREE.Vector3(0, 4, 0));
    this.shipLight.intensity = 0.5 + (1 - dayFactor) * 2.2;

    this.waterUniforms.uTime.value = this.time;

    // aurora ribbons and shooting stars only at night
    const night = 1 - dayFactor;
    this.aurora.visible = this.auroraActive && night > 0.35;
    if (this.aurora.visible) {
      this.aurora.position.set(this.pos.x, this.pos.y, this.pos.z);
      this.aurora.rotation.y += dt * 0.02;
      this.aurora.children.forEach((r, i) => {
        r.material.opacity = 0.05 + Math.abs(Math.sin(this.time * 0.3 + i)) * 0.16 * night;
      });
    }
    for (const m of this.meteors) {
      if (m.life > 0) {
        m.life -= dt;
        m.mesh.position.addScaledVector(m.vel, dt);
        m.mesh.material.opacity = Math.min(1, m.life * 2);
        if (m.life <= 0) m.mesh.visible = false;
      } else if (night > 0.5 && Math.random() < dt * 0.12) {
        m.life = 1.4;
        m.mesh.visible = true;
        const a = Math.random() * Math.PI * 2;
        m.mesh.position.set(this.pos.x + Math.cos(a) * 400, this.pos.y + 260, this.pos.z + Math.sin(a) * 400);
        m.vel.set(-Math.cos(a) * 220, -60, -Math.sin(a) * 220);
        m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.vel.clone().normalize());
      }
    }

    // weather drift
    if (this.weather.visible) {
      this.weather.position.set(this.pos.x, 0, this.pos.z);
      const p = this.weather.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - this.weatherVel * dt;
        let x = p.getX(i) + dt * this.weatherVel * 0.12;
        if (y < -6) { y = 46 + Math.random() * 8; }
        if (x > 45) x -= 90;
        p.setY(i, y); p.setX(i, x);
      }
      p.needsUpdate = true;
      this.weather.position.y = this.height(this.pos.x, this.pos.z);
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
    const speed = sprint ? 18 : 9;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    const accel = this.grounded ? 13 : 4;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, dt * accel);

    if (input.down('Space')) {
      if (this.grounded) {
        this.vel.y = 9 * Math.sqrt(this.planet.gravity);
        this.grounded = false;
        audio.blip(320, 0.07, 'sine', 0.15);
      } else if (state.jetpack > 0) {
        this.vel.y += 28 * dt;
        state.jetpack = Math.max(0, state.jetpack - dt * stats.jetpackDrain);
      }
    }
    this.vel.y -= this.gravity * dt;

    this.pos.addScaledVector(this.vel, dt);

    const ground = this.height(this.pos.x, this.pos.z);
    const swimming = this.pos.y < this.waterLevel + EYE;
    const floor = Math.max(ground, swimming ? this.waterLevel - 1.4 : -Infinity) + EYE;
    if (this.pos.y <= floor) {
      if (this.vel.y < -22) audio.blip(120, 0.12, 'sine', 0.2);
      this.pos.y = floor;
      this.vel.y = 0;
      this.grounded = true;
      state.jetpack = Math.min(100, state.jetpack + dt * stats.jetpackRecharge);
    } else {
      this.grounded = false;
      if (!input.down('Space')) state.jetpack = Math.min(100, state.jetpack + dt * 12);
    }

    // head bob + footsteps
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && horizSpeed > 1) {
      this.bob += dt * horizSpeed * 0.9;
      this.stepTimer -= dt * horizSpeed;
      if (this.stepTimer <= 0) {
        this.stepTimer = 8;
        audio.blip(90 + Math.random() * 40, 0.05, 'triangle', 0.08);
      }
    } else this.bob += dt;

    this.camera.position.copy(this.pos);
    this.camera.position.y += Math.sin(this.bob * 2) * (this.grounded ? 0.06 : 0) * Math.min(1, horizSpeed / 8);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(Math.sin(this.bob) * 0.006 * Math.min(1, horizSpeed / 8));

    this.updateSky(dt);
    this.ensureChunks();
    this.updateCreatures(dt);
    this.updateSentinels(dt);
    this.updateBolts(dt);
    this.updateHazards(dt, swimming);
    this.updateTool(dt);
    this.regenSuit(dt);
    audio.hum(Math.min(0.3, horizSpeed / 70));
    ui.compass(this.yaw, this.waypoints());
  }

  waypoints() {
    const list = [{ pos: this.ship.position, color: '#63e6ff', label: 'SHIP' }];
    if (this.portal) list.push({ pos: this.portal.position, color: '#ffb066', label: 'PORTAL' });
    for (const s of this.structures) {
      if (s.position.distanceTo(this.pos) < 400) {
        list.push({ pos: s.position, color: s.userData.used ? '#8a8a8a' : '#ff9f43', label: s.userData.name.toUpperCase() });
      }
    }
    return list.map((w) => {
      const dx = w.pos.x - this.pos.x, dz = w.pos.z - this.pos.z;
      return { bearing: Math.atan2(dx, -dz), dist: Math.hypot(dx, dz), color: w.color, label: w.label };
    });
  }

  regenSuit(dt) {
    this.hitTimer = Math.max(0, this.hitTimer - dt);
    if (this.hitTimer <= 0 && this.sentinels.length === 0) {
      state.suitShield = Math.min(stats.suitShieldMax, state.suitShield + dt * 7);
    }
  }

  updateHazards(dt, swimming) {
    const b = this.planet.biome;
    if (b.hazard !== 'None') {
      state.hazardProtection = Math.max(0, state.hazardProtection - dt * stats.hazardDrain);
      if (state.hazardProtection <= 0) {
        state.life = Math.max(0, state.life - dt * 4);
        if (state.life <= 0) {
          state.life = 35; state.hazardProtection = 50;
          this.pos.copy(this.ship.position).add(new THREE.Vector3(0, 4, 0));
          this.vel.set(0, 0, 0);
          ui.log('LIFE SUPPORT FAILURE — emergency recovery at ship', 'bad');
          audio.error();
        } else if (Math.random() < dt * 1.4) {
          ui.log('WARNING: hazard protection depleted', 'bad');
        }
      }
    } else {
      state.hazardProtection = Math.min(100, state.hazardProtection + dt * 3);
    }

    if (swimming && this.pos.y < this.waterLevel - 0.4) {
      state.life = Math.max(0, state.life - dt * 5);
    } else {
      state.life = Math.min(100, state.life + dt * 1.2);
    }

    if (input.down('KeyR') && state.hazardProtection < 95 && hasResources({ sodium: 10 })) {
      spendResources({ sodium: 10 });
      state.hazardProtection = Math.min(100, state.hazardProtection + 50);
      ui.log('Hazard protection recharged with Sodium', 'good');
      audio.pickup();
      input.keys.delete('KeyR');
    }
  }

  updateTool(dt) {
    this.beam.visible = false;
    this.impact.visible = false;
    this.launchRequest = false;

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const origin = this.camera.position.clone();
    this.raycaster.set(origin, dir);
    this.raycaster.far = 30;

    let tName = null, tSub = '', scanPct = null, prompt = '';

    // ship
    const shipDist = this.ship.position.distanceTo(this.pos);
    if (shipDist < 15) {
      prompt = state.launchFuel >= 20
        ? 'Press <b>E</b> to launch'
        : 'Thrusters dry — <b>G</b> to refuel (20 Di-hydrogen)';
      if (input.down('KeyE') && state.launchFuel >= 20) {
        this.launchRequest = true;
        input.keys.delete('KeyE');
      }
      if (input.down('KeyG') && hasResources({ dihydrogen: 20 })) {
        spendResources({ dihydrogen: 20 });
        state.launchFuel = Math.min(100, state.launchFuel + 50);
        ui.log('Launch thrusters refuelled', 'good');
        audio.pickup();
        input.keys.delete('KeyG');
      }
    }

    // ancient portal
    this.portalRequest = null;
    if (this.portal) {
      this.portal.userData.inner.material.opacity = 0.22 + Math.sin(this.time * 2) * 0.12;
      this.portal.rotation.y += dt * 0.05;
      const pd = this.portal.position.distanceTo(this.pos);
      if (pd < 18) {
        tName = 'ANCIENT PORTAL';
        tSub = `glyph address ${this.portalGlyphs} · hold <b>E</b> to step through`;
        prompt = prompt || 'Hold <b>E</b> to activate the portal';
        if (input.down('KeyE')) {
          this.portalHold += dt;
          scanPct = Math.min(1, this.portalHold / 1.4);
          if (this.portalHold > 1.4) {
            this.portalHold = 0;
            this.portalRequest = {
              systemHash: this.portalTargetSystem,
              planetIndex: this.portalTargetPlanet,
              glyphs: this.portalGlyphs,
            };
          }
        } else this.portalHold = 0;
      }
    }

    // structures
    let structure = null;
    for (const s of this.structures) {
      if (s.position.distanceTo(this.pos) < 12) { structure = s; break; }
    }
    if (structure && !prompt) {
      const u = structure.userData;
      tName = u.name.toUpperCase();
      tSub = u.used ? 'already surveyed' : 'hold <b>F</b> to interface';
      if (!u.used) {
        if (input.down('KeyF')) {
          if (this.scanTimer <= 0) audio.scan();
          this.scanTimer += dt * stats.scanSpeed;
          scanPct = Math.min(1, this.scanTimer / 1.6);
          if (this.scanTimer > 1.6) {
            this.scanTimer = 0;
            u.used = true;
            discover(u.key, u.name, 'ruin');
            for (const [k, v] of Object.entries(u.loot)) { addResource(k, v); ui.flashSlot(k); }
            ui.log(`${u.name.toUpperCase()} — ${u.lore}`, 'good');
            ui.log(`Salvage: ${Object.entries(u.loot).map(([k, v]) => `+${v} ${k}`).join(' · ')} · +60 nanites`, 'good');
            audio.discovery();
            for (const m of missions.event('ruin')) ui.missionDone(m);
          }
        } else this.scanTimer = 0;
      }
    }

    // creature scan
    let creature = null, ncd = 70;
    for (const c of this.creatures) {
      const d = c.mesh.position.distanceTo(this.pos);
      const toC = c.mesh.position.clone().sub(origin).normalize();
      if (d < ncd && toC.dot(dir) > 0.94) { creature = c; ncd = d; }
    }

    const hits = this.raycaster.intersectObjects(this.props, true);
    let hitProp = null;
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData?.res && o.parent) o = o.parent;
      if (o?.userData?.res) hitProp = { obj: o, point: hits[0].point };
    }

    if (hitProp && !structure) {
      const u = hitProp.obj.userData;
      tName = u.label.toUpperCase();
      tSub = `${u.res.toUpperCase()} · ${Math.max(0, Math.round(u.hp * 100))}%`;
      if (input.mouseDown) {
        const end = hitProp.point;
        this.beam.visible = true;
        this.beam.position.copy(origin.clone().lerp(end, 0.5));
        this.beam.scale.set(1, origin.distanceTo(end), 1);
        this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.impact.visible = true;
        this.impact.position.copy(end);
        this.impact.scale.setScalar(0.9 + Math.random() * 0.7);

        u.hp -= dt * 1.5 * stats.miningRate;
        this.raiseWanted(dt * 0.035);
        if (u.hp <= 0) {
          const got = addResource(u.res, u.amount);
          ui.flashSlot(u.res);
          ui.log(`+${got} ${u.res}`, 'good');
          audio.pickup();
          this.raiseWanted(0.08);
          for (const m of missions.syncGather()) ui.missionDone(m);
          this.scene.remove(hitProp.obj);
          const i = this.props.indexOf(hitProp.obj);
          if (i >= 0) this.props.splice(i, 1);
          for (const ch of this.chunks.values()) {
            const j = ch.props.indexOf(hitProp.obj);
            if (j >= 0) ch.props.splice(j, 1);
          }
        }
      }
    } else if (creature && !structure) {
      const known = state.discoveries[creature.key];
      if (ncd < 14) {
        prompt = prompt || (creature.fed
          ? `${creature.name} is following you`
          : 'Press <b>G</b> to feed (10 Carbon)');
        if (!creature.fed && input.down('KeyG') && hasResources({ carbon: 10 })) {
          spendResources({ carbon: 10 });
          creature.fed = true;
          creature.temperament = 'Docile';
          const drop = ['sodium', 'ferrite', 'carbon', 'dihydrogen'][Math.floor(Math.random() * 4)];
          const amt = 20 + Math.floor(Math.random() * 30);
          addResource(drop, amt);
          ui.flashSlot(drop);
          ui.log(`${creature.name} is grateful — +${amt} ${drop}`, 'good');
          audio.pickup();
          input.keys.delete('KeyG');
        }
      }
      tName = known ? creature.name.toUpperCase() : 'UNKNOWN LIFEFORM';
      tSub = known
        ? `${creature.diet} · ${creature.temperament} · ${creature.weight} kg`
        : `${Math.round(ncd)} m · hold F to scan`;
      if (input.down('KeyF') && !known) {
        if (this.scanTimer <= 0) audio.scan();
        this.scanTimer += dt * stats.scanSpeed;
        scanPct = Math.min(1, this.scanTimer / 1.1);
        if (this.scanTimer > 1.1) {
          this.scanTimer = 0;
          const reward = discover(creature.key, creature.name, 'creature');
          ui.log(`LIFEFORM CATALOGUED — ${creature.name} · ${creature.diet} · ${creature.temperament} (+${reward} units)`, 'good');
          audio.discovery();
          for (const m of missions.event('scan_creature')) ui.missionDone(m);
        }
      } else if (!input.down('KeyF')) this.scanTimer = 0;
    } else if (!structure) {
      this.scanTimer = 0;
    }

    ui.prompt(prompt);
    ui.target(tName, tSub, scanPct);
  }

  info() {
    const p = this.planet;
    const alt = Math.round(this.pos.y - this.waterLevel);
    const hh = Math.floor(this.dayT * 24);
    const mm = Math.floor((this.dayT * 24 % 1) * 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    return {
      system: this.system.name,
      planetLabel: 'Planet',
      planet: `${p.name} · ${p.biome.label}`,
      sentinelLevel: Math.floor(this.wanted),
      conditions: `Hazard: ${p.biome.hazard} · ${p.weather}<br>`
        + `Sentinels: ${p.sentinels} · Gravity: ${p.gravity.toFixed(2)}g<br>`
        + `Local time ${clock} · Altitude ${alt} m<br>`
        + `Coords ${Math.round(this.pos.x)}, ${Math.round(this.pos.z)}`,
    };
  }
}
