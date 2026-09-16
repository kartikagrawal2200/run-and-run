(function () {
  'use strict';

  // Canvas roundRect compatibility polyfill for older/mobile browsers
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
      let r = typeof radii === 'number' ? radii : 4;
      r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

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
     CYBER SUITS / COSTUMES SYSTEM
     ============================================================ */
  const COSTUMES = {
    neo: {
      id: 'neo',
      name: 'NEO RUNNER',
      price: 0,
      desc: 'Standard issue cyber athlete suit with agility exo-struts.',
      suitDark: '#101c38',
      suitLight: '#4cc9f0',
      visor: '#ffd23f',
      visorGlow: 'rgba(255, 210, 63, 0.9)',
      skin: '#f4c7ab',
      hair: '#00f0ff',
      shoes: '#ffffff',
      accent: '#4cc9f0',
      swatch: 'linear-gradient(135deg, #101c38, #4cc9f0, #ffd23f)'
    },
    ninja: {
      id: 'ninja',
      name: 'CYBER NINJA',
      price: 100,
      desc: 'Stealth carbon weave with crimson energy scarf & razor visor.',
      suitDark: '#0b0c10',
      suitLight: '#1f222e',
      visor: '#ff0055',
      visorGlow: 'rgba(255, 0, 85, 0.95)',
      skin: '#d8b090',
      hair: '#ff0055',
      shoes: '#ff0055',
      accent: '#ff0055',
      swatch: 'linear-gradient(135deg, #0b0c10, #ff0055, #1f222e)'
    },
    rebel: {
      id: 'rebel',
      name: 'SYNTH REBEL',
      price: 200,
      desc: 'Outrun street jacket with UV sunglasses visor & radioactive kicks.',
      suitDark: '#280638',
      suitLight: '#f72585',
      visor: '#00f0ff',
      visorGlow: 'rgba(0, 240, 255, 0.95)',
      skin: '#eec7a7',
      hair: '#f72585',
      shoes: '#06d6a0',
      accent: '#f72585',
      swatch: 'linear-gradient(135deg, #280638, #f72585, #00f0ff)'
    },
    apex: {
      id: 'apex',
      name: 'GOLDEN APEX',
      price: 350,
      desc: 'Gilded aerospace exoskeleton reserved for syndicate champions.',
      suitDark: '#171410',
      suitLight: '#ffd23f',
      visor: '#ff7b00',
      visorGlow: 'rgba(255, 123, 0, 0.95)',
      skin: '#d8a682',
      hair: '#ffd23f',
      shoes: '#ffd23f',
      accent: '#ffd23f',
      swatch: 'linear-gradient(135deg, #171410, #ffd23f, #ff7b00)'
    },
    titan: {
      id: 'titan',
      name: 'TITAN ENFORCER',
      price: 500,
      desc: 'Heavy titanium kinetic plating powered by emerald fusion micro-cells.',
      suitDark: '#e2e8f0',
      suitLight: '#06d6a0',
      visor: '#00f0ff',
      visorGlow: 'rgba(0, 240, 255, 0.95)',
      skin: '#c28552',
      hair: '#1e293b',
      shoes: '#06d6a0',
      accent: '#06d6a0',
      swatch: 'linear-gradient(135deg, #e2e8f0, #06d6a0, #00f0ff)'
    }
  };

  /* ============================================================
     TECH UPGRADES SYSTEM
     ============================================================ */
  const UPGRADES = {
    magnet: {
      id: 'magnet',
      name: 'Magnet Tech',
      icon: '🧲',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 8, radius: 160, cost: 0, desc: '8s duration, standard reach' },
        { level: 2, duration: 12, radius: 190, cost: 80, desc: '12s duration, +20% reach' },
        { level: 3, duration: 16, radius: 220, cost: 160, desc: '16s duration, +40% reach' },
        { level: 4, duration: 20, radius: 260, cost: 300, desc: '20s duration, hyper pull' }
      ]
    },
    multiplier: {
      id: 'multiplier',
      name: '2X Score Boost',
      icon: '⭐',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 10, cost: 0, desc: '10s duration of 2X score' },
        { level: 2, duration: 15, cost: 100, desc: '15s duration of 2X score' },
        { level: 3, duration: 20, cost: 200, desc: '20s duration of 2X score' },
        { level: 4, duration: 25, cost: 350, desc: '25s duration of 2X score' }
      ]
    },
    shield: {
      id: 'shield',
      name: 'Starting Shield',
      icon: '🛡️',
      maxLevel: 2,
      levels: [
        { level: 0, shields: 0, cost: 0, desc: 'Deploy with 0 Starting Shield' },
        { level: 1, shields: 1, cost: 150, desc: 'Deploy with 1 Shield active' },
        { level: 2, shields: 2, cost: 300, desc: 'Deploy with 2 Shields active' }
      ]
    }
  };

  /* ============================================================
     HUMANOID RUNNER RENDER PIPELINE
     ============================================================ */
  /* ============================================================
     HUMANOID RUNNER RENDER PIPELINE (CRASH-PROOF & HIGH-DEFINITION)
     ============================================================ */
  function drawHumanoidRunner(ctx, cx, groundY, animTime, isJumping, isSliding, jumpHeight, tilt, costume, squash, hasShield) {
    try {
      const c = costume || COSTUMES.neo;
      ctx.save();
      ctx.translate(cx, groundY);
      if (tilt) ctx.rotate(tilt);

      // 1. Dynamic ground shadow that scales with jump height
      if (jumpHeight !== undefined) {
        ctx.save();
        const shadowScale = clamp(1 - (jumpHeight || 0) / 280, 0.25, 1);
        ctx.globalAlpha = 0.45 * shadowScale;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        const sw = Math.max(4, 22 * shadowScale);
        const sh = Math.max(2, 6 * shadowScale);
        ctx.ellipse(0, 4, sw, sh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Lift body by jumpHeight
      ctx.translate(0, -(jumpHeight || 0));

      // 2. Dual Hex Shield if active
      if (hasShield) {
        const pulse = Math.sin(animTime * 6) * 3;
        const r = 36 + pulse;

        // Outer rotating hexagon
        ctx.save();
        ctx.translate(0, -40);
        ctx.rotate(animTime * 2.2);
        ctx.strokeStyle = '#06d6a0';
        ctx.shadowColor = '#06d6a0';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = Math.cos(a) * r, hy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Inner counter-rotating ring
        ctx.save();
        ctx.translate(0, -40);
        ctx.rotate(-animTime * 1.8);
        ctx.strokeStyle = '#4cc9f0';
        ctx.shadowColor = '#4cc9f0';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = Math.cos(a) * (r * 0.78), hy = Math.sin(a) * (r * 0.78);
          if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      if (isSliding) {
        // ----------------------------------------------------
        // SLIDING HUMAN POSE: low angled skid on asphalt
        // ----------------------------------------------------
        ctx.save();
        ctx.translate(0, -18);
        ctx.rotate(-0.35); // Leaning backwards

        // Rear stretched leg
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.moveTo(-18, 2); ctx.lineTo(6, 2); ctx.lineTo(4, 10); ctx.lineTo(-18, 10);
        ctx.closePath();
        ctx.fill();

        // Rear glowing sneaker
        ctx.fillStyle = c.shoes;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        ctx.fillRect(-24, 2, 7, 9);
        ctx.shadowBlur = 0;

        // Front bent knee forward
        ctx.fillStyle = c.suitLight;
        ctx.beginPath();
        ctx.moveTo(2, -4); ctx.lineTo(20, -4); ctx.lineTo(16, 8); ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fill();

        // Knee friction spark armor pad
        ctx.fillStyle = c.visor;
        ctx.shadowColor = c.visor;
        ctx.shadowBlur = 12;
        ctx.fillRect(16, -2, 6, 8);

        // Friction spark trails
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20 + Math.sin(animTime * 30) * 4, 3, 3, 3);
        ctx.fillRect(16 + Math.cos(animTime * 25) * 5, 5, 2, 2);
        ctx.shadowBlur = 0;

        // Torso / cyber jacket
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(10, 0); ctx.lineTo(-10, 0);
        ctx.closePath();
        ctx.fill();

        // Jacket chestplate
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-8, -20, 16, 10);

        // Torso glowing core
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, -12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Arms in slide bracing position
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-18, -14, 12, 6);
        ctx.fillRect(6, -10, 14, 6);
        ctx.fillStyle = c.skin;
        ctx.fillRect(-22, -14, 5, 5);
        ctx.fillRect(19, -10, 5, 5);

        // Head / cyber helmet
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.arc(0, -32, 10, 0, Math.PI * 2);
        ctx.fill();

        // Helmet crest / energy hair flying back
        ctx.fillStyle = c.hair;
        ctx.beginPath();
        ctx.moveTo(-6, -36);
        ctx.lineTo(-24, -30 + Math.sin(animTime * 16) * 3);
        ctx.lineTo(-8, -27);
        ctx.closePath();
        ctx.fill();

        // Glowing Visor
        ctx.fillStyle = c.visor;
        ctx.shadowColor = c.visor;
        ctx.shadowBlur = 12;
        ctx.fillRect(2, -35, 9, 6);
        ctx.shadowBlur = 0;

        ctx.restore();

      } else if (isJumping) {
        // ----------------------------------------------------
        // JUMPING HUMAN POSE: tucked athletic mid-air stride
        // ----------------------------------------------------
        ctx.save();
        ctx.translate(0, -38);

        // Left leg tucked forward-up
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-14, 4, 10, 14);
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-14, 16, 12, 10);
        ctx.fillStyle = c.shoes;
        ctx.fillRect(-16, 24, 14, 7);

        // Right leg bent back
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(4, 4, 10, 12);
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(8, 14, 12, 10);
        ctx.fillStyle = c.shoes;
        ctx.fillRect(10, 22, 14, 7);

        // Torso / chestplate
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(10, 4); ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-8, -20, 16, 14);

        // Chest reactor core
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Outstretched arms for balance
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-22, -18, 11, 7);
        ctx.fillRect(-25, -24, 6, 9);
        ctx.fillRect(11, -18, 11, 7);
        ctx.fillRect(19, -24, 6, 9);
        ctx.fillStyle = c.skin;
        ctx.fillRect(-26, -27, 6, 5);
        ctx.fillRect(19, -27, 6, 5);

        // Head / Cyber Helmet
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.arc(0, -32, 10, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        ctx.fillStyle = c.skin;
        ctx.fillRect(-4, -24, 8, 4);

        // Cyber Hair / Crest in wind
        ctx.fillStyle = c.hair;
        ctx.beginPath();
        ctx.moveTo(-5, -36);
        ctx.lineTo(-20, -42 + Math.sin(animTime * 14) * 3);
        ctx.lineTo(-8, -30);
        ctx.closePath();
        ctx.fill();

        // Glowing Visor
        ctx.fillStyle = c.visor;
        ctx.shadowColor = c.visor;
        ctx.shadowBlur = 14;
        ctx.fillRect(-1, -35, 10, 6);
        ctx.shadowBlur = 0;

        // Thruster flames from jet boots
        const flameH = 12 + Math.sin(animTime * 24) * 4;
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(-16, 31); ctx.lineTo(-10, 31 + flameH); ctx.lineTo(-4, 31);
        ctx.moveTo(10, 29); ctx.lineTo(16, 29 + flameH); ctx.lineTo(22, 29);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

      } else {
        // ----------------------------------------------------
        // ATHLETIC RUNNING / SPRINTING CYBER ATHLETE
        // ----------------------------------------------------
        const phase = (animTime * 14) % (Math.PI * 2);
        const legSwing = Math.sin(phase);
        const bobY = -Math.abs(Math.sin(phase)) * 4 + (squash || 0) * 8;

        ctx.save();
        ctx.translate(0, -38 + bobY);

        // 1. BACK ARM (Swings opposite to front leg)
        const backArmAngle = legSwing * 0.7;
        ctx.save();
        ctx.translate(-9, -16);
        ctx.rotate(backArmAngle);
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-3, 0, 6, 14); // upper arm
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-3, 12, 6, 12); // forearm gauntlet
        ctx.fillStyle = c.skin;
        ctx.fillRect(-2, 22, 5, 5); // fist
        ctx.restore();

        // 2. BACK LEG
        const backLegAngle = -legSwing * 0.75;
        ctx.save();
        ctx.translate(-5, 6);
        ctx.rotate(backLegAngle);
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-4, 0, 8, 16); // thigh
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-4, 14, 8, 16); // shin guard
        // Back shoe
        ctx.fillStyle = c.shoes;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 6;
        ctx.fillRect(-4, 28, 13, 7);
        ctx.shadowBlur = 0;
        ctx.restore();

        // 3. HUMAN ATHLETIC TORSO & CYBER JACKET
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.moveTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(10, 4); ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.fill();

        // Jacket chestplate & armor accents
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-8, -20, 16, 14);

        // Shoulder pauldrons
        ctx.fillStyle = c.suitLight;
        ctx.beginPath();
        ctx.arc(-11, -16, 5, 0, Math.PI * 2);
        ctx.arc(11, -16, 5, 0, Math.PI * 2);
        ctx.fill();

        // Chest glowing cyber reactor core
        ctx.fillStyle = c.accent;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, -11, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Belt & utility buckle
        ctx.fillStyle = '#070a12';
        ctx.fillRect(-11, 2, 22, 4);
        ctx.fillStyle = c.visor;
        ctx.fillRect(-3, 2, 6, 4);

        // 4. FRONT LEG (Swings forward)
        const frontLegAngle = legSwing * 0.75;
        ctx.save();
        ctx.translate(5, 6);
        ctx.rotate(frontLegAngle);
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-4, 0, 8, 16); // thigh
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-4, 14, 8, 16); // shin guard
        // Front shoe with glowing neon sole
        ctx.fillStyle = c.shoes;
        ctx.shadowColor = c.accent;
        ctx.shadowBlur = 8;
        ctx.fillRect(-3, 28, 14, 7);
        ctx.fillStyle = c.accent;
        ctx.fillRect(-3, 33, 14, 2.5); // glowing sole
        ctx.shadowBlur = 0;
        ctx.restore();

        // 5. HUMAN HEAD & CYBER HELMET
        // Neck
        ctx.fillStyle = c.skin;
        ctx.fillRect(-4, -24, 8, 4);

        // Cyber Helmet shell
        ctx.fillStyle = c.suitDark;
        ctx.beginPath();
        ctx.arc(0, -32, 10, 0, Math.PI * 2);
        ctx.fill();

        // Chin / faceplate
        ctx.fillStyle = c.skin;
        ctx.beginPath();
        ctx.arc(4, -27, 4, 0, Math.PI * 2);
        ctx.fill();

        // Cyber Hair / Wind crest
        ctx.fillStyle = c.hair;
        ctx.beginPath();
        ctx.moveTo(-4, -36);
        ctx.lineTo(-22, -35 + Math.sin(phase) * 4);
        ctx.lineTo(-8, -28);
        ctx.closePath();
        ctx.fill();

        // Visor eye-slit
        ctx.fillStyle = c.visor;
        ctx.shadowColor = c.visorGlow;
        ctx.shadowBlur = 12;
        ctx.fillRect(0, -35, 10, 6);

        // Visor animated laser scanner beam
        const scanX = 0 + ((Math.sin(animTime * 12) + 1) * 0.5) * 7;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(scanX, -35, 3, 6);
        ctx.shadowBlur = 0;

        // 6. FRONT ARM (Swings opposite to back arm)
        const frontArmAngle = -legSwing * 0.7;
        ctx.save();
        ctx.translate(9, -16);
        ctx.rotate(frontArmAngle);
        ctx.fillStyle = c.suitDark;
        ctx.fillRect(-3, 0, 6, 14); // upper arm
        ctx.fillStyle = c.suitLight;
        ctx.fillRect(-3, 12, 6, 12); // forearm gauntlet
        ctx.fillStyle = c.skin;
        ctx.fillRect(-2, 22, 5, 5); // fist
        ctx.restore();

        // Jet thruster flames on heels when running fast
        const flameH = 6 + Math.sin(animTime * 24) * 3;
        ctx.fillStyle = c.visor;
        ctx.shadowColor = c.visor;
        ctx.shadowBlur = 8;
        ctx.fillRect(-10, 30, 4, flameH);
        ctx.fillRect(6, 30, 4, flameH);
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      ctx.restore();
    } catch (err) {
      console.error('[Runner Render Error]', err);
      try { ctx.restore(); } catch (e) {}
    }
  }

  /* ============================================================
     PLAYER (HUMANOID CYBER RUNNER v2)
     ============================================================ */
  class Player {
    constructor(costume) {
      this.costume = costume || COSTUMES.neo;
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
        particles.trail(this.x, GROUND_Y - 20, this.costume.accent);
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
          particles.burst(this.x, GROUND_Y, this.costume.accent, 10, 50, 130);
        }
      }

      if (this.squash > 0) {
        this.squash = Math.max(0, this.squash - dt * 5);
      }

      // Slide countdown
      if (this.sliding) {
        this.slideTimer -= dt;
        particles.trail(this.x, GROUND_Y - 8, this.costume.visor);
        if (this.slideTimer <= 0) {
          this.sliding = false;
        }
      }

      // Continuous dual cyber thruster particles
      if (!this.jumping && Math.random() < 0.5) {
        particles.trail(this.x - 8, GROUND_Y - 2, this.costume.accent);
        particles.trail(this.x + 8, GROUND_Y - 2, this.costume.visor);
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
      drawHumanoidRunner(
        ctx,
        this.x,
        GROUND_Y,
        this.animTime,
        this.jumping,
        this.sliding,
        this.jumpHeight,
        this.tilt,
        this.costume,
        this.squash,
        this.hasShield
      );
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

    reset(startingShields = 0, magnetDur = 8, magnetRad = 160, multiplierDur = 10) {
      this.items = [];
      this.coinCount = 0;
      this.coinScore = 0;
      this.activePowerUps = {};
      this.shieldCharges = startingShields;
      this.magnetDuration = magnetDur;
      this.magnetRadius = magnetRad;
      this.multiplierDuration = multiplierDur;
      this.coinTimer = 1.0;
      this.powerupTimer = 11.0;
    }

    onObstacleSpawned(obstacle) {
      if (obstacle.type.id === 'LOW') {
        this._spawnArcTrail(obstacle.lane, obstacle.y, true);
      } else if (obstacle.type.id === 'HIGH') {
        this._spawnCoinLine(obstacle.lane, obstacle.y + 60, 3, 28, { requiresSlide: true });
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
        let duration = meta.duration;
        if (item.type === 'magnet' && this.magnetDuration) duration = this.magnetDuration;
        if (item.type === 'multiplier' && this.multiplierDuration) duration = this.multiplierDuration;
        this.activePowerUps[item.type] = duration;
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
  const COINS_STORAGE_KEY = 'run_and_run_bank_coins';
  const COSTUMES_STORAGE_KEY = 'run_and_run_unlocked_costumes';
  const EQUIPPED_STORAGE_KEY = 'run_and_run_equipped_costume';
  const UPGRADES_STORAGE_KEY = 'run_and_run_upgrades';

  class GameApp {
    constructor() {
      this.state = GameStates.MENU;
      this.bestScore = this.loadBest();

      // Persistent Bank, Costumes & Tech Upgrades
      this.bankCoins = this.loadBankCoins();
      this.unlockedCostumes = this.loadUnlockedCostumes();
      this.equippedCostume = this.loadEquippedCostume();
      this.upgrades = this.loadUpgrades();

      // UI elements
      this.hud = document.getElementById('hud');
      this.virtualControls = document.getElementById('virtualControls');
      this.menuScreen = document.getElementById('menuScreen');
      this.pauseScreen = document.getElementById('pauseScreen');
      this.gameOverScreen = document.getElementById('gameOverScreen');
      this.settingsModal = document.getElementById('settingsModal');
      this.shopModal = document.getElementById('shopModal');

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

      // Bank displays
      this.menuCoinBank = document.getElementById('menuCoinBank');
      this.shopCoinBank = document.getElementById('shopCoinBank');
      this.gameoverBankTotal = document.getElementById('gameoverBankTotal');
      this.equippedCostumeName = document.getElementById('equippedCostumeName');

      // Avatar canvas preview
      this.avatarCanvas = document.getElementById('avatarCanvas');
      this.avatarCtx = this.avatarCanvas ? this.avatarCanvas.getContext('2d') : null;
      this.avatarAnimTime = 0;

      this.menuBestScore.textContent = this.bestScore;
      this.updateBankDisplays();

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

    loadBankCoins() {
      try {
        const val = localStorage.getItem(COINS_STORAGE_KEY);
        // Start new players with 150 welcome coins to experience the Armory immediately
        return val !== null ? parseInt(val, 10) || 0 : 150;
      } catch (e) {
        return 150;
      }
    }

    saveBankCoins(coins) {
      try {
        localStorage.setItem(COINS_STORAGE_KEY, String(coins));
      } catch (e) {}
    }

    loadUnlockedCostumes() {
      try {
        const val = localStorage.getItem(COSTUMES_STORAGE_KEY);
        if (val) {
          const arr = JSON.parse(val);
          if (Array.isArray(arr) && arr.length) return arr;
        }
      } catch (e) {}
      return ['neo'];
    }

    saveUnlockedCostumes(arr) {
      try {
        localStorage.setItem(COSTUMES_STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    }

    loadEquippedCostume() {
      try {
        const val = localStorage.getItem(EQUIPPED_STORAGE_KEY);
        if (val && COSTUMES[val]) return val;
      } catch (e) {}
      return 'neo';
    }

    saveEquippedCostume(id) {
      try {
        localStorage.setItem(EQUIPPED_STORAGE_KEY, id);
      } catch (e) {}
    }

    loadUpgrades() {
      try {
        const val = localStorage.getItem(UPGRADES_STORAGE_KEY);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            return {
              magnet: parsed.magnet || 1,
              multiplier: parsed.multiplier || 1,
              shield: parsed.shield || 0
            };
          }
        }
      } catch (e) {}
      return { magnet: 1, multiplier: 1, shield: 0 };
    }

    saveUpgrades(upgrades) {
      try {
        localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(upgrades));
      } catch (e) {}
    }

    updateBankDisplays() {
      if (this.menuCoinBank) this.menuCoinBank.textContent = this.bankCoins;
      if (this.shopCoinBank) this.shopCoinBank.textContent = this.bankCoins;
      if (this.gameoverBankTotal) this.gameoverBankTotal.textContent = this.bankCoins;
      if (this.equippedCostumeName) {
        const current = COSTUMES[this.equippedCostume] || COSTUMES.neo;
        this.equippedCostumeName.textContent = current.name;
      }
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
      this.prevThemeIndex = index;
      this.themeIndex = index;
      this.themeBlend = 1;
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

      const currentCostume = COSTUMES[this.equippedCostume] || COSTUMES.neo;
      this.player = new Player(currentCostume);
      this.track = new TrackManager();
      this.collectibles = new CollectibleManager();

      // Retrieve player's upgraded stats
      const magnetLevel = this.upgrades.magnet || 1;
      const magnetConf = UPGRADES.magnet.levels[magnetLevel - 1] || UPGRADES.magnet.levels[0];

      const multiplierLevel = this.upgrades.multiplier || 1;
      const multiplierConf = UPGRADES.multiplier.levels[multiplierLevel - 1] || UPGRADES.multiplier.levels[0];

      const shieldLevel = this.upgrades.shield || 0;
      const shieldConf = UPGRADES.shield.levels[shieldLevel] || UPGRADES.shield.levels[0];

      this.track.onObstacleSpawned = (o) => this.collectibles.onObstacleSpawned(o);
      this.track.reset();
      this.collectibles.reset(shieldConf.shields, magnetConf.duration, magnetConf.radius, multiplierConf.duration);

      // Maintain user's chosen background
      this.themeIndex = this.selectedBgIndex;
      this.prevThemeIndex = this.selectedBgIndex;
      this.themeBlend = 1;
      this.themeTimer = 0;
    }

    getScore() {
      return Math.floor(this.distance / 10) + this.collectibles.coinScore;
    }

    /* ---------------- ARMORY SHOP SYSTEM ---------------- */
    attachButtonAction(elementOrId, callback) {
      const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
      if (!el) return;
      let lastTrigger = 0;
      const handler = (e) => {
        const now = Date.now();
        if (now - lastTrigger < 250) return; // Prevent double-trigger from touch+click
        lastTrigger = now;
        if (e && e.cancelable && e.type !== 'click') e.preventDefault();
        try {
          callback(e);
        } catch (err) {
          console.error('[ButtonAction Error]', err);
        }
      };
      el.addEventListener('click', handler);
      el.addEventListener('touchend', handler);
    }

    flashInsufficientFunds(btn, needed) {
      if (!btn) return;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `NEED 🪙 +${needed}`;
      btn.classList.add('flash-warn');
      const shopBank = document.getElementById('shopCoinBank');
      if (shopBank) {
        shopBank.classList.add('flash-warn-pill');
        setTimeout(() => shopBank.classList.remove('flash-warn-pill'), 1200);
      }
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('flash-warn');
      }, 1300);
    }

    renderCostumesList() {
      const container = document.getElementById('costumesList');
      if (!container) return;
      container.innerHTML = '';

      for (const suit of Object.values(COSTUMES)) {
        const isUnlocked = this.unlockedCostumes.includes(suit.id);
        const isEquipped = this.equippedCostume === suit.id;

        const card = document.createElement('div');
        card.className = `costume-item-card ${isEquipped ? 'equipped' : ''}`;

        const left = document.createElement('div');
        left.className = 'costume-info-left';

        const orb = document.createElement('div');
        orb.className = 'costume-avatar-orb';
        orb.style.background = suit.swatch;

        const text = document.createElement('div');
        text.className = 'costume-text';
        text.innerHTML = `<span class="costume-name">${suit.name}</span><span class="costume-desc">${suit.desc}</span>`;

        left.appendChild(orb);
        left.appendChild(text);
        card.appendChild(left);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shop-action-btn';

        if (isEquipped) {
          btn.classList.add('equipped-btn');
          btn.textContent = 'EQUIPPED';
        } else if (isUnlocked) {
          btn.classList.add('equip-btn');
          btn.textContent = 'EQUIP';
          this.attachButtonAction(btn, () => this.equipCostume(suit.id));
        } else {
          btn.classList.add('buy-btn');
          const hasCoins = this.bankCoins >= suit.price;
          btn.innerHTML = `BUY 🪙 ${suit.price}`;
          if (!hasCoins) {
            btn.classList.add('btn-locked');
          }
          this.attachButtonAction(btn, () => {
            if (this.bankCoins < suit.price) {
              this.flashInsufficientFunds(btn, suit.price - this.bankCoins);
              return;
            }
            this.buyCostume(suit.id);
          });
        }

        card.appendChild(btn);
        container.appendChild(card);
      }
    }

    buyCostume(suitId) {
      const suit = COSTUMES[suitId];
      if (!suit || this.bankCoins < suit.price) return;

      this.bankCoins -= suit.price;
      if (!this.unlockedCostumes.includes(suitId)) {
        this.unlockedCostumes.push(suitId);
      }
      this.equippedCostume = suitId;
      if (this.player) {
        this.player.costume = suit;
      }

      this.saveBankCoins(this.bankCoins);
      this.saveUnlockedCostumes(this.unlockedCostumes);
      this.saveEquippedCostume(this.equippedCostume);

      try { SoundSystem.buy(); } catch (e) {}
      this.updateBankDisplays();
      this.renderCostumesList();
    }

    equipCostume(suitId) {
      if (!this.unlockedCostumes.includes(suitId)) return;
      this.equippedCostume = suitId;
      if (this.player) {
        this.player.costume = COSTUMES[suitId] || COSTUMES.neo;
      }
      this.saveEquippedCostume(suitId);

      try { SoundSystem.equip(); } catch (e) {}
      this.updateBankDisplays();
      this.renderCostumesList();
    }

    renderUpgradesList() {
      const container = document.getElementById('upgradesList');
      if (!container) return;
      container.innerHTML = '';

      for (const [id, upDef] of Object.entries(UPGRADES)) {
        const currLevel = this.upgrades[id] || (id === 'shield' ? 0 : 1);
        const isMax = currLevel >= upDef.maxLevel;

        const card = document.createElement('div');
        card.className = 'upgrade-item-card';

        const left = document.createElement('div');
        left.className = 'upgrade-info-left';

        const iconBox = document.createElement('div');
        iconBox.className = 'upgrade-icon-box';
        iconBox.textContent = upDef.icon;

        const text = document.createElement('div');
        text.className = 'upgrade-text';

        // Title row with level pips
        const titleRow = document.createElement('div');
        titleRow.className = 'upgrade-title-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'upgrade-name';
        nameSpan.textContent = upDef.name;

        const pipsWrap = document.createElement('div');
        pipsWrap.className = 'upgrade-level-pips';
        for (let i = 1; i <= upDef.maxLevel; i++) {
          const pip = document.createElement('span');
          pip.className = `level-pip ${i <= currLevel ? 'filled' : ''}`;
          pipsWrap.appendChild(pip);
        }

        titleRow.appendChild(nameSpan);
        titleRow.appendChild(pipsWrap);

        const descSpan = document.createElement('span');
        descSpan.className = 'upgrade-desc';

        const currentConf = id === 'shield' ? upDef.levels[currLevel] : upDef.levels[currLevel - 1];
        const nextConf = !isMax ? (id === 'shield' ? upDef.levels[currLevel + 1] : upDef.levels[currLevel]) : null;

        if (isMax) {
          descSpan.textContent = `MAX: ${currentConf.desc}`;
        } else {
          descSpan.textContent = `Next: ${nextConf.desc}`;
        }

        text.appendChild(titleRow);
        text.appendChild(descSpan);
        left.appendChild(iconBox);
        left.appendChild(text);
        card.appendChild(left);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'upgrade-btn';

        if (isMax) {
          btn.classList.add('max-btn');
          btn.textContent = 'MAX LEVEL';
        } else {
          btn.innerHTML = `UPGRADE 🪙 ${nextConf.cost}`;
          const hasCoins = this.bankCoins >= nextConf.cost;
          if (!hasCoins) {
            btn.classList.add('btn-locked');
          }
          this.attachButtonAction(btn, () => {
            if (this.bankCoins < nextConf.cost) {
              this.flashInsufficientFunds(btn, nextConf.cost - this.bankCoins);
              return;
            }
            this.buyUpgrade(id);
          });
        }

        card.appendChild(btn);
        container.appendChild(card);
      }
    }

    buyUpgrade(upgradeId) {
      const upDef = UPGRADES[upgradeId];
      if (!upDef) return;

      const currLevel = this.upgrades[upgradeId] || (upgradeId === 'shield' ? 0 : 1);
      if (currLevel >= upDef.maxLevel) return;

      const nextConf = upgradeId === 'shield' ? upDef.levels[currLevel + 1] : upDef.levels[currLevel];
      if (!nextConf || this.bankCoins < nextConf.cost) return;

      this.bankCoins -= nextConf.cost;
      this.upgrades[upgradeId] = currLevel + 1;

      this.saveBankCoins(this.bankCoins);
      this.saveUpgrades(this.upgrades);

      if (this.collectibles) {
        if (upgradeId === 'magnet') {
          this.collectibles.magnetDuration = nextConf.duration;
          this.collectibles.magnetRadius = nextConf.radius;
        } else if (upgradeId === 'multiplier') {
          this.collectibles.multiplierDuration = nextConf.duration;
        } else if (upgradeId === 'shield') {
          this.collectibles.shieldCharges = Math.max(this.collectibles.shieldCharges, nextConf.shields);
        }
      }

      try { SoundSystem.buy(); } catch (e) {}
      this.updateBankDisplays();
      this.renderUpgradesList();
    }

    /* ---------------- AVATAR PREVIEW (PEDESTAL) ---------------- */
    renderAvatarPreview(dt) {
      if (!this.avatarCtx || !this.avatarCanvas) return;
      this.avatarAnimTime += dt;

      const actx = this.avatarCtx;
      actx.clearRect(0, 0, this.avatarCanvas.width, this.avatarCanvas.height);

      const suit = COSTUMES[this.equippedCostume] || COSTUMES.neo;
      // Draw running/breathing humanoid runner in center of canvas
      drawHumanoidRunner(
        actx,
        this.avatarCanvas.width / 2,
        this.avatarCanvas.height - 24,
        this.avatarAnimTime,
        false,
        false,
        0,
        0,
        suit,
        0,
        false
      );
    }

    initEventListeners() {
      // Menu Play: Start Game
      this.attachButtonAction('playBtn', () => {
        try {
          SoundSystem.ensure();
          SoundSystem.startBgm();
        } catch (e) {
          console.warn('[Audio] Failed to start on play:', e);
        }
        this.resetRun();
        this.setState(GameStates.PLAYING);
      });

      // Settings Modal Open/Close
      const settingsModal = this.settingsModal;
      this.attachButtonAction('menuSettingsBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        if (settingsModal) settingsModal.classList.remove('hidden');
      });
      this.attachButtonAction('closeSettingsBtn', () => {
        if (settingsModal) settingsModal.classList.add('hidden');
      });
      this.attachButtonAction('applySettingsBtn', () => {
        if (settingsModal) settingsModal.classList.add('hidden');
      });

      // Shop Modal Open/Close
      const shopModal = this.shopModal;
      const openShop = () => {
        try { SoundSystem.ensure(); } catch (e) {}
        this.renderCostumesList();
        this.renderUpgradesList();
        this.updateBankDisplays();
        if (shopModal) shopModal.classList.remove('hidden');
      };
      this.attachButtonAction('menuShopBtn', openShop);
      this.attachButtonAction('gameoverShopBtn', openShop);

      const closeShop = () => {
        if (shopModal) shopModal.classList.add('hidden');
        this.updateBankDisplays();
      };
      this.attachButtonAction('closeShopBtn', closeShop);
      this.attachButtonAction('leaveShopBtn', closeShop);

      // Scoped Modal Tabs (Each modal controls its own tabs independently)
      document.querySelectorAll('.modal-panel').forEach(panel => {
        const tabs = panel.querySelectorAll('.modal-nav-tabs .tab-btn');
        tabs.forEach(btn => {
          this.attachButtonAction(btn, () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const contents = panel.querySelectorAll('.tab-content');
            contents.forEach(c => {
              if (c.id === targetId) c.classList.remove('hidden');
              else c.classList.add('hidden');
            });
          });
        });
      });

      // Audio volume & toggle controls in Settings
      const bgmToggle = document.getElementById('settingsBgmToggle');
      const bgmSlider = document.getElementById('settingsBgmSlider');
      if (bgmToggle && bgmSlider) {
        this.attachButtonAction(bgmToggle, () => {
          const active = SoundSystem.toggleBgm();
          bgmToggle.textContent = active ? 'ON' : 'OFF';
          if (active) bgmToggle.classList.add('active');
          else bgmToggle.classList.remove('active');
        });
        bgmSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) / 100;
          SoundSystem.setBgmVolume(val);
        });
      }

      const sfxToggle = document.getElementById('settingsSfxToggle');
      const sfxSlider = document.getElementById('settingsSfxSlider');
      if (sfxToggle && sfxSlider) {
        this.attachButtonAction(sfxToggle, () => {
          const active = SoundSystem.toggleSfx();
          sfxToggle.textContent = active ? 'ON' : 'OFF';
          if (active) sfxToggle.classList.add('active');
          else sfxToggle.classList.remove('active');
        });
        sfxSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) / 100;
          SoundSystem.setSfxVolume(val);
        });
      }

      // Pause / Resume
      this.attachButtonAction('pauseBtn', () => {
        if (this.state === GameStates.PLAYING) this.setState(GameStates.PAUSED);
      });
      this.attachButtonAction('resumeBtn', () => {
        this.setState(GameStates.PLAYING);
      });
      this.attachButtonAction('quitBtn', () => {
        try { SoundSystem.stopBgm(); } catch (e) {}
        this.setState(GameStates.MENU);
      });

      // Game Over buttons
      this.attachButtonAction('restartBtn', () => {
        try {
          SoundSystem.ensure();
          SoundSystem.startBgm();
        } catch (e) {}
        this.resetRun();
        this.setState(GameStates.PLAYING);
      });
      this.attachButtonAction('menuBtn', () => {
        try { SoundSystem.stopBgm(); } catch (e) {}
        this.setState(GameStates.MENU);
      });

      // Audio toggles in HUD
      const muteBtn = document.getElementById('muteBtn');
      if (muteBtn) {
        this.attachButtonAction(muteBtn, () => {
          const active = SoundSystem.toggleSfx();
          muteBtn.textContent = active ? '🔊' : '🔇';
        });
      }

      const bgmBtn = document.getElementById('bgmBtn');
      if (bgmBtn) {
        this.attachButtonAction(bgmBtn, () => {
          const active = SoundSystem.toggleBgm();
          bgmBtn.textContent = active ? '🎵' : '🔇';
        });
      }

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

      // 3-Choice Background Selector buttons (Direct + Delegated with touch debounce)
      for (let i = 0; i < THEMES.length; i++) {
        const btn = document.getElementById(`bgBtn${i}`);
        if (btn) {
          this.attachButtonAction(btn, () => {
            try {
              SoundSystem.ensure();
              SoundSystem.equip();
            } catch (e) {}
            this.selectBackground(i);
          });
        }
      }

      const bgOptionsContainer = document.getElementById('bgOptions');
      if (bgOptionsContainer) {
        this.attachButtonAction(bgOptionsContainer, (e) => {
          const btn = e.target.closest('.bg-option-btn');
          if (btn && btn.hasAttribute('data-bg')) {
            const idx = parseInt(btn.getAttribute('data-bg'), 10);
            if (!isNaN(idx)) {
              try {
                SoundSystem.ensure();
                SoundSystem.equip();
              } catch (err) {}
              this.selectBackground(idx);
            }
          }
        });
      }

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
        this.updateBankDisplays();
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
        this.updateBankDisplays();
        this.gameOverScreen.classList.remove('hidden');
      }
    }

    checkCollisions() {
      if (this.state !== GameStates.PLAYING) return;
      if (!this.player || !this.track) return;

      const playerFeet = GROUND_Y - this.player.jumpHeight;
      const playerHead = playerFeet - (this.player.sliding ? this.player.slideHeight : this.player.height);
      const playerLeft = this.player.x - 20;
      const playerRight = this.player.x + 20;

      for (const o of this.track.obstacles) {
        if (o.hit) continue;

        // Broad vertical culling: ignore obstacles far above or far below the player
        if (o.y < GROUND_Y - 140 || o.y - o.h > GROUND_Y + 60) continue;

        // Horizontal body collision check (accurate whether in lane or during lateral dash)
        const obsLeft = o.x - o.w / 2 + 10;
        const obsRight = o.x + o.w / 2 - 10;
        const overlapX = playerRight > obsLeft && playerLeft < obsRight;
        if (!overlapX) continue;

        // Obstacle-specific vertical intersection & evasion mechanics
        let collided = false;

        if (o.type.id === 'LOW') {
          // Electric Barrier (h: 44, requires JUMP)
          const barrierTop = o.y - o.h;
          const barrierBottom = o.y;

          // Contact with low ground barrier
          const overlapY = (playerFeet > barrierTop + 4) && (playerHead < barrierBottom);
          const clearedJump = this.player.jumping && (this.player.jumpHeight >= o.h * 0.72);

          if (overlapY && !clearedJump) {
            collided = true;
          }
        } else if (o.type.id === 'HIGH') {
          // Laser Gate (h: 110, gap: 48, requires SLIDE)
          const solidBeamTop = o.y - o.h;
          const solidBeamBottom = o.y - o.type.gap; // o.y - 48

          // Contact with overhead lethal beam
          const overlapBeam = (playerFeet > solidBeamTop) && (playerHead < solidBeamBottom);
          const safelySliding = this.player.sliding && (this.player.jumpHeight <= 5);

          if (overlapBeam && !safelySliding) {
            collided = true;
          }
        } else {
          // BLOCK Monolith (Full solid pillar, cannot be jumped or slid under)
          const blockTop = o.y - o.h;
          const blockBottom = o.y;
          const overlapBlock = (playerFeet > blockTop + 4) && (playerHead < blockBottom);

          if (overlapBlock) {
            collided = true;
          }
        }

        if (collided) {
          o.hit = true;

          // Shield absorption
          if (this.collectibles.shieldCharges > 0) {
            this.collectibles.shieldCharges--;
            try { SoundSystem.shieldBreak(); } catch (e) {}
            ScreenShake.trigger(10, 0.3);
            this.particles.burst(o.x, o.y - o.h / 2, '#06d6a0', 24);
            this.particles.spawnText(this.player.x, GROUND_Y - 100, 'SHIELD BROKEN', '#ff3366');
            this.track.obstacles = this.track.obstacles.filter(item => item !== o);
          } else {
            // Fatal Crash -> Runner dies immediately
            this.gameOver();
            return;
          }
        }
      }
    }

    gameOver() {
      try {
        SoundSystem.stopBgm();
        SoundSystem.crash();
      } catch (e) {
        console.warn('[Audio] Crash SFX error:', e);
      }
      ScreenShake.trigger(20, 0.5);
      this.particles.burst(this.player.x, GROUND_Y - this.player.height / 2, '#ff3366', 36, 120, 360);

      // Deposit collected coins into bank
      const earned = this.collectibles.coinCount;
      this.bankCoins += earned;
      this.saveBankCoins(this.bankCoins);

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

      try {
        // Gentle ambient updates when on menu
        if (this.state !== GameStates.PLAYING) {
          this.distance += 40 * dt;
          this.parallax.update(dt, 0.4);
          this.updateTheme(dt);
          this.particles.update(dt);
          ScreenShake.update(dt);
          this.renderAvatarPreview(dt);
        }

        this.update(dt);
        this.draw();
      } catch (err) {
        console.error('[Game Loop Error]', err);
      }

      requestAnimationFrame(t => this.loop(t));
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      new GameApp();
    });
  } else {
    new GameApp();
  }
})();
