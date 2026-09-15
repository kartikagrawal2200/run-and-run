(function () {
  'use strict';

  /* ============================================================
     CANVAS CONFIGURATION & VIEWPORT
     ============================================================ */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DESIGN_WIDTH = 480;
  const DESIGN_HEIGHT = 800;
  const LANE_COUNT = 3;
  const LANE_WIDTH = DESIGN_WIDTH / LANE_COUNT;
  const GROUND_Y = 640;

  function laneX(lane) {
    return LANE_WIDTH * lane + LANE_WIDTH / 2;
  }

  function resize() {
    const parent = document.getElementById('gameContainer');
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const availableW = Math.min(winW, 600);
    const availableH = winH;

    const designRatio = DESIGN_WIDTH / DESIGN_HEIGHT;
    const currentRatio = availableW / availableH;

    let targetW, targetH;
    if (currentRatio > designRatio) {
      targetH = availableH;
      targetW = targetH * designRatio;
    } else {
      targetW = availableW;
      targetH = targetW / designRatio;
    }

    canvas.style.width = Math.floor(targetW) + 'px';
    canvas.style.height = Math.floor(targetH) + 'px';
    parent.style.width = Math.floor(targetW) + 'px';
    parent.style.height = Math.floor(targetH) + 'px';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DESIGN_WIDTH * dpr;
    canvas.height = DESIGN_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener('resize', resize);

  /* ============================================================
     MATH UTILITIES
     ============================================================ */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randRange = (min, max) => min + Math.random() * (max - min);

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const bl = Math.round(lerp(a[2], b[2], t));
    return `rgb(${r},${g},${bl})`;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ============================================================
     ZONES / CYBER THEMES
     ============================================================ */
  const THEMES = [
    {
      name: 'DOWNTOWN MATRIX',
      sky: ['#040a17', '#0e1e38'],
      ground: '#131b2e',
      grid: '#4cc9f0',
      building: '#192644',
      accent: '#4cc9f0'
    },
    {
      name: 'SUNSET HIGHWAY',
      sky: ['#280824', '#601b3d'],
      ground: '#331526',
      grid: '#f72585',
      building: '#481938',
      accent: '#ff007f'
    },
    {
      name: 'TOXIC CORE',
      sky: ['#061a14', '#0d3829'],
      ground: '#112b20',
      grid: '#06d6a0',
      building: '#163e30',
      accent: '#06d6a0'
    },
    {
      name: 'NEON DESERT',
      sky: ['#2a1608', '#542d0a'],
      ground: '#3b220d',
      grid: '#ffd23f',
      building: '#5c3817',
      accent: '#ffb703'
    },
    {
      name: 'GLITCH VOID',
      sky: ['#120826', '#26114a'],
      ground: '#1f103b',
      grid: '#b5179e',
      building: '#371869',
      accent: '#7209b7'
    }
  ];

  /* ============================================================
     PARTICLE & FLOATING TEXT ENGINE
     ============================================================ */
  class ParticleSystem {
    constructor() {
      this.particles = [];
      this.floatingTexts = [];
    }

    burst(x, y, color, count = 16, speedMin = 80, speedMax = 260) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randRange(speedMin, speedMax);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 50,
          life: randRange(0.35, 0.75),
          maxLife: 0.75,
          radius: randRange(2.5, 5),
          color: color || '#4cc9f0'
        });
      }
    }

    trail(x, y, color) {
      this.particles.push({
        x: x + randRange(-8, 8),
        y: y + randRange(-4, 4),
        vx: randRange(-15, 15),
        vy: randRange(40, 90),
        life: 0.28,
        maxLife: 0.28,
        radius: randRange(2, 4),
        color: color || '#4cc9f0'
      });
    }

    spawnText(x, y, text, color = '#ffd23f') {
      this.floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 0.8,
        maxLife: 0.8,
        vy: -75
      });
    }

    update(dt) {
      // Particles
      for (const p of this.particles) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 450 * dt;
        p.vx *= 0.97;
      }
      this.particles = this.particles.filter(p => p.life > 0);

      // Floating Texts
      for (const ft of this.floatingTexts) {
        ft.life -= dt;
        ft.y += ft.vy * dt;
      }
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
    }

    render(ctx) {
      // Draw particles with glowing circles
      for (const p of this.particles) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * a, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw floating texts
      for (const ft of this.floatingTexts) {
        const a = clamp(ft.life / ft.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = ft.color;
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }
  }

  /* ============================================================
     SCREEN SHAKE
     ============================================================ */
  const ScreenShake = {
    time: 0,
    duration: 0,
    magnitude: 0,
    trigger(magnitude, duration) {
      this.magnitude = magnitude;
      this.duration = duration;
      this.time = duration;
    },
    update(dt) {
      if (this.time > 0) this.time = Math.max(0, this.time - dt);
    },
    getOffset() {
      if (this.time <= 0) return { x: 0, y: 0 };
      const t = this.time / this.duration;
      const mag = this.magnitude * t;
      return {
        x: (Math.random() * 2 - 1) * mag,
        y: (Math.random() * 2 - 1) * mag
      };
    }
  };

  /* ============================================================
     PARALLAX SKYLINE & ROAD
     ============================================================ */
  class ParallaxCity {
    constructor() {
      this.farBuildings = this._createLayer(8, 70, 180);
      this.midBuildings = this._createLayer(6, 120, 270);
      this.streaks = [];
      for (let i = 0; i < 20; i++) {
        this.streaks.push({
          x: randRange(20, DESIGN_WIDTH - 20),
          y: randRange(GROUND_Y - 300, GROUND_Y + 120),
          speed: randRange(1.2, 2.5),
          len: randRange(20, 60),
          alpha: randRange(0.2, 0.6)
        });
      }
    }

    _createLayer(count, minH, maxH) {
      const b = [];
      const colWidth = DESIGN_WIDTH / count;
      for (let i = 0; i < count; i++) {
        b.push({
          x: i * colWidth,
          w: colWidth * randRange(0.6, 0.9),
          h: randRange(minH, maxH),
          windows: Math.random() > 0.3
        });
      }
      return b;
    }

    render(ctx, distance, buildingColor, gridColor) {
      // Far layer
      this._renderBuildings(ctx, this.farBuildings, distance * 0.1, 240, buildingColor, 0.35);
      // Mid layer
      this._renderBuildings(ctx, this.midBuildings, distance * 0.26, 290, buildingColor, 0.65);

      // Distant neon grid on horizon
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      const horizonY = 300;
      for (let x = 0; x <= DESIGN_WIDTH; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, horizonY);
        ctx.lineTo(x + (x - DESIGN_WIDTH / 2) * 1.5, GROUND_Y);
        ctx.stroke();
      }
      ctx.restore();
    }

    _renderBuildings(ctx, list, offset, baseY, color, alpha) {
      const period = DESIGN_WIDTH;
      const shift = offset % period;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;

      for (const b of list) {
        for (let r = -1; r <= 1; r++) {
          const bx = b.x - shift + r * period;
          if (bx < -b.w || bx > DESIGN_WIDTH) continue;
          ctx.fillRect(bx, baseY - b.h, b.w, b.h);

          // Glowing windows
          if (b.windows) {
            ctx.fillStyle = '#ffd23f';
            ctx.globalAlpha = alpha * 0.45;
            for (let wy = baseY - b.h + 16; wy < baseY - 16; wy += 18) {
              for (let wx = bx + 6; wx < bx + b.w - 10; wx += 14) {
                if (Math.sin(wx * 11 + wy) > 0.2) {
                  ctx.fillRect(wx, wy, 5, 8);
                }
              }
            }
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
          }
        }
      }
      ctx.restore();
    }
  }

  /* ============================================================
     PLAYER (CYBER RUNNER)
     ============================================================ */
  class Player {
    constructor() {
      this.lane = 1;
      this.x = laneX(1);
      this.targetX = this.x;
      this.laneChangeSpeed = 16;

      this.jumpHeight = 0;
      this.jumpVel = 0;
      this.jumping = false;
      this.gravity = 2700;
      this.jumpImpulse = 960;

      this.sliding = false;
      this.slideTimer = 0;
      this.slideDuration = 0.52;

      this.width = 46;
      this.height = 80;
      this.slideHeight = 38;

      this.hasShield = false;
      this.animTime = 0;
      this.squash = 0;
    }

    moveLeft() {
      if (this.lane > 0) {
        this.lane--;
        this.targetX = laneX(this.lane);
        SoundSystem.laneSwitch();
      }
    }

    moveRight() {
      if (this.lane < LANE_COUNT - 1) {
        this.lane++;
        this.targetX = laneX(this.lane);
        SoundSystem.laneSwitch();
      }
    }

    jump() {
      if (!this.jumping && !this.sliding) {
        this.jumping = true;
        this.jumpVel = this.jumpImpulse;
        SoundSystem.jump();
      }
    }

    slide() {
      if (!this.jumping && !this.sliding) {
        this.sliding = true;
        this.slideTimer = this.slideDuration;
        SoundSystem.slide();
      }
    }

    update(dt, particles) {
      this.animTime += dt;

      // Smooth horizontal interpolation
      const dx = this.targetX - this.x;
      if (Math.abs(dx) > 0.5) {
        const factor = 1 - Math.pow(0.001, dt * (this.laneChangeSpeed / 10));
        this.x += dx * factor;
        // Emit trail sparks during lane change
        particles.trail(this.x, GROUND_Y - 20, '#4cc9f0');
      } else {
        this.x = this.targetX;
      }

      // Jump physics
      if (this.jumping) {
        this.jumpVel -= this.gravity * dt;
        this.jumpHeight += this.jumpVel * dt;
        if (this.jumpHeight <= 0) {
          this.jumpHeight = 0;
          this.jumping = false;
          this.jumpVel = 0;
          this.squash = 1; // Landing squash
          particles.burst(this.x, GROUND_Y, '#4cc9f0', 8, 40, 100);
        }
      }

      if (this.squash > 0) {
        this.squash = Math.max(0, this.squash - dt * 5);
      }

      // Slide countdown
      if (this.sliding) {
        this.slideTimer -= dt;
        particles.trail(this.x, GROUND_Y - 10, '#ffd23f');
        if (this.slideTimer <= 0) {
          this.sliding = false;
        }
      }

      // Steady runner particles
      if (!this.jumping && Math.random() < 0.4) {
        particles.trail(this.x, GROUND_Y, '#4cc9f0');
      }
    }

    getBounds() {
      const h = this.sliding ? this.slideHeight : this.height;
      const bottom = GROUND_Y - this.jumpHeight;
      return {
        x: this.x - this.width / 2,
        y: bottom - h,
        w: this.width,
        h: h,
        lane: this.lane
      };
    }

    render(ctx) {
      const b = this.getBounds();
      const currentH = b.h;
      const squashOffset = this.squash * 8;

      // Drop shadow on ground
      ctx.save();
      const shadowScale = clamp(1 - this.jumpHeight / 280, 0.3, 1);
      ctx.globalAlpha = 0.4 * shadowScale;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y + 6, (this.width * 0.6) * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();

      // Energy Shield Aura if active
      if (this.hasShield) {
        ctx.save();
        const pulse = Math.sin(this.animTime * 8) * 4;
        ctx.strokeStyle = '#06d6a0';
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.x, b.y + currentH / 2, (this.width / 2) + 12 + pulse, (currentH / 2) + 12 + pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Cyber Runner Suit Body
      const bodyColor = this.sliding ? '#f72585' : '#4cc9f0';
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 12;

      // Rounded torso / body
      const cornerR = 8;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y + squashOffset, b.w, currentH - squashOffset, cornerR);
      ctx.fill();

      // Cyber glowing visor
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f';
      ctx.shadowBlur = 8;
      const visorH = this.sliding ? 7 : 12;
      const visorY = b.y + (this.sliding ? 6 : 10) + squashOffset;
      ctx.fillRect(b.x + 6, visorY, b.w - 12, visorH);

      // Running armor details / stripes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowBlur = 0;
      if (!this.sliding) {
        // Torso neon core
        ctx.fillRect(b.x + 10, b.y + 30 + squashOffset, b.w - 20, 6);
        // Running leg animation swing
        const legSwing = Math.sin(this.animTime * 18) * 8;
        ctx.fillStyle = '#212f4d';
        ctx.fillRect(b.x + 8, b.y + currentH - 14, 12, 14 + (this.jumping ? 0 : legSwing));
        ctx.fillRect(b.x + b.w - 20, b.y + currentH - 14, 12, 14 - (this.jumping ? 0 : legSwing));
      }

      ctx.restore();
    }
  }

  /* ============================================================
     OBSTACLES: LOW (Jump), HIGH (Slide), BLOCK (Switch Lane)
     ============================================================ */
  const OBSTACLE_DEFS = {
    LOW: {
      id: 'LOW',
      name: 'Electric Barrier',
      w: 118,
      h: 42,
      action: 'jump',
      color: '#ff3366',
      accent: '#ffe066'
    },
    HIGH: {
      id: 'HIGH',
      name: 'Laser Gate',
      w: 122,
      h: 110,
      gap: 48,
      action: 'slide',
      color: '#7209b7',
      accent: '#4cc9f0'
    },
    BLOCK: {
      id: 'BLOCK',
      name: 'Cyber Monolith',
      w: 130,
      h: 146,
      action: 'switch',
      color: '#1a2238',
      accent: '#ff0055'
    }
  };

  class TrackManager {
    constructor() {
      this.obstacles = [];
      this.laneCooldowns = [0, 0, 0];
      this.globalCooldown = 2.2;
      this.minGapTime = 2.4;
      this.maxGapTime = 4.8;
      this.globalMinInterval = 2.0;
      this.minWorldGap = 650;
      this.onObstacleSpawned = null;
    }

    reset() {
      this.obstacles = [];
      this.laneCooldowns = [0, 0, 0];
      this.globalCooldown = 2.5;
    }

    update(dt, speed, elapsed) {
      for (const o of this.obstacles) {
        o.y += speed * dt;
      }
      this.obstacles = this.obstacles.filter(o => o.y < DESIGN_HEIGHT + 160);

      this.globalCooldown = Math.max(0, this.globalCooldown - dt);
      for (let i = 0; i < LANE_COUNT; i++) {
        this.laneCooldowns[i] = Math.max(0, this.laneCooldowns[i] - dt);
      }

      this._spawn(elapsed);
    }

    _canSpawnInLane(lane) {
      const inLane = this.obstacles.filter(o => o.lane === lane);
      if (!inLane.length) return true;
      let topY = Infinity;
      for (const o of inLane) topY = Math.min(topY, o.y);
      return topY >= this.minWorldGap;
    }

    _spawn(elapsed) {
      if (this.globalCooldown > 0) return;

      const candidates = [];
      for (let l = 0; l < LANE_COUNT; l++) {
        if (this.laneCooldowns[l] <= 0 && this._canSpawnInLane(l)) {
          candidates.push(l);
        }
      }
      if (!candidates.length) return;

      // Keep lanes generous and spacious
      const maxSpawns = Math.min(candidates.length, LANE_COUNT - 1);
      let count = 1;
      // Only after 90+ seconds allow a very rare 2-obstacle wave
      if (maxSpawns >= 2 && elapsed > 90 && Math.random() < 0.12) {
        count = 2;
      }

      const selected = shuffle([...candidates]).slice(0, count);
      const typeKeys = Object.keys(OBSTACLE_DEFS);

      for (const lane of selected) {
        const typeId = typeKeys[Math.floor(Math.random() * typeKeys.length)];
        const def = OBSTACLE_DEFS[typeId];
        const obstacle = {
          type: def,
          lane,
          x: laneX(lane),
          y: -70,
          w: def.w,
          h: def.h,
          hit: false
        };
        this.obstacles.push(obstacle);
        if (this.onObstacleSpawned) this.onObstacleSpawned(obstacle);
        this.laneCooldowns[lane] = randRange(this.minGapTime, this.maxGapTime);
      }

      this.globalCooldown = this.globalMinInterval;
    }

    render(ctx) {
      for (const o of this.obstacles) {
        ctx.save();
        const ox = o.x - o.w / 2;
        const oy = o.y - o.h;

        if (o.type.id === 'LOW') {
          // Low Barrier with caution stripes
          ctx.fillStyle = o.type.color;
          ctx.shadowColor = o.type.color;
          ctx.shadowBlur = 10;
          ctx.fillRect(ox, oy, o.w, o.h);

          // Glowing danger line
          ctx.fillStyle = o.type.accent;
          ctx.fillRect(ox + 4, oy + 4, o.w - 8, 6);

          // Caution diagonal stripes
          ctx.fillStyle = '#000';
          ctx.globalAlpha = 0.25;
          for (let sx = ox; sx < ox + o.w; sx += 18) {
            ctx.beginPath();
            ctx.moveTo(sx, oy + o.h);
            ctx.lineTo(sx + 10, oy);
            ctx.lineTo(sx + 18, oy);
            ctx.lineTo(sx + 8, oy + o.h);
            ctx.fill();
          }
        } else if (o.type.id === 'HIGH') {
          // Overhead High Beam with slide gap
          const solidH = o.h - o.type.gap;

          // Upper beam
          ctx.fillStyle = o.type.color;
          ctx.shadowColor = o.type.accent;
          ctx.shadowBlur = 12;
          ctx.fillRect(ox, oy, o.w, solidH);

          // Pulsing laser emitter beam
          ctx.fillStyle = o.type.accent;
          ctx.fillRect(ox + 8, oy + solidH - 8, o.w - 16, 6);

          // Subtle holographic clearance indicator below
          ctx.fillStyle = o.type.accent;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(ox, oy + solidH, o.w, o.type.gap);
          ctx.globalAlpha = 0.8;
          ctx.font = 'bold 11px "Orbitron", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▼ SLIDE ▼', o.x, oy + solidH + 26);
        } else {
          // Block Monolith
          ctx.fillStyle = o.type.color;
          ctx.fillRect(ox, oy, o.w, o.h);

          // Glowing edge frame
          ctx.strokeStyle = o.type.accent;
          ctx.shadowColor = o.type.accent;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 3;
          ctx.strokeRect(ox + 2, oy + 2, o.w - 4, o.h - 4);

          // Hazard symbol
          ctx.fillStyle = o.type.accent;
          ctx.font = 'bold 20px "Orbitron", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠', o.x, oy + o.h / 2 + 7);
        }

        ctx.restore();
      }
    }
  }

  /* ============================================================
     COLLECTIBLES & POWER-UPS
     ============================================================ */
  const POWERUP_METAS = {
    magnet: { name: 'MAGNET', duration: 8, color: '#4cc9f0', icon: '🧲' },
    multiplier: { name: '2X SCORE', duration: 10, color: '#ffd23f', icon: '⭐' },
    shield: { name: 'SHIELD', duration: 0, color: '#06d6a0', icon: '🛡️' }
  };

  class CollectibleItem {
    constructor(lane, y, type, opts = {}) {
      this.lane = lane;
      this.x = laneX(lane);
      this.y = y;
      this.type = type;
      this.collected = false;
      this.radius = type === 'coin' ? 10 : 15;
      this.requiresJump = !!opts.requiresJump;
      this.requiresSlide = !!opts.requiresSlide;
      this.height = opts.height || 0;
      this.spin = Math.random() * Math.PI * 2;
    }

    getBounds() {
      const r = this.radius;
      return {
        x: this.x - r,
        y: this.y - this.height - r,
        w: r * 2,
        h: r * 2
      };
    }
  }

  class CollectibleManager {
    constructor() {
      this.items = [];
      this.coinCount = 0;
      this.coinScore = 0;
      this.activePowerUps = {};
      this.shieldCharges = 0;
      this.coinTimer = 1.0;
      this.powerupTimer = 11.0;
      this.magnetRadius = 160;
      this.magnetSpeed = 700;
    }

    reset() {
      this.items = [];
      this.coinCount = 0;
      this.coinScore = 0;
      this.activePowerUps = {};
      this.shieldCharges = 0;
      this.coinTimer = 1.0;
      this.powerupTimer = 11.0;
    }

    onObstacleSpawned(obstacle) {
      if (obstacle.type.id === 'LOW') {
        this._spawnArcTrail(obstacle.lane, obstacle.y, true);
      } else if (obstacle.type.id === 'HIGH') {
        this._spawnCoinLine(obstacle.lane, obstacle.y, 4, 30, { requiresSlide: true });
      } else {
        const others = [0, 1, 2].filter(l => l !== obstacle.lane);
        const freeLane = others[Math.floor(Math.random() * others.length)];
        this._spawnCoinLine(freeLane, obstacle.y, 3, 32, {});
      }
    }

    _spawnCoinLine(lane, startY, count, spacing, opts) {
      for (let i = 0; i < count; i++) {
        this.items.push(new CollectibleItem(lane, startY - i * spacing, 'coin', opts));
      }
    }

    _spawnArcTrail(lane, obstacleY, requiresJump) {
      const count = 5, spread = 120, peak = 75;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const y = obstacleY + spread / 2 - t * spread;
        const height = Math.sin(t * Math.PI) * peak;
        this.items.push(new CollectibleItem(lane, y, 'coin', { requiresJump, height }));
      }
    }

    _spawnPowerup(lane, y, type) {
      this.items.push(new CollectibleItem(lane, y, type));
    }

    update(dt, player, speed, particles) {
      // Coin spawn pacing
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
        this.coinTimer = randRange(1.1, 1.8);
        const l = Math.floor(Math.random() * LANE_COUNT);
        if (Math.random() < 0.65) {
          this._spawnCoinLine(l, -50, 4, 32, {});
        } else {
          this._spawnArcTrail(l, -50, false);
        }
      }

      // Power-up spawn pacing
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        this.powerupTimer = randRange(12, 19);
        const l = Math.floor(Math.random() * LANE_COUNT);
        const keys = Object.keys(POWERUP_METAS);
        const chosen = keys[Math.floor(Math.random() * keys.length)];
        this._spawnPowerup(l, -60, chosen);
      }

      // Move items down
      for (const item of this.items) {
        item.y += speed * dt;
        item.spin += dt * 4;
      }

      // Magnet suction pull
      if (this.activePowerUps.magnet) {
        const playerY = GROUND_Y - player.jumpHeight - player.height / 2;
        for (const item of this.items) {
          if (item.collected || item.type !== 'coin') continue;
          const dx = player.x - item.x;
          const dy = playerY - item.y;
          const dist = Math.hypot(dx, dy);
          if (dist < this.magnetRadius) {
            const pull = this.magnetSpeed * dt;
            item.x += (dx / (dist || 1)) * pull;
            item.y += (dy / (dist || 1)) * pull;
          }
        }
      }

      // Check player collection
      const pBounds = player.getBounds();
      for (const item of this.items) {
        if (item.collected) continue;

        const isMagnetized = this.activePowerUps.magnet && item.type === 'coin';
        if (item.lane !== player.lane && !isMagnetized) continue;
        if (item.requiresJump && !player.jumping && !isMagnetized) continue;
        if (item.requiresSlide && !player.sliding && !isMagnetized) continue;

        if (rectsOverlap(pBounds, item.getBounds())) {
          this._collect(item, particles);
        }
      }

      this.items = this.items.filter(i => !i.collected && i.y < DESIGN_HEIGHT + 80);

      // Decrement active timed power-ups
      for (const key of Object.keys(this.activePowerUps)) {
        this.activePowerUps[key] -= dt;
        if (this.activePowerUps[key] <= 0) {
          delete this.activePowerUps[key];
        }
      }
    }

    _collect(item, particles) {
      item.collected = true;

      if (item.type === 'coin') {
        this.coinCount++;
        const multiplier = this.activePowerUps.multiplier ? 2 : 1;
        const gain = 10 * multiplier;
        this.coinScore += gain;
        SoundSystem.coin();
        particles.burst(item.x, item.y - item.height, '#ffd23f', 8, 40, 120);
        particles.spawnText(item.x, item.y - item.height, `+${gain}`, '#ffd23f');
      } else if (item.type === 'shield') {
        this.shieldCharges = Math.min(3, this.shieldCharges + 1);
        SoundSystem.powerup();
        particles.burst(item.x, item.y, '#06d6a0', 16, 60, 200);
        particles.spawnText(item.x, item.y, 'SHIELD ARMED', '#06d6a0');
      } else {
        const meta = POWERUP_METAS[item.type];
        this.activePowerUps[item.type] = meta.duration;
        SoundSystem.powerup();
        particles.burst(item.x, item.y, meta.color, 16, 60, 200);
        particles.spawnText(item.x, item.y, meta.name, meta.color);
      }
    }

    render(ctx) {
      for (const item of this.items) {
        const b = item.getBounds();
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;

        ctx.save();
        if (item.type === 'coin') {
          // 3D Spinning Coin
          const wobble = Math.abs(Math.cos(item.spin));
          const w = Math.max(3, item.radius * wobble);

          ctx.fillStyle = '#ffd23f';
          ctx.shadowColor = '#ffd23f';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.ellipse(cx, cy, w, item.radius, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Power-up Orb
          const meta = POWERUP_METAS[item.type];
          ctx.fillStyle = meta.color;
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(cx, cy, item.radius, 0, Math.PI * 2);
          ctx.fill();

          // Icon
          ctx.fillStyle = '#0b0f19';
          ctx.shadowBlur = 0;
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(meta.icon, cx, cy);
        }
        ctx.restore();
      }
    }
  }

  /* ============================================================
     MAIN GAME ENGINE
     ============================================================ */
  const GameStates = Object.freeze({
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  });

  const STORAGE_KEY = 'run_and_run_best_score';

  class GameApp {
    constructor() {
      this.state = GameStates.MENU;
      this.bestScore = this.loadBest();

      // UI elements
      this.hud = document.getElementById('hud');
      this.virtualControls = document.getElementById('virtualControls');
      this.menuScreen = document.getElementById('menuScreen');
      this.pauseScreen = document.getElementById('pauseScreen');
      this.gameOverScreen = document.getElementById('gameOverScreen');
      this.scoreDisplay = document.getElementById('scoreDisplay');
      this.coinCount = document.getElementById('coinCount');
      this.shieldDisplay = document.getElementById('shieldDisplay');
      this.shieldCount = document.getElementById('shieldCount');
      this.zoneDisplay = document.getElementById('zoneDisplay');
      this.speedBarFill = document.getElementById('speedBarFill');
      this.powerupDisplay = document.getElementById('powerupDisplay');
      this.powerupIcon = document.getElementById('powerupIcon');
      this.powerupText = document.getElementById('powerupText');
      this.menuBestScore = document.getElementById('menuBestScore');

      this.menuBestScore.textContent = this.bestScore;

      // Systems
      this.parallax = new ParallaxCity();
      this.particles = new ParticleSystem();

      this.themeIndex = 0;
      this.prevThemeIndex = 0;
      this.themeBlend = 1;
      this.themeTimer = 0;
      this.themeDuration = 20;

      this.lastTime = 0;
      this.resetRun();

      this.initEventListeners();
      resize();

      requestAnimationFrame(t => this.loop(t));
    }

    loadBest() {
      try {
        return parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
      } catch (e) {
        return 0;
      }
    }

    saveBest(score) {
      try {
        localStorage.setItem(STORAGE_KEY, String(score));
      } catch (e) {}
    }

    resetRun() {
      this.distance = 0;
      this.elapsed = 0;
      this.baseSpeed = 320;
      this.maxSpeed = 820;
      this.speed = this.baseSpeed;
      this.speedRamp = 3.5;

      this.player = new Player();
      this.track = new TrackManager();
      this.collectibles = new CollectibleManager();

      this.track.onObstacleSpawned = (o) => this.collectibles.onObstacleSpawned(o);
      this.track.reset();
      this.collectibles.reset();

      this.themeIndex = 0;
      this.prevThemeIndex = 0;
      this.themeBlend = 1;
      this.themeTimer = 0;
    }

    getScore() {
      return Math.floor(this.distance / 10) + this.collectibles.coinScore;
    }

    initEventListeners() {
      // Menu Play
      document.getElementById('playBtn').addEventListener('click', () => {
        SoundSystem.ensure();
        SoundSystem.startBgm();
        this.resetRun();
        this.setState(GameStates.PLAYING);
      });

      // Pause / Resume
      document.getElementById('pauseBtn').addEventListener('click', () => {
        if (this.state === GameStates.PLAYING) this.setState(GameStates.PAUSED);
      });
      document.getElementById('resumeBtn').addEventListener('click', () => {
        this.setState(GameStates.PLAYING);
      });
      document.getElementById('quitBtn').addEventListener('click', () => {
        SoundSystem.stopBgm();
        this.setState(GameStates.MENU);
      });

      // Game Over buttons
      document.getElementById('restartBtn').addEventListener('click', () => {
        SoundSystem.startBgm();
        this.resetRun();
        this.setState(GameStates.PLAYING);
      });
      document.getElementById('menuBtn').addEventListener('click', () => {
        SoundSystem.stopBgm();
        this.setState(GameStates.MENU);
      });

      // Audio toggles
      const muteBtn = document.getElementById('muteBtn');
      muteBtn.addEventListener('click', () => {
        const active = SoundSystem.toggleSfx();
        muteBtn.textContent = active ? '🔊' : '🔇';
      });

      const bgmBtn = document.getElementById('bgmBtn');
      bgmBtn.addEventListener('click', () => {
        const active = SoundSystem.toggleBgm();
        bgmBtn.textContent = active ? '🎵' : '🔇';
      });

      // Keyboard Controls
      window.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
          if (this.state === GameStates.PLAYING) this.setState(GameStates.PAUSED);
          else if (this.state === GameStates.PAUSED) this.setState(GameStates.PLAYING);
          return;
        }

        if (this.state !== GameStates.PLAYING) return;

        switch (e.key) {
          case 'ArrowLeft':
          case 'a':
          case 'A':
            this.player.moveLeft();
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            this.player.moveRight();
            break;
          case 'ArrowUp':
          case 'w':
          case 'W':
          case ' ':
            e.preventDefault();
            this.player.jump();
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            this.player.slide();
            break;
        }
      });

      // Virtual on-screen controls
      const handleBtn = (id, action) => {
        const el = document.getElementById(id);
        const trigger = (e) => {
          e.preventDefault();
          SoundSystem.ensure();
          if (this.state === GameStates.PLAYING) action();
        };
        el.addEventListener('mousedown', trigger);
        el.addEventListener('touchstart', trigger, { passive: false });
      };

      handleBtn('ctrlLeft', () => this.player.moveLeft());
      handleBtn('ctrlRight', () => this.player.moveRight());
      handleBtn('ctrlJump', () => this.player.jump());
      handleBtn('ctrlSlide', () => this.player.slide());

      // Touch swipes on canvas
      let touchStartX = 0, touchStartY = 0, touchActive = false;
      const swipeThreshold = 30;

      canvas.addEventListener('touchstart', (e) => {
        SoundSystem.ensure();
        if (this.state !== GameStates.PLAYING) return;
        const t = e.changedTouches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchActive = true;
      }, { passive: true });

      canvas.addEventListener('touchend', (e) => {
        if (this.state !== GameStates.PLAYING || !touchActive) return;
        touchActive = false;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > swipeThreshold) {
            if (dx > 0) this.player.moveRight();
            else this.player.moveLeft();
          }
        } else {
          if (Math.abs(dy) > swipeThreshold) {
            if (dy < 0) this.player.jump();
            else this.player.slide();
          }
        }
      }, { passive: true });
    }

    setState(next) {
      this.state = next;

      // Hide all overlays initially
      this.menuScreen.classList.add('hidden');
      this.pauseScreen.classList.add('hidden');
      this.gameOverScreen.classList.add('hidden');
      this.hud.classList.add('hidden');
      this.virtualControls.classList.add('hidden');

      if (next === GameStates.MENU) {
        this.menuBestScore.textContent = this.bestScore;
        this.menuScreen.classList.remove('hidden');
      } else if (next === GameStates.PLAYING) {
        this.hud.classList.remove('hidden');
        this.virtualControls.classList.remove('hidden');
      } else if (next === GameStates.PAUSED) {
        this.hud.classList.remove('hidden');
        this.pauseScreen.classList.remove('hidden');
      } else if (next === GameStates.GAMEOVER) {
        const score = this.getScore();
        if (score > this.bestScore) {
          this.bestScore = score;
          this.saveBest(score);
        }
        document.getElementById('finalScore').textContent = score;
        document.getElementById('finalCoins').textContent = this.collectibles.coinCount;
        document.getElementById('bestScore').textContent = this.bestScore;
        this.gameOverScreen.classList.remove('hidden');
      }
    }

    checkCollisions() {
      const pBounds = this.player.getBounds();

      for (const o of this.track.obstacles) {
        if (o.hit) continue;
        if (o.lane !== this.player.lane) continue;
        if (Math.abs(o.y - GROUND_Y) > 46) continue;

        let evaded = false;
        if (o.type.action === 'jump') {
          evaded = this.player.jumping && this.player.jumpHeight > o.h * 0.52;
        } else if (o.type.action === 'slide') {
          evaded = this.player.sliding;
        }

        if (evaded) continue;

        const oBounds = { x: o.x - o.w / 2, y: o.y - o.h, w: o.w, h: o.h };
        if (!rectsOverlap(pBounds, oBounds)) continue;

        o.hit = true;

        // Has Shield protection?
        if (this.collectibles.shieldCharges > 0) {
          this.collectibles.shieldCharges--;
          SoundSystem.shieldBreak();
          ScreenShake.trigger(8, 0.25);
          this.particles.burst(o.x, o.y - o.h / 2, '#06d6a0', 20);
          this.particles.spawnText(this.player.x, GROUND_Y - 100, 'SHIELD BROKEN', '#ff3366');
          this.track.obstacles = this.track.obstacles.filter(item => item !== o);
        } else {
          // Fatal Crash
          this.gameOver();
          return;
        }
      }
    }

    gameOver() {
      SoundSystem.stopBgm();
      SoundSystem.crash();
      ScreenShake.trigger(18, 0.45);
      this.particles.burst(this.player.x, GROUND_Y - this.player.height / 2, '#ff3366', 32, 100, 320);
      this.setState(GameStates.GAMEOVER);
    }

    updateTheme(dt) {
      this.themeTimer += dt;
      if (this.themeTimer >= this.themeDuration && this.themeBlend >= 1) {
        this.themeTimer = 0;
        this.prevThemeIndex = this.themeIndex;
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.themeBlend = 0;
      }
      if (this.themeBlend < 1) {
        this.themeBlend = Math.min(1, this.themeBlend + dt / 2.5);
      }
    }

    update(dt) {
      if (this.state !== GameStates.PLAYING) return;

      this.elapsed += dt;
      this.speed = Math.min(this.maxSpeed, this.baseSpeed + this.elapsed * this.speedRamp);
      this.distance += this.speed * dt;

      this.player.hasShield = this.collectibles.shieldCharges > 0;
      this.player.update(dt, this.particles);

      this.track.update(dt, this.speed, this.elapsed);
      this.collectibles.update(dt, this.player, this.speed, this.particles);

      this.checkCollisions();
      this.particles.update(dt);
      ScreenShake.update(dt);
      this.updateTheme(dt);

      this.syncHUD();
    }

    syncHUD() {
      this.scoreDisplay.textContent = this.getScore();
      this.coinCount.textContent = this.collectibles.coinCount;

      if (this.collectibles.shieldCharges > 0) {
        this.shieldDisplay.classList.remove('hidden');
        this.shieldCount.textContent = this.collectibles.shieldCharges;
      } else {
        this.shieldDisplay.classList.add('hidden');
      }

      this.zoneDisplay.textContent = THEMES[this.themeIndex].name;

      // Speed gauge
      const speedPercent = ((this.speed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed)) * 100;
      this.speedBarFill.style.width = Math.max(15, speedPercent) + '%';

      // Power-up badge
      const activeEntry = Object.entries(this.collectibles.activePowerUps)[0];
      if (activeEntry) {
        const [pType, timeLeft] = activeEntry;
        const meta = POWERUP_METAS[pType];
        this.powerupDisplay.classList.remove('hidden');
        this.powerupIcon.textContent = meta.icon;
        this.powerupText.textContent = `${meta.name} ${Math.ceil(timeLeft)}s`;
      } else {
        this.powerupDisplay.classList.add('hidden');
      }
    }

    drawBackground() {
      const from = THEMES[this.prevThemeIndex];
      const to = THEMES[this.themeIndex];
      const t = this.themeBlend;

      const skyTop = t < 1 ? lerpColor(from.sky[0], to.sky[0], t) : to.sky[0];
      const skyBot = t < 1 ? lerpColor(from.sky[1], to.sky[1], t) : to.sky[1];
      const groundCol = t < 1 ? lerpColor(from.ground, to.ground, t) : to.ground;
      const bldgCol = t < 1 ? lerpColor(from.building, to.building, t) : to.building;
      const gridCol = t < 1 ? lerpColor(from.grid, to.grid, t) : to.grid;

      // Dynamic Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

      // Parallax Cityscape
      this.parallax.render(ctx, this.distance, bldgCol, gridCol);

      // Ground Track
      ctx.fillStyle = groundCol;
      ctx.fillRect(0, GROUND_Y + 12, DESIGN_WIDTH, DESIGN_HEIGHT - GROUND_Y - 12);

      // Neon Lane Lines
      ctx.save();
      ctx.strokeStyle = gridCol;
      ctx.shadowColor = gridCol;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.setLineDash([24, 20]);
      ctx.lineDashOffset = -(this.distance % 44);

      for (let i = 1; i < LANE_COUNT; i++) {
        const lx = LANE_WIDTH * i;
        ctx.beginPath();
        ctx.moveTo(lx, 260);
        ctx.lineTo(lx, DESIGN_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();

      // Ground horizon divider
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 12);
      ctx.lineTo(DESIGN_WIDTH, GROUND_Y + 12);
      ctx.stroke();
    }

    draw() {
      ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
      const shake = ScreenShake.getOffset();

      ctx.save();
      ctx.translate(shake.x, shake.y);

      this.drawBackground();

      if (this.state !== GameStates.MENU) {
        this.track.render(ctx);
        this.collectibles.render(ctx);
        this.player.render(ctx);
        this.particles.render(ctx);
      }

      ctx.restore();
    }

    loop(timestamp) {
      if (!this.lastTime) this.lastTime = timestamp;
      let dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;
      dt = Math.min(dt, 1 / 30);

      // Gentle ambient updates when on menu
      if (this.state !== GameStates.PLAYING) {
        this.distance += 40 * dt;
        this.updateTheme(dt);
        this.particles.update(dt);
        ScreenShake.update(dt);
      }

      this.update(dt);
      this.draw();
      requestAnimationFrame(t => this.loop(t));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    new GameApp();
  });
})();
