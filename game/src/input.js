// Ridgeline Run — keyboard and mouse.
// One job: turn keys and the mouse into a single stick object the flight
// model reads: { pitch, bank, throttle } plus edge-triggered actions
// (drop, pause, restart, mute). Nothing here knows about the game state.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0,
    bank: 0,
    throttle: 0,
    mouseX: 0.5, // 0..1 across the canvas
    mouseY: 0.5,
    mouseActive: false,
    dropQueued: false,
    pauseQueued: false,
    restartQueued: false,
    muteQueued: false,
    missionQueued: -1,
    anyKey: false,
  };

  const KEY_ACTIONS = {
    KeyB: 'dropQueued',
    Space: 'dropQueued',
    KeyP: 'pauseQueued',
    Escape: 'pauseQueued',
    KeyR: 'restartQueued',
    KeyM: 'muteQueued',
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    state.anyKey = true;
    const action = KEY_ACTIONS[e.code];
    if (action === undefined) return;
    if (typeof action === 'number') state.missionQueued = action;
    else state[action] = true;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    state.mouseY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    state.mouseActive = true;
  }

  function onMouseDown(e) {
    onMouseMove(e);
    state.mouseActive = true;
    state.dropQueued = true;
  }

  function onWheel(e) {
    e.preventDefault();
    state.throttle = Math.max(-1, Math.min(1, state.throttle - Math.sign(e.deltaY) * 0.15));
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Read the stick once per frame: keys win over the mouse while held.
  state.read = function read() {
    let pitch = 0;
    let bank = 0;
    if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) bank -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) bank += 1;

    // Mouse steering: hold the pointer off-centre and the plane follows it.
    if (state.mouseActive && pitch === 0 && bank === 0) {
      bank = (state.mouseX - 0.5) * 2.2;
      pitch = (0.5 - state.mouseY) * 1.6;
    }

    let throttle = 0;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle += 1;
    if (keys.has('ControlLeft') || keys.has('KeyC')) throttle -= 1;
    throttle += state.throttle;
    state.throttle = 0; // wheel nudges are one-frame impulses
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      bank: Math.max(-1, Math.min(1, bank)),
      throttle: Math.max(-1, Math.min(1, throttle)),
    };
  };

  // Edge-triggered actions are consumed by the game loop each frame.
  state.consume = function consume(name) {
    const value = state[name];
    // Numbers reset to their own "none" value; flags reset to false.
    state[name] = name === 'missionQueued' ? -1 : false;
    return value;
  };

  return state;
}
