/**
 * Web Audio Engine for Neon Lane Runner 3D
 * Pure synthesized retro/synthwave audio & sound effects (no external audio files needed).
 */
const SoundSystem = (function () {
  'use strict';

  let ctx = null;
  let sfxMuted = false;
  let bgmMuted = false;
  let sfxVolume = 1.0;
  let bgmVolume = 0.55;
  let isPlayingBgm = false;
  let nextNoteTime = 0;
  let bgmStep = 0;
  let bgmTimer = null;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Initialize saved audio preferences
  try {
    if (localStorage.getItem('runner_sfx_muted') === 'true') sfxMuted = true;
    if (localStorage.getItem('runner_bgm_muted') === 'true') bgmMuted = true;
    const sv = parseFloat(localStorage.getItem('runner_sfx_vol'));
    if (!isNaN(sv)) sfxVolume = clamp(sv, 0, 1);
    const bv = parseFloat(localStorage.getItem('runner_bgm_vol'));
    if (!isNaN(bv)) bgmVolume = clamp(bv, 0, 1);
  } catch (e) {}

  // 124 BPM Synthwave
  const tempo = 124;
  const secondsPerBeat = 60.0 / tempo;
  const stepTime = secondsPerBeat / 4; // 16th notes

  // Bassline frequencies in Hz (A minor synthwave progression: Am, F, C, G)
  const bassNotes = [
    110.00, 110.00, 110.00, 110.00, 110.00, 110.00, 110.00, 110.00, // A2
    87.31,  87.31,  87.31,  87.31,  87.31,  87.31,  87.31,  87.31,  // F2
    130.81, 130.81, 130.81, 130.81, 130.81, 130.81, 130.81, 130.81, // C3
    98.00,  98.00,  98.00,  98.00,  98.00,  98.00,  98.00,  98.00   // G2
  ];

  // Lead arpeggio notes (pentatonic flavor)
  const leadNotes = [
    440, 523.25, 659.25, 523.25, 783.99, 659.25, 523.25, 440,
    349.23, 440, 523.25, 440, 659.25, 523.25, 440, 349.23,
    523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 523.25,
    392, 493.88, 587.33, 493.88, 659.25, 587.33, 493.88, 392
  ];

  function ensureAudio() {
    try {
      if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          ctx = new AudioCtx();
        }
      }
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {}
    return ctx;
  }

  // Proactive user-gesture audio unlocker for modern browsers
  const unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'click'];
  function unlockAudio() {
    try {
      ensureAudio();
      if (ctx && ctx.state === 'running') {
        unlockEvents.forEach(evt => window.removeEventListener(evt, unlockAudio));
      }
    } catch (e) {}
  }
  unlockEvents.forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true }));

  function playTone(freq, duration, type, startGain, delay, freqEnd) {
    try {
      if (sfxMuted) return;
      ensureAudio();
      if (!ctx || ctx.state !== 'running') return;

      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
      }

      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime((startGain || 0.15) * sfxVolume, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) {}
  }

  // Sound effects
  function playJump() {
    try {
      playTone(320, 0.16, 'triangle', 0.18, 0, 780);
      playTone(540, 0.12, 'sine', 0.1, 0.04, 880);
    } catch (e) {}
  }

  function playSlide() {
    try {
      playTone(280, 0.22, 'sine', 0.16, 0, 110);
    } catch (e) {}
  }

  function playLaneSwitch() {
    try {
      playTone(400, 0.06, 'triangle', 0.09, 0, 560);
    } catch (e) {}
  }

  function playCoin() {
    try {
      playTone(1046.5, 0.08, 'square', 0.09, 0);       // C6
      playTone(1318.5, 0.09, 'square', 0.08, 0.04);    // E6
      playTone(1567.98, 0.14, 'square', 0.07, 0.08);   // G6
    } catch (e) {}
  }

  function playPowerup() {
    try {
      playTone(440, 0.08, 'sawtooth', 0.1, 0);
      playTone(554.37, 0.08, 'sawtooth', 0.1, 0.06);
      playTone(659.25, 0.08, 'sawtooth', 0.1, 0.12);
      playTone(880, 0.2, 'sawtooth', 0.12, 0.18);
    } catch (e) {}
  }

  function playShieldBreak() {
    try {
      playTone(240, 0.25, 'sawtooth', 0.2, 0, 70);
      playTone(160, 0.3, 'square', 0.15, 0.05, 50);
    } catch (e) {}
  }

  function playCrash() {
    try {
      if (sfxMuted) return;
      ensureAudio();
      if (!ctx) return;
      const t0 = ctx.currentTime;

      // Sub bass drop
      playTone(150, 0.6, 'sawtooth', 0.28, 0, 30);
      playTone(80, 0.7, 'triangle', 0.35, 0.05, 20);

      // Filtered noise burst
      try {
        const bufferSize = ctx.sampleRate * 0.35;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t0);
        filter.frequency.exponentialRampToValueAtTime(200, t0 + 0.35);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.35 * sfxVolume, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start(t0);
      } catch (e) {}
    } catch (e) {}
  }

  function playBuy() {
    try {
      playTone(523.25, 0.08, 'square', 0.12, 0);       // C5
      playTone(659.25, 0.08, 'square', 0.12, 0.06);    // E5
      playTone(783.99, 0.08, 'square', 0.12, 0.12);    // G5
      playTone(1046.5, 0.22, 'square', 0.15, 0.18);    // C6
    } catch (e) {}
  }

  function playEquip() {
    try {
      playTone(330, 0.08, 'triangle', 0.14, 0, 660);
      playTone(880, 0.15, 'sine', 0.12, 0.08);
    } catch (e) {}
  }

  /* ---------------- Procedural Synthwave BGM ---------------- */
  function scheduleBgmNote(time) {
    if (bgmMuted || !isPlayingBgm || !ctx) return;

    const step16 = bgmStep % 32;
    const bassIdx = Math.floor(bgmStep / 2) % bassNotes.length;

    // Kick on 1, 5, 9, 13 (four on the floor)
    if (step16 % 4 === 0) {
      try {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(130, time);
        kickOsc.frequency.exponentialRampToValueAtTime(32, time + 0.08);
        kickGain.gain.setValueAtTime(0.24 * bgmVolume, time);
        kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
        kickOsc.connect(kickGain).connect(ctx.destination);
        kickOsc.start(time);
        kickOsc.stop(time + 0.09);
      } catch (e) {}
    }

    // Snare on 5, 13 (backbeat)
    if (step16 % 8 === 4) {
      try {
        const snareOsc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(180, time);
        snareOsc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
        snareGain.gain.setValueAtTime(0.12 * bgmVolume, time);
        snareGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
        snareOsc.connect(snareGain).connect(ctx.destination);
        snareOsc.start(time);
        snareOsc.stop(time + 0.12);
      } catch (e) {}
    }

    // Hi-hat on every 16th note (using valid highpass filter)
    try {
      const hatOsc = ctx.createOscillator();
      const hatFilter = ctx.createBiquadFilter();
      const hatGain = ctx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(7500, time);
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(6000, time);
      hatGain.gain.setValueAtTime(0.02 * bgmVolume, time);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
      hatOsc.connect(hatFilter).connect(hatGain).connect(ctx.destination);
      hatOsc.start(time);
      hatOsc.stop(time + 0.035);
    } catch (e) {}

    // Driving rolling synth bass
    try {
      const bassFreq = bassNotes[bassIdx];
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      const bassFilter = ctx.createBiquadFilter();

      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassFreq, time);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(450, time);
      bassFilter.frequency.exponentialRampToValueAtTime(220, time + stepTime * 0.85);

      bassGain.gain.setValueAtTime(0, time);
      bassGain.gain.linearRampToValueAtTime(0.07 * bgmVolume, time + 0.005);
      bassGain.gain.exponentialRampToValueAtTime(0.001, time + stepTime * 0.9);

      bassOsc.connect(bassFilter).connect(bassGain).connect(ctx.destination);
      bassOsc.start(time);
      bassOsc.stop(time + stepTime);
    } catch (e) {}

    // Synth lead melody accents
    if (step16 % 4 === 2 && Math.random() < 0.65) {
      try {
        const leadNote = leadNotes[bgmStep % leadNotes.length];
        const leadOsc = ctx.createOscillator();
        const leadGain = ctx.createGain();
        leadOsc.type = 'sine';
        leadOsc.frequency.setValueAtTime(leadNote, time);
        leadGain.gain.setValueAtTime(0.035 * bgmVolume, time);
        leadGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
        leadOsc.connect(leadGain).connect(ctx.destination);
        leadOsc.start(time);
        leadOsc.stop(time + 0.23);
      } catch (e) {}
    }
  }

  function bgmScheduler() {
    if (!isPlayingBgm || !ctx) return;
    try {
      while (nextNoteTime < ctx.currentTime + 0.12) {
        scheduleBgmNote(nextNoteTime);
        nextNoteTime += stepTime;
        bgmStep++;
      }
      bgmTimer = setTimeout(bgmScheduler, 25);
    } catch (e) {
      console.warn('[Audio] bgmScheduler error:', e);
    }
  }

  function startBgm() {
    try {
      if (bgmMuted) return;
      ensureAudio();
      if (!ctx) return;

      const launch = () => {
        if (isPlayingBgm) return;
        isPlayingBgm = true;
        bgmStep = 0;
        nextNoteTime = ctx.currentTime + 0.05;
        bgmScheduler();
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(launch).catch(() => {});
      } else {
        launch();
      }
    } catch (e) {
      console.warn('[Audio] Failed to start BGM:', e);
    }
  }

  function stopBgm() {
    isPlayingBgm = false;
    if (bgmTimer) {
      clearTimeout(bgmTimer);
      bgmTimer = null;
    }
  }

  function setSfxVolume(vol) {
    sfxVolume = clamp(vol, 0, 1);
    try { localStorage.setItem('runner_sfx_vol', String(sfxVolume)); } catch (e) {}
  }

  function setBgmVolume(vol) {
    bgmVolume = clamp(vol, 0, 1);
    try { localStorage.setItem('runner_bgm_vol', String(bgmVolume)); } catch (e) {}
  }

  function toggleSfx() {
    sfxMuted = !sfxMuted;
    try { localStorage.setItem('runner_sfx_muted', String(sfxMuted)); } catch (e) {}
    return !sfxMuted;
  }

  function toggleBgm() {
    bgmMuted = !bgmMuted;
    try { localStorage.setItem('runner_bgm_muted', String(bgmMuted)); } catch (e) {}
    if (bgmMuted) {
      stopBgm();
    } else {
      startBgm();
    }
    return !bgmMuted;
  }

  return {
    ensure: ensureAudio,
    jump: playJump,
    slide: playSlide,
    laneSwitch: playLaneSwitch,
    coin: playCoin,
    powerup: playPowerup,
    shieldBreak: playShieldBreak,
    crash: playCrash,
    buy: playBuy,
    equip: playEquip,
    startBgm: startBgm,
    stopBgm: stopBgm,
    toggleSfx: toggleSfx,
    toggleBgm: toggleBgm,
    setSfxVolume: setSfxVolume,
    setBgmVolume: setBgmVolume,
    getSfxState: () => !sfxMuted,
    getBgmState: () => !bgmMuted
  };
})();
