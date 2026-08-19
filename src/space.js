// Space flight mode: fly, fight, scan and dock inside a star system.
import * as THREE from 'three';
import {
  planetTextures, makeStarfield, makeNebula, buildShip, buildPirate,
  buildStation, radialSprite, atmosphereMaterial,
} from './assets3d.js';
import { input } from './input.js';
import { state, stats, addResource, discover } from './state.js';
import { ui } from './ui.js';
import { RNG } from './rng.js';
import { audio } from './audio.js';
import { BIOMES } from './universe.js';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, -1);

class Projectile {
  constructor(mesh) {
    this.mesh = mesh;
    this.vel = new THREE.Vector3();
    this.life = 0;
    this.dmg = 10;
    this.hostile = false;
  }
}

export class SpaceMode {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 1, 900000);
    this.scene.add(new THREE.AmbientLight('#5a7a9a', 0.55));

    this.starfield = makeStarfield();
    this.scene.add(this.starfield);

    this.sunLight = new THREE.PointLight('#ffffff', 3.4, 0, 0);
    this.scene.add(this.sunLight);

    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 48, 32),
      new THREE.MeshBasicMaterial({ color: '#fff2cf' })
    );
    this.scene.add(this.sun);

    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffd9a0', 256, 1.5), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    }));
    this.sunGlow.scale.set(16000, 16000, 1);
    this.scene.add(this.sunGlow);

    this.planetGroup = new THREE.Group();
    this.asteroidGroup = new THREE.Group();
    this.enemyGroup = new THREE.Group();
    this.scene.add(this.planetGroup, this.asteroidGroup, this.enemyGroup);

    this.ship = buildShip();
    this.scene.add(this.ship);

    // pooled bolts
    this.bolts = [];
    this.boltPool = [];
    const boltGeo = new THREE.CapsuleGeometry(0.5, 6, 4, 8);
    this.boltGeo = boltGeo;
    this.boltMatFriendly = new THREE.MeshBasicMaterial({ color: '#8ff0ff' });
    this.boltMatHostile = new THREE.MeshBasicMaterial({ color: '#ff6a4d' });

    this.explosionSprites = [];
    for (let i = 0; i < 16; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialSprite('#ffb066', 128, 1.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }));
      sp.visible = false;
      this.scene.add(sp);
      this.explosionSprites.push({ sp, life: 0, size: 1 });
    }

    this.velocity = new THREE.Vector3();
    this.throttle = 0;
    this.speed = 0;
    this.pulse = 0;
    this.landHold = 0;
    this.dockHold = 0;
    this.landRequest = null;
    this.dockRequest = false;
    this.scanTimer = 0;
    this.fireCooldown = 0;
    this.damageTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.planets = [];
    this.enemies = [];
    this.pirateBudget = 0;
    this.spawnTimer = 20;
    this.station = null;
    this.system = null;
    this.camPos = new THREE.Vector3();
    this.camShake = 0;
    this.clouds = [];

    this.buildTitleScene();
  }

  // A pretty backdrop for the title screen, discarded once a real system loads.
  buildTitleScene() {
    this.camera.position.set(-700, 900, 3600);
    this.camera.lookAt(0, 0, 0);
    this.scene.background = makeNebula(99, ['#3b2f7a', '#1f4c8a', '#8a2f5b']);
    this.scene.backgroundIntensity = 0.7;
    this.sun.position.set(-26000, 4000, -30000);
    this.sunGlow.position.copy(this.sun.position);
    this.sunLight.position.copy(this.sun.position);

    const fake = {
      seed: 424242, radius: 1400, biomeKey: 'lush', biome: BIOMES.lush,
      tilt: 0.3, hasRings: true, moons: 1,
    };
    const tex = planetTextures(fake);
    const holder = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(fake.radius, 96, 64),
      new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bump, bumpScale: 8, roughness: 0.9 })
    );
    mesh.rotation.z = fake.tilt;
    holder.add(mesh);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(fake.radius * 1.02, 64, 40),
      new THREE.MeshStandardMaterial({ map: tex.clouds, transparent: true, opacity: 0.5, depthWrite: false })
    );
    holder.add(clouds);
    holder.add(new THREE.Mesh(
      new THREE.SphereGeometry(fake.radius * 1.09, 48, 32),
      atmosphereMaterial(BIOMES.lush.sky, 3.0, 1.5)
    ));
    holder.position.set(900, -400, -1200);
    this.scene.add(holder);
    this.titlePlanet = { holder, mesh, clouds };
    this.ship.position.set(-140, 20, 1400);
    this.ship.rotation.set(0.05, 0.5, 0.1);
  }

  disposeTitleScene() {
    if (!this.titlePlanet) return;
    this.scene.remove(this.titlePlanet.holder);
    this.titlePlanet.holder.traverse((o) => o.geometry?.dispose?.());
    this.titlePlanet = null;
  }

  titleTick(dt) {
    if (!this.titlePlanet) return;
    this.titlePlanet.mesh.rotation.y += dt * 0.02;
    this.titlePlanet.clouds.rotation.y += dt * 0.026;
    this.starfield.rotation.y += dt * 0.004;
    this.camera.position.x = -700 + Math.sin(performance.now() * 0.00006) * 120;
    this.camera.lookAt(500, -100, -600);
  }

  // ------------------------------------------------------------ setup
  setSystem(system, { fromPlanet = null } = {}) {
    this.disposeTitleScene();
    this.system = system;
    for (const g of [this.planetGroup, this.asteroidGroup, this.enemyGroup]) {
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse?.((o) => { o.geometry?.dispose?.(); });
      }
    }
    this.planets = [];
    this.clouds = [];
    this.enemies = [];
    this.station = null;
    this.bolts.forEach((b) => { b.mesh.visible = false; this.boltPool.push(b); });
    this.bolts.length = 0;

    const rng = new RNG(system.seed ^ 0x1234);
    this.scene.background = makeNebula(system.seed, [
      new THREE.Color(system.starColor).offsetHSL(0.5, 0, -0.35).getStyle(),
      new THREE.Color(system.starColor).offsetHSL(0.1, 0, -0.45).getStyle(),
      '#0a0f1c',
    ]);
    this.scene.backgroundIntensity = 0.55;

    this.sun.material.color.set(system.starColor);
    this.sunGlow.material.map = radialSprite(system.starColor, 256, 1.5);
    this.sunGlow.material.needsUpdate = true;
    this.sunLight.color.set(system.starColor);

    this.texQueue = [];
    for (const p of system.planets) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius, 96, 64),
        new THREE.MeshStandardMaterial({
          color: p.biome.ground[1], roughness: 0.9, metalness: 0.02,
        })
      );
      mesh.rotation.z = p.tilt;

      const holder = new THREE.Group();
      holder.add(mesh);

      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.02, 64, 40),
        new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false, roughness: 1 })
      );
      cloud.rotation.z = p.tilt;
      cloud.visible = false;
      holder.add(cloud);
      this.clouds.push(cloud);

      // heavy procedural textures are painted a planet at a time, off the warp path
      this.texQueue.push({ planet: p, mesh, cloud });

      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.09, 48, 32),
        atmosphereMaterial(p.biome.sky, 3.2, 1.3)
      );
      holder.add(atmo);

      if (p.hasRings) {
        const ringGeo = new THREE.RingGeometry(p.radius * 1.5, p.radius * 2.6, 128);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
          color: p.biome.fog, side: THREE.DoubleSide, transparent: true, opacity: 0.32,
        }));
        ring.rotation.x = Math.PI / 2 + p.tilt * 0.6;
        holder.add(ring);
      }

      for (let m = 0; m < p.moons; m++) {
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(p.radius * 0.18, 24, 16),
          new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 1 })
        );
        moon.userData = { dist: p.radius * (2.6 + m * 1.1), ang: m * 2.2, spd: 0.25 + m * 0.1 };
        holder.add(moon);
      }

      holder.userData.planet = p;
      holder.userData.mesh = mesh;
      this.planetGroup.add(holder);
      this.planets.push(holder);
    }

    // station
    const st = buildStation();
    const first = system.planets[0];
    st.position.set(first.orbit * 0.55, 500, first.orbit * 0.25);
    this.scene.add(st);
    this.station = st;

    // asteroid belt
    const astMat = new THREE.MeshStandardMaterial({ color: '#8b7d6b', roughness: 1, flatShading: true });
    const beltR = 9000 + rng.float(0, 4000);
    for (let i = 0; i < 140; i++) {
      const a = rng.float(0, Math.PI * 2);
      const r = beltR + rng.float(-2200, 2200);
      const s = rng.float(28, 110);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), astMat);
      rock.position.set(Math.cos(a) * r, rng.float(-700, 700), Math.sin(a) * r);
      rock.rotation.set(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6));
      rock.userData = {
        hp: 3, spin: new THREE.Vector3(rng.float(-0.3, 0.3), rng.float(-0.3, 0.3), rng.float(-0.3, 0.3)),
        rich: rng.chance(0.28),
      };
      this.asteroidGroup.add(rock);
    }

    this.updateOrbits(0, true);

    const target = fromPlanet != null ? this.planets[fromPlanet] : null;
    if (target) {
      const p = target.userData.planet;
      this.ship.position.copy(target.position).add(new THREE.Vector3(0, p.radius * 1.6, p.radius * 2.4));
      this.ship.lookAt(target.position);
    } else {
      this.ship.position.set(system.planets[0].orbit * 0.6, 900, system.planets[0].orbit * 0.6);
      this.ship.lookAt(0, 0, 0);
    }
    this.ship.up.set(0, 1, 0);
    this.velocity.set(0, 0, 0);
    this.throttle = 0.25;
    this.camPos.copy(this.ship.position);

    // pirates
    this.pirateBudget = system.pirates;
    this.spawnTimer = 12;

    const reward = discover('sys:' + system.id, system.name, 'system');
    if (reward) {
      ui.log(`SYSTEM DISCOVERED — ${system.name} (+${reward} units)`, 'good');
      audio.discovery();
    }
    state.visitedSystems[system.id] = true;
  }

  // ------------------------------------------------------------ world tick
  updateOrbits(dt, immediate = false) {
    for (const holder of this.planets) {
      const p = holder.userData.planet;
      p.orbitAngle += p.orbitSpeed * dt * 0.08;
      holder.position.set(
        Math.cos(p.orbitAngle) * p.orbit,
        Math.sin(p.orbitAngle * 0.4) * 320,
        Math.sin(p.orbitAngle) * p.orbit
      );
      if (!immediate) {
        holder.userData.mesh.rotation.y += dt * 0.02;
        for (const c of holder.children) {
          if (c.userData.dist != null) {
            c.userData.ang += dt * c.userData.spd;
            c.position.set(Math.cos(c.userData.ang) * c.userData.dist, 0, Math.sin(c.userData.ang) * c.userData.dist);
          }
        }
      }
    }
    for (const c of this.clouds) c.rotation.y += dt * 0.006;
  }

  nearestPlanet() {
    let best = null, bestD = Infinity;
    for (const holder of this.planets) {
      const d = holder.position.distanceTo(this.ship.position) - holder.userData.planet.radius;
      if (d < bestD) { bestD = d; best = holder; }
    }
    return { holder: best, dist: bestD };
  }

  update(dt) {
    const ship = this.ship;
    const m = input.consumeMouse();

    const sens = 0.0022;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      -m.y * sens,
      -m.x * sens,
      (input.down('KeyA') ? 1.8 : 0) * dt - (input.down('KeyD') ? 1.8 : 0) * dt,
      'XYZ'
    ));
    ship.quaternion.multiply(q).normalize();

    if (input.down('KeyW')) this.throttle = Math.min(1, this.throttle + dt * 0.85);
    if (input.down('KeyS')) this.throttle = Math.max(0, this.throttle - dt * 1.3);

    const boosting = input.down('ShiftLeft') || input.down('ShiftRight');
    const near = this.nearestPlanet();
    const hostileNear = this.enemies.some((e) => e.mesh.position.distanceTo(ship.position) < 2600);
    const canPulse = near.dist > 900 && !hostileNear;
    const pulsing = input.down('Space') && canPulse;
    this.pulse += ((pulsing ? 1 : 0) - this.pulse) * Math.min(1, dt * (pulsing ? 0.9 : 3.5));

    const maxSpeed = 950 * (boosting ? 3.4 : 1) + this.pulse * 52000;
    this.speed += (this.throttle * maxSpeed - this.speed) * Math.min(1, dt * 1.7);

    const forward = FWD.clone().applyQuaternion(ship.quaternion);
    ship.position.addScaledVector(forward, this.speed * dt);

    if (near.holder && near.dist < 30) {
      const p = near.holder.userData.planet;
      const dir = ship.position.clone().sub(near.holder.position).normalize();
      ship.position.copy(near.holder.position).addScaledVector(dir, p.radius + 30);
      this.speed *= 0.2;
    }

    // camera
    this.camShake = Math.max(0, this.camShake - dt * 2.5);
    const shake = new THREE.Vector3(
      (Math.random() - 0.5) * this.camShake * 4,
      (Math.random() - 0.5) * this.camShake * 4,
      0
    );
    const camOffset = new THREE.Vector3(0, 3.4, 13.5 + this.pulse * 10).add(shake).applyQuaternion(ship.quaternion);
    this.camPos.lerp(ship.position.clone().add(camOffset), Math.min(1, dt * 6));
    this.camera.position.copy(this.camPos);
    this.camera.up.copy(UP.clone().applyQuaternion(ship.quaternion));
    this.camera.lookAt(ship.position.clone().addScaledVector(forward, 40));
    this.camera.fov = 72 + this.pulse * 24 + (boosting ? 7 : 0);
    this.camera.updateProjectionMatrix();

    const t = 0.5 + this.speed / maxSpeed;
    ship.userData.thruster.children.forEach((s) => s.scale.set(1.2 * t, 1.2 * t, 1));

    this.starfield.position.copy(ship.position);
    this.sunGlow.position.copy(this.sun.position);

    this.updateOrbits(dt);
    this.processTextureQueue();
    for (const a of this.asteroidGroup.children) {
      a.rotation.x += a.userData.spin.x * dt;
      a.rotation.y += a.userData.spin.y * dt;
    }

    this.updateCombat(dt);
    this.updateBolts(dt);
    this.updateExplosions(dt);
    this.regenShields(dt);

    audio.hum(Math.min(1, this.speed / 4000) + this.pulse * 0.4);
    this.handleTargeting(dt, near);
  }

  // one planet skin per frame keeps warping instant
  processTextureQueue() {
    if (!this.texQueue || !this.texQueue.length) return;
    const job = this.texQueue.shift();
    const tex = planetTextures(job.planet);
    job.mesh.material.map = tex.map;
    job.mesh.material.bumpMap = tex.bump;
    job.mesh.material.bumpScale = 6;
    job.mesh.material.color.set('#ffffff');
    job.mesh.material.needsUpdate = true;
    if (tex.hasClouds) {
      job.cloud.material.map = tex.clouds;
      job.cloud.material.opacity = 0.5;
      job.cloud.material.needsUpdate = true;
      job.cloud.visible = true;
    }
  }

  // ------------------------------------------------------------ combat
  spawnPirate() {
    const rng = new RNG((Math.random() * 1e9) | 0);
    const mesh = buildPirate(rng.next() * 1000);
    const dir = new THREE.Vector3(rng.float(-1, 1), rng.float(-0.3, 0.3), rng.float(-1, 1)).normalize();
    mesh.position.copy(this.ship.position).addScaledVector(dir, rng.float(1400, 2400));
    this.enemyGroup.add(mesh);
    this.enemies.push({ mesh, hp: 45, cooldown: rng.float(0.5, 2), roll: rng.float(0, 6) });
  }

  updateCombat(dt) {
    // spawn waves
    if (this.pirateBudget > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < 4) {
        this.spawnTimer = 25 + Math.random() * 25;
        const n = Math.min(this.pirateBudget, 1 + Math.floor(Math.random() * 2));
        for (let i = 0; i < n; i++) this.spawnPirate();
        this.pirateBudget -= n;
        ui.log('WARNING — pirate contacts inbound', 'bad');
        audio.error();
      }
    }

    const shipPos = this.ship.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const toShip = shipPos.clone().sub(e.mesh.position);
      const d = toShip.length();
      toShip.normalize();

      // steer
      const desired = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(e.mesh.position, shipPos, UP)
      );
      e.mesh.quaternion.slerp(desired, Math.min(1, dt * 1.6));
      const speed = d > 400 ? 620 : d < 180 ? -180 : 120;
      e.mesh.position.addScaledVector(FWD.clone().applyQuaternion(e.mesh.quaternion), speed * dt);

      // fire
      e.cooldown -= dt;
      const aim = FWD.clone().applyQuaternion(e.mesh.quaternion).dot(toShip);
      if (e.cooldown <= 0 && d < 1400 && aim > 0.965) {
        e.cooldown = 0.55 + Math.random() * 0.5;
        this.fireBolt(e.mesh.position, toShip, true, 8);
      }

      if (d > 9000) { this.enemyGroup.remove(e.mesh); this.enemies.splice(i, 1); }
    }
  }

  fireBolt(origin, dir, hostile, dmg) {
    let b = this.boltPool.pop();
    if (!b) {
      const mesh = new THREE.Mesh(this.boltGeo, hostile ? this.boltMatHostile : this.boltMatFriendly);
      this.scene.add(mesh);
      b = new Projectile(mesh);
    }
    b.mesh.material = hostile ? this.boltMatHostile : this.boltMatFriendly;
    b.mesh.visible = true;
    b.mesh.position.copy(origin);
    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    b.vel.copy(dir).multiplyScalar(hostile ? 2600 : 3800);
    b.life = 2.4;
    b.dmg = dmg;
    b.hostile = hostile;
    this.bolts.push(b);
    audio.blip(hostile ? 220 : 720, 0.06, 'square', 0.18);
  }

  updateBolts(dt) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      let dead = b.life <= 0;

      if (!dead && b.hostile) {
        if (b.mesh.position.distanceTo(this.ship.position) < 9) {
          dead = true;
          this.damagePlayer(b.dmg);
        }
      } else if (!dead) {
        for (const e of this.enemies) {
          if (b.mesh.position.distanceTo(e.mesh.position) < 14) {
            dead = true;
            e.hp -= b.dmg * stats.shipDamage;
            this.explode(b.mesh.position, 40);
            if (e.hp <= 0) this.killEnemy(e);
            break;
          }
        }
        if (!dead) {
          for (const rock of this.asteroidGroup.children) {
            if (b.mesh.position.distanceTo(rock.position) < rock.geometry.parameters.radius + 8) {
              dead = true;
              rock.userData.hp -= 1.1 * stats.shipDamage;
              this.explode(b.mesh.position, 55);
              if (rock.userData.hp <= 0) {
                this.asteroidGroup.remove(rock);
                const rich = rock.userData.rich;
                const amt = 16 + Math.floor(Math.random() * 24);
                addResource(rich ? 'chromatic' : 'ferrite', amt);
                ui.flashSlot(rich ? 'chromatic' : 'ferrite');
                ui.log(`+${amt} ${rich ? 'Chromatic Metal' : 'Ferrite Dust'}`, 'good');
                audio.pickup();
              }
              break;
            }
          }
        }
      }

      if (dead) {
        b.mesh.visible = false;
        this.boltPool.push(b);
        this.bolts.splice(i, 1);
      }
    }

    // player firing
    this.fireCooldown -= dt;
    if (input.mouseDown && this.fireCooldown <= 0) {
      this.fireCooldown = 0.14;
      const dir = FWD.clone().applyQuaternion(this.ship.quaternion);
      for (const s of [-1, 1]) {
        const off = new THREE.Vector3(s * 2.6, -0.18, -2).applyQuaternion(this.ship.quaternion);
        this.fireBolt(this.ship.position.clone().add(off), dir, false, 12);
      }
    }
  }

  killEnemy(e) {
    this.explode(e.mesh.position, 220);
    this.enemyGroup.remove(e.mesh);
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    state.kills++;
    const loot = 20 + Math.floor(Math.random() * 40);
    addResource('platinum', loot);
    state.units += 2200;
    ui.flashSlot('platinum');
    ui.log(`PIRATE DESTROYED — salvage +${loot} Platinum, +2200 units`, 'good');
    audio.sweep(400, 60, 0.6, 'sawtooth', 0.3);
  }

  damagePlayer(dmg) {
    this.damageTimer = 5;
    this.camShake = 0.9;
    ui.damageFlash();
    if (state.shields > 0) {
      state.shields = Math.max(0, state.shields - dmg);
      audio.blip(150, 0.12, 'square', 0.25);
    } else {
      state.shipHealth = Math.max(0, state.shipHealth - dmg * 0.8);
      audio.blip(90, 0.2, 'square', 0.3);
      if (state.shipHealth <= 0) this.playerDestroyed();
    }
  }

  playerDestroyed() {
    this.explode(this.ship.position, 320);
    state.shipHealth = 45;
    state.shields = stats.shieldMax * 0.5;
    // lose a chunk of cargo
    for (const k of ['carbon', 'ferrite', 'sodium', 'dihydrogen', 'platinum', 'chromatic']) {
      state.inventory[k] = Math.floor((state.inventory[k] || 0) * 0.5);
    }
    if (this.station) this.ship.position.copy(this.station.position).add(new THREE.Vector3(0, 300, 500));
    this.speed = 0;
    ui.log('SHIP DESTROYED — emergency rebuild at station, half your cargo is gone', 'bad');
    ui.warpFlash(900);
  }

  regenShields(dt) {
    this.damageTimer = Math.max(0, this.damageTimer - dt);
    if (this.damageTimer <= 0) {
      state.shields = Math.min(stats.shieldMax, state.shields + dt * 6);
    }
  }

  explode(pos, size) {
    const slot = this.explosionSprites.find((s) => s.life <= 0);
    if (!slot) return;
    slot.sp.position.copy(pos);
    slot.sp.visible = true;
    slot.life = 0.45;
    slot.size = size;
  }

  updateExplosions(dt) {
    for (const s of this.explosionSprites) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const t = Math.max(0, s.life / 0.45);
      s.sp.scale.setScalar(s.size * (1.6 - t));
      s.sp.material.opacity = t;
      if (s.life <= 0) s.sp.visible = false;
    }
  }

  // ------------------------------------------------------------ HUD interactions
  handleTargeting(dt, near) {
    this.landRequest = null;
    this.dockRequest = false;
    let prompt = '';
    let tName = null, tSub = '', scanPct = null;

    // hostile priority
    let hostile = null, hd = Infinity;
    for (const e of this.enemies) {
      const d = e.mesh.position.distanceTo(this.ship.position);
      if (d < hd) { hd = d; hostile = e; }
    }

    if (this.station) {
      const sd = this.station.position.distanceTo(this.ship.position);
      this.station.rotation.z += dt * 0.05;
      if (sd < 1200) {
        tName = 'SPACE STATION';
        tSub = `${this.system.economy} · ${this.system.wealth} · ${Math.round(sd)} u`;
        if (sd < 520) {
          prompt = 'Hold <b>E</b> to dock — repair, refuel &amp; trade';
          if (input.down('KeyE')) {
            this.dockHold += dt;
            if (this.dockHold > 0.8) {
              this.dockHold = 0;
              this.dockRequest = true;
            }
          } else this.dockHold = 0;
        }
      }
    }

    if (near.holder) {
      const p = near.holder.userData.planet;
      const d = near.dist;
      if (d < p.radius * 7 && !prompt) {
        const known = state.discoveries['pl:' + p.seed];
        tName = tName || (known ? p.name.toUpperCase() : 'UNKNOWN WORLD');
        if (!tSub) {
          tSub = known
            ? `${p.biome.label} · ${p.weather} · Sentinels: ${p.sentinels} · ${Math.round(d)} u`
            : `UNSCANNED · ${Math.round(d)} u · hold F to scan`;
        }

        if (input.down('KeyF') && !known) {
          if (this.scanTimer <= 0) audio.scan();
          this.scanTimer += dt;
          scanPct = Math.min(1, this.scanTimer / 1.4);
          if (this.scanTimer > 1.4) {
            this.scanTimer = 0;
            const reward = discover('pl:' + p.seed, p.name, 'planet');
            if (reward) {
              p.discovered = true;
              ui.log(`PLANET DISCOVERED — ${p.name} · ${p.biome.label} (+${reward} units)`, 'good');
              ui.log(`Resources: ${p.resources.map((r) => r.toUpperCase()).join(' · ')}`, '');
              audio.discovery();
            }
          }
        } else if (!input.down('KeyF')) this.scanTimer = 0;

        if (d < p.radius * 0.55) {
          prompt = 'Hold <b>E</b> to land';
          if (input.down('KeyE')) {
            this.landHold += dt;
            if (this.landHold > 0.7) { this.landHold = 0; this.landRequest = p; }
          } else this.landHold = 0;
        } else if (d < p.radius * 1.6) {
          prompt = 'Descend closer to land';
        }
      }
    }

    if (hostile && hd < 3000) {
      tName = 'HOSTILE — PIRATE INTERCEPTOR';
      tSub = `${Math.round(hd)} u · left-click to engage`;
      scanPct = null;
    }

    ui.prompt(prompt);
    ui.target(tName, tSub, scanPct);
    ui.radar(this.radarContacts());
  }

  radarContacts() {
    const out = [];
    const inv = this.ship.quaternion.clone().invert();
    const push = (pos, color, kind) => {
      const rel = pos.clone().sub(this.ship.position).applyQuaternion(inv);
      out.push({ x: rel.x, y: rel.z, z: rel.y, color, kind, dist: rel.length() });
    };
    for (const h of this.planets) push(h.position, h.userData.planet.biome.sky, 'planet');
    if (this.station) push(this.station.position, '#ff8a3d', 'station');
    for (const e of this.enemies) push(e.mesh.position, '#ff4d4d', 'hostile');
    push(this.sun.position, this.system?.starColor || '#ffd9a0', 'star');
    return out;
  }

  info() {
    const near = this.nearestPlanet();
    let loc = 'Deep Space';
    if (near.holder && near.dist < near.holder.userData.planet.radius * 8) {
      loc = 'Orbit of ' + near.holder.userData.planet.name;
    }
    return {
      system: this.system?.name,
      planetLabel: 'Position',
      planet: loc,
      conditions: `${this.system?.starClass} star · ${this.system?.economy}<br>`
        + `Conflict: ${this.system?.danger} · Hostiles: ${this.enemies.length}<br>`
        + `Speed: ${Math.round(this.speed).toLocaleString()} u/s`,
    };
  }
}
