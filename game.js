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
     ZONES / CYBER THEMES (3 SELECTABLE BACKGROUNDS)
     ============================================================ */
  const THEMES = [
    {
      id: 'matrix',
      name: 'CYBER MATRIX',
      sky: ['#02050f', '#09162c'],
      ground: '#0c1424',
      grid: '#4cc9f0',
      building: '#101d36',
      accent: '#00f0ff',
      celestial: 'moon',
      horizonGlow: 'rgba(76, 201, 240, 0.22)'
    },
    {
      id: 'sunset',
      name: 'SYNTH SUNSET',
      sky: ['#240523', '#5a123b'],
      ground: '#260d21',
      grid: '#f72585',
      building: '#3b122f',
      accent: '#ff007f',
      celestial: 'sun',
      horizonGlow: 'rgba(247, 37, 133, 0.28)'
    },
    {
      id: 'cosmic',
      name: 'COSMIC VOID',
      sky: ['#070214', '#1f0b3d'],
      ground: '#130726',
      grid: '#9d4edd',
      building: '#261145',
      accent: '#ffd23f',
      celestial: 'nebula',
      horizonGlow: 'rgba(157, 78, 221, 0.25)'
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

      // Starfield for deep cyber space
      this.stars = [];
      for (let i = 0; i < 55; i++) {
        this.stars.push({
          x: Math.random() * DESIGN_WIDTH,
          y: Math.random() * (GROUND_Y - 260),
          radius: randRange(0.8, 2.2),
          alpha: randRange(0.3, 0.95),
          twinkleSpeed: randRange(2.0, 5.5),
          twinklePhase: Math.random() * Math.PI * 2
        });
      }

      // Shooting stars system
      this.shootingStar = null;
      this.shootingStarTimer = randRange(2.0, 4.5);

      // Speed streaks (wind trails when running fast)
      this.speedStreaks = [];
      for (let i = 0; i < 22; i++) {
        this.speedStreaks.push({
          x: randRange(15, DESIGN_WIDTH - 15),
          y: Math.random() * DESIGN_HEIGHT,
          speed: randRange(1.4, 2.8),
          len: randRange(35, 85),
          alpha: randRange(0.18, 0.45)
        });
      }

      this.time = 0;
    }

    _createLayer(count, minH, maxH) {
      const b = [];
      const colWidth = DESIGN_WIDTH / count;
      for (let i = 0; i < count; i++) {
        b.push({
          x: i * colWidth,
          w: colWidth * randRange(0.6, 0.9),
          h: randRange(minH, maxH),
          windows: Math.random() > 0.25,
          beacon: Math.random() > 0.35,
          beaconColor: Math.random() > 0.5 ? '#ff3366' : '#00f0ff',
          neonSign: Math.random() > 0.65 ? (['RUN', 'V2.0', 'NEO', 'CYBER'][Math.floor(Math.random() * 4)]) : null
        });
      }
      return b;
    }

    update(dt, speedRatio = 1) {
      this.time += dt;

      // Update shooting stars
      if (this.shootingStar) {
        this.shootingStar.life -= dt;
        this.shootingStar.x += this.shootingStar.vx * dt;
        this.shootingStar.y += this.shootingStar.vy * dt;
        if (this.shootingStar.life <= 0) {
          this.shootingStar = null;
          this.shootingStarTimer = randRange(3.0, 6.5);
        }
      } else {
        this.shootingStarTimer -= dt;
        if (this.shootingStarTimer <= 0) {
          this.shootingStar = {
            x: randRange(20, DESIGN_WIDTH - 120),
            y: randRange(20, 150),
            vx: randRange(380, 650),
            vy: randRange(180, 320),
            len: randRange(55, 95),
            life: randRange(0.35, 0.6),
            maxLife: 0.6,
            color: Math.random() > 0.5 ? '#4cc9f0' : '#ffd23f'
          };
        }
      }

      // Update speed wind streaks
      for (const s of this.speedStreaks) {
        s.y += 420 * s.speed * speedRatio * dt;
        if (s.y > DESIGN_HEIGHT + s.len) {
          s.y = -s.len;
          s.x = randRange(10, DESIGN_WIDTH - 10);
        }
      }
    }

    render(ctx, distance, theme, buildingColor, gridColor, speedRatio = 1) {
      // 1. Starfield with smooth twinkling
      ctx.save();
      for (const st of this.stars) {
        const twinkle = Math.sin(this.time * st.twinkleSpeed + st.twinklePhase);
        const a = clamp(st.alpha + twinkle * 0.35, 0.1, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Shooting star streak
      if (this.shootingStar) {
        const ss = this.shootingStar;
        const a = clamp(ss.life / ss.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = ss.color;
        ctx.shadowColor = ss.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - ss.vx * 0.08, ss.y - ss.vy * 0.08);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Celestial object (Retro Sun, Cyber Moon, or Nebula)
      this._renderCelestial(ctx, theme);

      // 4. Parallax skyline layers
      this._renderBuildings(ctx, this.farBuildings, distance * 0.1, 240, buildingColor, 0.38, gridColor);
      this._renderBuildings(ctx, this.midBuildings, distance * 0.26, 290, buildingColor, 0.70, gridColor);

      // 5. Distant perspective grid on horizon
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      const horizonY = 300;
      for (let x = 0; x <= DESIGN_WIDTH; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, horizonY);
        ctx.lineTo(x + (x - DESIGN_WIDTH / 2) * 1.6, GROUND_Y);
        ctx.stroke();
      }
      ctx.restore();

      // 6. Atmospheric horizon glow
      if (theme && theme.horizonGlow) {
        ctx.save();
        const hGrad = ctx.createLinearGradient(0, horizonY - 40, 0, GROUND_Y + 12);
        hGrad.addColorStop(0, 'rgba(0,0,0,0)');
        hGrad.addColorStop(0.7, theme.horizonGlow);
        hGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, horizonY - 40, DESIGN_WIDTH, GROUND_Y - horizonY + 52);
        ctx.restore();
      }

      // 7. Track border rails with animated neon LED guide nodes
      ctx.save();
      ctx.strokeStyle = gridColor;
      ctx.shadowColor = gridColor;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 260); ctx.lineTo(0, DESIGN_HEIGHT);
      ctx.moveTo(DESIGN_WIDTH, 260); ctx.lineTo(DESIGN_WIDTH, DESIGN_HEIGHT);
      ctx.stroke();

      for (let y = 300; y < DESIGN_HEIGHT; y += 70) {
        const offset = (this.time * 60 + y) % (DESIGN_HEIGHT - 300) + 300;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = gridColor;
        ctx.shadowBlur = 8;
        ctx.fillRect(2, offset, 4, 10);
        ctx.fillRect(DESIGN_WIDTH - 6, offset, 4, 10);
      }
      ctx.restore();

      // 8. Dynamic speed wind streaks
      if (speedRatio > 1.05) {
        ctx.save();
        ctx.strokeStyle = gridColor;
        ctx.shadowColor = gridColor;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.2;
        const streakAlpha = clamp((speedRatio - 1.05) * 0.45, 0, 0.45);
        ctx.globalAlpha = streakAlpha;
        for (const s of this.speedStreaks) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + s.len);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    _renderCelestial(ctx, theme) {
      if (!theme) return;
      ctx.save();

      if (theme.celestial === 'sun') {
        // Retro Synthwave Sun
        const sunX = DESIGN_WIDTH / 2;
        const sunY = 250;
        const radius = 68;

        // Big outer radiant glow
        const sunGlow = ctx.createRadialGradient(sunX, sunY, radius * 0.2, sunX, sunY, radius * 1.8);
        sunGlow.addColorStop(0, 'rgba(255, 210, 63, 0.6)');
        sunGlow.addColorStop(0.5, 'rgba(247, 37, 133, 0.3)');
        sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Sun disc gradient
        const discGrad = ctx.createLinearGradient(sunX, sunY - radius, sunX, sunY + radius);
        discGrad.addColorStop(0, '#ffd23f');
        discGrad.addColorStop(0.5, '#ff007f');
        discGrad.addColorStop(1, '#7209b7');

        ctx.fillStyle = discGrad;
        ctx.shadowColor = '#f72585';
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Iconic horizontal retro blinds
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#240523';
        const startCutY = sunY - 10;
        for (let i = 0; i < 7; i++) {
          const sy = startCutY + i * 11;
          const sliceH = 2 + i * 1.2;
          ctx.fillRect(sunX - radius, sy, radius * 2, sliceH);
        }
      } else if (theme.celestial === 'moon') {
        // Cyber Matrix Digital Moon
        const moonX = DESIGN_WIDTH * 0.72;
        const moonY = 160;
        const radius = 42;

        const moonGlow = ctx.createRadialGradient(moonX, moonY, radius * 0.3, moonX, moonY, radius * 2.2);
        moonGlow.addColorStop(0, 'rgba(76, 201, 240, 0.5)');
        moonGlow.addColorStop(0.6, 'rgba(0, 240, 255, 0.15)');
        moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        const moonGrad = ctx.createLinearGradient(moonX - radius, moonY - radius, moonX + radius, moonY + radius);
        moonGrad.addColorStop(0, '#e0f7fa');
        moonGrad.addColorStop(0.5, '#4cc9f0');
        moonGrad.addColorStop(1, '#09162c');

        ctx.fillStyle = moonGrad;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Orbiting cyan data rings
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(moonX, moonY, radius * 1.5, radius * 0.48, -0.28, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting satellite data node
        const satAngle = this.time * 1.8;
        const satX = moonX + Math.cos(satAngle) * radius * 1.5;
        const satY = moonY + Math.sin(satAngle) * radius * 0.48;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(satX, satY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Cosmic Void Nebula & Pulsar
        const nebX = DESIGN_WIDTH * 0.38;
        const nebY = 175;

        const nebGrad = ctx.createRadialGradient(nebX, nebY, 20, nebX, nebY, 140);
        nebGrad.addColorStop(0, 'rgba(181, 23, 158, 0.35)');
        nebGrad.addColorStop(0.4, 'rgba(114, 9, 183, 0.22)');
        nebGrad.addColorStop(0.8, 'rgba(76, 201, 240, 0.12)');
        nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebGrad;
        ctx.beginPath();
        ctx.arc(nebX, nebY, 140, 0, Math.PI * 2);
        ctx.fill();

        // Radiant Pulsar Star
        const pX = DESIGN_WIDTH * 0.42;
        const pY = 160;
        const pSize = 5 + Math.sin(this.time * 5) * 1.5;
        ctx.fillStyle = '#ffd23f';
        ctx.shadowColor = '#ffd23f';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(pX, pY, pSize, 0, Math.PI * 2);
        ctx.fill();

        // Cross flare
        ctx.strokeStyle = 'rgba(255, 210, 63, 0.6)';
        ctx.lineWidth = 1.5;
        const rayLen = 22 + Math.sin(this.time * 5) * 6;
        ctx.beginPath();
        ctx.moveTo(pX - rayLen, pY); ctx.lineTo(pX + rayLen, pY);
        ctx.moveTo(pX, pY - rayLen); ctx.lineTo(pX, pY + rayLen);
        ctx.stroke();
      }

      ctx.restore();
    }

    _renderBuildings(ctx, list, offset, baseY, color, alpha, accentColor) {
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

          // Rooftop beacon
          if (b.beacon) {
            const blink = Math.sin(this.time * 4 + bx) > 0;
            if (blink) {
              ctx.save();
              ctx.fillStyle = b.beaconColor;
              ctx.shadowColor = b.beaconColor;
              ctx.shadowBlur = 8;
              ctx.globalAlpha = 0.9;
              ctx.fillRect(bx + b.w / 2 - 1, baseY - b.h - 8, 2, 8);
              ctx.beginPath();
              ctx.arc(bx + b.w / 2, baseY - b.h - 9, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Neon advertising sign
          if (b.neonSign && b.w > 36) {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.font = 'bold 9px "Orbitron", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = accentColor || '#4cc9f0';
            ctx.shadowColor = accentColor || '#4cc9f0';
            ctx.shadowBlur = 8;
            ctx.fillText(b.neonSign, bx + b.w / 2, baseY - b.h + 20);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
  }

  /* ============================================================
     PLAYER (CYBER RUNNER v2 - ULTRA SMOOTH PHYSICS & GRAPHICS)
     ============================================================ */
  class Player {
    constructor() {
      this.lane = 1;
      this.x = laneX(1);
      this.targetX = this.x;
      this.tilt = 0;

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

      // Critically damped exponential lane approach for buttery 60/120fps smoothness
      const dx = this.targetX - this.x;
      const moveAlpha = 1 - Math.exp(-24 * dt);
      this.x += dx * moveAlpha;

      // Dynamic banking tilt when changing lanes
      const targetTilt = clamp(dx * 0.0035, -0.22, 0.22);
      this.tilt = lerp(this.tilt, targetTilt, 1 - Math.exp(-18 * dt));

      // Emit lateral trail sparks during lane change
      if (Math.abs(dx) > 1.5) {
        particles.trail(this.x, GROUND_Y - 20, '#4cc9f0');
      }

      // Jump physics with apex smoothing
      if (this.jumping) {
        const apexFloat = Math.abs(this.jumpVel) < 200 ? 0.78 : 1.0;
        this.jumpVel -= this.gravity * apexFloat * dt;
        this.jumpHeight += this.jumpVel * dt;
        if (this.jumpHeight <= 0) {
          this.jumpHeight = 0;
          this.jumping = false;
          this.jumpVel = 0;
          this.squash = 1; // Landing squash
          particles.burst(this.x, GROUND_Y, '#4cc9f0', 10, 50, 130);
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

      // Continuous dual cyber thruster particles
      if (!this.jumping && Math.random() < 0.5) {
        particles.trail(this.x - 8, GROUND_Y - 2, '#00f0ff');
        particles.trail(this.x + 8, GROUND_Y - 2, '#ffd23f');
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

      // Dynamic ground shadow that scales with jump height
      ctx.save();
      const shadowScale = clamp(1 - this.jumpHeight / 280, 0.3, 1);
      ctx.globalAlpha = 0.4 * shadowScale;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y + 6, (this.width * 0.6) * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      // Apply banking tilt rotation
      ctx.translate(this.x, b.y + currentH / 2);
      ctx.rotate(this.tilt);
      ctx.translate(-this.x, -(b.y + currentH / 2));

      // Dual Counter-Rotating Hex Energy Shield
      if (this.hasShield) {
        ctx.save();
        const pulse = Math.sin(this.animTime * 6) * 3;
        const r = (this.width / 2) + 14 + pulse;

        // Outer rotating hexagon
        ctx.save();
        ctx.translate(this.x, b.y + currentH / 2);
        ctx.rotate(this.animTime * 2.2);
        ctx.strokeStyle = '#06d6a0';
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = Math.cos(angle) * r;
          const hy = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Inner counter-rotating ring
        ctx.save();
        ctx.translate(this.x, b.y + currentH / 2);
        ctx.rotate(-this.animTime * 1.7);
        ctx.strokeStyle = '#4cc9f0';
        ctx.shadowColor = '#4cc9f0';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = Math.cos(angle) * (r * 0.78);
          const hy = Math.sin(angle) * (r * 0.78);
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        ctx.restore();
      }

      // Cyber Runner Suit Body
      const bodyColor = this.sliding ? '#f72585' : '#4cc9f0';
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 14;

      // Rounded cyber torso
      const cornerR = 8;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y + squashOffset, b.w, currentH - squashOffset, cornerR);
      ctx.fill();

      // Dual jet thrusters with pulsing flame glow
      const flameH = 8 + Math.sin(this.animTime * 24) * 4;
      ctx.fillStyle = this.sliding ? '#ffd23f' : '#00f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(b.x + 8, b.y + currentH - 2, 6, flameH);
      ctx.fillRect(b.x + b.w - 14, b.y + currentH - 2, 6, flameH);

      // Cyber glowing visor with scanner beam
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f';
      ctx.shadowBlur = 8;
      const visorH = this.sliding ? 7 : 12;
      const visorY = b.y + (this.sliding ? 6 : 10) + squashOffset;
      ctx.fillRect(b.x + 6, visorY, b.w - 12, visorH);

      // Visor animated laser scan highlight
      const scanX = b.x + 6 + ((Math.sin(this.animTime * 12) + 1) * 0.5) * (b.w - 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(scanX, visorY, 4, visorH);

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
          // Low Barrier with caution stripes and electric arcs
          ctx.fillStyle = o.type.color;
          ctx.shadowColor = o.type.color;
          ctx.shadowBlur = 12;
          ctx.fillRect(ox, oy, o.w, o.h);

          // Glowing danger line
          ctx.fillStyle = o.type.accent;
          ctx.fillRect(ox + 4, oy + 4, o.w - 8, 6);

          // Animated electric lightning sparks across top edge
          ctx.strokeStyle = '#00f0ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.beginPath();
          let arcX = ox + 6;
          ctx.moveTo(arcX, oy + 6);
          while (arcX < ox + o.w - 8) {
            arcX += randRange(10, 20);
            const arcY = oy + 6 + (Math.random() * 8 - 4);
            ctx.lineTo(Math.min(arcX, ox + o.w - 6), arcY);
          }
          ctx.stroke();

          // Caution diagonal stripes
          ctx.fillStyle = '#000';
          ctx.globalAlpha = 0.28;
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

          // Upper beam structure
          ctx.fillStyle = o.type.color;
          ctx.shadowColor = o.type.accent;
          ctx.shadowBlur = 14;
          ctx.fillRect(ox, oy, o.w, solidH);

          // Pulsing laser emitter beam
          const laserPulse = (Math.sin(Date.now() * 0.012) + 1) * 0.5;
          ctx.fillStyle = o.type.accent;
          ctx.shadowColor = o.type.accent;
          ctx.shadowBlur = 12 + laserPulse * 10;
          ctx.fillRect(ox + 6, oy + solidH - 8, o.w - 12, 6);

          // Subtle holographic clearance indicator below
          ctx.fillStyle = o.type.accent;
          ctx.globalAlpha = 0.14 + laserPulse * 0.08;
          ctx.fillRect(ox, oy + solidH, o.w, o.type.gap);

          ctx.globalAlpha = 0.85;
          ctx.font = 'bold 11px "Orbitron", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▼ SLIDE UNDER ▼', o.x, oy + solidH + 26);
        } else {
          // Block Monolith with tech circuitry
          ctx.fillStyle = o.type.color;
          ctx.fillRect(ox, oy, o.w, o.h);

          // Glowing edge frame
          ctx.strokeStyle = o.type.accent;
          ctx.shadowColor = o.type.accent;
          ctx.shadowBlur = 16;
          ctx.lineWidth = 3;
          ctx.strokeRect(ox + 2, oy + 2, o.w - 4, o.h - 4);

          // Digital circuit trace lines
          ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ox + 10, oy + 18); ctx.lineTo(ox + o.w - 10, oy + 18);
          ctx.moveTo(ox + 10, oy + o.h - 18); ctx.lineTo(ox + o.w - 10, oy + o.h - 18);
          ctx.moveTo(ox + o.w / 2, oy + 18); ctx.lineTo(ox + o.w / 2, oy + o.h - 18);
          ctx.stroke();

          // Pulsing Hazard symbol
          const hazardPulse = Math.sin(Date.now() * 0.008) * 2;
          ctx.fillStyle = o.type.accent;
          ctx.font = `bold ${20 + hazardPulse}px "Orbitron", sans-serif`;
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
          // 3D Spinning Gold Coin with metallic sheen
          const wobble = Math.abs(Math.cos(item.spin));
          const w = Math.max(3, item.radius * wobble);

          const coinGrad = ctx.createLinearGradient(cx - w, cy - item.radius, cx + w, cy + item.radius);
          coinGrad.addColorStop(0, '#fffbe0');
          coinGrad.addColorStop(0.5, '#ffd23f');
          coinGrad.addColorStop(1, '#ff9100');

          ctx.fillStyle = coinGrad;
          ctx.shadowColor = '#ffd23f';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.ellipse(cx, cy, w, item.radius, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Inner metallic rim when facing viewer
          if (w > 5) {
            ctx.strokeStyle = 'rgba(184, 93, 0, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cx, cy, w * 0.65, item.radius * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          // Power-up Orb with orbiting energy aura rings
          const meta = POWERUP_METAS[item.type];

          // Outer rotating halo ring
          ctx.strokeStyle = meta.color;
          ctx.shadowColor = meta.color;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(cx, cy, item.radius * 1.5, item.radius * 0.6, item.spin * 2.2, 0, Math.PI * 2);
          ctx.stroke();

          // Core Orb
          const orbGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, item.radius);
          orbGrad.addColorStop(0, '#ffffff');
          orbGrad.addColorStop(0.4, meta.color);
          orbGrad.addColorStop(1, '#0b0f19');

          ctx.fillStyle = orbGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, item.radius, 0, Math.PI * 2);
          ctx.fill();

          // Icon
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 4;
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
  const BG_STORAGE_KEY = 'run_and_run_selected_bg';

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

      // Background selection (3 choices)
      this.selectedBgIndex = this.loadSelectedBg();
      this.themeIndex = this.selectedBgIndex;
      this.prevThemeIndex = this.selectedBgIndex;
      this.themeBlend = 1;
      this.themeTimer = 0;

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

    loadSelectedBg() {
      try {
        const val = parseInt(localStorage.getItem(BG_STORAGE_KEY), 10);
        return (val >= 0 && val < THEMES.length) ? val : 0;
      } catch (e) {
        return 0;
      }
    }

    saveSelectedBg(idx) {
      try {
        localStorage.setItem(BG_STORAGE_KEY, String(idx));
      } catch (e) {}
    }

    selectBackground(index) {
      if (index < 0 || index >= THEMES.length) return;
      this.selectedBgIndex = index;
      this.prevThemeIndex = this.themeIndex;
      this.themeIndex = index;
      this.themeBlend = 0;
      this.saveSelectedBg(index);

      // Update UI buttons active state
      for (let i = 0; i < THEMES.length; i++) {
        const btn = document.getElementById(`bgBtn${i}`);
        if (btn) {
          if (i === index) btn.classList.add('active');
          else btn.classList.remove('active');
        }
      }

      const nameEl = document.getElementById('bgSelectedName');
      if (nameEl) {
        nameEl.textContent = THEMES[index].name;
      }
      if (this.zoneDisplay) {
        this.zoneDisplay.textContent = THEMES[index].name;
      }
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

      // Maintain user's chosen background
      this.themeIndex = this.selectedBgIndex;
      this.prevThemeIndex = this.selectedBgIndex;
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

      // 3-Choice Background Selector buttons
      for (let i = 0; i < 3; i++) {
        const btn = document.getElementById(`bgBtn${i}`);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            SoundSystem.ensure();
            this.selectBackground(i);
          });
        }
      }
      // Initialize active background state and label
      this.selectBackground(this.selectedBgIndex);
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
      if (this.themeBlend < 1) {
        this.themeBlend = Math.min(1, this.themeBlend + dt / 0.5);
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
      this.parallax.update(dt, this.speed / this.baseSpeed);

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
      const from = THEMES[this.prevThemeIndex] || THEMES[0];
      const to = THEMES[this.themeIndex] || THEMES[0];
      const t = this.themeBlend;

      const skyTop = t < 1 ? lerpColor(from.sky[0], to.sky[0], t) : to.sky[0];
      const skyBot = t < 1 ? lerpColor(from.sky[1], to.sky[1], t) : to.sky[1];
      const groundCol = t < 1 ? lerpColor(from.ground, to.ground, t) : to.ground;
      const bldgCol = t < 1 ? lerpColor(from.building, to.building, t) : to.building;
      const gridCol = t < 1 ? lerpColor(from.grid, to.grid, t) : to.grid;
      const speedRatio = this.state === GameStates.PLAYING ? (this.speed / this.baseSpeed) : 0.6;

      // Dynamic Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

      // Parallax Cityscape with Celestial Objects & Speed Streaks
      this.parallax.render(ctx, this.distance, to, bldgCol, gridCol, speedRatio);

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
      // High refresh smoothness clamp (handles 60Hz, 90Hz, 120Hz gracefully)
      dt = Math.min(Math.max(dt, 0.001), 0.033);

      // Gentle ambient updates when on menu
      if (this.state !== GameStates.PLAYING) {
        this.distance += 40 * dt;
        this.parallax.update(dt, 0.4);
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
