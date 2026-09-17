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
     3D PERSPECTIVE CONFIGURATION (SUBWAY RUNNER PROJECTION)
     ============================================================ */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const DESIGN_WIDTH = 480;
  const DESIGN_HEIGHT = 800;
  const LANE_COUNT = 3;

  // 3D Perspective Camera & World Constants
  const VP_X = DESIGN_WIDTH / 2;     // Horizon Vanishing Point X (240)
  const VP_Y = 270;                  // Horizon Vanishing Point Y (270)
  const GROUND_Y = 720;              // Camera Foreground Road Y (720)
  const ROAD_WIDTH_FG = 440;         // Road width at foreground (440)
  const ROAD_WIDTH_BG = 54;          // Road width at horizon (54)
  const FOCAL_LENGTH = 280;          // Perspective projection focal length
  const Z_SPAWN = 950;               // Distance where obstacles spawn at horizon
  const PLAYER_Z = 110;              // Fixed 3D camera chase depth of the player runner

  // 3D Perspective Projection Function
  function project3D(laneNorm, z, heightOffset = 0) {
    const scale = FOCAL_LENGTH / (Math.max(8, z) + FOCAL_LENGTH);
    const roadW = ROAD_WIDTH_FG * scale;
    const laneSpan = roadW / LANE_COUNT;
    const screenX = VP_X + laneNorm * laneSpan;
    const screenY = VP_Y + (GROUND_Y - VP_Y) * scale - heightOffset * scale;
    return { x: screenX, y: screenY, scale, roadW, laneSpan };
  }

  function laneX(lane) {
    const norm = lane - 1; // 0 -> -1, 1 -> 0, 2 -> 1
    return project3D(norm, PLAYER_Z).x;
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

    // Ultra-smooth mobile optimization:
    // Clamp DPR to 1.35x on mobile (prevents 9x pixel fill-rate lag and WebGL/canvas OOM crashes)
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (winW < 650);
    const maxDpr = isMobile ? 1.35 : 1.75;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(DESIGN_WIDTH * dpr);
    canvas.height = Math.round(DESIGN_HEIGHT * dpr);
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
     ZONES / SUBWAY WORLDS (3 VIBRANT MULTI-COLOR THEMES)
     ============================================================ */
  const THEMES = [
    {
      id: 'subway_classic',
      name: 'SUBWAY CITY CLASSIC',
      flag: '🚇',
      type: 'classic',
      sky: ['#0f172a', '#1e3a8a', '#0284c7'],
      ground: '#1e293b',
      rails: '#f8fafc',
      ties: '#334155',
      ballast: '#64748b',
      grid: '#38bdf8',
      building: '#090d16',
      accent: '#fde047',
      celestial: 'sun',
      horizonGlow: 'rgba(56, 189, 248, 0.7)',
      isBright: true
    },
    {
      id: 'tokyo_food',
      name: 'TOKYO FOOD STREET',
      flag: '🐙',
      type: 'tokyo',
      sky: ['#1e143b', '#701a75', '#db2777'],
      ground: '#18112c',
      rails: '#f8fafc',
      ties: '#3b0764',
      ballast: '#475569',
      grid: '#db2777',
      building: '#110b20',
      accent: '#facc15',
      celestial: 'moon',
      horizonGlow: 'rgba(219, 39, 119, 0.65)',
      isBright: true
    },
    {
      id: 'wild_west',
      name: 'WILD WEST CANYON',
      flag: '🤠',
      type: 'western',
      sky: ['#431407', '#9a3412', '#fb923c'],
      ground: '#3a1708',
      rails: '#fef08a',
      ties: '#78350f',
      ballast: '#7c2d12',
      grid: '#f97316',
      building: '#271005',
      accent: '#fde047',
      celestial: 'sun',
      horizonGlow: 'rgba(251, 146, 60, 0.75)',
      isBright: true
    },
    {
      id: 'rio_beach',
      name: 'RIO CARNIVAL BEACH',
      flag: '🌴',
      type: 'rio',
      sky: ['#14532d', '#059669', '#34d399'],
      ground: '#064e3b',
      rails: '#fef08a',
      ties: '#065f46',
      ballast: '#047857',
      grid: '#10b981',
      building: '#022c22',
      accent: '#fbbf24',
      celestial: 'sun',
      horizonGlow: 'rgba(52, 211, 153, 0.7)',
      isBright: true
    },
    {
      id: 'cairo_pyramids',
      name: 'CAIRO PYRAMIDS',
      flag: '🐪',
      type: 'cairo',
      sky: ['#713f12', '#a16207', '#eab308'],
      ground: '#451a03',
      rails: '#fef08a',
      ties: '#78350f',
      ballast: '#b45309',
      grid: '#ca8a04',
      building: '#3b1704',
      accent: '#facc15',
      celestial: 'sun',
      horizonGlow: 'rgba(234, 179, 8, 0.8)',
      isBright: true
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

    burst(x, y, color, count = 12, speedMin = 80, speedMax = 260) {
      // Mobile performance: cap active particles
      if (this.particles.length > 32) return;
      const actualCount = Math.min(count, 14);
      for (let i = 0; i < actualCount; i++) {
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
      const signs = ['ラーメン', 'すし', 'TOKYO', 'SUBWAY', 'SURF', 'TAKO'];
      for (let i = 0; i < count; i++) {
        b.push({
          x: i * colWidth,
          w: colWidth * randRange(0.65, 0.92),
          h: randRange(minH, maxH),
          windows: Math.random() > 0.2,
          roofTrim: Math.random() > 0.35,
          neonSign: Math.random() > 0.5 ? signs[Math.floor(Math.random() * signs.length)] : null,
          signColor: ['#facc15', '#f43f5e', '#06b6d4', '#22c55e'][Math.floor(Math.random() * 4)]
        });
      }
      return b;
    }

    update(dt, speedRatio = 1) {
      this.time += dt;
      // Scroll speed wind streaks (subtle speed lines)
      for (const s of this.speedStreaks) {
        s.y += 420 * s.speed * speedRatio * dt;
        if (s.y > DESIGN_HEIGHT + s.len) {
          s.y = -s.len;
          s.x = randRange(10, DESIGN_WIDTH - 10);
        }
      }
    }

    render(ctx, distance, theme, buildingColor, gridColor, speedRatio = 1) {
      const isWestern = (theme && theme.type === 'western');

      // 1. Celestial Sun (Warm cartoon sun in both Tokyo & Wild West)
      this._renderCelestial(ctx, theme);

      // 2. Parallax Skyline: Tokyo Cartoon Skyscrapers or Western Sandstone Mesas
      if (isWestern) {
        // Multi-layered Red-Rock Sandstone Mesas in distance
        this._renderWesternMesas(ctx, distance);
      } else {
        // Tokyo Colorful City Skyline with Japanese Food Signs
        this._renderBuildings(ctx, this.farBuildings, distance * 0.1, 240, buildingColor, 0.45, gridColor);
        this._renderBuildings(ctx, this.midBuildings, distance * 0.25, 290, buildingColor, 0.75, gridColor);
      }

      // 3. Atmospheric Horizon Glow
      if (theme && theme.horizonGlow) {
        ctx.save();
        const hGrad = ctx.createLinearGradient(0, 210, 0, VP_Y + 40);
        hGrad.addColorStop(0, 'rgba(0,0,0,0)');
        hGrad.addColorStop(0.7, theme.horizonGlow);
        hGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hGrad;
        ctx.fillRect(0, 210, DESIGN_WIDTH, VP_Y - 170);
        ctx.restore();
      }

      // 4. Subtle Speed Streaks when running fast
      if (speedRatio > 1.15) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = clamp((speedRatio - 1.15) * 0.35, 0, 0.35);
        for (const s of this.speedStreaks) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x, s.y + s.len * 0.7);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    _renderCelestial(ctx, theme) {
      if (!theme) return;
      ctx.save();
      const isWestern = theme.type === 'western';

      if (isWestern) {
        // Bright Desert Sun
        const sunX = DESIGN_WIDTH * 0.72;
        const sunY = 120;
        const r = 38;
        // Outer warm heat halo
        const halo = ctx.createRadialGradient(sunX, sunY, r * 0.3, sunX, sunY, r * 2.4);
        halo.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
        halo.addColorStop(0.5, 'rgba(251, 146, 60, 0.35)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // Solid golden sun disc
        const sunGrad = ctx.createLinearGradient(sunX, sunY - r, sunX, sunY + r);
        sunGrad.addColorStop(0, '#ffffff');
        sunGrad.addColorStop(0.4, '#fef08a');
        sunGrad.addColorStop(1, '#f97316');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Tokyo Sunset Golden Hour Sun
        const sunX = DESIGN_WIDTH * 0.5;
        const sunY = 195;
        const r = 46;
        const halo = ctx.createRadialGradient(sunX, sunY, r * 0.2, sunX, sunY, r * 2.2);
        halo.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
        halo.addColorStop(0.4, 'rgba(244, 63, 94, 0.3)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r * 2.2, 0, Math.PI * 2);
        ctx.fill();

        const sunGrad = ctx.createLinearGradient(sunX, sunY - r, sunX, sunY + r);
        sunGrad.addColorStop(0, '#fffbeb');
        sunGrad.addColorStop(0.5, '#facc15');
        sunGrad.addColorStop(1, '#db2777');
        ctx.fillStyle = sunGrad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _renderWesternMesas(ctx, distance) {
      ctx.save();
      const period = DESIGN_WIDTH;
      // Far mesas
      const farShift = (distance * 0.06) % period;
      ctx.fillStyle = '#7c2d12';
      ctx.globalAlpha = 0.55;
      for (let r = -1; r <= 1; r++) {
        const ox = r * period - farShift;
        ctx.beginPath();
        ctx.moveTo(ox, VP_Y);
        ctx.lineTo(ox + 40, VP_Y - 65);
        ctx.lineTo(ox + 160, VP_Y - 65);
        ctx.lineTo(ox + 210, VP_Y);
        ctx.lineTo(ox + 260, VP_Y - 80);
        ctx.lineTo(ox + 390, VP_Y - 80);
        ctx.lineTo(ox + 440, VP_Y);
        ctx.closePath();
        ctx.fill();
      }

      // Mid mesas (warmer sandstone)
      const midShift = (distance * 0.16) % period;
      ctx.fillStyle = '#9a3412';
      ctx.globalAlpha = 0.85;
      for (let r = -1; r <= 1; r++) {
        const ox = r * period - midShift;
        ctx.beginPath();
        ctx.moveTo(ox + 60, VP_Y);
        ctx.lineTo(ox + 110, VP_Y - 45);
        ctx.lineTo(ox + 220, VP_Y - 45);
        ctx.lineTo(ox + 260, VP_Y);
        ctx.lineTo(ox + 310, VP_Y - 55);
        ctx.lineTo(ox + 420, VP_Y - 55);
        ctx.lineTo(ox + 460, VP_Y);
        ctx.closePath();
        ctx.fill();
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
          // Building silhouette
          ctx.fillRect(bx, baseY - b.h, b.w, b.h);

          // Roof antenna / pagoda trim
          if (b.roofTrim) {
            ctx.fillStyle = '#facc15';
            ctx.fillRect(bx + 4, baseY - b.h - 3, b.w - 8, 3);
            ctx.fillRect(bx + b.w / 2 - 1.5, baseY - b.h - 14, 3, 11);
            ctx.fillStyle = color;
          }

          // Glowing windows (warm cartoon yellow & fuchsia)
          if (b.windows) {
            ctx.fillStyle = '#fef08a';
            ctx.globalAlpha = alpha * 0.7;
            for (let wy = baseY - b.h + 14; wy < baseY - 12; wy += 18) {
              for (let wx = bx + 6; wx < bx + b.w - 8; wx += 12) {
                if (Math.sin(wx * 7 + wy * 13) > 0.1) {
                  ctx.fillRect(wx, wy, 6, 9);
                }
              }
            }
            ctx.fillStyle = color;
            ctx.globalAlpha = alpha;
          }

          // Japanese / Subway neon sign
          if (b.neonSign && b.w > 32) {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.font = '900 11px "Titan One", "Noto Sans JP", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = b.signColor || '#facc15';
            ctx.fillText(b.neonSign, bx + b.w / 2, baseY - b.h + 24);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
  }

  /* ============================================================
     SUBWAY SURFERS CHARACTERS & OUTFITS
     ============================================================ */
  const COSTUMES = {
    jake: {
      id: 'jake',
      name: 'JAKE',
      character: 'jake',
      price: 0,
      desc: 'The legendary Subway Surfer with backwards red cap, white hoodie & graffiti spray can!',
      cap: '#ef4444',
      hoodie: '#f8fafc',
      vest: '#2563eb',
      jeans: '#3b82f6',
      shoes: '#dc2626',
      skin: '#fed7aa',
      hair: '#78350f',
      accessory: 'spraycan',
      swatch: 'linear-gradient(135deg, #ef4444 0%, #f8fafc 50%, #2563eb 100%)'
    },
    tricky: {
      id: 'tricky',
      name: 'TRICKY',
      character: 'tricky',
      price: 100,
      desc: 'Smart skater girl with cute blonde pigtails, sky-blue beanie & green cargo pants!',
      cap: '#0284c7',
      hoodie: '#ffffff',
      vest: '#f43f5e',
      jeans: '#16a34a',
      shoes: '#ffffff',
      skin: '#fed7aa',
      hair: '#facc15',
      accessory: 'skateboard',
      swatch: 'linear-gradient(135deg, #0284c7 0%, #facc15 50%, #16a34a 100%)'
    },
    fresh: {
      id: 'fresh',
      name: 'FRESH',
      character: 'fresh',
      price: 200,
      desc: 'Cool music lover with high-top fade haircut, retro shades & 80s boombox stereo!',
      cap: '#1e1b4b',
      hoodie: '#22c55e',
      vest: '#eab308',
      jeans: '#dc2626',
      shoes: '#ffffff',
      skin: '#78350f',
      hair: '#0f172a',
      accessory: 'boombox',
      swatch: 'linear-gradient(135deg, #22c55e 0%, #dc2626 50%, #fde047 100%)'
    },
    spike: {
      id: 'spike',
      name: 'SPIKE',
      character: 'spike',
      price: 350,
      desc: 'Rockstar rebel with bright red punk mohawk, black leather vest & skate kicks!',
      cap: '#ef4444',
      hoodie: '#1e293b',
      vest: '#f59e0b',
      jeans: '#2563eb',
      shoes: '#000000',
      skin: '#fed7aa',
      hair: '#ef4444',
      accessory: 'guitar',
      swatch: 'linear-gradient(135deg, #ef4444 0%, #1e293b 50%, #f59e0b 100%)'
    },
    yutani: {
      id: 'yutani',
      name: 'YUTANI',
      character: 'yutani',
      price: 500,
      desc: 'Genius inventor kid in her iconic green alien mascot suit with cute big eyes!',
      cap: '#22c55e',
      hoodie: '#16a34a',
      vest: '#a855f7',
      jeans: '#15803d',
      shoes: '#a855f7',
      skin: '#86efac',
      hair: '#22c55e',
      accessory: 'gadget',
      swatch: 'linear-gradient(135deg, #22c55e 0%, #a855f7 50%, #fde047 100%)'
    }
  };

  // Backwards compatibility aliases for saved profiles
  COSTUMES.neo = COSTUMES.jake;
  COSTUMES.ninja = COSTUMES.tricky;
  COSTUMES.rebel = COSTUMES.fresh;
  COSTUMES.apex = COSTUMES.spike;
  COSTUMES.titan = COSTUMES.yutani;

  /* ============================================================
     TECH UPGRADES SYSTEM
     ============================================================ */
  const UPGRADES = {
    magnet: {
      id: 'magnet',
      name: 'Coin Magnet',
      icon: '🧲',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 8, radius: 160, cost: 0, desc: '8s duration, standard pull' },
        { level: 2, duration: 12, radius: 190, cost: 80, desc: '12s duration, +20% reach' },
        { level: 3, duration: 16, radius: 220, cost: 160, desc: '16s duration, +40% reach' },
        { level: 4, duration: 20, radius: 260, cost: 300, desc: '20s duration, hyper pull' }
      ]
    },
    multiplier: {
      id: 'multiplier',
      name: '2X Multiplier',
      icon: '⭐',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 10, cost: 0, desc: '10s duration of 2X score' },
        { level: 2, duration: 15, cost: 100, desc: '15s duration of 2X score' },
        { level: 3, duration: 20, cost: 200, desc: '20s duration of 2X score' },
        { level: 4, duration: 25, cost: 350, desc: '25s duration of 2X score' }
      ]
    },
    jetpack: {
      id: 'jetpack',
      name: 'Paint Jetpack',
      icon: '🚀',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 8, cost: 0, desc: '8s sky flight above tracks' },
        { level: 2, duration: 11, cost: 120, desc: '11s sky flight + extra coins' },
        { level: 3, duration: 14, cost: 220, desc: '14s sky flight + extra coins' },
        { level: 4, duration: 18, cost: 400, desc: '18s extended sky flight' }
      ]
    },
    sneakers: {
      id: 'sneakers',
      name: 'Super Sneakers',
      icon: '👟',
      maxLevel: 4,
      levels: [
        { level: 1, duration: 12, cost: 0, desc: '12s high bounce over trains' },
        { level: 2, duration: 16, cost: 100, desc: '16s high bounce duration' },
        { level: 3, duration: 20, cost: 180, desc: '20s high bounce duration' },
        { level: 4, duration: 25, cost: 300, desc: '25s high bounce duration' }
      ]
    },
    hoverboard: {
      id: 'hoverboard',
      name: 'Hoverboard Supply',
      icon: '🛹',
      maxLevel: 4,
      levels: [
        { level: 1, stock: 3, cost: 0, desc: 'Start runs with 3 hoverboards' },
        { level: 2, stock: 6, cost: 150, desc: 'Start runs with 6 hoverboards' },
        { level: 3, stock: 10, cost: 250, desc: 'Start runs with 10 hoverboards' },
        { level: 4, stock: 15, cost: 450, desc: 'Start runs with 15 hoverboards' }
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
     DAILY MISSIONS & CHALLENGES DATA
     ============================================================ */
  const MISSIONS_DATA = [
    { id: 'm_coins_100', title: 'Collect 100 Coins in one run', icon: '🪙', type: 'single_coins', target: 100, rewardCoins: 150, rewardMult: 0 },
    { id: 'm_jumps_15', title: 'Jump 15 times over tracks', icon: '🏃', type: 'jumps', target: 15, rewardCoins: 150, rewardMult: 0 },
    { id: 'm_slides_10', title: 'Roll or slide 10 times', icon: '👟', type: 'slides', target: 10, rewardCoins: 150, rewardMult: 0 },
    { id: 'm_trains_3', title: 'Climb on top of 3 trains', icon: '🚂', type: 'trains', target: 3, rewardCoins: 250, rewardMult: 1 },
    { id: 'm_powerups_2', title: 'Pick up 2 Power-ups', icon: '⚡', type: 'powerups', target: 2, rewardCoins: 200, rewardMult: 0 },
    { id: 'm_score_5k', title: 'Reach 5,000 Score in one run', icon: '🏆', type: 'score', target: 5000, rewardCoins: 300, rewardMult: 1 },
    { id: 'm_coins_300', title: 'Collect 300 Coins in one run', icon: '🪙', type: 'single_coins', target: 300, rewardCoins: 350, rewardMult: 1 },
    { id: 'm_hoverboard_1', title: 'Activate Hoverboard once', icon: '🛹', type: 'hoverboard', target: 1, rewardCoins: 200, rewardMult: 0 }
  ];

  /* ============================================================
     AUTHENTIC SUBWAY SURFERS 3D CARTOON RUNNER RENDER PIPELINE
     ============================================================ */
  function drawHumanoidRunner(ctx, cx, groundY, animTime, isJumping, isSliding, jumpHeight, tilt, costume, squash, hasShield, scaleFactor = 1.0, baseHeight = 0, isFrontView = false, activeBuffs = {}) {
    try {
      const c = costume || COSTUMES.jake;
      ctx.save();
      ctx.translate(cx, groundY);
      if (scaleFactor && scaleFactor !== 1.0) {
        ctx.scale(scaleFactor, scaleFactor);
      }
      if (tilt) ctx.rotate(tilt);

      // Surface elevation: train roof, ramp or jetpack sky flight
      if (baseHeight > 0) {
        ctx.translate(0, -baseHeight);
      }

      // 1. Soft Cartoon Ground / Roof Shadow
      if (jumpHeight !== undefined && (!activeBuffs || !activeBuffs.jetpack)) {
        ctx.save();
        const shadowScale = clamp(1 - (jumpHeight || 0) / 260, 0.25, 1);
        ctx.globalAlpha = 0.45 * shadowScale;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        const sw = Math.max(5, 26 * shadowScale);
        const sh = Math.max(2, 7 * shadowScale);
        ctx.ellipse(0, 4, sw, sh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Lift body by jumpHeight
      ctx.translate(0, -(jumpHeight || 0));

      // 2. ACTIVE HOVERBOARD UNDER RUNNER'S FEET
      if (activeBuffs && activeBuffs.hoverboard && !isFrontView) {
        ctx.save();
        ctx.translate(0, 3);
        const hbGrad = ctx.createLinearGradient(-24, 0, 24, 0);
        hbGrad.addColorStop(0, '#06b6d4');
        hbGrad.addColorStop(0.5, '#facc15');
        hbGrad.addColorStop(1, '#ec4899');
        ctx.fillStyle = hbGrad;
        ctx.beginPath();
        ctx.roundRect(-24, -4, 48, 8, [4, 4, 4, 4]);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Hover thruster neon glow
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.ellipse(0, 5, 26, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 3. ACTIVE JETPACK ON RUNNER'S BACK
      if (activeBuffs && activeBuffs.jetpack && !isFrontView) {
        ctx.save();
        ctx.translate(0, -32);
        // Dual chrome canisters
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(-16, -10, 10, 22, [4, 4, 2, 2]);
        ctx.roundRect(6, -10, 10, 22, [4, 4, 2, 2]);
        ctx.fill();
        // Red hazard stripes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-16, -2, 10, 4);
        ctx.fillRect(6, -2, 10, 4);
        // Nozzles
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-15, 12, 8, 4);
        ctx.fillRect(7, 12, 8, 4);
        // Rainbow thruster smoke & flames
        const flameL = 18 + Math.sin(animTime * 25) * 8;
        const flameGrad = ctx.createLinearGradient(0, 14, 0, 14 + flameL);
        flameGrad.addColorStop(0, '#facc15');
        flameGrad.addColorStop(0.5, '#f97316');
        flameGrad.addColorStop(1, '#ec4899');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-15, 16); ctx.lineTo(-11, 16 + flameL); ctx.lineTo(-7, 16);
        ctx.moveTo(7, 16); ctx.lineTo(11, 16 + flameL); ctx.lineTo(15, 16);
        ctx.fill();
        ctx.restore();
      }

      // 4. ACTIVE SUPER SNEAKERS (Golden Wings on Shoes)
      if (activeBuffs && activeBuffs.sneakers && !isFrontView) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.fillStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        // Left shoe wing
        ctx.beginPath();
        ctx.moveTo(-16, 26); ctx.lineTo(-26, 18); ctx.lineTo(-20, 26);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Right shoe wing
        ctx.beginPath();
        ctx.moveTo(16, 26); ctx.lineTo(26, 18); ctx.lineTo(20, 26);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }

      // Shield Aura
      if (hasShield) {
        ctx.save();
        ctx.translate(0, -42);
        const pulse = Math.sin(animTime * 6) * 3;
        const r = 40 + pulse;
        ctx.strokeStyle = '#06d6a0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(6, 214, 160, 0.18)';
        ctx.fill();
        ctx.restore();
      }

      const capCol = c.cap || '#ef4444';
      const hoodieCol = c.hoodie || '#f8fafc';
      const vestCol = c.vest || '#2563eb';
      const jeansCol = c.jeans || '#3b82f6';
      const shoesCol = c.shoes || '#dc2626';
      const skinCol = c.skin || '#fed7aa';
      const hairCol = c.hair || '#78350f';

      // ============================================================
      // A. FRONT-FACING HEROIC POSE (FOR HOME SCREEN / MENU)
      // ============================================================
      if (isFrontView) {
        const breath = Math.sin(animTime * 3) * 2;
        ctx.save();
        ctx.translate(0, -42 + breath);

        // --- SUBWAY SURFERS HOVERBOARD / SKATEBOARD STANDING BESIDE JAKE ---
        ctx.save();
        ctx.translate(34, 10);
        ctx.rotate(0.12);
        // Deck body
        const boardGrad = ctx.createLinearGradient(-7, -42, 7, 36);
        boardGrad.addColorStop(0, '#facc15');
        boardGrad.addColorStop(0.5, '#ec4899');
        boardGrad.addColorStop(1, '#06b6d4');
        ctx.fillStyle = boardGrad;
        ctx.beginPath();
        ctx.roundRect(-8, -42, 16, 78, [8, 8, 8, 8]);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Deck graffiti star
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Titan One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, -2);
        // Trucks and wheels
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-10, -28, 20, 4);
        ctx.fillRect(-10, 20, 20, 4);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(-11, -26, 4, 0, Math.PI * 2);
        ctx.arc(11, -26, 4, 0, Math.PI * 2);
        ctx.arc(-11, 22, 4, 0, Math.PI * 2);
        ctx.arc(11, 22, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 1. LEGS (STURDY CARTOON SKATER STANCE)
        ctx.fillStyle = jeansCol;
        // Left leg
        ctx.beginPath();
        ctx.roundRect(-16, 6, 12, 28, [4, 4, 2, 2]);
        ctx.fill();
        // Right leg
        ctx.beginPath();
        ctx.roundRect(4, 6, 12, 28, [4, 4, 2, 2]);
        ctx.fill();
        // Dark denim seam
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, 8); ctx.lineTo(-10, 32);
        ctx.moveTo(10, 8); ctx.lineTo(10, 32);
        ctx.stroke();

        // 2. CHUNKY SNEAKERS (FRONT VIEW)
        // Left shoe
        ctx.fillStyle = shoesCol;
        ctx.beginPath();
        ctx.roundRect(-20, 32, 16, 12, [5, 5, 3, 3]);
        ctx.fill();
        // White rubber toe bumper & sole
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-20, 39, 16, 5, [0, 0, 3, 3]);
        ctx.fill();
        ctx.fillRect(-18, 32, 12, 4); // white toe cap
        // White laces
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-16, 35, 8, 2);

        // Right shoe
        ctx.fillStyle = shoesCol;
        ctx.beginPath();
        ctx.roundRect(4, 32, 16, 12, [5, 5, 3, 3]);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(4, 39, 16, 5, [0, 0, 3, 3]);
        ctx.fill();
        ctx.fillRect(6, 32, 12, 4);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(8, 35, 8, 2);

        // 3. TORSO (WHITE HOODIE + BLUE DENIM VEST)
        // White hoodie body
        ctx.fillStyle = hoodieCol;
        ctx.beginPath();
        ctx.roundRect(-16, -22, 32, 30, [6, 6, 4, 4]);
        ctx.fill();
        // Inner tee shirt visible at neckline
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(-7, -22); ctx.lineTo(7, -22); ctx.lineTo(0, -10);
        ctx.closePath();
        ctx.fill();
        // Denim blue vest open in front
        ctx.fillStyle = vestCol;
        // Left vest panel
        ctx.beginPath();
        ctx.moveTo(-16, -22); ctx.lineTo(-6, -22); ctx.lineTo(-5, 8); ctx.lineTo(-16, 8);
        ctx.closePath();
        ctx.fill();
        // Right vest panel
        ctx.beginPath();
        ctx.moveTo(16, -22); ctx.lineTo(6, -22); ctx.lineTo(5, 8); ctx.lineTo(16, 8);
        ctx.closePath();
        ctx.fill();
        // Brass vest buttons
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(-7, -12, 1.8, 0, Math.PI * 2);
        ctx.arc(-7, -3, 1.8, 0, Math.PI * 2);
        ctx.arc(-7, 5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Puffy hood collar around neck
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.roundRect(-14, -26, 28, 7, [4, 4, 4, 4]);
        ctx.fill();

        // 4. ARMS & SPRAY CAN
        // Left arm (casual on hip/board)
        ctx.fillStyle = hoodieCol;
        ctx.fillRect(15, -20, 9, 14); // upper sleeve
        ctx.fillStyle = skinCol;
        ctx.fillRect(17, -6, 7, 14); // forearm
        ctx.beginPath();
        ctx.arc(20, 10, 4.5, 0, Math.PI * 2); // hand
        ctx.fill();

        // Right arm holding Spray Can
        ctx.fillStyle = hoodieCol;
        ctx.fillRect(-24, -20, 9, 14);
        ctx.fillStyle = skinCol;
        ctx.fillRect(-24, -6, 7, 14);
        // Spray Can in right hand
        ctx.save();
        ctx.translate(-26, 4);
        // Silver can body
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(-5, -6, 10, 18, [2, 2, 2, 2]);
        ctx.fill();
        // Cyan spray can cap/nozzle
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-3, -10, 6, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -12, 2, 2);
        // Can label stripe
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-5, 0, 10, 6);
        ctx.restore();
        // Hand gripping can
        ctx.fillStyle = skinCol;
        ctx.beginPath();
        ctx.arc(-24, 7, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // 5. CARTOON HEAD & BACKWARDS RED BASEBALL CAP (FRONT VIEW)
        // Neck
        ctx.fillStyle = skinCol;
        ctx.fillRect(-5, -28, 10, 6);

        // Head
        ctx.fillStyle = skinCol;
        ctx.beginPath();
        ctx.arc(0, -36, 13, 0, Math.PI * 2);
        ctx.fill();

        // Big cartoon eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-5, -37, 4, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(5, -37, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Dark blue pupils
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.arc(-4.5, -36.5, 2.2, 0, Math.PI * 2);
        ctx.arc(5.5, -36.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        // Specular glint in eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-5.5, -38, 1, 0, Math.PI * 2);
        ctx.arc(4.5, -38, 1, 0, Math.PI * 2);
        ctx.fill();

        // Happy smile & rosy cheeks
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -32, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.beginPath();
        ctx.arc(-8, -32, 2.5, 0, Math.PI * 2);
        ctx.arc(8, -32, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Brown cartoon bangs/hair on forehead
        ctx.fillStyle = hairCol;
        ctx.beginPath();
        ctx.moveTo(-12, -43);
        ctx.lineTo(-4, -39);
        ctx.lineTo(2, -42);
        ctx.lineTo(10, -40);
        ctx.lineTo(12, -44);
        ctx.closePath();
        ctx.fill();

        // Red Backwards Baseball Cap
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.arc(0, -44, 13, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Visor peak turned slightly to the side/back
        ctx.beginPath();
        ctx.roundRect(-14, -46, 28, 5, [3, 3, 1, 1]);
        ctx.fill();
        // White Subway logo badge on center of cap
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -48, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 5px "Titan One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('S', 0, -46);

        ctx.restore();
        ctx.restore();
        return;
      }

      // ============================================================
      // B. REAR CHASE CAMERA VIEW (IN-GAME RUNNING / JUMPING / SLIDING)
      // ============================================================
      if (isSliding) {
        // SLIDING POSE: Athletic low skid across tracks
        ctx.save();
        ctx.translate(0, -18);
        ctx.rotate(-0.35);

        // Rear stretched leg
        ctx.fillStyle = jeansCol;
        ctx.fillRect(-18, 2, 24, 9);
        // Skate shoe skidding
        ctx.fillStyle = shoesCol;
        ctx.fillRect(-22, 2, 8, 9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-22, 9, 8, 3); // white sole

        // Front bent leg
        ctx.fillStyle = jeansCol;
        ctx.fillRect(2, -6, 12, 10);

        // Torso with white hoodie & denim vest
        ctx.fillStyle = hoodieCol;
        ctx.fillRect(-12, -22, 24, 20);
        ctx.fillStyle = vestCol;
        ctx.fillRect(-10, -20, 20, 16);
        // "SUB SURF" patch
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-7, -16, 14, 8);

        // Folded hood on neck
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, -22, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head with red backwards baseball cap
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.arc(0, -32, 11, 0, Math.PI * 2);
        ctx.fill();
        // Cap visor extending back over neck
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.roundRect(-9, -24, 18, 4.5, [2, 2, 2, 2]);
        ctx.fill();

        ctx.restore();

      } else if (isJumping) {
        // JUMPING POSE: Athletic parkour tuck stride
        ctx.save();
        ctx.translate(0, -38);

        // Left leg tucked forward
        ctx.fillStyle = jeansCol;
        ctx.fillRect(-14, 4, 10, 16);
        ctx.fillStyle = shoesCol;
        ctx.fillRect(-16, 20, 14, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-16, 26, 14, 3);

        // Right leg bent back
        ctx.fillStyle = jeansCol;
        ctx.fillRect(4, 4, 10, 14);
        ctx.fillStyle = shoesCol;
        ctx.fillRect(10, 18, 14, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, 24, 14, 3);

        // Torso: White hoodie + Denim vest + "SUB SURF" patch
        ctx.fillStyle = hoodieCol;
        ctx.beginPath();
        ctx.roundRect(-14, -22, 28, 26, [5, 5, 3, 3]);
        ctx.fill();

        ctx.fillStyle = vestCol;
        ctx.beginPath();
        ctx.roundRect(-11, -20, 22, 22, [4, 4, 2, 2]);
        ctx.fill();

        // Graffiti Sub Surf Patch on back
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-9, -15, 18, 13, [3, 3, 3, 3]);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.font = '900 6px "Titan One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SUB', 0, -8);
        ctx.fillStyle = '#06b6d4';
        ctx.fillText('SURF', 0, -3);

        // Folded hood collar
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, -22, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head & Backwards Red Cap
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.arc(0, -33, 11, 0, Math.PI * 2);
        ctx.fill();
        // Curved cap peak pointing backwards
        ctx.beginPath();
        ctx.roundRect(-8, -25, 16, 4.5, [2, 2, 2, 2]);
        ctx.fill();
        // Hair poking out under cap
        ctx.fillStyle = hairCol;
        ctx.fillRect(-9, -27, 4, 3);
        ctx.fillRect(5, -27, 4, 3);

        // Arms spread for balance holding spray can
        ctx.fillStyle = hoodieCol;
        ctx.fillRect(-22, -18, 9, 8);
        ctx.fillRect(13, -18, 9, 8);
        ctx.fillStyle = skinCol;
        ctx.fillRect(-25, -24, 6, 8);
        ctx.fillRect(19, -24, 6, 8);

        // Spray can held high in right hand
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(20, -34, 7, 12);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(21, -37, 5, 3);

        ctx.restore();

      } else {
        // ATHLETIC CARTOON RUNNING STRIDE (AUTHENTIC SUBWAY SURFERS JAKE)
        const phase = (animTime * 15) % (Math.PI * 2);
        const legSwing = Math.sin(phase);
        const bobY = -Math.abs(Math.sin(phase)) * 4 + (squash || 0) * 8;

        ctx.save();
        ctx.translate(0, -38 + bobY);

        // 1. BACK ARM (Holding spray paint can, swings opposite to leg)
        const backArmAngle = legSwing * 0.75;
        ctx.save();
        ctx.translate(-11, -16);
        ctx.rotate(backArmAngle);
        // White hoodie sleeve rolled up
        ctx.fillStyle = hoodieCol;
        ctx.beginPath();
        ctx.roundRect(-4, 0, 8, 14, [3, 3, 2, 2]);
        ctx.fill();
        // Forearm
        ctx.fillStyle = skinCol;
        ctx.fillRect(-3, 12, 6, 12);
        // Spray Can held in fist
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(-5, 18, 8, 14);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(-4, 15, 6, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-5, 23, 8, 4); // can label
        // Hand fist
        ctx.fillStyle = skinCol;
        ctx.beginPath();
        ctx.arc(0, 24, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. BACK LEG
        const backLegAngle = -legSwing * 0.8;
        ctx.save();
        ctx.translate(-6, 6);
        ctx.rotate(backLegAngle);
        // Denim blue jean thigh
        ctx.fillStyle = jeansCol;
        ctx.beginPath();
        ctx.roundRect(-5, 0, 10, 16, [3, 3, 2, 2]);
        ctx.fill();
        // Shin
        ctx.fillRect(-4, 14, 9, 16);
        // Seams
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-4, 14, 9, 16);
        // Chunky skater sneaker
        ctx.fillStyle = shoesCol;
        ctx.beginPath();
        ctx.roundRect(-5, 28, 15, 8, [4, 4, 2, 2]);
        ctx.fill();
        // Crisp white rubber rim & toe
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, 33, 15, 4);
        ctx.fillRect(6, 28, 4, 7);
        // Black rubber tread
        ctx.fillStyle = '#334155';
        ctx.fillRect(-5, 36, 15, 1.5);
        ctx.restore();

        // 3. HUMAN TORSO: WHITE HOODIE + DENIM "SUB SURF" VEST
        // Puffy white hoodie base
        ctx.fillStyle = hoodieCol;
        ctx.beginPath();
        ctx.roundRect(-15, -22, 30, 28, [6, 6, 4, 4]);
        ctx.fill();

        // Blue denim vest worn over hoodie
        ctx.fillStyle = vestCol;
        ctx.beginPath();
        ctx.roundRect(-12, -20, 24, 23, [4, 4, 2, 2]);
        ctx.fill();
        // Denim armhole hems
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12, -20, 24, 23);

        // VIBRANT "SUB SURF" GRAFFITI PATCH ON BACK (SCREENSHOT 1 & 2)
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-10, -16, 20, 15, [4, 4, 4, 4]);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = '900 7px "Titan One", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SUB', 0, -9);
        ctx.fillStyle = '#06b6d4';
        ctx.font = '900 6.5px "Titan One", sans-serif';
        ctx.fillText('SURF', 0, -3);

        // Folded white hood collar resting on neck
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, -22, 13, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 4. FRONT LEG (Swings forward)
        const frontLegAngle = legSwing * 0.8;
        ctx.save();
        ctx.translate(6, 6);
        ctx.rotate(frontLegAngle);
        // Denim jean thigh
        ctx.fillStyle = jeansCol;
        ctx.beginPath();
        ctx.roundRect(-5, 0, 10, 16, [3, 3, 2, 2]);
        ctx.fill();
        // Shin
        ctx.fillRect(-4, 14, 9, 16);
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(-4, 14, 9, 16);
        // Chunky skater sneaker
        ctx.fillStyle = shoesCol;
        ctx.beginPath();
        ctx.roundRect(-4, 28, 15, 8, [4, 4, 2, 2]);
        ctx.fill();
        // White rubber rim & toe
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, 33, 15, 4);
        ctx.fillRect(7, 28, 4, 7);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-4, 36, 15, 1.5);
        ctx.restore();

        // 5. CARTOON HEAD & BACKWARDS RED BASEBALL CAP (REAR VIEW)
        // Neck
        ctx.fillStyle = skinCol;
        ctx.fillRect(-5, -28, 10, 6);

        // Cap Crown (Red Dome)
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.arc(0, -34, 12, 0, Math.PI * 2);
        ctx.fill();

        // Curved Cap Visor Peak pointing backwards over nape of neck
        ctx.fillStyle = capCol;
        ctx.beginPath();
        ctx.roundRect(-9, -25, 18, 5, [3, 3, 2, 2]);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 1;
        ctx.stroke();

        // White button on top of cap
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -45, 2, 0, Math.PI * 2);
        ctx.fill();

        // Brown cartoon hair peeking out at sides of cap
        ctx.fillStyle = hairCol;
        ctx.beginPath();
        ctx.fillRect(-11, -29, 4, 5);
        ctx.fillRect(7, -29, 4, 5);

        // Special Character Head Accents
        if (c.character === 'tricky') {
          // Blonde pigtails flying out left and right
          ctx.fillStyle = '#facc15';
          const pigtailWave = Math.sin(phase) * 4;
          // Left pigtail
          ctx.beginPath();
          ctx.ellipse(-16, -30 + pigtailWave, 5, 8, -0.4, 0, Math.PI * 2);
          ctx.fill();
          // Right pigtail
          ctx.beginPath();
          ctx.ellipse(16, -30 - pigtailWave, 5, 8, 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.character === 'fresh') {
          // Hi-top fade dark hair
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-8, -48, 16, 12);
        } else if (c.character === 'spike') {
          // Red punk mohawk
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-3, -46); ctx.lineTo(0, -56); ctx.lineTo(3, -46);
          ctx.closePath();
          ctx.fill();
        } else if (c.character === 'yutani') {
          // Green alien mascot antennae
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-8, -50, 2, 7);
          ctx.fillRect(6, -50, 2, 7);
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(-7, -51, 3, 0, Math.PI * 2);
          ctx.arc(7, -51, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // 6. FRONT ARM (Swings opposite to back arm)
        const frontArmAngle = -legSwing * 0.75;
        ctx.save();
        ctx.translate(11, -16);
        ctx.rotate(frontArmAngle);
        ctx.fillStyle = hoodieCol;
        ctx.beginPath();
        ctx.roundRect(-4, 0, 8, 14, [3, 3, 2, 2]);
        ctx.fill();
        ctx.fillStyle = skinCol;
        ctx.fillRect(-3, 12, 6, 12);
        ctx.beginPath();
        ctx.arc(0, 24, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
      }

      ctx.restore();
    } catch (err) {
      console.error('[Runner Render Error]', err);
      try { ctx.restore(); } catch (e) {}
    }
  }

  /* ============================================================
     PLAYER (HUMANOID CYBER & SUBWAY RUNNER)
     ============================================================ */
  class Player {
    constructor(costume) {
      this.costume = costume || COSTUMES.neo;
      this.lane = 1;         // Target lane: 0 (Left), 1 (Center), 2 (Right)
      this.laneNorm = 0;     // Continuous lateral position: -1, 0, +1
      this.tilt = 0;

      this.jumpHeight = 0;
      this.jumpVel = 0;
      this.jumping = false;
      this.gravity = 2500;
      this.jumpImpulse = 940;

      this.sliding = false;
      this.slideTimer = 0;
      this.slideDuration = 0.54;

      this.width = 46;
      this.height = 80;
      this.slideHeight = 38;

      // Power-up Buff Flags
      this.hasJetpack = false;
      this.hasHoverboard = false;
      this.hasSneakers = false;

      // Subway train roof running mechanics
      this.baseHeight = 0;
      this.targetBaseHeight = 0;
      this.onTrain = false;

      this.hasShield = false;
      this.animTime = 0;
      this.squash = 0;

      // Callbacks for missions
      this.onJump = null;
      this.onSlide = null;

      // Project initial 3D position
      const pPos = project3D(this.laneNorm, PLAYER_Z);
      this.x = pPos.x;
      this.groundY = pPos.y;
      this.scale = pPos.scale;
    }

    moveLeft() {
      if (this.lane > 0) {
        this.lane--;
        try { SoundSystem.laneSwitch(); } catch (e) {}
      }
    }

    moveRight() {
      if (this.lane < LANE_COUNT - 1) {
        this.lane++;
        try { SoundSystem.laneSwitch(); } catch (e) {}
      }
    }

    jump() {
      if (this.sliding) {
        this.sliding = false;
      }
      if (!this.jumping) {
        this.jumping = true;
        const mult = this.hasSneakers ? 1.55 : 1.0;
        this.jumpVel = this.jumpImpulse * mult;
        try {
          if (this.hasSneakers) SoundSystem.sneakers();
          else SoundSystem.jump();
        } catch (e) {}
        if (this.onJump) this.onJump();
      }
    }

    slide() {
      if (this.jumping) {
        this.jumpVel = -1200; // fast downward stomp from jump
      }
      if (!this.sliding) {
        this.sliding = true;
        this.slideTimer = this.slideDuration;
        try { SoundSystem.slide(); } catch (e) {}
        if (this.onSlide) this.onSlide();
      }
    }

    update(dt, particles, obstacles = []) {
      this.animTime += dt;

      // 3D smooth exponential lane shifting
      const targetNorm = this.lane - 1;
      const dNorm = targetNorm - this.laneNorm;
      this.laneNorm += dNorm * (1 - Math.exp(-22 * dt));

      // Dynamic 3D banking tilt
      const targetTilt = clamp(dNorm * 0.45, -0.22, 0.22);
      this.tilt = lerp(this.tilt, targetTilt, 1 - Math.exp(-18 * dt));

      // Jetpack sky altitude takes priority
      if (this.hasJetpack) {
        this.targetBaseHeight = 145;
        this.onTrain = false;
      } else {
        // Check if runner is over a subway train roof
        let underTrain = null;
        if (obstacles && obstacles.length) {
          for (const o of obstacles) {
            if (o.isTrain) {
              const inLane = Math.abs(this.laneNorm - o.laneNorm) < 0.62;
              const onZ = (o.z - 35 <= PLAYER_Z) && (PLAYER_Z <= o.z + o.length + 20);
              if (inLane && onZ) {
                underTrain = o;
                break;
              }
            }
          }
        }

        if (underTrain) {
          if (this.onTrain || (this.jumpHeight + this.baseHeight >= underTrain.h - 18) || underTrain.hasRamp) {
            this.onTrain = true;
            this.targetBaseHeight = underTrain.h;
          }
        } else {
          if (this.onTrain) {
            this.onTrain = false;
            this.jumpHeight = Math.max(this.jumpHeight, this.baseHeight);
            this.baseHeight = 0;
            this.targetBaseHeight = 0;
            this.jumping = true;
            this.jumpVel = Math.min(this.jumpVel, -50);
          } else {
            this.targetBaseHeight = 0;
          }
        }
      }

      // Smooth altitude transitions when boarding trains or jetpack flight
      this.baseHeight = lerp(this.baseHeight, this.targetBaseHeight, 1 - Math.exp(-18 * dt));

      // Calculate current 3D screen position
      const pPos = project3D(this.laneNorm, PLAYER_Z);
      this.x = pPos.x;
      this.groundY = pPos.y;
      this.scale = pPos.scale;

      // Lateral trail sparks when shifting lanes
      if (Math.abs(dNorm) > 0.08 && particles) {
        const footY = this.groundY - (this.baseHeight + this.jumpHeight) * this.scale;
        particles.trail(this.x, footY - 8 * this.scale, this.costume.accent);
      }

      // 3D Jump physics with apex smoothing
      if (this.jumping) {
        const apexFloat = Math.abs(this.jumpVel) < 180 ? 0.78 : 1.0;
        this.jumpVel -= this.gravity * apexFloat * dt;
        this.jumpHeight += this.jumpVel * dt;
        if (this.jumpHeight <= 0) {
          this.jumpHeight = 0;
          this.jumping = false;
          this.jumpVel = 0;
          this.squash = 1; // Landing squash
          const footY = this.groundY - this.baseHeight * this.scale;
          if (particles) particles.burst(this.x, footY, this.costume.accent, 10, 50, 130);
        }
      }

      if (this.squash > 0) {
        this.squash = Math.max(0, this.squash - dt * 5);
      }

      // Slide countdown & road sparks
      if (this.sliding) {
        this.slideTimer -= dt;
        if (particles && Math.random() < 0.6) {
          const footY = this.groundY - this.baseHeight * this.scale;
          particles.trail(this.x, footY - 4 * this.scale, this.costume.visor);
        }
        if (this.slideTimer <= 0) {
          this.sliding = false;
        }
      }

      // Continuous running particles & jetpack smoke
      if (particles) {
        const footY = this.groundY - this.baseHeight * this.scale;
        if (this.hasJetpack) {
          particles.trail(this.x - 12 * this.scale, footY, '#f43f5e');
          particles.trail(this.x + 12 * this.scale, footY, '#06b6d4');
        } else if (!this.jumping && Math.random() < 0.4) {
          particles.trail(this.x - 5 * this.scale, footY - 2, this.costume.accent);
          particles.trail(this.x + 5 * this.scale, footY - 2, this.costume.visor);
        }
      }
    }

    render(ctx, customZ, customScale, isFrontView = false, activeBuffs = {}) {
      const z = (customZ !== undefined) ? customZ : PLAYER_Z;
      const pPos = project3D(this.laneNorm, z);
      const s = (customScale !== undefined) ? customScale : pPos.scale;
      const buffs = (activeBuffs && Object.keys(activeBuffs).length > 0) ? activeBuffs : {
        jetpack: this.hasJetpack,
        hoverboard: this.hasHoverboard,
        sneakers: this.hasSneakers
      };
      drawHumanoidRunner(
        ctx,
        pPos.x,
        pPos.y,
        this.animTime,
        this.jumping,
        this.sliding,
        this.jumpHeight,
        this.tilt,
        this.costume,
        this.squash,
        this.hasShield,
        s,
        this.baseHeight,
        isFrontView,
        buffs
      );
    }
  }

  /* ============================================================
     OBSTACLES: SUBWAY TRAINS & TRACK HURDLES (3D PERSPECTIVE)
     ============================================================ */
  const TRAIN_LIVERIES = [
    { name: 'Red Express', body: '#ef4444', roof: '#fca5a5', stripe: '#fde047', front: '#dc2626', trim: '#facc15' },
    { name: 'Blue Metro', body: '#0284c7', roof: '#7dd3fc', stripe: '#a3e635', front: '#0369a1', trim: '#fef08a' },
    { name: 'Graffiti Purple', body: '#9333ea', roof: '#d8b4fe', stripe: '#f43f5e', front: '#7e22ce', trim: '#38bdf8' },
    { name: 'Golden Express', body: '#eab308', roof: '#fef08a', stripe: '#ef4444', front: '#ca8a04', trim: '#22c55e' },
    { name: 'Emerald Runner', body: '#16a34a', roof: '#86efac', stripe: '#fde047', front: '#15803d', trim: '#ffffff' },
    { name: 'Citrus Orange', body: '#ea580c', roof: '#fdba74', stripe: '#38bdf8', front: '#c2410c', trim: '#facc15' },
    { name: 'Tokyo Turquoise', body: '#06b6d4', roof: '#a5f3fc', stripe: '#ec4899', front: '#0891b2', trim: '#fef08a' },
    { name: 'Royal Indigo', body: '#4f46e5', roof: '#a5b4fc', stripe: '#fbbf24', front: '#4338ca', trim: '#f43f5e' }
  ];

  const OBSTACLE_DEFS = {
    TRAIN_RAMP: {
      id: 'TRAIN_RAMP',
      name: 'Subway Train (Ramped)',
      w: 104,
      h: 62,
      length: 420,
      isTrain: true,
      hasRamp: true,
      action: 'climb'
    },
    TRAIN_CLOSED: {
      id: 'TRAIN_CLOSED',
      name: 'Subway Train (Closed)',
      w: 104,
      h: 62,
      length: 420,
      isTrain: true,
      hasRamp: false,
      action: 'dodge'
    },
    LOW: {
      id: 'LOW',
      name: 'Track Hurdle',
      w: 106,
      h: 44,
      depth: 32,
      action: 'jump',
      color: '#f59e0b',
      accent: '#ef4444'
    },
    HIGH: {
      id: 'HIGH',
      name: 'Signal Arch',
      w: 110,
      h: 112,
      gap: 48,
      depth: 26,
      action: 'slide',
      color: '#3b82f6',
      accent: '#facc15'
    },
    BLOCK: {
      id: 'BLOCK',
      name: 'Buffer Stop',
      w: 115,
      h: 135,
      depth: 55,
      action: 'switch',
      color: '#334155',
      accent: '#ef4444'
    }
  };

  class TrackManager {
    constructor() {
      this.obstacles = [];
      this.laneCooldowns = [0, 0, 0];
      this.globalCooldown = 0.5;
      this.minGapTime = 1.6;
      this.maxGapTime = 3.2;
      this.globalMinInterval = 1.3;
      this.minZGap = 200; // Separation between obstacles in same lane
      this.onObstacleSpawned = null;
    }

    reset() {
      this.obstacles = [];
      this.laneCooldowns = [0, 0, 0];
      this.globalCooldown = 0.5;

      // Spawn signature Subway Train right in front at start of run!
      const initialTrainLane = 1;
      const def = OBSTACLE_DEFS.TRAIN_RAMP;
      const firstTrain = {
        type: def,
        lane: initialTrainLane,
        laneNorm: 0,
        z: 700,
        w: def.w,
        h: def.h,
        length: def.length || 420,
        isTrain: true,
        hasRamp: true,
        colorScheme: TRAIN_LIVERIES[0], // Red Express
        hit: false
      };
      this.obstacles.push(firstTrain);
      if (this.onObstacleSpawned) this.onObstacleSpawned(firstTrain);
      this.laneCooldowns[initialTrainLane] = 3.8;
    }

    update(dt, speed, elapsed) {
      // Advance obstacles along 3D depth towards camera
      for (const o of this.obstacles) {
        o.z -= speed * dt;
      }
      // Clean up obstacles once they pass behind camera
      this.obstacles = this.obstacles.filter(o => (o.z + (o.length || 0)) > -90);

      this.globalCooldown = Math.max(0, this.globalCooldown - dt);
      for (let i = 0; i < LANE_COUNT; i++) {
        this.laneCooldowns[i] = Math.max(0, this.laneCooldowns[i] - dt);
      }

      this._spawn(elapsed);
    }

    _canSpawnInLane(lane) {
      const inLane = this.obstacles.filter(o => o.lane === lane);
      if (!inLane.length) return true;
      let maxZ = -Infinity;
      for (const o of inLane) {
        const tailZ = o.z + (o.length || 0);
        maxZ = Math.max(maxZ, tailZ);
      }
      return maxZ <= (Z_SPAWN - this.minZGap);
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

      // Keep lanes navigable: at least one lane is always open
      const maxSpawns = Math.min(candidates.length, LANE_COUNT - 1);
      let count = 1;
      if (maxSpawns >= 2 && elapsed > 45 && Math.random() < 0.22) {
        count = 2;
      }

      const selected = shuffle([...candidates]).slice(0, count);

      for (const lane of selected) {
        // High frequency of 3D Subway Trains (55% Ramped, 30% Closed, 15% Hurdle)
        const rand = Math.random();
        let typeId = 'TRAIN_RAMP';
        if (rand < 0.55) {
          typeId = 'TRAIN_RAMP'; // 55% ramped train with roof climbing
        } else if (rand < 0.85) {
          typeId = 'TRAIN_CLOSED'; // 30% closed flat cab train
        } else {
          typeId = 'LOW'; // 15% low track hurdle
        }

        const def = OBSTACLE_DEFS[typeId];
        const isTrain = !!def.isTrain;
        const obstacle = {
          type: def,
          lane: lane,
          laneNorm: lane - 1,
          z: Z_SPAWN,
          w: def.w,
          h: def.h,
          length: def.length || 36,
          isTrain: isTrain,
          hasRamp: !!def.hasRamp,
          colorScheme: isTrain ? TRAIN_LIVERIES[Math.floor(Math.random() * TRAIN_LIVERIES.length)] : null,
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
        this.renderObstacle(ctx, o);
      }
    }

    renderObstacle(ctx, o) {
      if ((o.z + (o.length || 0)) < -80 || o.z > Z_SPAWN + 120) return;
      ctx.save();

      // Dispatch 3D Subway Trains
      if (o.isTrain) {
        this.renderTrain(ctx, o);
        ctx.restore();
        return;
      }

      const base = project3D(o.laneNorm, o.z, 0);
      const s = base.scale;
      const bw = o.type.w * s;
      const bh = o.type.h * s;
      const bx = base.x - bw / 2;
      const by = base.y - bh;

      // 3D Ground drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, bw * 0.55, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      if (o.type.id === 'LOW') {
        // 3D Subway Track Hurdle (Wooden/Metal Caution Barrier)
        const topBack = project3D(o.laneNorm, o.z + o.type.depth, o.type.h);
        const topBackW = o.type.w * topBack.scale;

        // Top depth face
        ctx.fillStyle = '#b45309';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(topBack.x + topBackW / 2, topBack.y);
        ctx.lineTo(topBack.x - topBackW / 2, topBack.y);
        ctx.closePath();
        ctx.fill();

        // Front Face
        ctx.fillStyle = o.type.color;
        ctx.fillRect(bx, by, bw, bh);

        // Warning Top Stripe
        ctx.fillStyle = o.type.accent;
        ctx.fillRect(bx + 2 * s, by + 2 * s, bw - 4 * s, 5 * s);

        // Caution diagonal stripes
        ctx.fillStyle = '#1e293b';
        ctx.globalAlpha = 0.35;
        const stripeW = 14 * s;
        for (let sx = bx; sx < bx + bw; sx += stripeW) {
          ctx.beginPath();
          ctx.moveTo(sx, by + bh);
          ctx.lineTo(sx + 8 * s, by);
          ctx.lineTo(sx + stripeW, by);
          ctx.lineTo(sx + stripeW - 8 * s, by + bh);
          ctx.fill();
        }
      } else if (o.type.id === 'HIGH') {
        // 3D Subway Signal Arch (Overhead Gantry with slide clearance)
        const pylonW = 12 * s;
        const solidH = (o.type.h - o.type.gap) * s;
        const gapH = o.type.gap * s;

        // Left & Right Signal Pylons
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(bx, by, pylonW, bh);
        ctx.fillRect(bx + bw - pylonW, by, pylonW, bh);

        // Signal lights on pylons
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx + pylonW / 2, by + bh * 0.4, 3.5 * s, 0, Math.PI * 2);
        ctx.arc(bx + bw - pylonW / 2, by + bh * 0.4, 3.5 * s, 0, Math.PI * 2);
        ctx.fill();

        // Top Arch Crossbar
        ctx.fillStyle = o.type.color;
        ctx.fillRect(bx, by, bw, solidH);

        // Warning lights bar
        const pulse = (Math.sin(Date.now() * 0.012) + 1) * 0.5;
        ctx.fillStyle = o.type.accent;
        ctx.fillRect(bx + pylonW, by + solidH - 6 * s, bw - pylonW * 2, 5 * s);

        // Sliding Clearance Opening
        ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
        ctx.fillRect(bx + pylonW, base.y - gapH, bw - pylonW * 2, gapH);

        // "SLIDE" Badge
        if (s > 0.42) {
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = '#fde047';
          ctx.font = `bold ${Math.max(9, 11 * s)}px "Orbitron", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('▼ SLIDE ▼', base.x, base.y - gapH * 0.45);
        }
      } else {
        // 3D Terminal Buffer Stop
        const topBack = project3D(o.laneNorm, o.z + o.type.depth, o.type.h);
        const topBackW = o.type.w * topBack.scale;

        // Side Depth Face
        if (base.x < VP_X - 10) {
          const baseBack = project3D(o.laneNorm, o.z + o.type.depth, 0);
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(bx + bw, by);
          ctx.lineTo(topBack.x + topBackW / 2, topBack.y);
          ctx.lineTo(baseBack.x + (o.type.w * baseBack.scale) / 2, baseBack.y);
          ctx.lineTo(bx + bw, base.y);
          ctx.closePath();
          ctx.fill();
        } else if (base.x > VP_X + 10) {
          const baseBack = project3D(o.laneNorm, o.z + o.type.depth, 0);
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(topBack.x - topBackW / 2, topBack.y);
          ctx.lineTo(baseBack.x - (o.type.w * baseBack.scale) / 2, baseBack.y);
          ctx.lineTo(bx, base.y);
          ctx.closePath();
          ctx.fill();
        }

        // Top Depth Face
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw, by);
        ctx.lineTo(topBack.x + topBackW / 2, topBack.y);
        ctx.lineTo(topBack.x - topBackW / 2, topBack.y);
        ctx.closePath();
        ctx.fill();

        // Front Face
        ctx.fillStyle = o.type.color;
        ctx.fillRect(bx, by, bw, bh);

        // Warning Hazard Frame
        ctx.strokeStyle = o.type.accent;
        ctx.lineWidth = Math.max(1.5, 2.5 * s);
        ctx.strokeRect(bx + 2 * s, by + 2 * s, bw - 4 * s, bh - 4 * s);

        if (s > 0.38) {
          ctx.fillStyle = o.type.accent;
          ctx.font = `bold ${Math.max(12, 20 * s)}px "Orbitron", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('⛔', base.x, by + bh * 0.55);
        }
      }

      ctx.restore();
    }

    /* ---------------- 3D SUBWAY TRAIN VOLUMETRIC RENDERER ---------------- */
    renderTrain(ctx, o) {
      // Train Front & Back 3D points
      const pFront = project3D(o.laneNorm, o.z, 0);
      const sFront = pFront.scale;
      const wFront = o.w * sFront;
      const hFront = o.h * sFront;
      const bxFront = pFront.x - wFront / 2;
      const byFront = pFront.y - hFront;

      const pBack = project3D(o.laneNorm, o.z + o.length, 0);
      const sBack = pBack.scale;
      const wBack = o.w * sBack;
      const hBack = o.h * sBack;
      const bxBack = pBack.x - wBack / 2;
      const byBack = pBack.y - hBack;

      const livery = o.colorScheme || TRAIN_LIVERIES[0];

      // Ground Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.moveTo(bxFront - 6 * sFront, pFront.y + 2);
      ctx.lineTo(bxFront + wFront + 6 * sFront, pFront.y + 2);
      ctx.lineTo(bxBack + wBack + 2, pBack.y + 2);
      ctx.lineTo(bxBack - 2, pBack.y + 2);
      ctx.closePath();
      ctx.fill();

      // 1. Visible Carriage Side Walls
      // Left side wall (visible when train is in center or right lane, or tapers inward)
      if (bxFront < bxBack + 3) {
        ctx.fillStyle = livery.body;
        ctx.beginPath();
        ctx.moveTo(bxFront, byFront);
        ctx.lineTo(bxBack, byBack);
        ctx.lineTo(bxBack, pBack.y);
        ctx.lineTo(bxFront, pFront.y);
        ctx.closePath();
        ctx.fill();

        // Left Side Windows
        const winCount = 5;
        for (let i = 1; i <= winCount; i++) {
          const t = i / (winCount + 1);
          const wz = o.z + t * o.length;
          const pW = project3D(o.laneNorm, wz, 0);
          const sw = pW.scale;
          const winW = 14 * sw;
          const winH = 12 * sw;
          const wx = pW.x - (o.w * sw) / 2;
          const wy = pW.y - (o.h * 0.72) * sw;
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(wx, wy, winW, winH);
        }
      }

      // Right side wall (visible when train is in center or left lane, or tapers inward)
      if (bxFront + wFront > bxBack + wBack - 3) {
        ctx.fillStyle = livery.front || livery.body;
        ctx.beginPath();
        ctx.moveTo(bxFront + wFront, byFront);
        ctx.lineTo(bxBack + wBack, byBack);
        ctx.lineTo(bxBack + wBack, pBack.y);
        ctx.lineTo(bxFront + wFront, pFront.y);
        ctx.closePath();
        ctx.fill();

        // Right Side Windows
        const winCount = 5;
        for (let i = 1; i <= winCount; i++) {
          const t = i / (winCount + 1);
          const wz = o.z + t * o.length;
          const pW = project3D(o.laneNorm, wz, 0);
          const sw = pW.scale;
          const winW = 14 * sw;
          const winH = 12 * sw;
          const wx = pW.x + (o.w * sw) / 2 - winW;
          const wy = pW.y - (o.h * 0.72) * sw;
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(wx, wy, winW, winH);
        }
      }

      // 1.5 Undercarriage Bogie Trucks & Steel Wheels (Sitting on Track Rails)
      const bogieOffsets = [55, Math.max(75, o.length - 65)];
      for (const bOffset of bogieOffsets) {
        if (bOffset >= o.length) continue;
        const bZ = o.z + bOffset;
        const pB = project3D(o.laneNorm, bZ, 0);
        const sB = pB.scale;
        const wB = o.w * sB;
        const wheelR = Math.max(3, 7.5 * sB);
        const bogieY = pB.y - 3 * sB;

        // Bogie frame (dark cast iron crossbar)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(pB.x - wB * 0.46, bogieY - 5 * sB, wB * 0.92, 4 * sB);

        // Left wheel set
        const lWheelX = pB.x - wB * 0.45;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(lWheelX, bogieY, wheelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 1.8 * sB);
        ctx.stroke();
        // Inner wheel hub
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(lWheelX, bogieY, wheelR * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Right wheel set
        const rWheelX = pB.x + wB * 0.45;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(rWheelX, bogieY, wheelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, 1.8 * sB);
        ctx.stroke();
        // Inner wheel hub
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(rWheelX, bogieY, wheelR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      // 1.6 Multi-Car Accordion Gangway (Bellows joint between cars)
      if (o.length >= 220) {
        const midZ = o.z + o.length * 0.5;
        const pMid = project3D(o.laneNorm, midZ, 0);
        const sMid = pMid.scale;
        const wMid = (o.w + 2) * sMid;
        const hMid = o.h * sMid;
        const bxMid = pMid.x - wMid / 2;
        const byMid = pMid.y - hMid;

        // Dark flexible rubber joint band
        ctx.fillStyle = '#090d16';
        ctx.fillRect(bxMid - 2 * sMid, byMid, wMid + 4 * sMid, hMid);

        // Rubber bellows pleats
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(1, 2 * sMid);
        for (let pleat = -6; pleat <= 6; pleat += 4) {
          const px = pMid.x + pleat * sMid;
          ctx.beginPath();
          ctx.moveTo(px, byMid);
          ctx.lineTo(px, pMid.y);
          ctx.stroke();
        }
      }

      // 2. Corrugated Roof Walkway
      ctx.fillStyle = livery.roof;
      ctx.beginPath();
      ctx.moveTo(bxFront, byFront);
      ctx.lineTo(bxFront + wFront, byFront);
      ctx.lineTo(bxBack + wBack, byBack);
      ctx.lineTo(bxBack, byBack);
      ctx.closePath();
      ctx.fill();

      // Roof ridges / walkway texture
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = Math.max(1, 1.4 * sFront);
      for (let rz = o.z + 35; rz < o.z + o.length; rz += 45) {
        const pr = project3D(o.laneNorm, rz, o.h);
        const prW = o.w * pr.scale;
        ctx.beginPath();
        ctx.moveTo(pr.x - prW / 2, pr.y);
        ctx.lineTo(pr.x + prW / 2, pr.y);
        ctx.stroke();
      }

      // 2.5 Rooftop HVAC / Air Conditioner Ventilation Pods
      const acOffsets = [o.length * 0.28, o.length * 0.74];
      for (const acOff of acOffsets) {
        const acZ = o.z + acOff;
        const pAC = project3D(o.laneNorm, acZ, o.h);
        const sAC = pAC.scale;
        const acW = o.w * 0.55 * sAC;
        const acH = 7 * sAC;
        const acX = pAC.x - acW / 2;
        const acY = pAC.y - acH;

        // Pod housing
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(acX, acY, acW, acH);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = Math.max(1, 1.2 * sAC);
        ctx.strokeRect(acX, acY, acW, acH);

        // Circular exhaust vents
        if (sAC > 0.3) {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(pAC.x - acW * 0.25, acY + acH * 0.5, Math.max(1.5, 2.5 * sAC), 0, Math.PI * 2);
          ctx.arc(pAC.x + acW * 0.25, acY + acH * 0.5, Math.max(1.5, 2.5 * sAC), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Train Front Cab Face
      ctx.fillStyle = livery.front;
      ctx.fillRect(bxFront, byFront, wFront, hFront);

      // Route / Destination display box above windshield
      const routeW = wFront * 0.72;
      const routeH = 7 * sFront;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bxFront + (wFront - routeW) / 2, byFront + 2 * sFront, routeW, routeH);
      if (sFront > 0.38) {
        ctx.fillStyle = '#facc15';
        ctx.font = `bold ${Math.max(6, 8 * sFront)}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SUBWAY 3D', pFront.x, byFront + 7 * sFront);
      }

      // Livery center stripe
      ctx.fillStyle = livery.stripe;
      ctx.fillRect(bxFront, byFront + hFront * 0.48, wFront, 6 * sFront);

      // Front Windshield
      const windW = wFront * 0.82;
      const windH = hFront * 0.36;
      const windX = bxFront + (wFront - windW) / 2;
      const windY = byFront + 8 * sFront;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(windX, windY, windW, windH);

      // Windshield reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.moveTo(windX + 3, windY + windH);
      ctx.lineTo(windX + windW * 0.4, windY);
      ctx.lineTo(windX + windW * 0.55, windY);
      ctx.lineTo(windX + 10, windY + windH);
      ctx.closePath();
      ctx.fill();

      // Twin Headlights with Volumetric Forward Beams
      const hlRadius = Math.max(2.5, 4.5 * sFront);
      const hlY = byFront + hFront * 0.72;
      const leftHlX = bxFront + 14 * sFront;
      const rightHlX = bxFront + wFront - 14 * sFront;

      // Volumetric forward light beams onto rails
      const pBeamEnd = project3D(o.laneNorm, Math.max(0, o.z - 110), 0);
      const beamEndW = o.w * pBeamEnd.scale * 1.35;
      ctx.fillStyle = 'rgba(254, 240, 138, 0.18)';
      ctx.beginPath();
      ctx.moveTo(leftHlX, hlY);
      ctx.lineTo(pBeamEnd.x - beamEndW / 2, pBeamEnd.y);
      ctx.lineTo(pBeamEnd.x + beamEndW / 2, pBeamEnd.y);
      ctx.lineTo(rightHlX, hlY);
      ctx.closePath();
      ctx.fill();

      // Glowing headlight bulbs
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(leftHlX, hlY, hlRadius, 0, Math.PI * 2);
      ctx.arc(rightHlX, hlY, hlRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bottom Steel Cow-catcher Grill
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(bxFront, pFront.y - 10 * sFront, wFront, 10 * sFront);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.max(1, 1.5 * sFront);
      for (let gx = bxFront + 6 * sFront; gx < bxFront + wFront; gx += 8 * sFront) {
        ctx.beginPath();
        ctx.moveTo(gx, pFront.y - 10 * sFront);
        ctx.lineTo(gx, pFront.y);
        ctx.stroke();
      }

      // 4. Front Boarding Ramp (If Ramped Train)
      if (o.hasRamp) {
        const rampDepth = 65;
        const pRampBase = project3D(o.laneNorm, Math.max(0, o.z - rampDepth), 0);
        const wRampBase = o.w * pRampBase.scale;
        const bxRamp = pRampBase.x - wRampBase / 2;

        // Yellow Metal Ramp surface
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(bxRamp, pRampBase.y);
        ctx.lineTo(bxRamp + wRampBase, pRampBase.y);
        ctx.lineTo(bxFront + wFront, byFront);
        ctx.lineTo(bxFront, byFront);
        ctx.closePath();
        ctx.fill();

        // Bold black hazard stripes on ramp
        ctx.fillStyle = '#18181b';
        ctx.globalAlpha = 0.65;
        const stripeStep = 18 * sFront;
        for (let sx = bxRamp - 10 * sFront; sx < bxRamp + wRampBase + 20 * sFront; sx += stripeStep) {
          ctx.beginPath();
          ctx.moveTo(sx, pRampBase.y);
          ctx.lineTo(sx + 10 * sFront, byFront);
          ctx.lineTo(sx + 20 * sFront, byFront);
          ctx.lineTo(sx + 10 * sFront, pRampBase.y);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Side Safety Handrails (Yellow tubular safety rails along ramp edges)
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1.5, 2.5 * sFront);

        // Left safety rail
        ctx.beginPath();
        ctx.moveTo(bxRamp + 2, pRampBase.y);
        ctx.lineTo(bxFront + 2, byFront);
        ctx.stroke();

        // Right safety rail
        ctx.beginPath();
        ctx.moveTo(bxRamp + wRampBase - 2, pRampBase.y);
        ctx.lineTo(bxFront + wFront - 2, byFront);
        ctx.stroke();

        // Vertical safety stanchion posts on ramp edges
        const postSteps = [0.25, 0.5, 0.75];
        for (const pst of postSteps) {
          const pPost = project3D(o.laneNorm, Math.max(0, o.z - rampDepth * (1 - pst)), o.h * pst);
          const sPost = pPost.scale;
          const postW = o.w * sPost;
          const leftPostX = pPost.x - postW / 2;
          const rightPostX = pPost.x + postW / 2;
          const postH = 10 * sPost;

          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = Math.max(1, 1.8 * sPost);
          ctx.beginPath();
          ctx.moveTo(leftPostX, pPost.y);
          ctx.lineTo(leftPostX, pPost.y - postH);
          ctx.moveTo(rightPostX, pPost.y);
          ctx.lineTo(rightPostX, pPost.y - postH);
          ctx.stroke();
        }

        // Glowing "▲ CLIMB ROOF ▲" prompt
        if (sFront > 0.35) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, 13 * sFront)}px "Orbitron", sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('▲ CLIMB ROOF ▲', pRampBase.x, pRampBase.y - (pRampBase.y - byFront) * 0.5);
        }
      }
    }
  }

  /* ============================================================
     COLLECTIBLES & POWER-UPS - 3D PERSPECTIVE
     ============================================================ */
  const POWERUP_METAS = {
    magnet: { name: 'MAGNET', duration: 8, color: '#4cc9f0', icon: '🧲' },
    multiplier: { name: '2X SCORE', duration: 10, color: '#ffd23f', icon: '⭐' },
    jetpack: { name: 'JETPACK', duration: 9, color: '#f43f5e', icon: '🚀' },
    sneakers: { name: 'SNEAKERS', duration: 14, color: '#10b981', icon: '👟' },
    hoverboard: { name: 'HOVERBOARD', duration: 30, color: '#38bdf8', icon: '🛹' },
    shield: { name: 'SHIELD', duration: 0, color: '#06d6a0', icon: '🛡️' }
  };

  class CollectibleItem {
    constructor(lane, z, type, opts = {}) {
      this.lane = lane;
      this.laneNorm = lane - 1;
      this.z = z;
      this.type = type;
      this.collected = false;
      this.radius = type === 'coin' ? 14 : 18;
      this.requiresJump = !!opts.requiresJump;
      this.requiresSlide = !!opts.requiresSlide;
      this.heightOffset = opts.heightOffset || (this.requiresJump ? 58 : 0);
      this.spin = Math.random() * Math.PI * 2;
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
      this.powerupTimer = 10.0;
      this.magnetRadius = 160;
      this.magnetSpeed = 650;
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
      this.powerupTimer = 10.0;
    }

    onObstacleSpawned(obstacle) {
      if (obstacle.isTrain) {
        if (obstacle.hasRamp) {
          // Continuous gold coin trail across train roof!
          this._spawnCoinLine(obstacle.lane, obstacle.z + 40, 7, 50, { heightOffset: obstacle.h + 8 });
        } else {
          // Coins in an open alternate lane
          const others = [0, 1, 2].filter(l => l !== obstacle.lane);
          const freeLane = others[Math.floor(Math.random() * others.length)];
          this._spawnCoinLine(freeLane, obstacle.z, 4, 45, {});
        }
      } else if (obstacle.type.id === 'LOW') {
        this._spawnArcTrail(obstacle.lane, obstacle.z, true);
      } else if (obstacle.type.id === 'HIGH') {
        this._spawnCoinLine(obstacle.lane, obstacle.z + 50, 3, 40, { requiresSlide: true, heightOffset: 0 });
      } else {
        const others = [0, 1, 2].filter(l => l !== obstacle.lane);
        const freeLane = others[Math.floor(Math.random() * others.length)];
        this._spawnCoinLine(freeLane, obstacle.z, 3, 45, {});
      }
    }

    _spawnCoinLine(lane, startZ, count, spacingZ, opts = {}) {
      for (let i = 0; i < count; i++) {
        this.items.push(new CollectibleItem(lane, startZ + i * spacingZ, 'coin', opts));
      }
    }

    _spawnArcTrail(lane, obstacleZ, requiresJump) {
      const count = 5, spreadZ = 180, peak = 75;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const z = obstacleZ - spreadZ / 2 + t * spreadZ;
        const heightOffset = Math.sin(t * Math.PI) * peak;
        this.items.push(new CollectibleItem(lane, z, 'coin', { requiresJump, heightOffset }));
      }
    }

    _spawnPowerup(lane, z, type) {
      this.items.push(new CollectibleItem(lane, z, type, { heightOffset: 15 }));
    }

    update(dt, player, speed, particles) {
      // Coin spawn timer
      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
        this.coinTimer = randRange(1.2, 1.9);
        const l = Math.floor(Math.random() * LANE_COUNT);
        if (Math.random() < 0.65) {
          this._spawnCoinLine(l, Z_SPAWN, 4, 45, {});
        } else {
          this._spawnArcTrail(l, Z_SPAWN, false);
        }
      }

      // Powerup spawn timer
      this.powerupTimer -= dt;
      if (this.powerupTimer <= 0) {
        this.powerupTimer = randRange(12, 18);
        const l = Math.floor(Math.random() * LANE_COUNT);
        const keys = Object.keys(POWERUP_METAS);
        const chosen = keys[Math.floor(Math.random() * keys.length)];
        this._spawnPowerup(l, Z_SPAWN, chosen);
      }

      // Move items along z towards camera
      for (const item of this.items) {
        item.z -= speed * dt;
        item.spin += dt * 4;
      }

      // 3D Magnet suction pull towards player
      if (this.activePowerUps.magnet) {
        for (const item of this.items) {
          if (item.collected || item.type !== 'coin') continue;
          const dz = item.z - PLAYER_Z;
          const dLane = item.laneNorm - player.laneNorm;
          if (dz > -40 && dz < 420) {
            // Smoothly magnetize towards player's lane and position
            item.laneNorm -= dLane * 7.5 * dt;
            item.z -= Math.sign(dz) * 140 * dt;
            // Also magnetize height towards player's elevation
            const pElev = player.baseHeight + player.jumpHeight;
            item.heightOffset = lerp(item.heightOffset, pElev, 1 - Math.exp(-12 * dt));
          }
        }
      }

      // 3D Collision / Collection check
      for (const item of this.items) {
        if (item.collected) continue;

        const isMagnetized = this.activePowerUps.magnet && item.type === 'coin';
        const depthDiff = Math.abs(item.z - PLAYER_Z);
        const laneDiff = Math.abs(player.laneNorm - item.laneNorm);

        // Collectible pickup tolerance
        if (depthDiff < 44 && (laneDiff < 0.60 || isMagnetized)) {
          // Height matching: roof coins require being on roof or jumping
          const playerElev = player.baseHeight + player.jumpHeight;
          if (item.heightOffset > 35) {
            if (Math.abs(playerElev - item.heightOffset) > 42 && !isMagnetized) continue;
          } else {
            // Ground coin: not picked up if player is high on roof without magnet
            if (player.baseHeight > 40 && !player.sliding && !isMagnetized) continue;
          }

          if (item.requiresJump && !player.jumping && !isMagnetized) continue;
          if (item.requiresSlide && !player.sliding && !isMagnetized) continue;

          this._collect(item, player, particles);
        }
      }

      // Sky Coins generation during Jetpack flight
      if (player && player.hasJetpack) {
        this.skyCoinTimer = (this.skyCoinTimer || 0) - dt;
        if (this.skyCoinTimer <= 0) {
          this.skyCoinTimer = 0.22;
          const skyWaveY = 145 + Math.sin(this.items.length * 0.7) * 24;
          this.items.push(new CollectibleItem(player.lane, Z_SPAWN, 'coin', { heightOffset: skyWaveY }));
        }
      }

      // Filter collected and out-of-screen items
      this.items = this.items.filter(i => !i.collected && i.z > -80);

      // Decrement active timed power-ups
      for (const key of Object.keys(this.activePowerUps)) {
        this.activePowerUps[key] -= dt;
        if (this.activePowerUps[key] <= 0) {
          delete this.activePowerUps[key];
          if (key === 'jetpack' && player) player.hasJetpack = false;
          if (key === 'sneakers' && player) player.hasSneakers = false;
          if (key === 'hoverboard' && player) player.hasHoverboard = false;
        }
      }
    }

    _collect(item, player, particles) {
      item.collected = true;
      const pos = project3D(item.laneNorm, item.z, item.heightOffset);

      if (item.type === 'coin') {
        this.coinCount++;
        const multiplier = this.activePowerUps.multiplier ? 2 : 1;
        const gain = 10 * multiplier;
        this.coinScore += gain;
        try { SoundSystem.coin(); } catch (e) {}
        if (particles) {
          particles.burst(pos.x, pos.y, '#ffd23f', 10, 45, 130);
          particles.spawnText(pos.x, pos.y - 12, `+${gain}`, '#ffd23f');
        }
        if (this.onCoinCollected) this.onCoinCollected(1);
      } else if (item.type === 'shield') {
        this.shieldCharges = Math.min(3, this.shieldCharges + 1);
        try { SoundSystem.powerup(); } catch (e) {}
        if (particles) {
          particles.burst(pos.x, pos.y, '#06d6a0', 16, 60, 200);
          particles.spawnText(pos.x, pos.y - 12, 'SHIELD ARMED', '#06d6a0');
        }
        if (this.onPowerupCollected) this.onPowerupCollected('shield');
      } else {
        const meta = POWERUP_METAS[item.type] || { name: item.type.toUpperCase(), duration: 10, color: '#facc15' };
        let duration = meta.duration;
        if (item.type === 'magnet' && this.magnetDuration) duration = this.magnetDuration;
        if (item.type === 'multiplier' && this.multiplierDuration) duration = this.multiplierDuration;
        if (item.type === 'jetpack' && this.jetpackDuration) duration = this.jetpackDuration;
        if (item.type === 'sneakers' && this.sneakersDuration) duration = this.sneakersDuration;

        this.activePowerUps[item.type] = duration;

        if (item.type === 'jetpack' && player) {
          player.hasJetpack = true;
          try { SoundSystem.jetpack(); } catch (e) {}
        } else if (item.type === 'sneakers' && player) {
          player.hasSneakers = true;
          try { SoundSystem.sneakers(); } catch (e) {}
        } else if (item.type === 'hoverboard' && player) {
          player.hasHoverboard = true;
          try { SoundSystem.hoverboard(); } catch (e) {}
        } else {
          try { SoundSystem.powerup(); } catch (e) {}
        }

        if (particles) {
          particles.burst(pos.x, pos.y, meta.color, 20, 70, 220);
          particles.spawnText(pos.x, pos.y - 14, meta.name, meta.color);
        }
        if (this.onPowerupCollected) this.onPowerupCollected(item.type);
      }
    }

    render(ctx) {
      for (const item of this.items) {
        this.renderItem(ctx, item);
      }
    }

    renderItem(ctx, item) {
      if (item.z < -60 || item.z > Z_SPAWN + 80) return;
      ctx.save();

      const pos = project3D(item.laneNorm, item.z, item.heightOffset);
      const groundPos = project3D(item.laneNorm, item.z, 0);
      const s = pos.scale;
      const r = item.radius * s;

      if (item.type === 'coin') {
        // 3D Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(groundPos.x, groundPos.y, r * 0.9, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3D Spinning Gold Coin
        const wobble = Math.cos(item.spin);
        const w = Math.max(2, r * Math.abs(wobble));

        const coinGrad = ctx.createLinearGradient(pos.x - w, pos.y - r, pos.x + w, pos.y + r);
        coinGrad.addColorStop(0, '#fffbe0');
        coinGrad.addColorStop(0.5, '#ffd23f');
        coinGrad.addColorStop(1, '#ff9100');

        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, w, r, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 1.2 * s);
        ctx.stroke();

        // Inner metallic rim when facing camera
        if (w > 4 * s) {
          ctx.strokeStyle = 'rgba(184, 93, 0, 0.55)';
          ctx.lineWidth = Math.max(0.8, 1 * s);
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y, w * 0.65, r * 0.65, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        // Power-up Orb with orbiting energy aura rings
        const meta = POWERUP_METAS[item.type];

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(groundPos.x, groundPos.y, r * 1.1, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Outer rotating halo ring
        ctx.strokeStyle = meta.color;
        ctx.lineWidth = Math.max(1, 1.8 * s);
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, r * 1.5, r * 0.6, item.spin * 2.2, 0, Math.PI * 2);
        ctx.stroke();

        // Core Orb
        const orbGrad = ctx.createRadialGradient(pos.x - 3 * s, pos.y - 3 * s, 2 * s, pos.x, pos.y, r);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.4, meta.color);
        orbGrad.addColorStop(1, '#0b0f19');

        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        if (s > 0.35) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(10, 14 * s)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(meta.icon, pos.x, pos.y);
        }
      }

      ctx.restore();
    }
  }

  /* ============================================================
     MAIN GAME ENGINE
     ============================================================ */
  const GameStates = Object.freeze({
    SPLASH: 'SPLASH',
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
  const PROFILE_STORAGE_KEY = 'run_and_run_pilot_profile';

  class GameApp {
    constructor() {
      // Start in Subway Surfers Splash Loading Screen (Page 1)
      this.state = GameStates.SPLASH;
      this.splashProgress = 0;
      this.splashDuration = 2.0; // 2 seconds loading
      this.splashDismissed = false;

      this.splashScreen = document.getElementById('splashScreen');
      this.splashProgressFill = document.getElementById('splashProgressFill');
      this.splashPercentText = document.getElementById('splashPercentText');
      this.splashTipText = document.getElementById('splashTipText');

      if (this.splashScreen) {
        const tapToSkip = () => {
          if (this.state === GameStates.SPLASH) {
            this.dismissSplash();
          }
        };
        this.splashScreen.addEventListener('click', tapToSkip);
        this.splashScreen.addEventListener('touchend', tapToSkip);
      }

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

      // Subway Surfers Missions & Multiplier System
      this.baseMultiplier = this.loadBaseMultiplier();
      this.missionsState = this.loadMissionsState();
      this.missionToastTimeout = null;
      this.updateMissionsNotificationBadge();

      // Pilot Profile & Rank
      this.profile = this.loadProfile();
      this.updateProfileUI();

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

    loadBaseMultiplier() {
      try {
        const val = parseInt(localStorage.getItem('subway_base_multiplier'), 10);
        return (val >= 1 && val <= 30) ? val : 1;
      } catch (e) {
        return 1;
      }
    }

    saveBaseMultiplier(mult) {
      try {
        localStorage.setItem('subway_base_multiplier', String(mult));
      } catch (e) {}
    }

    loadMissionsState() {
      try {
        const val = localStorage.getItem('subway_missions_state');
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            MISSIONS_DATA.forEach(m => {
              if (!parsed[m.id]) {
                parsed[m.id] = { progress: 0, completed: false, claimed: false };
              }
            });
            return parsed;
          }
        }
      } catch (e) {}
      const state = {};
      MISSIONS_DATA.forEach(m => {
        state[m.id] = { progress: 0, completed: false, claimed: false };
      });
      return state;
    }

    saveMissionsState() {
      try {
        localStorage.setItem('subway_missions_state', JSON.stringify(this.missionsState));
      } catch (e) {}
    }

    checkMissionEvent(type, amount = 1) {
      if (!this.missionsState) return;
      let stateChanged = false;
      MISSIONS_DATA.forEach(m => {
        const mState = this.missionsState[m.id] || { progress: 0, completed: false, claimed: false };
        if (mState.completed) return;

        if (m.type === type) {
          if (type === 'single_coins' || type === 'score') {
            mState.progress = Math.max(mState.progress, amount);
          } else {
            mState.progress += amount;
          }

          if (mState.progress >= m.target) {
            mState.progress = m.target;
            mState.completed = true;
            stateChanged = true;
            this.showMissionToast(m);
            try { SoundSystem.missionComplete(); } catch (e) {}
          } else {
            stateChanged = true;
          }
        }
      });
      if (stateChanged) {
        this.saveMissionsState();
        this.updateMissionsNotificationBadge();
      }
    }

    showMissionToast(mission) {
      const toast = document.getElementById('missionToast');
      const text = document.getElementById('missionToastText');
      if (toast && text) {
        text.textContent = `🎯 MISSION COMPLETE: ${mission.title}!`;
        toast.classList.remove('hidden');
        toast.classList.add('slide-in');
        clearTimeout(this.missionToastTimeout);
        this.missionToastTimeout = setTimeout(() => {
          toast.classList.remove('slide-in');
          toast.classList.add('hidden');
        }, 3600);
      }
    }

    claimMission(missionId) {
      const m = MISSIONS_DATA.find(x => x.id === missionId);
      const mState = this.missionsState ? this.missionsState[missionId] : null;
      if (!m || !mState || !mState.completed || mState.claimed) return;

      mState.claimed = true;
      this.bankCoins += m.rewardCoins;
      this.saveBankCoins(this.bankCoins);

      if (m.rewardMult > 0) {
        this.baseMultiplier = Math.min(30, (this.baseMultiplier || 1) + m.rewardMult);
        this.saveBaseMultiplier(this.baseMultiplier);
      }

      this.saveMissionsState();
      try { SoundSystem.buy(); } catch (e) {}
      this.updateBankDisplays();
      this.renderMissionsModal();
      this.updateMissionsNotificationBadge();
    }

    renderMissionsModal() {
      const container = document.getElementById('missionsList');
      const multVal = document.getElementById('missionsMultiplierVal') || document.getElementById('modalMultiplierVal');
      if (multVal) multVal.textContent = `x${this.baseMultiplier || 1} ⭐`;
      if (!container) return;
      container.innerHTML = '';

      MISSIONS_DATA.forEach(m => {
        const mState = (this.missionsState && this.missionsState[m.id]) || { progress: 0, completed: false, claimed: false };
        const card = document.createElement('div');
        card.className = `mission-item-card ${mState.claimed ? 'claimed' : (mState.completed ? 'completed' : '')}`;

        const pct = Math.min(100, Math.floor((mState.progress / m.target) * 100));

        card.innerHTML = `
          <div class="mission-info-left">
            <div class="mission-icon-box">${m.icon}</div>
            <div class="mission-text">
              <div class="mission-title">${m.title}</div>
              <div class="mission-progress-bar-wrap">
                <div class="mission-progress-bar-fill" style="width: ${pct}%"></div>
              </div>
              <div class="mission-progress-num">${mState.progress} / ${m.target} (${pct}%)</div>
            </div>
          </div>
          <div class="mission-action-right">
            ${mState.claimed ? `
              <button class="mission-btn mission-claimed-btn" disabled>CLAIMED ✓</button>
            ` : (mState.completed ? `
              <button class="mission-btn mission-claim-btn" data-mission="${m.id}">CLAIM 🪙 +${m.rewardCoins}${m.rewardMult ? ` ⭐ +${m.rewardMult}X` : ''}</button>
            ` : `
              <div class="mission-reward-tag">🪙 +${m.rewardCoins}${m.rewardMult ? ` ⭐ +${m.rewardMult}X` : ''}</div>
            `)}
          </div>
        `;

        const claimBtn = card.querySelector('.mission-claim-btn');
        if (claimBtn) {
          this.attachButtonAction(claimBtn, () => {
            this.claimMission(m.id);
          });
        }

        container.appendChild(card);
      });
    }

    updateMissionsNotificationBadge() {
      if (!this.missionsState) return;
      const unclaimedCount = MISSIONS_DATA.filter(m => {
        const s = this.missionsState[m.id];
        return s && s.completed && !s.claimed;
      }).length;

      const badge = document.getElementById('missionsNotificationBadge');
      if (badge) {
        if (unclaimedCount > 0) {
          badge.textContent = unclaimedCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }
    }

    renderLeaderboardModal() {
      const container = document.getElementById('leaderboardList');
      if (!container) return;
      container.innerHTML = '';

      const myScore = this.bestScore || 0;
      const myName = (this.profile && this.profile.callsign) ? this.profile.callsign : 'YOU';
      const myAvatar = (this.profile && this.profile.avatar) ? this.profile.avatar : '🏃';

      const rivals = [
        { name: 'Kai_Speedster', avatar: '⚡', score: Math.max(12500, Math.floor(myScore * 1.35) + 450), league: 'DIAMOND', medal: '🥇' },
        { name: 'Tokyo_Rider', avatar: '🐙', score: Math.max(9200, Math.floor(myScore * 1.18) + 210), league: 'DIAMOND', medal: '🥈' },
        { name: 'SubwaySurfer99', avatar: '🛹', score: Math.max(7600, Math.floor(myScore * 1.05) + 90), league: 'GOLD', medal: '🥉' },
        { name: myName, avatar: myAvatar, score: myScore, league: this.getProfileRank(myScore).title.split(' ')[1] || 'GOLD', isMe: true },
        { name: 'TrackPhantom', avatar: '👻', score: Math.max(3400, Math.floor(myScore * 0.82)), league: 'SILVER' },
        { name: 'NeonDash', avatar: '🚀', score: Math.max(2100, Math.floor(myScore * 0.65)), league: 'BRONZE' },
        { name: 'RookieSkater', avatar: '👟', score: Math.max(900, Math.floor(myScore * 0.40)), league: 'BRONZE' }
      ];

      rivals.sort((a, b) => b.score - a.score);

      rivals.forEach((r, idx) => {
        const rankNum = idx + 1;
        const card = document.createElement('div');
        card.className = `leaderboard-item-card ${r.isMe ? 'my-rank' : ''}`;
        const medalOrNum = r.medal || `#${rankNum}`;

        card.innerHTML = `
          <div class="lb-rank-num ${rankNum <= 3 ? 'top-three' : ''}">${medalOrNum}</div>
          <div class="lb-avatar">${r.avatar}</div>
          <div class="lb-info">
            <div class="lb-name">${r.name} ${r.isMe ? '<span class="lb-me-tag">YOU</span>' : ''}</div>
            <div class="lb-league-badge">${r.league}</div>
          </div>
          <div class="lb-score">🏆 ${r.score.toLocaleString()}</div>
        `;
        container.appendChild(card);
      });
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
          if (Array.isArray(arr) && arr.length) {
            return arr.map(id => (COSTUMES[id] ? COSTUMES[id].id : id));
          }
        }
      } catch (e) {}
      return ['jake'];
    }

    saveUnlockedCostumes(arr) {
      try {
        localStorage.setItem(COSTUMES_STORAGE_KEY, JSON.stringify(arr));
      } catch (e) {}
    }

    loadEquippedCostume() {
      try {
        const ver = localStorage.getItem('subway_costume_ver');
        if (ver !== 'v14') {
          localStorage.setItem('subway_costume_ver', 'v14');
          localStorage.setItem(EQUIPPED_STORAGE_KEY, 'jake');
          return 'jake';
        }
        const val = localStorage.getItem(EQUIPPED_STORAGE_KEY);
        if (val && COSTUMES[val]) return COSTUMES[val].id;
      } catch (e) {}
      return 'jake';
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

    loadProfile() {
      try {
        const val = localStorage.getItem('subway_player_profile') || localStorage.getItem(PROFILE_STORAGE_KEY);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed === 'object') {
            const rawName = (parsed.callsign || '').trim();
            // Discard system-decided defaults from older versions
            if (rawName && rawName !== 'NEO_KARTIK' && rawName !== 'CYBER_RUNNER') {
              return {
                callsign: rawName.slice(0, 14),
                avatar: parsed.avatar || '🏃'
              };
            }
          }
        }
      } catch (e) {}
      return { callsign: 'RUNNER 1', avatar: '🏃' };
    }

    saveProfile(callsign, avatar) {
      if (!this.profile) this.profile = { callsign: 'RUNNER 1', avatar: '🏃' };
      const clean = (callsign || '').trim().slice(0, 14);
      if (clean) this.profile.callsign = clean;
      if (avatar !== undefined) this.profile.avatar = avatar || '🏃';
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
        localStorage.setItem('subway_player_profile', JSON.stringify(this.profile));
        localStorage.setItem('subway_player_name', this.profile.callsign);
      } catch (e) {}
      this.updateProfileUI();
    }

    getProfileRank(score) {
      if (score >= 7000) return { title: '👑 DIAMOND SURFER', tier: 'TIER 5' };
      if (score >= 3500) return { title: '⚡ GOLD RUNNER', tier: 'TIER 4' };
      if (score >= 1500) return { title: '🚀 SILVER TRACKER', tier: 'TIER 3' };
      if (score >= 500) return { title: '🛡️ BRONZE ROOKIE', tier: 'TIER 2' };
      return { title: '🏃 STREET RUNNER', tier: 'TIER 1' };
    }

    updateProfileUI() {
      const callsign = (this.profile && this.profile.callsign) ? this.profile.callsign : 'RUNNER 1';
      const avatar = (this.profile && this.profile.avatar) ? this.profile.avatar : '🏃';
      const rankInfo = this.getProfileRank(this.bestScore);

      // Top bar profile button
      const avatarPill = document.getElementById('profileAvatarPill');
      const callsignPill = document.getElementById('profileCallsignPill');
      if (avatarPill) avatarPill.textContent = avatar;
      if (callsignPill) callsignPill.textContent = callsign;

      // Settings Modal Profile Tab
      const bigAvatar = document.getElementById('profileBigAvatar');
      const rankBadge = document.getElementById('profileRankBadge');
      const input = document.getElementById('profileCallsignInput');
      const statBest = document.getElementById('profileStatBest');
      const statBank = document.getElementById('profileStatBank');
      const statTier = document.getElementById('profileStatTier');

      if (bigAvatar) bigAvatar.textContent = avatar;
      if (rankBadge) rankBadge.textContent = rankInfo.title;
      if (input && document.activeElement !== input) input.value = callsign;
      if (statBest) statBest.textContent = this.bestScore;
      if (statBank) statBank.textContent = this.bankCoins;
      if (statTier) statTier.textContent = rankInfo.tier;

      // Dedicated Name Modal input
      const nameModalInput = document.getElementById('playerNameInput');
      if (nameModalInput && document.activeElement !== nameModalInput) {
        nameModalInput.value = (callsign === 'RUNNER 1' || callsign === 'SET NAME') ? '' : callsign;
      }

      // Highlight active avatar in pickers
      document.querySelectorAll('.avatar-chip, .avatar-choice-btn').forEach(chip => {
        const val = chip.getAttribute('data-avatar') || chip.getAttribute('data-av');
        if (val === avatar) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });

      // Game Over debrief
      const goAvatar = document.getElementById('gameoverAvatar');
      const goCallsign = document.getElementById('gameoverCallsign');
      if (goAvatar) goAvatar.textContent = avatar;
      if (goCallsign) goCallsign.textContent = callsign;

      // Sync active world button in Settings > Worlds tab
      for (let i = 0; i < THEMES.length; i++) {
        const btn = document.getElementById(`bgBtn${i}`);
        if (btn) {
          if (i === this.selectedBgIndex) btn.classList.add('active');
          else btn.classList.remove('active');
        }
      }
      const bgNameEl = document.getElementById('bgSelectedName');
      if (bgNameEl && THEMES[this.selectedBgIndex]) {
        bgNameEl.textContent = THEMES[this.selectedBgIndex].name;
      }
    }

    loadSelectedBg() {
      try {
        const ver = localStorage.getItem('run_and_run_bg_ver');
        if (ver !== 'v13') {
          localStorage.setItem('run_and_run_bg_ver', 'v13');
          localStorage.setItem(BG_STORAGE_KEY, '0');
          return 0;
        }
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

    renderWorldTourModal() {
      const container = document.getElementById('worldTourCards');
      if (!container) return;
      container.innerHTML = '';
      THEMES.forEach((theme, idx) => {
        const card = document.createElement('div');
        card.className = `world-city-card ${idx === this.selectedBgIndex ? 'active' : ''}`;
        card.innerHTML = `
          <div class="world-city-flag">${theme.flag || '🏙️'}</div>
          <div class="world-city-info">
            <span class="world-city-name">${theme.name}</span>
            <small class="world-city-status">${idx === this.selectedBgIndex ? '● ACTIVE WORLD' : 'TAP TO SELECT'}</small>
          </div>
        `;
        card.onclick = () => {
          this.selectBackground(idx);
          try { SoundSystem.equip(); } catch (e) {}
          this.renderWorldTourModal();
          const modal = document.getElementById('worldTourModal');
          if (modal) {
            setTimeout(() => modal.classList.add('hidden'), 200);
          }
        };
        container.appendChild(card);
      });
    }

    resetRun() {
      this.distance = 0;
      this.elapsed = 0;
      this.baseSpeed = 330;
      this.maxSpeed = 880;
      this.speed = this.baseSpeed;
      this.speedRamp = 3.8;
      this.slowMoTimer = 0;
      this.tauntTimer = 0;

      // Hoverboard supply stock
      const hbLevel = this.upgrades.hoverboard || 1;
      const hbConf = (UPGRADES.hoverboard && UPGRADES.hoverboard.levels[hbLevel - 1]) || { stock: 3 };
      this.hoverboardStock = hbConf.stock || 3;

      const currentCostume = COSTUMES[this.equippedCostume] || COSTUMES.jake;
      this.player = new Player(currentCostume);
      this.track = new TrackManager();
      this.collectibles = new CollectibleManager();

      // Retrieve player's upgraded stats
      const magnetLevel = this.upgrades.magnet || 1;
      const magnetConf = UPGRADES.magnet.levels[magnetLevel - 1] || UPGRADES.magnet.levels[0];

      const multiplierLevel = this.upgrades.multiplier || 1;
      const multiplierConf = UPGRADES.multiplier.levels[multiplierLevel - 1] || UPGRADES.multiplier.levels[0];

      const jetpackLevel = this.upgrades.jetpack || 1;
      const jetpackConf = (UPGRADES.jetpack && UPGRADES.jetpack.levels[jetpackLevel - 1]) || { duration: 9 };

      const sneakersLevel = this.upgrades.sneakers || 1;
      const sneakersConf = (UPGRADES.sneakers && UPGRADES.sneakers.levels[sneakersLevel - 1]) || { duration: 14 };

      const shieldLevel = this.upgrades.shield || 0;
      const shieldConf = UPGRADES.shield.levels[shieldLevel] || UPGRADES.shield.levels[0];

      this.track.onObstacleSpawned = (o) => this.collectibles.onObstacleSpawned(o);
      this.track.reset();
      this.collectibles.reset(shieldConf.shields, magnetConf.duration, magnetConf.radius, multiplierConf.duration);
      this.collectibles.jetpackDuration = jetpackConf.duration;
      this.collectibles.sneakersDuration = sneakersConf.duration;

      // Hook mission progress tracking
      this.collectibles.onCoinCollected = () => {
        this.checkMissionEvent('single_coins', this.collectibles.coinCount);
      };
      this.collectibles.onPowerupCollected = (pType) => {
        this.checkMissionEvent('powerups', 1);
        try { SoundSystem.taunt(); } catch (e) {}
      };
      this.player.onJump = () => {
        this.checkMissionEvent('jumps', 1);
      };
      this.player.onSlide = () => {
        this.checkMissionEvent('slides', 1);
      };

      // Maintain user's chosen background
      this.themeIndex = this.selectedBgIndex;
      this.prevThemeIndex = this.selectedBgIndex;
      this.themeBlend = 1;
      this.themeTimer = 0;
    }

    getScore() {
      const activeMult = (this.collectibles && this.collectibles.activePowerUps && this.collectibles.activePowerUps.multiplier) ? 2 : 1;
      const totalMult = (this.baseMultiplier || 1) * activeMult;
      return (Math.floor(this.distance / 10) + (this.collectibles ? this.collectibles.coinScore : 0)) * totalMult;
    }

    activateHoverboard() {
      if (this.state !== GameStates.PLAYING) return;
      if (this.player.hasHoverboard || (this.collectibles && this.collectibles.activePowerUps.hoverboard)) {
        return;
      }
      if (this.hoverboardStock <= 0) {
        this.particles.spawnText(this.player.x, this.player.groundY - 95, 'NO BOARDS! 🛹', '#ef4444');
        try { SoundSystem.equip(); } catch (e) {}
        return;
      }
      this.hoverboardStock--;
      this.player.hasHoverboard = true;
      if (!this.collectibles.activePowerUps) this.collectibles.activePowerUps = {};
      this.collectibles.activePowerUps.hoverboard = 30;
      try { SoundSystem.hoverboard(); } catch (e) {}
      this.particles.burst(this.player.x, this.player.groundY, '#38bdf8', 24);
      this.particles.spawnText(this.player.x, this.player.groundY - 110, 'HOVERBOARD ON! 🛹', '#38bdf8');
      this.checkMissionEvent('hoverboard', 1);
      this.syncHUD();
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

      const uniqueSuits = ['jake', 'tricky', 'fresh', 'spike', 'yutani'].map(id => COSTUMES[id]).filter(Boolean);
      for (const suit of uniqueSuits) {
        const isUnlocked = this.unlockedCostumes.includes(suit.id);
        const isEquipped = this.equippedCostume === suit.id;

        const card = document.createElement('div');
        card.className = `costume-item-card ${isEquipped ? 'equipped' : ''}`;

        const left = document.createElement('div');
        left.className = 'costume-info-left';

        // 3D Mini Avatar Canvas Preview
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = 60;
        previewCanvas.height = 70;
        previewCanvas.className = 'costume-avatar-canvas';
        const pctx = previewCanvas.getContext('2d');
        if (pctx) {
          drawHumanoidRunner(pctx, 30, 62, 0, false, false, 0, 0, suit, 0, false, 0.72, 0, true);
        }

        const text = document.createElement('div');
        text.className = 'costume-text';
        text.innerHTML = `<span class="costume-name">${suit.name}</span><span class="costume-desc">${suit.desc}</span>`;

        left.appendChild(previewCanvas);
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

      const suit = COSTUMES[this.equippedCostume] || COSTUMES.jake;
      // Draw front-facing Subway Surfer on pedestal
      drawHumanoidRunner(
        actx,
        this.avatarCanvas.width / 2,
        this.avatarCanvas.height - 18,
        this.avatarAnimTime,
        false,
        false,
        0,
        0,
        suit,
        0,
        false,
        0.95,
        0,
        true
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
        this.updateProfileUI();
        if (settingsModal) settingsModal.classList.remove('hidden');
      });
      this.attachButtonAction('closeSettingsBtn', () => {
        if (settingsModal) settingsModal.classList.add('hidden');
      });
      this.attachButtonAction('applySettingsBtn', () => {
        if (settingsModal) settingsModal.classList.add('hidden');
      });

      // Dedicated Runner Name Modal (Direct Custom Name Input)
      const nameModal = document.getElementById('nameModal');
      this.attachButtonAction('menuProfileBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        this.updateProfileUI();
        if (nameModal) {
          nameModal.classList.remove('hidden');
          const inp = document.getElementById('playerNameInput');
          if (inp) {
            setTimeout(() => { inp.focus(); inp.select(); }, 120);
          }
        }
      });

      // Name Modal Save Button
      this.attachButtonAction('saveRunnerNameBtn', () => {
        const inp = document.getElementById('playerNameInput');
        const name = (inp && inp.value.trim()) ? inp.value.trim() : 'RUNNER 1';
        this.saveProfile(name, this.profile.avatar);
        try { SoundSystem.equip(); } catch (e) {}
        if (nameModal) nameModal.classList.add('hidden');
      });

      // Name Modal Close Button
      this.attachButtonAction('closeNameModalBtn', () => {
        if (nameModal) nameModal.classList.add('hidden');
      });

      // Name Modal Avatar Pickers
      document.querySelectorAll('.avatar-choice-btn').forEach(btn => {
        this.attachButtonAction(btn, () => {
          const av = btn.getAttribute('data-av');
          this.saveProfile(this.profile.callsign, av);
          try { SoundSystem.equip(); } catch (e) {}
        });
      });

      // World Tour Modal Open/Close
      const worldTourModal = document.getElementById('worldTourModal');
      this.attachButtonAction('menuWorldBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        this.renderWorldTourModal();
        if (worldTourModal) worldTourModal.classList.remove('hidden');
      });

      this.attachButtonAction('closeWorldTourBtn', () => {
        if (worldTourModal) worldTourModal.classList.add('hidden');
      });

      // Side Rail: Missions & Challenges (QUESTS)
      const missionsModal = document.getElementById('missionsModal');
      this.attachButtonAction('menuMissionsBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        this.renderMissionsModal();
        if (missionsModal) missionsModal.classList.remove('hidden');
      });
      this.attachButtonAction('closeMissionsBtn', () => {
        if (missionsModal) missionsModal.classList.add('hidden');
      });
      this.attachButtonAction('closeMissionsDoneBtn', () => {
        if (missionsModal) missionsModal.classList.add('hidden');
      });

      // Side Rail: Top Run Leaderboard
      const leaderboardModal = document.getElementById('leaderboardModal');
      this.attachButtonAction('menuLeaderboardBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        this.renderLeaderboardModal();
        if (leaderboardModal) leaderboardModal.classList.remove('hidden');
      });
      this.attachButtonAction('closeLeaderboardBtn', () => {
        if (leaderboardModal) leaderboardModal.classList.add('hidden');
      });
      this.attachButtonAction('closeLeaderboardDoneBtn', () => {
        if (leaderboardModal) leaderboardModal.classList.add('hidden');
      });

      // HUD Hoverboard Button
      this.attachButtonAction('hudHoverboardBtn', () => {
        this.activateHoverboard();
      });

      // Side Rail: Character Suits (ME)
      this.attachButtonAction('menuSuitsBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        openShop();
        const tabBtn = document.getElementById('tabBtnCostumes');
        if (tabBtn) tabBtn.click();
      });

      // Side Rail: Boosters / Upgrades
      this.attachButtonAction('menuUpgradesBtn', () => {
        try { SoundSystem.ensure(); } catch (e) {}
        openShop();
        const tabBtn = document.getElementById('tabBtnShopUpgrades');
        if (tabBtn) tabBtn.click();
      });

      // Profile Save button in Settings
      this.attachButtonAction('profileSaveBtn', () => {
        const input = document.getElementById('profileCallsignInput');
        const name = input ? input.value : this.profile.callsign;
        this.saveProfile(name, this.profile.avatar);
        try { SoundSystem.equip(); } catch (e) {}
        const btn = document.getElementById('profileSaveBtn');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'SAVED!';
          setTimeout(() => { btn.textContent = orig; }, 1200);
        }
      });

      // Avatar Chips in Settings Picker
      document.querySelectorAll('.avatar-chip').forEach(chip => {
        this.attachButtonAction(chip, () => {
          const av = chip.getAttribute('data-avatar');
          this.saveProfile(this.profile.callsign, av);
          try { SoundSystem.equip(); } catch (e) {}
        });
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
      const restartBtn = document.getElementById('restartBtn');
      if (restartBtn) {
        this.attachButtonAction(restartBtn, (e) => {
          if (e) {
            try { e.stopPropagation(); } catch (err) {}
          }
          try {
            SoundSystem.ensure();
            SoundSystem.startBgm();
          } catch (err) {}
          this.resetRun();
          this.setState(GameStates.PLAYING);
        });
      }

      const menuBtn = document.getElementById('menuBtn');
      if (menuBtn) {
        this.attachButtonAction(menuBtn, (e) => {
          if (e) {
            try { e.stopPropagation(); } catch (err) {}
          }
          try { SoundSystem.stopBgm(); } catch (err) {}
          this.setState(GameStates.MENU);
        });
      }

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
      let lastCanvasTapTime = 0;
      const swipeThreshold = 30;

      canvas.addEventListener('touchstart', (e) => {
        SoundSystem.ensure();
        if (this.state !== GameStates.PLAYING) return;
        const now = Date.now();
        if (now - lastCanvasTapTime < 320) {
          this.activateHoverboard();
        }
        lastCanvasTapTime = now;
        const t = e.changedTouches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchActive = true;
      }, { passive: true });

      canvas.addEventListener('dblclick', () => {
        if (this.state === GameStates.PLAYING) {
          this.activateHoverboard();
        }
      });

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

    dismissSplash() {
      if (this.splashDismissed) return;
      this.splashDismissed = true;
      if (this.splashProgressFill) this.splashProgressFill.style.width = '100%';
      if (this.splashPercentText) this.splashPercentText.textContent = '100%';
      if (this.splashScreen) {
        this.splashScreen.classList.add('fade-out');
        setTimeout(() => {
          this.splashScreen.classList.add('hidden');
        }, 650);
      }
      this.setState(GameStates.MENU);
    }

    setState(next) {
      this.state = next;

      // Hide all overlays initially
      this.menuScreen.classList.add('hidden');
      this.pauseScreen.classList.add('hidden');
      this.gameOverScreen.classList.add('hidden');
      this.hud.classList.add('hidden');
      this.virtualControls.classList.add('hidden');

      if (next === GameStates.SPLASH) {
        if (this.splashScreen) {
          this.splashScreen.classList.remove('hidden');
          this.splashScreen.classList.remove('fade-out');
        }
      } else if (next === GameStates.MENU) {
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
        const isNewBest = score > this.bestScore;
        if (isNewBest) {
          this.bestScore = score;
          this.saveBest(score);
        }
        const finalScoreEl = document.getElementById('finalScore');
        if (finalScoreEl) finalScoreEl.textContent = score;
        const finalCoinsEl = document.getElementById('finalCoins');
        if (finalCoinsEl) finalCoinsEl.textContent = this.collectibles.coinCount;
        const bestScoreEl = document.getElementById('bestScore');
        if (bestScoreEl) bestScoreEl.textContent = this.bestScore;
        const newBestBadge = document.getElementById('newBestBadge');
        if (newBestBadge) {
          if (isNewBest) newBestBadge.classList.remove('hidden');
          else newBestBadge.classList.add('hidden');
        }
        const gameoverTitle = document.getElementById('gameoverTitle');
        if (gameoverTitle) {
          gameoverTitle.textContent = isNewBest ? 'NEW RECORD! 🏆' : 'GAME OVER';
        }
        this.updateBankDisplays();
        this.updateProfileUI();
        this.gameOverScreen.classList.remove('hidden');
      }
    }

    checkCollisions() {
      if (this.state !== GameStates.PLAYING) return;
      if (!this.player || !this.track) return;

      // Paint Jetpack: complete sky flight altitude clearance above tracks
      if (this.player.hasJetpack || (this.collectibles && this.collectibles.activePowerUps && this.collectibles.activePowerUps.jetpack)) {
        return;
      }

      for (const o of this.track.obstacles) {
        if (o.hit) continue;

        // --- 1. IF PLAYER IS RUNNING HIGH ON A TRAIN ROOF ---
        if (this.player.onTrain || this.player.baseHeight >= 25) {
          if (!o.isTrain) {
            // Ground hurdles (LOW electric hurdle, HIGH laser gate, BLOCK wall) pass harmlessly underneath!
            continue;
          }

          // If obstacle is another train in the runner's lane:
          const laneDiff = Math.abs(this.player.laneNorm - o.laneNorm);
          if (laneDiff <= 0.6) {
            // Check if jumping over or boarding another train
            const distToFront = Math.abs(o.z - PLAYER_Z);
            if (distToFront < 32 && this.player.jumpHeight < 10) {
              // Runner stays mounted on the current or adjacent train roof
              this.player.targetBaseHeight = o.h;
            }
          }
          continue;
        }

        // --- 2. IF PLAYER IS ON THE GROUND TRACK ---
        let collided = false;

        if (o.isTrain) {
          const laneDiff = Math.abs(this.player.laneNorm - o.laneNorm);
          if (laneDiff <= 0.62) {
            // Check front cab approach
            const distToFront = Math.abs(o.z - PLAYER_Z);
            if (distToFront <= 38) {
              if (o.hasRamp) {
                // RAMPED SUBWAY TRAIN: Automatically board and climb onto train roof!
                this.player.onTrain = true;
                this.player.targetBaseHeight = o.h;
                this.player.baseHeight = Math.max(this.player.baseHeight, 18);
                this.player.jumpHeight = 0;
                try { SoundSystem.jump(); } catch (e) {}
                this.particles.burst(this.player.x, this.player.groundY - 24, '#facc15', 18);
                this.particles.spawnText(this.player.x, this.player.groundY - 110, 'ROOF CLIMBED! 🚂', '#facc15');
                this.checkMissionEvent('trains', 1);
                continue;
              } else {
                // CLOSED FLAT CAB TRAIN: Solid metal bumper!
                if (this.player.jumping && (this.player.jumpHeight >= o.h - 18)) {
                  // Super jump vaulted cleanly onto the closed train roof!
                  this.player.onTrain = true;
                  this.player.targetBaseHeight = o.h;
                  this.player.baseHeight = o.h;
                  this.player.jumpHeight = 0;
                  try { SoundSystem.jump(); } catch (e) {}
                  this.particles.spawnText(this.player.x, this.player.groundY - 110, 'ROOF VAULT! 🚂', '#38bdf8');
                  this.checkMissionEvent('trains', 1);
                  continue;
                }
                // Frontal collision with closed train cab
                collided = true;
              }
            } else if (PLAYER_Z > o.z && PLAYER_Z < (o.z + o.length)) {
              // Side impact into moving train carriage
              collided = true;
            }
          }
        } else {
          // Standard ground hurdle collisions
          const depthDiff = Math.abs(o.z - PLAYER_Z);
          if (depthDiff > 36) continue;

          const laneDiff = Math.abs(this.player.laneNorm - o.laneNorm);
          if (laneDiff > 0.58) continue;

          if (o.type.id === 'LOW') {
            // Barrier hurdle: Player must jump over it
            const clearedJump = this.player.jumping && (this.player.jumpHeight >= 28);
            if (!clearedJump) collided = true;
          } else if (o.type.id === 'HIGH') {
            // Overhead gate: Player must slide underneath clearance
            const safelySliding = this.player.sliding && (this.player.jumpHeight <= 8);
            if (!safelySliding) collided = true;
          } else {
            // Monolith Block: Impassable barrier
            collided = true;
          }
        }

        if (collided) {
          o.hit = true;

          // 1. Hoverboard crash-immunity save
          if (this.player.hasHoverboard || (this.collectibles && this.collectibles.activePowerUps && this.collectibles.activePowerUps.hoverboard)) {
            if (this.collectibles && this.collectibles.activePowerUps) {
              delete this.collectibles.activePowerUps.hoverboard;
            }
            this.player.hasHoverboard = false;
            try { SoundSystem.boardCrash(); } catch (e) {}
            ScreenShake.trigger(16, 0.45);
            const pos = project3D(o.laneNorm, o.z, (o.h || (o.type && o.type.h) || 30) / 2);
            this.particles.burst(pos.x, pos.y, '#38bdf8', 32, 100, 320);
            this.particles.spawnText(this.player.x, this.player.groundY - 115, 'BOARD SAVED YOU! 🛹💥', '#38bdf8');
            this.track.obstacles = this.track.obstacles.filter(item => item !== o);
            this.syncHUD();
            continue;
          }

          // 2. Shield absorption
          if (this.collectibles.shieldCharges > 0) {
            this.collectibles.shieldCharges--;
            try { SoundSystem.shieldBreak(); } catch (e) {}
            ScreenShake.trigger(12, 0.35);
            const pos = project3D(o.laneNorm, o.z, (o.h || o.type.h) / 2);
            this.particles.burst(pos.x, pos.y, '#06d6a0', 24);
            this.particles.spawnText(this.player.x, this.player.groundY - 100, 'SHIELD BROKEN', '#ff3366');
            this.track.obstacles = this.track.obstacles.filter(item => item !== o);
          } else {
            // Fatal Crash -> Runner wiped out immediately
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
      this.particles.burst(this.player.x, this.player.groundY - 40 * this.player.scale, '#ff3366', 36, 120, 360);

      // Deposit collected coins into bank
      const earned = this.collectibles.coinCount;
      this.bankCoins += earned;
      this.saveBankCoins(this.bankCoins);

      this.updateProfileUI();
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
      // Progressive difficulty ramp
      this.speed = Math.min(this.maxSpeed, this.baseSpeed + Math.pow(this.elapsed, 1.14) * 2.2);
      this.distance += this.speed * dt;

      // Near-miss obstacle detection
      if (this.track && this.track.obstacles) {
        for (const o of this.track.obstacles) {
          if (o.hit || o.nearMissChecked) continue;
          const distZ = Math.abs(o.z - PLAYER_Z);
          const laneDiff = Math.abs(this.player.laneNorm - o.laneNorm);
          if (distZ < 28 && laneDiff > 0.58 && laneDiff < 1.35) {
            o.nearMissChecked = true;
            try { SoundSystem.nearMiss(); } catch (e) {}
            this.particles.spawnText(this.player.x, this.player.groundY - 100, 'NEAR MISS! 💨', '#38bdf8');
            ScreenShake.trigger(5, 0.14);
            this.slowMoTimer = 0.12;
          }
        }
      }

      // Slow-mo brief effect
      if (this.slowMoTimer > 0) {
        this.slowMoTimer -= dt;
        dt *= 0.55;
      }

      // Periodic character voice taunts ("Woohoo!")
      this.tauntTimer = (this.tauntTimer || 0) + dt;
      if (this.tauntTimer > 18) {
        this.tauntTimer = 0;
        try { SoundSystem.taunt(); } catch (e) {}
      }

      // Check run score milestones for missions
      this.checkMissionEvent('score', this.getScore());

      this.player.hasShield = this.collectibles.shieldCharges > 0;
      this.player.update(dt, this.particles, this.track.obstacles);

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

      // Multiplier Tag
      const activeMult = (this.collectibles && this.collectibles.activePowerUps && this.collectibles.activePowerUps.multiplier) ? 2 : 1;
      const totalMult = (this.baseMultiplier || 1) * activeMult;
      const hudMultiplierTag = document.getElementById('hudMultiplierTag');
      if (hudMultiplierTag) {
        hudMultiplierTag.textContent = `${totalMult}X`;
      }

      // Hoverboard HUD Button Stock
      const hudHoverboardBtn = document.getElementById('hudHoverboardBtn');
      const hudHoverboardStock = document.getElementById('hudHoverboardStock') || document.getElementById('hudHoverboardQty');
      if (hudHoverboardBtn && hudHoverboardStock) {
        hudHoverboardStock.textContent = `x${this.hoverboardStock || 0}`;
        if (this.player && this.player.hasHoverboard) {
          hudHoverboardBtn.classList.add('board-active');
        } else {
          hudHoverboardBtn.classList.remove('board-active');
        }
      }

      // Active Powerups Countdown List
      const activeList = document.getElementById('activePowerupsList');
      if (activeList) {
        activeList.innerHTML = '';
        const entries = Object.entries(this.collectibles.activePowerUps);
        if (entries.length > 0) {
          activeList.classList.remove('hidden');
          entries.forEach(([pType, timeLeft]) => {
            const meta = POWERUP_METAS[pType] || { name: pType.toUpperCase(), icon: '⚡', color: '#facc15', duration: 10 };
            const itemEl = document.createElement('div');
            itemEl.className = 'hud-powerup-bar-item';
            const totalDur = meta.duration || 10;
            const pct = Math.min(100, Math.max(0, (timeLeft / totalDur) * 100));
            itemEl.innerHTML = `
              <span class="hud-powerup-icon">${meta.icon}</span>
              <div class="hud-powerup-meter">
                <div class="hud-powerup-fill" style="width: ${pct}%; background: ${meta.color}"></div>
              </div>
              <span class="hud-powerup-time">${Math.ceil(timeLeft)}s</span>
            `;
            activeList.appendChild(itemEl);
          });
        } else {
          activeList.classList.add('hidden');
        }
      }

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

      // Power-up badge (legacy badge fallback)
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
      const railsCol = to.rails || '#e2e8f0';
      const tiesCol = to.ties || '#854d0e';
      const ballastCol = to.ballast || '#64748b';
      const speedRatio = this.state === GameStates.PLAYING ? (this.speed / this.baseSpeed) : 0.6;

      // 1. Dynamic Vibrant Subway Sky Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, VP_Y + 40);
      grad.addColorStop(0, skyTop);
      grad.addColorStop(1, skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

      // Fluffy Cartoon Clouds scrolling in sky
      ctx.save();
      const cloudTime = (this.distance * 0.05) % (DESIGN_WIDTH + 200);
      const clouds = [
        { x: (80 - cloudTime + DESIGN_WIDTH + 200) % (DESIGN_WIDTH + 200) - 100, y: 55, r: 24, w: 90 },
        { x: (260 - cloudTime * 0.8 + DESIGN_WIDTH + 200) % (DESIGN_WIDTH + 200) - 100, y: 95, r: 18, w: 75 },
        { x: (420 - cloudTime * 1.2 + DESIGN_WIDTH + 200) % (DESIGN_WIDTH + 200) - 100, y: 70, r: 28, w: 110 }
      ];
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (const c of clouds) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 0.8, c.y - c.r * 0.3, c.r * 0.9, 0, Math.PI * 2);
        ctx.arc(c.x + c.r * 1.7, c.y, c.r * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Parallax Cityscape with Sun & Horizon Skyline
      this.parallax.render(ctx, this.distance, to, bldgCol, gridCol, speedRatio);

      // 3. Ground Terrain Outside Railroad Track
      ctx.fillStyle = groundCol;
      ctx.fillRect(0, VP_Y, DESIGN_WIDTH, DESIGN_HEIGHT - VP_Y);

      // Authentic Subway Surfers trackside verges:
      if (to.type === 'western') {
        // Bright green grass strips flanking both sides of the railroad (Screenshot 2)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(0, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_BG / 2 - 10, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_FG / 2 - 25, DESIGN_HEIGHT);
        ctx.lineTo(0, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(DESIGN_WIDTH, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_BG / 2 + 10, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_FG / 2 + 25, DESIGN_HEIGHT);
        ctx.lineTo(DESIGN_WIDTH, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();

        // Wooden boardwalk sidewalks flanking the tracks
        ctx.fillStyle = '#92400e';
        ctx.fillRect(0, DESIGN_HEIGHT - 65, Math.max(0, VP_X - ROAD_WIDTH_FG / 2 - 32), 65);
        ctx.fillRect(VP_X + ROAD_WIDTH_FG / 2 + 32, DESIGN_HEIGHT - 65, DESIGN_WIDTH, 65);
      } else if (to.type === 'rio') {
        // Rio Carnival: Golden tropical beach sand with turquoise ocean water
        ctx.fillStyle = '#fde047';
        // Left sand beach
        ctx.beginPath();
        ctx.moveTo(0, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_BG / 2 - 10, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_FG / 2 - 25, DESIGN_HEIGHT);
        ctx.lineTo(0, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();

        // Right sand beach
        ctx.beginPath();
        ctx.moveTo(DESIGN_WIDTH, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_BG / 2 + 10, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_FG / 2 + 25, DESIGN_HEIGHT);
        ctx.lineTo(DESIGN_WIDTH, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();

        // Turquoise ocean water flanking outer edges
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(0, DESIGN_HEIGHT - 80, Math.max(0, VP_X - ROAD_WIDTH_FG / 2 - 50), 80);
        ctx.fillRect(VP_X + ROAD_WIDTH_FG / 2 + 50, DESIGN_HEIGHT - 80, DESIGN_WIDTH, 80);
      } else if (to.type === 'cairo') {
        // Cairo: Warm golden sand dunes flanking the ancient railway
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.moveTo(0, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_BG / 2 - 10, VP_Y);
        ctx.lineTo(VP_X - ROAD_WIDTH_FG / 2 - 25, DESIGN_HEIGHT);
        ctx.lineTo(0, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(DESIGN_WIDTH, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_BG / 2 + 10, VP_Y);
        ctx.lineTo(VP_X + ROAD_WIDTH_FG / 2 + 25, DESIGN_HEIGHT);
        ctx.lineTo(DESIGN_WIDTH, DESIGN_HEIGHT);
        ctx.closePath();
        ctx.fill();
      } else if (to.type === 'classic') {
        // Classic Subway City: Industrial weathered concrete curbs & asphalt
        const leftWallX = VP_X - ROAD_WIDTH_FG / 2 - 32;
        const rightWallX = VP_X + ROAD_WIDTH_FG / 2 + 32;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, VP_Y, Math.max(0, leftWallX), DESIGN_HEIGHT - VP_Y);
        ctx.fillRect(rightWallX, VP_Y, DESIGN_WIDTH - rightWallX, DESIGN_HEIGHT - VP_Y);

        // Weathered red and white safety curbs
        ctx.save();
        const curbW = 10;
        const stripeStep = 28;
        const sOffset = (this.distance * 0.8) % stripeStep;
        for (let sy = VP_Y - 20; sy < DESIGN_HEIGHT; sy += stripeStep) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(leftWallX, sy + sOffset, curbW, stripeStep / 2);
          ctx.fillRect(rightWallX - curbW, sy + sOffset, curbW, stripeStep / 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(leftWallX, sy + sOffset + stripeStep / 2, curbW, stripeStep / 2);
          ctx.fillRect(rightWallX - curbW, sy + sOffset + stripeStep / 2, curbW, stripeStep / 2);
        }
        ctx.restore();
      } else {
        // Tokyo Food Street: Concrete elevated embankment with yellow & black hazard stripes (Screenshot 1)
        const leftWallX = VP_X - ROAD_WIDTH_FG / 2 - 32;
        const rightWallX = VP_X + ROAD_WIDTH_FG / 2 + 32;
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, VP_Y, Math.max(0, leftWallX), DESIGN_HEIGHT - VP_Y);
        ctx.fillRect(rightWallX, VP_Y, DESIGN_WIDTH - rightWallX, DESIGN_HEIGHT - VP_Y);

        // Yellow and black diagonal hazard barrier curb stripes
        ctx.save();
        const curbW = 12;
        const stripeStep = 24;
        const sOffset = (this.distance * 0.8) % stripeStep;
        for (let sy = VP_Y - 20; sy < DESIGN_HEIGHT; sy += stripeStep) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(leftWallX, sy + sOffset, curbW, stripeStep / 2);
          ctx.fillRect(rightWallX - curbW, sy + sOffset, curbW, stripeStep / 2);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(leftWallX, sy + sOffset + stripeStep / 2, curbW, stripeStep / 2);
          ctx.fillRect(rightWallX - curbW, sy + sOffset + stripeStep / 2, curbW, stripeStep / 2);
        }
        ctx.restore();
      }

      // 4. 3D Railroad Ballast Bed (Gravel trapezoid converging into vanishing point)
      ctx.save();
      const ballastGrad = ctx.createLinearGradient(0, VP_Y, 0, DESIGN_HEIGHT);
      ballastGrad.addColorStop(0, '#334155');
      ballastGrad.addColorStop(0.3, ballastCol);
      ballastGrad.addColorStop(1, '#1e293b');

      ctx.fillStyle = ballastGrad;
      ctx.beginPath();
      ctx.moveTo(VP_X - ROAD_WIDTH_BG / 2 - 14, VP_Y);
      ctx.lineTo(VP_X + ROAD_WIDTH_BG / 2 + 14, VP_Y);
      ctx.lineTo(VP_X + ROAD_WIDTH_FG / 2 + 30, DESIGN_HEIGHT);
      ctx.lineTo(VP_X - ROAD_WIDTH_FG / 2 - 30, DESIGN_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Gravel texture speckles
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      for (let g = 0; g < 40; g++) {
        const gz = ((g * 24 + this.distance * 0.9) % 850);
        const gNorm = ((g * 7) % 200 - 100) / 70;
        const pG = project3D(gNorm, gz, 0);
        ctx.fillRect(pG.x, pG.y, Math.max(1.5, 3 * pG.scale), Math.max(1, 2 * pG.scale));
      }

      // 5. 3D Wooden Railroad Ties / Sleepers (Scrolling smoothly with distance)
      const tieStep = 44;
      const tieOffset = (this.distance * 0.85) % tieStep;
      for (let tz = tieOffset; tz < 880; tz += tieStep) {
        const pL = project3D(-1.42, tz, 0);
        const pR = project3D(1.42, tz, 0);
        const tieH = Math.max(2, 6 * pL.scale);
        const tieTopY = pL.y - tieH;

        // Wooden tie body
        ctx.fillStyle = tiesCol;
        ctx.beginPath();
        ctx.moveTo(pL.x, tieTopY);
        ctx.lineTo(pR.x, tieTopY);
        ctx.lineTo(pR.x, pR.y);
        ctx.lineTo(pL.x, pL.y);
        ctx.closePath();
        ctx.fill();

        // Dark front wood bevel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(pL.x, tieTopY + tieH * 0.6, pR.x - pL.x, tieH * 0.4);

        // Steel tie-plates holding rails
        ctx.fillStyle = '#1e293b';
        const plateW = 8 * pL.scale;
        for (const norm of [-1.32, -0.68, -0.32, 0.32, 0.68, 1.32]) {
          const pt = project3D(norm, tz, 0);
          ctx.fillRect(pt.x - plateW / 2, tieTopY, plateW, tieH);
        }
      }

      // 6. 6 Continuous Steel Train Rails (2 per lane: laneNorm ± 0.32)
      // Lanes: 0 (norm -1), 1 (norm 0), 2 (norm +1)
      const railOffsets = [
        -1 - 0.32, -1 + 0.32, // Lane 0 rails
         0 - 0.32,  0 + 0.32, // Lane 1 rails
         1 - 0.32,  1 + 0.32  // Lane 2 rails
      ];

      for (const rNorm of railOffsets) {
        const pFar = project3D(rNorm, 950, 0);
        const pNear = project3D(rNorm, -40, 0);

        // Rail bottom flange
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = Math.max(2, 5 * pNear.scale);
        ctx.beginPath();
        ctx.moveTo(pFar.x, pFar.y);
        ctx.lineTo(pNear.x, pNear.y);
        ctx.stroke();

        // Steel rail crown
        ctx.strokeStyle = railsCol;
        ctx.lineWidth = Math.max(1.5, 3.2 * pNear.scale);
        ctx.beginPath();
        ctx.moveTo(pFar.x, pFar.y - 2 * pFar.scale);
        ctx.lineTo(pNear.x, pNear.y - 2 * pNear.scale);
        ctx.stroke();

        // Specular chrome glint on top of rail in the sunlight
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, 1.4 * pNear.scale);
        ctx.beginPath();
        ctx.moveTo(pFar.x, pFar.y - 3 * pFar.scale);
        ctx.lineTo(pNear.x, pNear.y - 3 * pNear.scale);
        ctx.stroke();
      }

      // 7. AUTHENTIC SUBWAY SURFERS SCENERY & LANDMARKS (TOKYO FOOD & WILD WEST)
      const currentTheme = to.type || 'tokyo';

      if (currentTheme === 'western') {
        // --- WILD WEST CANYON THEME (SCREENSHOT 2) ---
        // A. Red-Rock Sandstone Canyon Mesa Cliffs in Skyline
        ctx.save();
        const mesaStep = 320;
        const mesaOffset = (this.distance * 0.12) % mesaStep;
        ctx.fillStyle = '#7c2d12';
        for (let mx = -120; mx < DESIGN_WIDTH + 180; mx += 160) {
          ctx.beginPath();
          ctx.moveTo(mx, VP_Y);
          ctx.lineTo(mx + 40, VP_Y - 55);
          ctx.lineTo(mx + 110, VP_Y - 55);
          ctx.lineTo(mx + 150, VP_Y);
          ctx.closePath();
          ctx.fill();
        }
        // Warm canyon sandstone ridge
        ctx.fillStyle = '#9a3412';
        for (let mx = -60; mx < DESIGN_WIDTH + 180; mx += 140) {
          ctx.beginPath();
          ctx.moveTo(mx, VP_Y);
          ctx.lineTo(mx + 30, VP_Y - 35);
          ctx.lineTo(mx + 85, VP_Y - 35);
          ctx.lineTo(mx + 120, VP_Y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // B. High Roller-Coaster Minecart Trestle Bridge on Horizon
        ctx.save();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.5;
        const bridgeY = VP_Y - 65;
        ctx.beginPath();
        ctx.moveTo(0, bridgeY);
        ctx.lineTo(DESIGN_WIDTH, bridgeY);
        ctx.stroke();
        // Trestle legs
        for (let tx = 30; tx < DESIGN_WIDTH; tx += 45) {
          ctx.beginPath();
          ctx.moveTo(tx, bridgeY);
          ctx.lineTo(tx - 12, VP_Y);
          ctx.moveTo(tx, bridgeY);
          ctx.lineTo(tx + 12, VP_Y);
          ctx.stroke();
        }
        // Rolling minecart
        const cartX = (this.distance * 0.4) % (DESIGN_WIDTH + 80) - 40;
        ctx.fillStyle = '#451a03';
        ctx.fillRect(cartX, bridgeY - 14, 22, 12);
        ctx.fillStyle = '#facc15'; // Gold ore in minecart
        ctx.fillRect(cartX + 2, bridgeY - 18, 18, 5);
        ctx.restore();

        // C. Trackside Saguaro Cacti along the railroad
        const cactusStep = 220;
        const cactusOffset = (this.distance * 0.95) % cactusStep;
        for (let cz = cactusOffset; cz < 850; cz += cactusStep) {
          for (const side of [-1.8, 1.8]) {
            const pC = project3D(side, cz, 0);
            const sc = pC.scale;
            if (sc < 0.08) continue;
            ctx.save();
            ctx.fillStyle = '#15803d'; // Saguaro green
            const cH = 60 * sc;
            const cW = 10 * sc;
            // Trunk
            ctx.fillRect(pC.x - cW / 2, pC.y - cH, cW, cH);
            // Left arm
            ctx.fillRect(pC.x - cW * 1.8, pC.y - cH * 0.7, cW * 1.8, 5 * sc);
            ctx.fillRect(pC.x - cW * 1.8, pC.y - cH * 0.95, cW * 0.8, cH * 0.3);
            // Right arm
            ctx.fillRect(pC.x, pC.y - cH * 0.55, cW * 1.8, 5 * sc);
            ctx.fillRect(pC.x + cW * 1.2, pC.y - cH * 0.8, cW * 0.8, cH * 0.3);
            ctx.restore();
          }
        }

        // D. Wooden "TRADE" Outpost General Store (Right side)
        const tradeStep = 480;
        const tradeOffset = (this.distance * 0.95) % tradeStep;
        for (let tz = tradeOffset; tz < 850; tz += tradeStep) {
          const pT = project3D(2.35, tz, 0);
          const st = pT.scale;
          if (st > 0.12) {
            ctx.save();
            const bW = 100 * st;
            const bH = 110 * st;
            // Wooden building body
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(pT.x - bW / 2, pT.y - bH, bW, bH);
            // Green corrugated awning roof
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.moveTo(pT.x - bW * 0.6, pT.y - bH);
            ctx.lineTo(pT.x, pT.y - bH - 24 * st);
            ctx.lineTo(pT.x + bW * 0.6, pT.y - bH);
            ctx.closePath();
            ctx.fill();
            // Steer skull on facade
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(pT.x - 8 * st, pT.y - bH - 12 * st, 16 * st, 10 * st);
            // Signboard "TRADE"
            ctx.fillStyle = '#166534';
            ctx.fillRect(pT.x - 38 * st, pT.y - bH * 0.85, 76 * st, 18 * st);
            ctx.fillStyle = '#fde047';
            ctx.font = `900 ${Math.max(7, 13 * st)}px "Rajdhani", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('TRADE POST', pT.x, pT.y - bH * 0.85 + 13 * st);
            // Windows
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(pT.x - 30 * st, pT.y - bH * 0.5, 20 * st, 20 * st);
            ctx.fillRect(pT.x + 10 * st, pT.y - bH * 0.5, 20 * st, 20 * st);
            ctx.restore();
          }
        }

        // E. Overhead Wooden "★ SALOON ★" Gateway Arch across the tracks
        const saloonStep = 560;
        const saloonOffset = (this.distance * 1.0) % saloonStep;
        for (let sz = saloonOffset; sz < 880; sz += saloonStep) {
          const pL = project3D(-1.7, sz, 0);
          const pR = project3D(1.7, sz, 0);
          const pM = project3D(0, sz, 85);
          const ss = pL.scale;
          if (ss > 0.1) {
            ctx.save();
            const postW = 14 * ss;
            const beamH = 26 * ss;
            // Heavy timber vertical posts
            ctx.fillStyle = '#78350f';
            ctx.fillRect(pL.x, pL.y - 85 * ss, postW, 85 * ss);
            ctx.fillRect(pR.x - postW, pR.y - 85 * ss, postW, 85 * ss);
            // Diagonal wooden cross-braces
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 3 * ss;
            ctx.beginPath();
            ctx.moveTo(pL.x, pL.y - 30 * ss);
            ctx.lineTo(pL.x + 20 * ss, pL.y - 85 * ss);
            ctx.moveTo(pR.x, pR.y - 30 * ss);
            ctx.lineTo(pR.x - 20 * ss, pR.y - 85 * ss);
            ctx.stroke();
            // Overhead Saloon timber signboard
            ctx.fillStyle = '#92400e';
            ctx.fillRect(pL.x, pM.y - beamH / 2, pR.x - pL.x, beamH);
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2 * ss;
            ctx.strokeRect(pL.x + 4 * ss, pM.y - beamH / 2 + 3 * ss, (pR.x - pL.x) - 8 * ss, beamH - 6 * ss);
            // Saloon text
            ctx.fillStyle = '#ffffff';
            ctx.font = `900 ${Math.max(8, 18 * ss)}px "Orbitron", Impact, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★ SALOON ★', pM.x, pM.y);
            // Steer Skull on center top
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(pM.x - 12 * ss, pM.y - beamH / 2 - 14 * ss, 24 * ss, 12 * ss);
            // Railroad crossing flags / TNT boxes
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(pL.x - 8 * ss, pL.y - 18 * ss, 16 * ss, 16 * ss);
            ctx.fillRect(pR.x - 8 * ss, pR.y - 18 * ss, 16 * ss, 16 * ss);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(6, 9 * ss)}px sans-serif`;
            ctx.fillText('TNT', pL.x, pL.y - 6 * ss);
            ctx.fillText('TNT', pR.x, pR.y - 6 * ss);
            ctx.restore();
          }
        }
      } else if (currentTheme === 'rio') {
        // --- RIO CARNIVAL BEACH THEME ---
        // A. Sugarloaf Mountain Silhouette in background
        ctx.save();
        const mountainX = ((DESIGN_WIDTH * 0.35) + (this.distance * 0.05)) % (DESIGN_WIDTH + 260) - 130;
        const mountainY = VP_Y;
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.moveTo(mountainX - 120, mountainY);
        ctx.quadraticCurveTo(mountainX, mountainY - 145, mountainX + 120, mountainY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // B. Tropical Palm Trees flanking tracks
        const palmStep = 180;
        const palmOffset = (this.distance * 0.95) % palmStep;
        for (let pz = palmOffset; pz < 860; pz += palmStep) {
          for (const side of [-2.0, 2.0]) {
            const pP = project3D(side, pz, 0);
            const sp = pP.scale;
            if (sp < 0.09) continue;
            ctx.save();
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = Math.max(3, 8 * sp);
            ctx.beginPath();
            ctx.moveTo(pP.x, pP.y);
            const curveX = side < 0 ? -18 * sp : 18 * sp;
            ctx.quadraticCurveTo(pP.x + curveX, pP.y - 50 * sp, pP.x + curveX * 1.5, pP.y - 95 * sp);
            ctx.stroke();
            const topX = pP.x + curveX * 1.5;
            const topY = pP.y - 95 * sp;
            ctx.fillStyle = '#22c55e';
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
              ctx.beginPath();
              ctx.ellipse(topX + Math.cos(a) * 22 * sp, topY + Math.sin(a) * 14 * sp, 22 * sp, 7 * sp, a, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(topX, topY, 4 * sp, 0, Math.PI * 2);
            ctx.arc(topX + 5 * sp, topY + 2 * sp, 4 * sp, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // C. Vibrant Carnival Favela Hillside Houses
        const favelaStep = 440;
        const favelaOffset = (this.distance * 0.9) % favelaStep;
        const favelaColors = ['#06b6d4', '#facc15', '#f43f5e', '#10b981', '#a855f7'];
        for (let fz = favelaOffset; fz < 860; fz += favelaStep) {
          const pF = project3D(2.4, fz, 0);
          const sf = pF.scale;
          if (sf > 0.12) {
            ctx.save();
            for (let h = 0; h < 3; h++) {
              const hCol = favelaColors[(Math.floor(fz / favelaStep) + h) % favelaColors.length];
              const boxW = (75 - h * 12) * sf;
              const boxH = 45 * sf;
              const boxX = pF.x - boxW / 2 + (h % 2 === 0 ? 10 : -10) * sf;
              const boxY = pF.y - (h + 1) * boxH;
              ctx.fillStyle = hCol;
              ctx.fillRect(boxX, boxY, boxW, boxH);
              ctx.fillStyle = '#475569';
              ctx.fillRect(boxX - 4 * sf, boxY - 4 * sf, boxW + 8 * sf, 4 * sf);
              ctx.fillStyle = '#fef08a';
              ctx.fillRect(boxX + 8 * sf, boxY + 12 * sf, 12 * sf, 12 * sf);
              ctx.fillRect(boxX + boxW - 20 * sf, boxY + 12 * sf, 12 * sf, 12 * sf);
            }
            ctx.fillStyle = '#ec4899';
            ctx.fillRect(pF.x - 30 * sf, pF.y - 155 * sf, 60 * sf, 14 * sf);
            ctx.fillStyle = '#ffffff';
            ctx.font = `900 ${Math.max(7, 11 * sf)}px "Orbitron", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('CARNAVAL 🌴', pF.x, pF.y - 144 * sf);
            ctx.restore();
          }
        }

        // D. Trackside Walls with Rio Graffiti
        const wallNorms = [-1.58, 1.58];
        const rioTags = [
          { text: 'RIO', col: '#10b981', outline: '#ffffff' },
          { text: 'SAMBA', col: '#facc15', outline: '#064e3b' },
          { text: 'CARNAVAL', col: '#ec4899', outline: '#ffffff' },
          { text: 'SURF ★', col: '#06b6d4', outline: '#ffffff' }
        ];
        for (const wNorm of wallNorms) {
          const grafStep = 160;
          const grafOffset = (this.distance * 0.9) % grafStep;
          for (let gz = grafOffset; gz < 860; gz += grafStep) {
            const pG = project3D(wNorm, gz, 24);
            const sG = pG.scale;
            const tag = rioTags[Math.floor(gz / grafStep) % rioTags.length];
            if (sG > 0.28) {
              ctx.save();
              ctx.fillStyle = tag.col;
              ctx.strokeStyle = tag.outline;
              ctx.lineWidth = Math.max(1, 1.8 * sG);
              ctx.font = `900 ${Math.max(8, 16 * sG)}px "Orbitron", Impact, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeText(tag.text, pG.x, pG.y);
              ctx.fillText(tag.text, pG.x, pG.y);
              ctx.restore();
            }
          }
        }
      } else if (currentTheme === 'cairo') {
        // --- CAIRO PYRAMIDS THEME ---
        // A. Great Pyramids of Giza on Horizon
        ctx.save();
        const pyrStep = 480;
        const pyrOffset = (this.distance * 0.08) % pyrStep;
        const p1X = (DESIGN_WIDTH * 0.35 + pyrOffset) % (DESIGN_WIDTH + 260) - 130;
        const p1Y = VP_Y;
        const p1W = 160;
        const p1H = 95;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(p1X, p1Y - p1H);
        ctx.lineTo(p1X + p1W * 0.45, p1Y);
        ctx.lineTo(p1X - p1W * 0.1, p1Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.moveTo(p1X, p1Y - p1H);
        ctx.lineTo(p1X - p1W * 0.55, p1Y);
        ctx.lineTo(p1X - p1W * 0.1, p1Y);
        ctx.closePath();
        ctx.fill();

        const p2X = (DESIGN_WIDTH * 0.75 + pyrOffset * 0.7) % (DESIGN_WIDTH + 260) - 130;
        const p2H = 75;
        const p2W = 130;
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath();
        ctx.moveTo(p2X, p1Y - p2H);
        ctx.lineTo(p2X + p2W * 0.45, p1Y);
        ctx.lineTo(p2X - p2W * 0.1, p1Y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#854d0e';
        ctx.beginPath();
        ctx.moveTo(p2X, p1Y - p2H);
        ctx.lineTo(p2X - p2W * 0.55, p1Y);
        ctx.lineTo(p2X - p2W * 0.1, p1Y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // B. Ancient Egyptian Obelisks flanking tracks
        const obeliskStep = 240;
        const obeliskOffset = (this.distance * 0.95) % obeliskStep;
        for (let oz = obeliskOffset; oz < 860; oz += obeliskStep) {
          for (const side of [-2.1, 2.1]) {
            const pO = project3D(side, oz, 0);
            const so = pO.scale;
            if (so < 0.1) continue;
            ctx.save();
            const obW = 16 * so;
            const obH = 95 * so;
            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.moveTo(pO.x - obW / 2, pO.y);
            ctx.lineTo(pO.x - obW * 0.35, pO.y - obH * 0.88);
            ctx.lineTo(pO.x + obW * 0.35, pO.y - obH * 0.88);
            ctx.lineTo(pO.x + obW / 2, pO.y);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.moveTo(pO.x, pO.y - obH);
            ctx.lineTo(pO.x + obW * 0.35, pO.y - obH * 0.88);
            ctx.lineTo(pO.x - obW * 0.35, pO.y - obH * 0.88);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#78350f';
            for (let hy = pO.y - obH * 0.8; hy < pO.y - 10 * so; hy += 16 * so) {
              ctx.fillRect(pO.x - 2 * so, hy, 4 * so, 4 * so);
              ctx.fillRect(pO.x - 4 * so, hy + 6 * so, 8 * so, 2 * so);
            }
            ctx.restore();
          }
        }

        // C. Cairo Graffiti
        const wallNorms = [-1.58, 1.58];
        const cairoTags = [
          { text: 'CAIRO', col: '#facc15', outline: '#451a03' },
          { text: 'PHARAOH', col: '#f97316', outline: '#ffffff' },
          { text: 'PYRAMID', col: '#fde047', outline: '#78350f' },
          { text: 'RA ★', col: '#ec4899', outline: '#ffffff' }
        ];
        for (const wNorm of wallNorms) {
          const grafStep = 170;
          const grafOffset = (this.distance * 0.9) % grafStep;
          for (let gz = grafOffset; gz < 860; gz += grafStep) {
            const pG = project3D(wNorm, gz, 24);
            const sG = pG.scale;
            const tag = cairoTags[Math.floor(gz / grafStep) % cairoTags.length];
            if (sG > 0.28) {
              ctx.save();
              ctx.fillStyle = tag.col;
              ctx.strokeStyle = tag.outline;
              ctx.lineWidth = Math.max(1, 1.8 * sG);
              ctx.font = `900 ${Math.max(8, 16 * sG)}px "Orbitron", Impact, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeText(tag.text, pG.x, pG.y);
              ctx.fillText(tag.text, pG.x, pG.y);
              ctx.restore();
            }
          }
        }
      } else if (currentTheme === 'classic') {
        // --- SUBWAY CITY CLASSIC THEME ---
        // A. Vintage Industrial Brick Subway Tunnel Portal
        const tunnelStep = 520;
        const tunnelOffset = (this.distance * 1.0) % tunnelStep;
        for (let tz = tunnelOffset; tz < 880; tz += tunnelStep) {
          const pL = project3D(-1.75, tz, 0);
          const pR = project3D(1.75, tz, 0);
          const pM = project3D(0, tz, 100);
          const st = pL.scale;
          if (st > 0.1) {
            ctx.save();
            ctx.fillStyle = '#b91c1c';
            ctx.fillRect(pL.x - 22 * st, pM.y - 30 * st, (pR.x - pL.x) + 44 * st, 30 * st);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(pL.x - 22 * st, pM.y, 22 * st, pL.y - pM.y);
            ctx.fillRect(pR.x, pM.y, 22 * st, pR.y - pM.y);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(pM.x - 55 * st, pM.y - 24 * st, 110 * st, 20 * st);
            ctx.fillStyle = '#38bdf8';
            ctx.font = `900 ${Math.max(8, 13 * st)}px "Orbitron", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('SUBWAY CITY 🚇', pM.x, pM.y - 10 * st);
            ctx.restore();
          }
        }

        // B. Vintage Wooden Water Tower on side
        const towerStep = 460;
        const towerOffset = (this.distance * 0.95 + 180) % towerStep;
        for (let wz = towerOffset; wz < 850; wz += towerStep) {
          const pW = project3D(-2.3, wz, 0);
          const sw = pW.scale;
          if (sw > 0.12) {
            ctx.save();
            const tankW = 60 * sw;
            const tankH = 50 * sw;
            const legH = 65 * sw;
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 3 * sw;
            ctx.beginPath();
            ctx.moveTo(pW.x - tankW * 0.45, pW.y);
            ctx.lineTo(pW.x - tankW * 0.35, pW.y - legH);
            ctx.moveTo(pW.x + tankW * 0.45, pW.y);
            ctx.lineTo(pW.x + tankW * 0.35, pW.y - legH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pW.x - tankW * 0.45, pW.y);
            ctx.lineTo(pW.x + tankW * 0.35, pW.y - legH);
            ctx.moveTo(pW.x + tankW * 0.45, pW.y);
            ctx.lineTo(pW.x - tankW * 0.35, pW.y - legH);
            ctx.stroke();
            ctx.fillStyle = '#78350f';
            ctx.fillRect(pW.x - tankW / 2, pW.y - legH - tankH, tankW, tankH);
            ctx.fillStyle = '#334155';
            ctx.fillRect(pW.x - tankW / 2, pW.y - legH - tankH * 0.75, tankW, 3 * sw);
            ctx.fillRect(pW.x - tankW / 2, pW.y - legH - tankH * 0.25, tankW, 3 * sw);
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.moveTo(pW.x - tankW * 0.55, pW.y - legH - tankH);
            ctx.lineTo(pW.x, pW.y - legH - tankH - 22 * sw);
            ctx.lineTo(pW.x + tankW * 0.55, pW.y - legH - tankH);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // C. Classic Subway Graffiti Tags
        const wallNorms = [-1.58, 1.58];
        const classicTags = [
          { text: 'SUBWAY', col: '#38bdf8', outline: '#ffffff' },
          { text: 'SURFERS', col: '#facc15', outline: '#0f172a' },
          { text: 'JAKE ★', col: '#ef4444', outline: '#ffffff' },
          { text: 'FRESH', col: '#22c55e', outline: '#ffffff' }
        ];
        for (const wNorm of wallNorms) {
          const grafStep = 160;
          const grafOffset = (this.distance * 0.9) % grafStep;
          for (let gz = grafOffset; gz < 860; gz += grafStep) {
            const pG = project3D(wNorm, gz, 24);
            const sG = pG.scale;
            const tag = classicTags[Math.floor(gz / grafStep) % classicTags.length];
            if (sG > 0.28) {
              ctx.save();
              ctx.fillStyle = tag.col;
              ctx.strokeStyle = tag.outline;
              ctx.lineWidth = Math.max(1, 1.8 * sG);
              ctx.font = `900 ${Math.max(8, 16 * sG)}px "Orbitron", Impact, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeText(tag.text, pG.x, pG.y);
              ctx.fillText(tag.text, pG.x, pG.y);
              ctx.restore();
            }
          }
        }
      } else {
        // --- TOKYO FOOD STREET THEME (SCREENSHOT 1) ---
        // A. Giant 3D Takoyaki / Cartoon Octopus Chef (Left side at laneNorm = -2.3)
        const octoStep = 450;
        const octoOffset = (this.distance * 0.95) % octoStep;
        for (let oz = octoOffset; oz < 850; oz += octoStep) {
          const pO = project3D(-2.3, oz, 0);
          const so = pO.scale;
          if (so > 0.12) {
            ctx.save();
            const oW = 95 * so;
            const oH = 120 * so;
            // Giant Red-Pink Octopus Head
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(pO.x, pO.y - oH * 0.7, oW * 0.48, 0, Math.PI * 2);
            ctx.fill();
            // Cute Anime Eyes (Black and white glint)
            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.arc(pO.x - 14 * so, pO.y - oH * 0.72, 8 * so, 0, Math.PI * 2);
            ctx.arc(pO.x + 14 * so, pO.y - oH * 0.72, 8 * so, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pO.x - 16 * so, pO.y - oH * 0.74, 3 * so, 0, Math.PI * 2);
            ctx.arc(pO.x + 12 * so, pO.y - oH * 0.74, 3 * so, 0, Math.PI * 2);
            ctx.fill();
            // Pink Blush Cheeks
            ctx.fillStyle = 'rgba(251, 113, 133, 0.65)';
            ctx.beginPath();
            ctx.arc(pO.x - 24 * so, pO.y - oH * 0.64, 7 * so, 0, Math.PI * 2);
            ctx.arc(pO.x + 24 * so, pO.y - oH * 0.64, 7 * so, 0, Math.PI * 2);
            ctx.fill();
            // Curling Tentacles
            ctx.strokeStyle = '#e11d48';
            ctx.lineWidth = 9 * so;
            ctx.beginPath();
            ctx.arc(pO.x - 30 * so, pO.y - oH * 0.35, 20 * so, 0.4, 2.5);
            ctx.arc(pO.x + 30 * so, pO.y - oH * 0.35, 20 * so, 0.8, 2.8);
            ctx.stroke();
            // 3 Takoyaki Balls on skewers
            const takoY = [0.45, 0.3, 0.15];
            for (let i = 0; i < takoY.length; i++) {
              ctx.fillStyle = '#b45309'; // Golden brown baked takoyaki ball
              ctx.beginPath();
              ctx.arc(pO.x + (i % 2 === 0 ? 32 : 44) * so, pO.y - oH * takoY[i], 13 * so, 0, Math.PI * 2);
              ctx.fill();
              // Savory mayo & seaweed flakes
              ctx.fillStyle = '#fef08a';
              ctx.fillRect(pO.x + (i % 2 === 0 ? 24 : 36) * so, pO.y - oH * takoY[i] - 3 * so, 16 * so, 3 * so);
              ctx.fillStyle = '#15803d';
              ctx.fillRect(pO.x + (i % 2 === 0 ? 28 : 40) * so, pO.y - oH * takoY[i] + 2 * so, 4 * so, 3 * so);
            }
            // Japanese Neon Sign "たこ焼き"
            ctx.fillStyle = '#facc15';
            ctx.font = `900 ${Math.max(8, 14 * so)}px "Rajdhani", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('TAKOYAKI 🐙', pO.x, pO.y - oH * 1.05);
            ctx.restore();
          }
        }

        // B. Giant Walrus-Mustache Sushi Chef Statue (Right side at laneNorm = +2.4)
        const chefStep = 520;
        const chefOffset = (this.distance * 0.95 + 260) % chefStep;
        for (let cz = chefOffset; cz < 850; cz += chefStep) {
          const pC = project3D(2.35, cz, 0);
          const sc = pC.scale;
          if (sc > 0.12) {
            ctx.save();
            const cW = 100 * sc;
            const cH = 135 * sc;
            // Chef Body / Uniform
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(pC.x - cW * 0.42, pC.y - cH * 0.5, cW * 0.84, cH * 0.5);
            // Blue Japanese Chef Vest
            ctx.fillStyle = '#1d4ed8';
            ctx.fillRect(pC.x - cW * 0.45, pC.y - cH * 0.5, cW * 0.2, cH * 0.5);
            ctx.fillRect(pC.x + cW * 0.25, pC.y - cH * 0.5, cW * 0.2, cH * 0.5);
            // Chef Face (Peach skin)
            ctx.fillStyle = '#fed7aa';
            ctx.beginPath();
            ctx.arc(pC.x, pC.y - cH * 0.68, cW * 0.34, 0, Math.PI * 2);
            ctx.fill();
            // Tall White Chef Hat
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(pC.x - cW * 0.28, pC.y - cH * 1.15, cW * 0.56, cH * 0.38);
            ctx.beginPath();
            ctx.arc(pC.x, pC.y - cH * 1.15, cW * 0.28, Math.PI, 0);
            ctx.fill();
            // Giant Black Walrus Mustache (Subway Surfers signature!)
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(pC.x - 14 * sc, pC.y - cH * 0.62, 18 * sc, 10 * sc, 0.2, 0, Math.PI * 2);
            ctx.ellipse(pC.x + 14 * sc, pC.y - cH * 0.62, 18 * sc, 10 * sc, -0.2, 0, Math.PI * 2);
            ctx.fill();
            // Chef Eyes & Nose
            ctx.fillStyle = '#ea580c';
            ctx.beginPath();
            ctx.arc(pC.x, pC.y - cH * 0.68, 5 * sc, 0, Math.PI * 2);
            ctx.fill();
            // Giant Chopsticks holding a Sushi Roll!
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 4 * sc;
            ctx.beginPath();
            ctx.moveTo(pC.x - 25 * sc, pC.y - cH * 0.4);
            ctx.lineTo(pC.x - 55 * sc, pC.y - cH * 0.7);
            ctx.moveTo(pC.x - 20 * sc, pC.y - cH * 0.35);
            ctx.lineTo(pC.x - 50 * sc, pC.y - cH * 0.75);
            ctx.stroke();
            // Sushi roll held by chopsticks: Nori outer, white rice, salmon center
            ctx.fillStyle = '#0f172a'; // Nori seaweed
            ctx.beginPath();
            ctx.arc(pC.x - 52 * sc, pC.y - cH * 0.72, 14 * sc, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff'; // White sushi rice
            ctx.beginPath();
            ctx.arc(pC.x - 52 * sc, pC.y - cH * 0.72, 11 * sc, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f97316'; // Fresh salmon center
            ctx.beginPath();
            ctx.arc(pC.x - 52 * sc, pC.y - cH * 0.72, 5 * sc, 0, Math.PI * 2);
            ctx.fill();
            // Red Lanterns flanking storefront
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(pC.x - cW * 0.5, pC.y - cH * 0.85, 14 * sc, 20 * sc);
            ctx.fillRect(pC.x + cW * 0.38, pC.y - cH * 0.85, 14 * sc, 20 * sc);
            // Signboard "SUSHI BAR"
            ctx.fillStyle = '#facc15';
            ctx.font = `900 ${Math.max(8, 14 * sc)}px "Rajdhani", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('すし CHEF 🍣', pC.x, pC.y - cH * 1.25);
            ctx.restore();
          }
        }

        // C. Giant Burger Tower in the background skyline
        const burgerX = ((DESIGN_WIDTH * 0.7) + (this.distance * 0.08)) % (DESIGN_WIDTH + 240) - 120;
        const burgerY = VP_Y - 50;
        ctx.save();
        // Top Bun with Sesame Seeds
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(burgerX, burgerY - 32, 28, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(burgerX - 12, burgerY - 45, 3, 2);
        ctx.fillRect(burgerX + 8, burgerY - 48, 3, 2);
        ctx.fillRect(burgerX - 4, burgerY - 52, 3, 2);
        // Lettuce
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(burgerX - 30, burgerY - 30, 60, 5);
        // Cheese slice corner
        ctx.fillStyle = '#facc15';
        ctx.fillRect(burgerX - 28, burgerY - 25, 56, 4);
        // Beef Patty
        ctx.fillStyle = '#78350f';
        ctx.fillRect(burgerX - 29, burgerY - 21, 58, 8);
        // Bottom Bun
        ctx.fillStyle = '#b45309';
        ctx.fillRect(burgerX - 27, burgerY - 13, 54, 7);
        ctx.restore();

        // D. Cute Kawaii Dumpling / Ghost Lantern floating above tracks
        const ghostTime = Date.now() * 0.003;
        const ghostY = VP_Y - 95 + Math.sin(ghostTime) * 12;
        const ghostX = (DESIGN_WIDTH * 0.48) + Math.cos(ghostTime * 0.7) * 20;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ghostX, ghostY, 14, 0, Math.PI * 2);
        ctx.fill();
        // Ghost tail
        ctx.beginPath();
        ctx.moveTo(ghostX - 14, ghostY);
        ctx.lineTo(ghostX - 10, ghostY + 16);
        ctx.lineTo(ghostX, ghostY + 12);
        ctx.lineTo(ghostX + 10, ghostY + 16);
        ctx.lineTo(ghostX + 14, ghostY);
        ctx.fill();
        // Ghost anime face
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(ghostX - 9, ghostY + 2, 4, 3);
        ctx.fillRect(ghostX + 5, ghostY + 2, 4, 3);
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath();
        ctx.arc(ghostX - 6, ghostY - 2, 2.5, 0, Math.PI * 2);
        ctx.arc(ghostX + 6, ghostY - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // E. Colorful Trackside Walls with Japanese Neon Graffiti
        const wallNorms = [-1.58, 1.58];
        const tokyoTags = [
          { text: 'TOKYO', col: '#ff007f', outline: '#ffffff' },
          { text: 'ラーメン', col: '#f59e0b', outline: '#1e1b4b' },
          { text: 'SUBWAY', col: '#06b6d4', outline: '#facc15' },
          { text: 'すし ★', col: '#10b981', outline: '#ffffff' },
          { text: 'SURF', col: '#ec4899', outline: '#ffffff' }
        ];
        for (const wNorm of wallNorms) {
          const wallFar = project3D(wNorm, 950, 0);
          const wallFarTop = project3D(wNorm, 950, 48);
          const wallNear = project3D(wNorm, -40, 0);
          const wallNearTop = project3D(wNorm, -40, 48);

          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.moveTo(wallFar.x, wallFar.y);
          ctx.lineTo(wallFarTop.x, wallFarTop.y);
          ctx.lineTo(wallNearTop.x, wallNearTop.y);
          ctx.lineTo(wallNear.x, wallNear.y);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = Math.max(1.5, 3.0 * wallNear.scale);
          ctx.beginPath();
          ctx.moveTo(wallFarTop.x, wallFarTop.y);
          ctx.lineTo(wallNearTop.x, wallNearTop.y);
          ctx.stroke();

          const grafStep = 150;
          const grafOffset = (this.distance * 0.9) % grafStep;
          for (let gz = grafOffset; gz < 860; gz += grafStep) {
            const pG = project3D(wNorm, gz, 24);
            const sG = pG.scale;
            const tag = tokyoTags[Math.floor(gz / grafStep) % tokyoTags.length];
            if (sG > 0.28) {
              ctx.save();
              ctx.fillStyle = tag.col;
              ctx.strokeStyle = tag.outline;
              ctx.lineWidth = Math.max(1, 1.8 * sG);
              ctx.font = `900 ${Math.max(8, 15 * sG)}px "Orbitron", Impact, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeText(tag.text, pG.x, pG.y);
              ctx.fillText(tag.text, pG.x, pG.y);
              ctx.restore();
            }
          }
        }
      }

      // 8. Overhead Electric Catenary Gantry Arches with Multi-Color Railway Signals
      const gantryStep = 260;
      const gantryOffset = (this.distance * 1.0) % gantryStep;
      const signalColors = ['#22c55e', '#f59e0b', '#ef4444']; // Green, Amber, Red signals
      for (let pz = gantryOffset; pz < 900; pz += gantryStep) {
        const pL = project3D(-1.62, pz, 0);
        const pLTop = project3D(-1.62, pz, 72);
        const pR = project3D(1.62, pz, 0);
        const pRTop = project3D(1.62, pz, 72);
        const sGantry = pL.scale;

        // Steel truss framework
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = Math.max(1.5, 3.8 * sGantry);

        // Left post
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pLTop.x, pLTop.y);
        ctx.stroke();

        // Right post
        ctx.beginPath();
        ctx.moveTo(pR.x, pR.y);
        ctx.lineTo(pRTop.x, pRTop.y);
        ctx.stroke();

        // Double Crossbeam
        ctx.beginPath();
        ctx.moveTo(pLTop.x, pLTop.y);
        ctx.lineTo(pRTop.x, pRTop.y);
        ctx.moveTo(pLTop.x, pLTop.y + 6 * sGantry);
        ctx.lineTo(pRTop.x, pRTop.y + 6 * sGantry);
        ctx.stroke();

        // 3 Glowing Multi-Color Signal Lanterns (one per track lane)
        const laneNorms = [-1, 0, 1];
        for (let l = 0; l < laneNorms.length; l++) {
          const lNorm = laneNorms[l];
          const pSig = project3D(lNorm, pz, 64);
          const sigCol = signalColors[l];
          const sigR = Math.max(2, 4.5 * sGantry);

          // Signal housing box
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(pSig.x - 4 * sGantry, pSig.y - 4 * sGantry, 8 * sGantry, 8 * sGantry);

          // Glowing signal bulb
          ctx.fillStyle = sigCol;
          ctx.beginPath();
          ctx.arc(pSig.x, pSig.y, sigR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    draw() {
      ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
      const shake = ScreenShake.getOffset();

      ctx.save();
      ctx.translate(shake.x, shake.y);

      this.drawBackground();

      // 3D Back-to-front Depth Ordering (Subway Surfers Painter's Algorithm)
      const renderList = [];

      if (this.state === GameStates.MENU) {
        // Full Subway Surfers 3D menu: Jake stands proudly in the foreground on center track facing the camera!
        // Positioned cleanly above bottom CTAs with customZ = 185 and customScale = 1.16
        renderList.push({ z: 185, type: 'player', item: this.player, customZ: 185, customScale: 1.16, isFrontView: true });
      } else {
        // Obstacles (trains, hurdles, barriers)
        for (const o of this.track.obstacles) {
          let sortZ = o.z;
          if (o.isTrain) {
            // A train body spans from o.z to o.z + o.length.
            // If the player is riding this train, climbing its ramp, or in same lane over it:
            const inSameLane = Math.abs(this.player.laneNorm - o.laneNorm) < 0.85;
            const trainOverlapsPlayer = (o.z - 45 <= PLAYER_Z) && (PLAYER_Z <= o.z + o.length + 40);
            if (this.player.onTrain || (inSameLane && trainOverlapsPlayer) || this.player.baseHeight > 10) {
              // Place train behind the player in draw order (larger Z renders first)
              sortZ = Math.max(o.z + o.length, PLAYER_Z + 180);
            }
          }
          renderList.push({ z: sortZ, type: 'obstacle', item: o });
        }

        // Collectibles (Coins & Powerups)
        for (const c of this.collectibles.items) {
          renderList.push({ z: c.z, type: 'collectible', item: c });
        }

        // Player runner: ensure player is drawn AFTER the train they are mounted on
        const playerSortZ = (this.player.onTrain || this.player.baseHeight > 10) ? (PLAYER_Z - 60) : PLAYER_Z;
        renderList.push({ z: playerSortZ, type: 'player', item: this.player });
      }

      // Sort descending: highest z (furthest from camera) rendered first
      renderList.sort((a, b) => b.z - a.z);

      for (const entity of renderList) {
        if (entity.type === 'obstacle') {
          this.track.renderObstacle(ctx, entity.item);
        } else if (entity.type === 'collectible') {
          this.collectibles.renderItem(ctx, entity.item);
        } else if (entity.type === 'player') {
          const buffs = {
            jetpack: this.player.hasJetpack,
            hoverboard: this.player.hasHoverboard,
            sneakers: this.player.hasSneakers
          };
          this.player.render(ctx, entity.customZ, entity.customScale, entity.isFrontView, buffs);
        }
      }

      // Foreground 2D HUD text and particle effects
      this.particles.render(ctx);

      ctx.restore();
    }

    loop(timestamp) {
      if (!this.lastTime) this.lastTime = timestamp;
      let dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;
      // High refresh smoothness clamp (handles 60Hz, 90Hz, 120Hz gracefully)
      dt = Math.min(Math.max(dt, 0.001), 0.033);

      try {
        if (this.state === GameStates.SPLASH) {
          this.splashProgress = Math.min(100, this.splashProgress + (dt / this.splashDuration) * 100);
          if (this.splashProgressFill) this.splashProgressFill.style.width = this.splashProgress + '%';
          if (this.splashPercentText) this.splashPercentText.textContent = Math.floor(this.splashProgress) + '%';
          if (this.splashProgress >= 100) {
            this.dismissSplash();
          }
        } else if (this.state !== GameStates.PLAYING) {
          this.distance += 45 * dt;
          this.parallax.update(dt, 0.35);
          this.updateTheme(dt);
          this.particles.update(dt);
          ScreenShake.update(dt);
          this.renderAvatarPreview(dt);

          // Keep player standing centered on track in 3D idle state
          if (this.player) {
            this.player.lane = 1;
            this.player.laneNorm = 0;
            this.player.baseHeight = 0;
            this.player.targetBaseHeight = 0;
            this.player.onTrain = false;
            this.player.jumping = false;
            this.player.sliding = false;
            this.player.animTime += dt * 0.8;
            this.player.x = VP_X;
            this.player.groundY = 485;
            this.player.scale = 1.22;
          }
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
