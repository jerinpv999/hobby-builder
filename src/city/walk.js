/* Walking: arrow keys or WASD to move, drag to look around. The engine draws the camera and the character. */
const KEYS = { w: "forward", arrowup: "forward", s: "back", arrowdown: "back", a: "left", d: "right", arrowleft: "turnLeft", arrowright: "turnRight", shift: "run" };
export const EYE = 0.205;
const STRIDE = 0.015; // longest single step, so thin posts can't be jumped over

/* canMove(fromX, fromZ, x, z) says whether the walker may take that step */
export function createWalker({ canMove }) {
  const held = new Set();
  const state = { x: 0, z: 0, yaw: 0, pitch: 0, bob: 0, phase: 0, moving: false };
  const typing = (e) => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox";
  const down = (e) => {
    const k = KEYS[e.key.toLowerCase()];
    if (!k || typing(e)) return;
    held.add(k);
    e.preventDefault();
  };
  const up = (e) => { const k = KEYS[e.key.toLowerCase()]; if (k) held.delete(k); };
  const blur = () => held.clear();

  return {
    state,
    start(x, z, yaw) {
      Object.assign(state, { x, z, yaw, pitch: 0, bob: 0, phase: 0, moving: false });
      held.clear();
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", blur);
    },
    stop() {
      held.clear();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    },
    hold(action, on) { if (on) held.add(action); else held.delete(action); },
    look(dx, dy) {
      state.yaw += dx * 0.0045;
      state.pitch = Math.max(-1.2, Math.min(1.3, state.pitch + dy * 0.0045));
    },
    update(dt) {
      const turn = (held.has("turnLeft") ? 1 : 0) - (held.has("turnRight") ? 1 : 0);
      state.yaw += turn * dt * 2;
      const ahead = (held.has("forward") ? 1 : 0) - (held.has("back") ? 1 : 0);
      const side = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      state.moving = false;
      if (!ahead && !side) return;
      const length = (held.has("run") ? 1.5 : 0.6) * dt;
      const steps = Math.max(1, Math.ceil(length / STRIDE));
      const each = length / steps / Math.hypot(ahead, side);
      const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
      const dx = (fx * ahead - fz * side) * each, dz = (fz * ahead + fx * side) * each;
      for (let i = 0; i < steps; i++) {
        // try each direction on its own so we slide along walls
        if (canMove(state.x, state.z, state.x + dx, state.z)) { state.x += dx; state.moving = true; }
        if (canMove(state.x, state.z, state.x, state.z + dz)) { state.z += dz; state.moving = true; }
      }
      state.bob += dt * (held.has("run") ? 17 : 11);
      if (state.moving) state.phase += length * 55;
    },
  };
}
