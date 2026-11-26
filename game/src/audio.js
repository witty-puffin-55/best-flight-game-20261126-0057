// Ridgeline Run — sound, synthesised, no audio files.
// One job: every sound the game makes is built here with WebAudio: the
// engine drone follows the throttle, the wind follows the speed, and the
// chime, thud and click are short envelopes. No samples, no network.

export function createAudio() {
  const api = {
    muted: false,
    enabled: false,
    ctx: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    windSource: null,
    windGain: null,
    windFilter: null,
  };

  api.unlock = function unlock() {
    if (api.enabled) {
      if (api.ctx && api.ctx.state === 'suspended') api.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      api.ctx = ctx;

      // Engine: two detuned saws through a low-pass, pitch follows throttle.
      api.engineOsc = ctx.createOscillator();
      api.engineOsc.type = 'sawtooth';
      api.engineOsc.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55 * 1.007;
      api.engineFilter = ctx.createBiquadFilter();
      api.engineFilter.type = 'lowpass';
      api.engineFilter.frequency.value = 320;
      api.engineGain = ctx.createGain();
      api.engineGain.gain.value = 0;
      api.engineOsc.connect(api.engineFilter);
      osc2.connect(api.engineFilter);
      api.engineFilter.connect(api.engineGain);
      api.engineGain.connect(ctx.destination);
      api.engineOsc.start();
      osc2.start();
      api.engineOsc2 = osc2;

      // Wind: looped noise through a band-pass, loudness follows speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      api.windSource = ctx.createBufferSource();
      api.windSource.buffer = buffer;
      api.windSource.loop = true;
      api.windFilter = ctx.createBiquadFilter();
      api.windFilter.type = 'bandpass';
      api.windFilter.frequency.value = 500;
      api.windFilter.Q.value = 0.6;
      api.windGain = ctx.createGain();
      api.windGain.gain.value = 0;
      api.windSource.connect(api.windFilter);
      api.windFilter.connect(api.windGain);
      api.windGain.connect(ctx.destination);
      api.windSource.start();

      api.enabled = true;
    } catch (err) {
      api.enabled = false;
    }
  };

  // Call every frame: engine and wind track the flight state.
  api.update = function update(plane, flying) {
    if (!api.enabled || !api.ctx) return;
    const t = api.ctx.currentTime;
    const throttle = flying ? plane.throttle : 0;
    const speed = flying ? plane.speed : 0;
    const engineLevel = api.muted ? 0 : 0.05 + throttle * 0.075;
    api.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    const freq = 52 + throttle * 68 + speed * 0.35;
    api.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    api.engineOsc2.frequency.setTargetAtTime(freq * 1.007, t, 0.1);
    api.engineFilter.frequency.setTargetAtTime(280 + throttle * 900, t, 0.15);
    const windLevel = api.muted ? 0 : Math.min(0.12, speed * 0.0016);
    api.windGain.gain.setTargetAtTime(windLevel, t, 0.2);
    api.windFilter.frequency.setTargetAtTime(320 + speed * 9, t, 0.2);
  };

  function blip(freq, dur, type, level, when = 0) {
    if (!api.enabled || !api.ctx || api.muted) return;
    const t = api.ctx.currentTime + when;
    const osc = api.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = api.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(api.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  api.chime = function chime() {
    blip(660, 0.35, 'sine', 0.16);
    blip(880, 0.4, 'sine', 0.14, 0.09);
    blip(1320, 0.5, 'sine', 0.1, 0.18);
  };

  api.drop = function drop() {
    blip(520, 0.18, 'triangle', 0.14);
    blip(390, 0.22, 'triangle', 0.12, 0.08);
  };

  api.thud = function thud() {
    if (!api.enabled || !api.ctx || api.muted) return;
    const t = api.ctx.currentTime;
    const osc = api.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const gain = api.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain);
    gain.connect(api.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  };

  api.click = function click() {
    blip(1200, 0.07, 'square', 0.05);
  };

  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    return api.muted;
  };

  return api;
}
