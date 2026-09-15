/**
 * Web Audio Engine for Neon Lane Runner
 * Pure synthesized retro/synthwave audio & sound effects (no external audio files needed).
 */
const SoundSystem = (function () {
  'use strict';

  let ctx = null;
  let sfxMuted = false;
  let bgmMuted = false;
  let isPlayingBgm = false;
  let nextNoteTime = 0;
  let bgmStep = 0;
  let bgmTimer = null;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

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
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  function playTone(freq, duration, type, startGain, delay, freqEnd) {
    try {
      if (sfxMuted || !ctx) return;
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
      ensureAudio();
      playTone(320, 0.16, 'triangle', 0.18, 0, 780);
      playTone(540, 0.12, 'sine', 0.1, 0.04, 880);
    } catch (e) {}
  }

  function playSlide() {
    try {
      ensureAudio();
      playTone(280, 0.22, 'sine', 0.16, 0, 110);
    } catch (e) {}
  }

  function playLaneSwitch() {
    try {
      ensureAudio();
      playTone(400, 0.06, 'triangle', 0.08, 0, 520);
    } catch (e) {}
  }

  function playCoin() {
    try {
      ensureAudio();
      playTone(1046.5, 0.08, 'square', 0.09, 0);       // C6
      playTone(1318.5, 0.09, 'square', 0.08, 0.04);    // E6
      playTone(1567.98, 0.14, 'square', 0.07, 0.08);   // G6
    } catch (e) {}
  }

  function playPowerup() {
    try {
      ensureAudio();
      playTone(440, 0.08, 'sawtooth', 0.1, 0);
      playTone(554.37, 0.08, 'sawtooth', 0.1, 0.06);
      playTone(659.25, 0.08, 'sawtooth', 0.1, 0.12);
      playTone(880, 0.2, 'sawtooth', 0.12, 0.18);
    } catch (e) {}
  }

  function playShieldBreak() {
    try {
      ensureAudio();
      playTone(240, 0.25, 'sawtooth', 0.2, 0, 70);
      playTone(160, 0.3, 'square', 0.15, 0.05, 50);
    } catch (e) {}
  }

  function playCrash() {
    try {
      ensureAudio();
      if (sfxMuted || !ctx) return;
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

  /* ---------------- Procedural Synthwave BGM ---------------- */
  function scheduleBgmNote(time) {
    if (bgmMuted || !isPlayingBgm || !ctx) return;

    const step16 = bgmStep % 32;
    const bassIdx = Math.floor(bgmStep / 2) % bassNotes.length;

    // Kick on 1, 5, 9, 13 (four on the floor)
    if (step16 % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.frequency.setValueAtTime(120, time);
      kickOsc.frequency.exponentialRampToValueAtTime(35, time + 0.1);
      kickGain.gain.setValueAtTime(0.24, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      kickOsc.connect(kickGain).connect(ctx.destination);
      kickOsc.start(time);
      kickOsc.stop(time + 0.13);
    }

    // Snare / clap on 4, 12 (beats 2 and 4)
    if (step16 % 8 === 4) {
      try {
        const snareLen = 0.12;
        const buf = ctx.createBuffer(1, ctx.sampleRate * snareLen, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
        }
        const snare = ctx.createBufferSource();
        snare.buffer = buf;
        const sGain = ctx.createGain();
        sGain.gain.setValueAtTime(0.12, time);
        sGain.gain.exponentialRampToValueAtTime(0.001, time + snareLen);
        snare.connect(sGain).connect(ctx.destination);
        snare.start(time);
      } catch (e) {}
    }

    // Hi-hat on off-beats
    if (step16 % 2 === 1) {
      try {
        const hatOsc = ctx.createOscillator();
        const hatGain = ctx.createGain();
        const hatFilter = ctx.createBiquadFilter();
        hatOsc.type = 'square';
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(7000, time);
        hatGain.gain.setValueAtTime(0.02 * sfxVolume, time);
        hatGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
        hatOsc.connect(hatFilter).connect(hatGain).connect(ctx.destination);
        hatOsc.start(time);
        hatOsc.stop(time + 0.035);
      } catch (e) {}
    }

    // Rolling 16th synth bassline
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

    // Occasional lead accent
    if (step16 % 4 === 2 && Math.random() < 0.6) {
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
      while (nextNoteTime < ctx.currentTime + 0.1) {
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
      ensureAudio();
      if (isPlayingBgm || !ctx) return;
      isPlayingBgm = true;
      bgmStep = 0;
      nextNoteTime = (ctx && typeof ctx.currentTime === 'number') ? ctx.currentTime + 0.05 : 0;
      bgmScheduler();
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

  let sfxVolume = 1.0;
  let bgmVolume = 0.55;

  function setSfxVolume(vol) {
    sfxVolume = clamp(vol, 0, 1);
  }

  function setBgmVolume(vol) {
    bgmVolume = clamp(vol, 0, 1);
  }

  function playBuy() {
    try {
      ensureAudio();
      playTone(523.25, 0.08, 'square', 0.12 * sfxVolume, 0);       // C5
      playTone(659.25, 0.08, 'square', 0.12 * sfxVolume, 0.06);    // E5
      playTone(783.99, 0.08, 'square', 0.12 * sfxVolume, 0.12);    // G5
      playTone(1046.5, 0.22, 'square', 0.15 * sfxVolume, 0.18);    // C6
    } catch (e) {}
  }

  function playEquip() {
    try {
      ensureAudio();
      playTone(330, 0.08, 'triangle', 0.14 * sfxVolume, 0, 660);
      playTone(880, 0.15, 'sine', 0.12 * sfxVolume, 0.08);
    } catch (e) {}
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
