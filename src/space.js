// Space flight mode: fly the ship around a star system.
import * as THREE from 'three';
import { planetTexture, makeStarfield, buildShip, radialSprite } from './assets3d.js';
import { input } from './input.js';
import { state, addResource, discover } from './state.js';
import { ui } from './ui.js';
import { RNG } from './rng.js';
import { audio } from './audio.js';

const UP = new THREE.Vector3(0, 1, 0);

export class SpaceMode {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 1, 800000);
    this.scene.add(new THREE.AmbientLight('#4a6a8a', 0.5));

    this.starfield = makeStarfield();
    this.scene.add(this.starfield);

    this.sunLight = new THREE.PointLight('#ffffff', 3.2, 0, 0);
    this.scene.add(this.sunLight);

    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 32, 24),
      new THREE.MeshBasicMaterial({ color: '#fff2cf' })
    );
    this.scene.add(this.sun);

    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialSprite('#ffd9a0', 256, 1.6), blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false,
    }));
    this.sunGlow.scale.set(14000, 14000, 1);
    this.scene.add(this.sunGlow);

    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);
    this.asteroidGroup = new THREE.Group();
    this.scene.add(this.asteroidGroup);

    this.ship = buildShip();
    this.scene.add(this.ship);

    // laser beam
    this.laser = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 1, 6),
      new THREE.MeshBasicMaterial({ color: '#ff5a3c', transparent: true, opacity: 0.9 })
    );
    this.laser.visible = false;
    this.scene.add(this.laser);

    this.velocity = new THREE.Vector3();
    this.throttle = 0;
    this.speed = 0;
    this.pulse = 0;
    this.landHold = 0;
    this.landRequest = null;
    this.scanTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.planets = [];
    this.station = null;
    this.system = null;
    this.camPos = new THREE.Vector3();

    // pleasant backdrop while the title screen is up
    this.camera.position.set(0, 2600, 12000);
    this.camera.lookAt(0, 0, 0);
  }

  setSystem(system, { fromPlanet = null } = {}) {
    this.system = system;
    // clear old
    for (const g of [this.planetGroup, this.asteroidGroup]) {
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse?.((o) => { o.geometry?.dispose?.(); });
      }
    }
    this.planets = [];
    this.station = null;

    this.sun.material.color.set(system.starColor);
    this.sunGlow.material.map = radialSprite(system.starColor, 256, 1.6);
    this.sunGlow.material.needsUpdate = true;
    this.sunLight.color.set(system.starColor);

    for (const p of system.planets) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius, 48, 32),
        new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.92, metalness: 0.02 })
      );
      mesh.rotation.z = p.tilt;

      const holder = new THREE.Group();
      holder.add(mesh);

      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(p.radius * 1.045, 32, 24),
        new THREE.MeshBasicMaterial({
          color: p.biome.sky, transparent: true, opacity: 0.22,
          side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      holder.add(atmo);

      if (p.hasRings) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(p.radius * 1.5, p.radius * 2.5, 72),
          new THREE.MeshBasicMaterial({ color: p.biome.fog, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
        );
        ring.rotation.x = Math.PI / 2 + p.tilt * 0.6;
        holder.add(ring);
      }

      for (let m = 0; m < p.moons; m++) {
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(p.radius * 0.18, 18, 12),
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

    if (system.spaceStation) {
      const st = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.TorusGeometry(120, 26, 12, 40),
        new THREE.MeshStandardMaterial({ color: '#c8d4e0', metalness: 0.7, roughness: 0.3 })
      );
      st.add(body);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(34, 34, 130, 12),
        new THREE.MeshStandardMaterial({ color: '#7f8b99', metalness: 0.8, roughness: 0.25 })
      );
      core.rotation.x = Math.PI / 2;
      st.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialSprite('#ff8a3d', 128, 2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }));
      glow.scale.set(280, 280, 1);
      st.add(glow);
      const first = system.planets[0];
      st.position.set(first.orbit * 0.55, 400, first.orbit * 0.2);
      this.scene.add(st);
      this.station = st;
    }

    // asteroid belt
    const rng = new RNG(system.seed ^ 0x1234);
    const beltR = 9000 + rng.float(0, 4000);
    const astMat = new THREE.MeshStandardMaterial({ color: '#8b7d6b', roughness: 1, flatShading: true });
    for (let i = 0; i < 90; i++) {
      const a = rng.float(0, Math.PI * 2);
      const r = beltR + rng.float(-1800, 1800);
      const s = rng.float(28, 95);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), astMat);
      rock.position.set(Math.cos(a) * r, rng.float(-600, 600), Math.sin(a) * r);
      rock.rotation.set(rng.float(0, 6), rng.float(0, 6), rng.float(0, 6));
      rock.userData = {
        hp: 3,
        spin: new THREE.Vector3(rng.float(-0.3, 0.3), rng.float(-0.3, 0.3), rng.float(-0.3, 0.3)),
        rich: rng.chance(0.25),
      };
      this.asteroidGroup.add(rock);
    }

    // position ship
    const target = fromPlanet != null ? this.planets[fromPlanet] : null;
    this.updateOrbits(0, true);
    if (target) {
      const p = target.userData.planet;
      this.ship.position.copy(target.position).add(new THREE.Vector3(0, p.radius * 1.5, p.radius * 2.2));
      this.ship.lookAt(target.position);
    } else {
      this.ship.position.set(system.planets[0].orbit * 0.6, 900, system.planets[0].orbit * 0.6);
      this.ship.lookAt(0, 0, 0);
    }
    this.velocity.set(0, 0, 0);
    this.throttle = 0.25;
    this.camPos.copy(this.ship.position);

    if (discover('sys:' + system.id, system.name, 'system')) {
      ui.log(`SYSTEM DISCOVERED — ${system.name}  (+2500 units)`, 'good');
      audio.discovery();
    }
    state.visitedSystems[system.id] = true;
  }

  updateOrbits(dt, immediate = false) {
    for (const holder of this.planets) {
      const p = holder.userData.planet;
      p.orbitAngle += p.orbitSpeed * dt * 0.08;
      holder.position.set(Math.cos(p.orbitAngle) * p.orbit, Math.sin(p.orbitAngle * 0.4) * 300, Math.sin(p.orbitAngle) * p.orbit);
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

    // --- rotation ---
    const sens = 0.0022;
    const pitch = -m.y * sens;
    const yaw = -m.x * sens;
    let roll = 0;
    if (input.down('KeyA')) roll += 1.6 * dt;
    if (input.down('KeyD')) roll -= 1.6 * dt;
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'XYZ'));
    ship.quaternion.multiply(q);
    ship.quaternion.normalize();

    // --- throttle ---
    if (input.down('KeyW')) this.throttle = Math.min(1, this.throttle + dt * 0.8);
    if (input.down('KeyS')) this.throttle = Math.max(0, this.throttle - dt * 1.2);

    const boosting = input.down('ShiftLeft') || input.down('ShiftRight');
    const near = this.nearestPlanet();
    const canPulse = near.dist > 900;
    const pulsing = input.down('Space') && canPulse;
    this.pulse += ((pulsing ? 1 : 0) - this.pulse) * Math.min(1, dt * (pulsing ? 0.9 : 3.5));

    const baseMax = 900 * (boosting ? 3.2 : 1);
    const maxSpeed = baseMax + this.pulse * 46000;
    const targetSpeed = this.throttle * maxSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.6);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    ship.position.addScaledVector(forward, this.speed * dt);

    // keep the ship out of planets
    if (near.holder && near.dist < 30) {
      const p = near.holder.userData.planet;
      const dir = ship.position.clone().sub(near.holder.position).normalize();
      ship.position.copy(near.holder.position).addScaledVector(dir, p.radius + 30);
      this.speed *= 0.2;
    }

    // --- camera ---
    const camOffset = new THREE.Vector3(0, 3.2, 13 + this.pulse * 9).applyQuaternion(ship.quaternion);
    const desired = ship.position.clone().add(camOffset);
    this.camPos.lerp(desired, Math.min(1, dt * 6));
    this.camera.position.copy(this.camPos);
    const lookAt = ship.position.clone().addScaledVector(forward, 40);
    this.camera.up.copy(UP.clone().applyQuaternion(ship.quaternion));
    this.camera.lookAt(lookAt);
    this.camera.fov = 70 + this.pulse * 22 + (boosting ? 6 : 0);
    this.camera.updateProjectionMatrix();

    // thruster glow
    const t = 0.5 + this.speed / maxSpeed;
    ship.userData.thruster.children.forEach((s) => s.scale.set(1.2 * t, 1.2 * t, 1));

    // starfield follows so we never leave it
    this.starfield.position.copy(ship.position);
    this.sunGlow.position.copy(this.sun.position);

    this.updateOrbits(dt);

    // asteroids
    for (const a of this.asteroidGroup.children) {
      a.rotation.x += a.userData.spin.x * dt;
      a.rotation.y += a.userData.spin.y * dt;
    }

    audio.hum(Math.min(1, this.speed / 4000) + this.pulse * 0.4);
    this.handleMining(dt);
    this.handleTargeting(dt, near);
  }

  handleMining(dt) {
    this.laser.visible = false;
    if (!input.mouseDown) return;
    const origin = this.ship.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.quaternion);
    this.raycaster.set(origin, dir);
    this.raycaster.far = 2600;
    const hits = this.raycaster.intersectObjects(this.asteroidGroup.children, false);

    const end = hits.length ? hits[0].point : origin.clone().addScaledVector(dir, 2600);
    const mid = origin.clone().addScaledVector(dir, 4).lerp(end, 0.5);
    this.laser.visible = true;
    this.laser.position.copy(mid);
    this.laser.scale.set(1, origin.distanceTo(end), 1);
    this.laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    if (hits.length) {
      const rock = hits[0].object;
      rock.userData.hp -= dt * 2.2;
      if (rock.userData.hp <= 0) {
        this.asteroidGroup.remove(rock);
        const rich = rock.userData.rich;
        const amt = 12 + Math.floor(Math.random() * 20);
        addResource(rich ? 'platinum' : 'ferrite', amt);
        ui.flashSlot(rich ? 'platinum' : 'ferrite');
        ui.log(`+${amt} ${rich ? 'Platinum' : 'Ferrite Dust'}`, 'good');
        audio.pickup();
      }
    }
  }

  handleTargeting(dt, near) {
    this.landRequest = null;
    let prompt = '';
    let tName = null, tSub = '', scanPct = null;

    // station docking
    if (this.station) {
      const sd = this.station.position.distanceTo(this.ship.position);
      if (sd < 900) {
        tName = 'SPACE STATION';
        tSub = `${this.system.economy} economy · ${Math.round(sd)} u`;
        if (sd < 420) {
          prompt = 'Hold <b>E</b> to dock — repair &amp; refuel';
          if (input.down('KeyE')) {
            this.dockHold = (this.dockHold || 0) + dt;
            if (this.dockHold > 0.9) {
              this.dockHold = 0;
              state.shipHealth = 100; state.shields = 100; state.launchFuel = 100; state.life = 100;
              ui.log('DOCKED — systems repaired, launch thrusters refuelled', 'good');
              audio.discovery();
            }
          } else this.dockHold = 0;
        }
      }
    }

    if (near.holder) {
      const p = near.holder.userData.planet;
      const d = near.dist;
      if (d < p.radius * 6) {
        tName = p.name.toUpperCase();
        const known = state.discoveries['pl:' + p.seed];
        tSub = known
          ? `${p.biome.label} · ${p.weather} · Sentinels: ${p.sentinels} · ${Math.round(d)} u`
          : `UNKNOWN WORLD · ${Math.round(d)} u · press F to scan`;

        if (input.down('KeyF') && !known) {
          this.scanTimer += dt;
          scanPct = Math.min(1, this.scanTimer / 1.4);
          if (this.scanTimer < dt * 1.5) audio.scan();
          if (this.scanTimer > 1.4) {
            this.scanTimer = 0;
            if (discover('pl:' + p.seed, p.name, 'planet')) {
              p.discovered = true;
              ui.log(`PLANET DISCOVERED — ${p.name} · ${p.biome.label} (+1500 units)`, 'good');
              ui.log(`Resources: ${p.resources.join(', ')}`, '');
              audio.discovery();
            }
          }
        } else this.scanTimer = 0;

        if (d < p.radius * 0.55) {
          prompt = 'Hold <b>E</b> to land';
          if (input.down('KeyE')) {
            this.landHold += dt;
            if (this.landHold > 0.7) {
              this.landHold = 0;
              this.landRequest = p;
            }
          } else this.landHold = 0;
        } else if (d < p.radius * 1.6) {
          prompt = 'Approach the surface to land';
        }
      }
    }

    ui.prompt(prompt);
    ui.target(tName, tSub, scanPct);
  }

  info() {
    const near = this.nearestPlanet();
    let loc = 'Deep Space';
    if (near.holder && near.dist < near.holder.userData.planet.radius * 8) {
      loc = 'Orbit of ' + near.holder.userData.planet.name;
    }
    const spd = Math.round(this.speed);
    return {
      system: this.system?.name,
      planetLabel: 'Position',
      planet: loc,
      conditions: `Star: ${this.system?.starClass} · Economy: ${this.system?.economy}<br>Conflict: ${this.system?.danger} · Speed: ${spd.toLocaleString()} u/s`,
    };
  }
}
