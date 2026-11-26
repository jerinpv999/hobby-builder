/* First-person walking: arrow keys or WASD to move, drag to look around. */
const KEYS = { w: "forward", arrowup: "forward", s: "back", arrowdown: "back", a: "left", d: "right", arrowleft: "turnLeft", arrowright: "turnRight", shift: "run" };
export const EYE = 0.205;

export function createWalker({ camera, canStand }) {
  const held = new Set();
  const state = { x: 0, z: 0, yaw: 0, pitch: 0, bob: 0 };
  const typing = (e) => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox";
  const down = (e) => {
    const k = KEYS[e.key.toLowerCase()];
    if (!k || typing(e)) return;
    held.add(k);
    e.preventDefault();
  };
  const up = (e) => { const k = KEYS[e.key.toLowerCase()]; if (k) held.delete(k); };
  const blur = () => held.clear();

  function place() {
    camera.position.set(state.x, EYE + Math.sin(state.bob) * 0.004, state.z);
    camera.rotation.set(state.pitch, state.yaw, 0, "YXZ");
  }
  return {
    state,
    start(x, z, yaw) {
      Object.assign(state, { x, z, yaw, pitch: 0, bob: 0 });
      held.clear();
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", blur);
      place();
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
      place();
    },
    update(dt) {
      const turn = (held.has("turnLeft") ? 1 : 0) - (held.has("turnRight") ? 1 : 0);
      state.yaw += turn * dt * 2;
      const ahead = (held.has("forward") ? 1 : 0) - (held.has("back") ? 1 : 0);
      const side = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      if (ahead || side) {
        const speed = (held.has("run") ? 1.5 : 0.6) * dt / (Math.hypot(ahead, side) || 1);
        const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
        const dx = (fx * ahead - fz * side) * speed, dz = (fz * ahead + fx * side) * speed;
        const stuck = !canStand(state.x, state.z); // something was built on top of us: let us out
        // try each direction on its own so we slide along walls
        if (stuck || canStand(state.x + dx, state.z)) state.x += dx;
        if (stuck || canStand(state.x, state.z + dz)) state.z += dz;
        state.bob += dt * (held.has("run") ? 17 : 11);
      }
      place();
    },
  };
}
