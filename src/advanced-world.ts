import * as T from 'three';
import type { Params, Sample } from './physics';
import type { ViewOptions } from './world';
import { millikanConstants, type AdvancedId } from './advanced';
const cyan = 0x63e6ce, amber = 0xffbc70, purple = 0xb3a1ff, red = 0xff7285;
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const n = (p: Params, k: string) => Number(p[k]);
export function buildAdvancedWorld(parent: T.Group, id: AdvancedId, p: Params) {
  const group = new T.Group(); parent.add(group);
  const material = (color: number) => new T.MeshStandardMaterial({ color, roughness: .35, metalness: .25 });
  function box(w: number, h: number, d: number, color: number, root: T.Object3D = group) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material(color)); m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  function ball(color = amber, r = .17) { const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), material(color)); m.castShadow = true; group.add(m); return m; }
  function text(value: string, color = '#dce9f3') {
    const c = document.createElement('canvas'); c.width = 384; c.height = 80; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#101a2bdd'; ctx.beginPath(); ctx.roundRect(2, 4, 380, 72, 12); ctx.fill(); ctx.font = '600 26px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(value, 192, 40);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(2.2, .46, 1); group.add(s); return s;
  }
  function line(color = 0xdce6f3, max = 800) {
    const geometry = new T.BufferGeometry(), attr = new T.BufferAttribute(new Float32Array(max * 3), 3); attr.setUsage(T.DynamicDrawUsage); geometry.setAttribute('position', attr); geometry.setDrawRange(0, 0);
    const l = new T.Line(geometry, new T.LineBasicMaterial({ color })); l.frustumCulled = false; group.add(l);
    return (pts: T.Vector3[]) => { pts.slice(0, max).forEach((a, i) => attr.setXYZ(i, a.x, a.y, a.z)); attr.needsUpdate = true; geometry.setDrawRange(0, Math.min(max, pts.length)); };
  }
  function spring(color = 0xdce6f3) {
    const draw = line(color, 161);
    return (a: T.Vector3, b: T.Vector3) => {
      const axis = b.clone().sub(a), normal = v(-axis.y, axis.x, 0).normalize();
      draw(Array.from({ length: 161 }, (_, i) => { const u = i / 160, e = Math.min(1, u * 16, (1 - u) * 16), point = a.clone().addScaledVector(axis, u); point.addScaledVector(normal, .095 * Math.sin(u * 20 * Math.PI) * e); point.z += .095 * Math.cos(u * 20 * Math.PI) * e; return point; }));
    };
  }
  function arrow(color: number) {
    const a = new T.ArrowHelper(v(1), v(), 1, color, .18, .1); a.visible = false; group.add(a);
    return (pos: T.Vector3, vector: T.Vector3, show: boolean) => { const length = vector.length(); a.visible = show && length > 1e-10; if (!a.visible) return; a.position.copy(pos); a.setDirection(vector.clone().normalize()); a.setLength(Math.min(2, .3 + length * .15), .16, .1); };
  }
  function trail(color = 0x717f9b) { const draw = line(color, 700), history: T.Vector3[] = []; let last = -1;
    return (s: Sample, position: T.Vector3) => { if (s.t < last || s.t - last > .25) history.length = 0; if (last !== s.t) { history.push(position.clone()); if (history.length > 650) history.shift(); draw(history); last = s.t; } };
  }
  function cart(w = 6.4) { const c = new T.Group(); group.add(c); const deck = box(w, .22, 1.6, 0x456b87, c); deck.position.y = .42;
    for (const x of [-w * .35, w * .35]) { const wh = new T.Mesh(new T.CylinderGeometry(.22, .22, 1.55, 24), material(0x90a4b8)); wh.rotation.x = Math.PI / 2; wh.position.set(x, .2, 0); c.add(wh); }
    return c;
  }
  function support(x: number, y: number) { box(.12, y, .16, 0x4e627a).position.set(x, y / 2, -.4); box(1, .14, .8, 0x8da1b6).position.set(x, y, -.1); }
  const vel = [arrow(cyan), arrow(cyan), arrow(cyan)], force = [arrow(red), arrow(amber), arrow(purple)];
  let width = 9, height = 6.5, targetY = 2.7;
  let apply: (s: Sample, o: ViewOptions) => void = () => {};
  let focus: (s: Sample, o: ViewOptions) => number = () => 0;
  const offset = (s: Sample) => p.frame === 'cart' ? s.q[0] : 0;
  if (id === 'cartSpring') {
    height = 4; targetY = 1;
    const c = cart(), wall = box(.12, 1.1, 1.3, 0x8b9db1, c); wall.position.set(-3, 1, 0);
    const a = box(.5, .55, .8, cyan), b = box(.5, .55, .8, amber), coil1 = spring(), coil2 = spring();
    const ca = text(`台車 M = ${p.M} kg`), la = text(`m₁ = ${p.m1} kg`, '#92f3df'), lb = text(`m₂ = ${p.m2} kg`, '#ffcf98');
    apply = (s, o) => { const off = offset(s), x = s.q[0] - off; c.position.x = x; a.position.set(s.q[1] - off, .85, 0); b.position.set(s.q[2] - off, .85, 0);
      coil1(v(x - 2.95, .85), a.position.clone().add(v(-.25))); coil2(a.position.clone().add(v(.25)), b.position.clone().add(v(-.25)));
      ca.position.set(x, .38, 1.05); la.position.copy(a.position).add(v(-.2, .8)); lb.position.copy(b.position).add(v(.2, .8));
      [a, b].forEach((body, i) => { vel[i](body.position, v(s.v[i + 1] - (p.frame === 'cart' ? s.v[0] : 0)), o.vectors); force[i](body.position.clone().add(v(0, 0, .5)), v(s.extra[`f${i + 1}`] - (p.frame === 'cart' ? n(p, i ? 'm2' : 'm1') * s.extra.aCart : 0)), o.forces); });
    };
    focus = (s, o) => o.follow && p.frame !== 'cart' ? s.q[0] : 0;
  } else if (id === 'cartPendulum') {
    const L = n(p, 'L'), H = L + 1.3, c = cart(), post = box(.1, H - .5, .12, 0x91a4ba, c); post.position.set(0, (H + .5) / 2, -.35);
    box(.8, .12, .8, 0x91a4ba, c).position.set(0, H, -.1); const bob = ball(), rod = line(), coil = spring(purple), lab = text(p.mode === 'accelerated' ? '外部駆動で加速' : '台車と振り子'); lab.position.set(0, H + .45, 0);
    height = H + 2; targetY = H * .5;
    apply = (s, o) => { const off = offset(s), X = s.q[0] - off, theta = s.q[1]; c.position.x = X; bob.position.set(X + L * Math.sin(theta), H - L * Math.cos(theta), 0); rod([v(X, H), bob.position.clone()]); lab.position.x = X;
      if (p.mode === 'spring') coil(v(-4 - off, .8), v(X - 3.2, .8));
      vel[0](bob.position, v(s.extra.vx - (p.frame === 'cart' ? s.v[0] : 0), s.extra.vy), o.vectors);
      force[0](bob.position.clone().add(v(0, 0, .2)), v(0, -n(p, 'm') * 9.8), o.forces);
      force[1](bob.position.clone().add(v(0, 0, .35)), v(p.frame === 'cart' ? s.extra.pseudo : 0), o.forces);
      force[2](bob.position.clone().add(v(0, 0, -.2)), v(-Math.sin(theta) * s.extra.tension, Math.cos(theta) * s.extra.tension), o.forces);
    }; focus = (s, o) => o.follow && p.frame !== 'cart' ? s.q[0] : 0;
  } else if (id === 'pendulum') {
    const L = n(p, 'L'), H = L + .55; support(0, H); const bob = ball(), rod = line(p.mode === 'string' ? amber : 0xdce6f3), trace = trail(); height = 2 * L + 1.8; targetY = H;
    const lab = text(p.mode === 'string' ? '糸：T ≥ 0 が必要' : '棒：圧縮も可能'); lab.position.set(0, height - .25, 0);
    apply = (s, o) => { const a = s.q[0], w = s.v[0]; bob.position.set(L * Math.sin(a), H - L * Math.cos(a), 0); rod([v(0, H), bob.position.clone()]); trace(s, bob.position);
      vel[0](bob.position, v(L * Math.cos(a) * w, L * Math.sin(a) * w), o.vectors); force[0](bob.position, v(0, -n(p, 'm') * 9.8), o.forces); force[1](bob.position, v(-Math.sin(a) * s.extra.tension, Math.cos(a) * s.extra.tension), o.forces); };
  } else if (id === 'coupledPendulum') {
    const L = n(p, 'L'), H = L + 1.2; support(-1.5, H); support(1.5, H); const a = ball(cyan), b = ball(amber), rods = [line(), line()], coil = spring(purple);
    const labels = [text('振り子 1', '#92f3df'), text('振り子 2', '#ffcf98')]; height = H + 1.3; targetY = H / 2;
    apply = (s, o) => { [a, b].forEach((body, i) => { const x = i ? 1.5 : -1.5, angle = s.q[i]; body.position.set(x + L * Math.sin(angle), H - L * Math.cos(angle), 0); rods[i]([v(x, H), body.position.clone()]); labels[i].position.copy(body.position).add(v(0, -.5)); vel[i](body.position, v(L * Math.cos(angle) * s.v[i], L * Math.sin(angle) * s.v[i]), o.vectors); }); coil(a.position, b.position);
      const delta = b.position.clone().sub(a.position), realForce = delta.clone().normalize().multiplyScalar(n(p, 'k') * s.extra.extension); force[0](a.position, realForce, o.forces); force[1](b.position, realForce.clone().negate(), o.forces); };
  } else if (id === 'elasticPendulum') {
    support(0, 4); const bob = ball(), coil = spring(), trace = trail(); const lab = text('伸縮する理想ばね'); lab.position.set(0, 4.65, 0); height = 6; targetY = 2.8;
    apply = (s, o) => { bob.position.set(s.q[0], 4 + s.q[1], 0); coil(v(0, 4), bob.position); trace(s, bob.position); vel[0](bob.position, v(s.v[0], s.v[1]), o.vectors); force[0](bob.position, v(0, -n(p, 'm') * 9.8), o.forces); force[1](bob.position, v(-s.q[0], -s.q[1]).normalize().multiplyScalar(s.extra.force), o.forces); };
  } else if (id === 'conveyor') {
    const angle = n(p, 'angle') * Math.PI / 180, scale = .65, plane = new T.Group(); group.add(plane); plane.position.y = 3.3; plane.rotation.z = angle;
    const belt = box(17 * scale, .22, 1.4, 0x426379, plane); const markers = Array.from({ length: 22 }, () => box(.035, .025, 1.36, 0x8ba2b3, plane));
    void belt; const a = box(.48, .55, .8, cyan, plane), b = box(.48, .55, .8, amber, plane); b.visible = p.mode === 'pair'; const coil = spring(), la = text('A：粗い面', '#92f3df'), lb = text('B：滑らかな面', '#ffcf98'); lb.visible = b.visible;
    const toWorld = (x: number, y = .45, z = 0) => v(scale * x * Math.cos(angle) - y * Math.sin(angle), 3.3 + scale * x * Math.sin(angle) + y * Math.cos(angle), z);
    const lab = text(`ベルト V = ${p.V} m/s →`); lab.position.set(0, 1.3, .5); width = 13; height = 8; targetY = 3.4;
    apply = (s, o) => { a.position.set(scale * s.q[0], .42, 0); b.position.set(scale * (s.q[1] ?? 0), .42, 0); markers.forEach((m, i) => m.position.set((((i * 17 / 22 + n(p, 'V') * s.t) % 17) - 8.5) * scale, .13, 0));
      const pa = toWorld(s.q[0]), pb = toWorld(s.q[1] ?? 0); if (b.visible) coil(pb.clone().add(v(.2)), pa.clone().add(v(-.2)));
      la.position.copy(pa).add(v(.2, .75)); lb.position.copy(pb).add(v(-.2, -.65));
      vel[0](pa, v(s.v[0] * Math.cos(angle), s.v[0] * Math.sin(angle)), o.vectors); vel[1](pb, v((s.v[1] ?? 0) * Math.cos(angle), (s.v[1] ?? 0) * Math.sin(angle)), o.vectors && b.visible);
      force[0](pa, v(s.extra.friction * Math.cos(angle), s.extra.friction * Math.sin(angle)), o.forces); force[1](pa.clone().add(v(0, 0, .45)), v(0, -n(p, 'm1') * 9.8), o.forces); };
  } else if (id === 'relative') {
    const c = cart(3), bob = ball(), trace = trail(), lab = text('車の基準面 y = 0'); lab.position.set(0, .8, 1); height = 6; targetY = 2;
    apply = (s, o) => { const off = offset(s); c.position.x = s.q[0] - off; lab.position.x = c.position.x; bob.position.set(s.q[1] - off, s.q[2] + .55, 0); trace(s, bob.position);
      vel[0](bob.position, v(p.frame === 'cart' ? s.extra.relativeV : s.v[1], s.v[2]), o.vectors); force[0](bob.position, v(0, -n(p, 'm') * 9.8), o.forces); force[1](bob.position, v(p.frame === 'cart' ? s.extra.pseudo : 0), o.forces); };
    focus = (s, o) => o.follow && p.frame !== 'cart' ? s.q[0] : 0;
  } else if (id === 'rotating') {
    const scale = .42, bob = ball(), trace = trail(), coil = spring(purple), axes = [line(0x6f8bb3), line(0x6f8bb3)]; const disk = new T.Mesh(new T.CircleGeometry(3.8, 96), new T.MeshStandardMaterial({ color: 0x253b52, transparent: true, opacity: .5, side: T.DoubleSide })); disk.rotation.x = -Math.PI / 2; disk.position.y = .07; group.add(disk);
    const lab = text(p.frame === 'rotating' ? '回転座標 r′・v′' : '地上座標 r・v'); lab.position.set(0, 2.3, -1); targetY = .9; height = 5;
    apply = (s, o) => { const rotating = p.frame === 'rotating', x = rotating ? s.extra.rx : s.q[0], y = rotating ? s.extra.ry : s.q[1]; bob.position.set(scale * x, .35, -scale * y); trace(s, bob.position);
      if (p.mode === 'spring') coil(v(0, .35), bob.position);
      const angle = (rotating ? -1 : 1) * n(p, 'Omega') * s.t; axes[0]([v(-3 * Math.cos(angle), .15, 3 * Math.sin(angle)), v(3 * Math.cos(angle), .15, -3 * Math.sin(angle))]); axes[1]([v(-3 * Math.sin(angle), .15, -3 * Math.cos(angle)), v(3 * Math.sin(angle), .15, 3 * Math.cos(angle))]);
      vel[0](bob.position, v(rotating ? s.extra.rvx : s.v[0], 0, -(rotating ? s.extra.rvy : s.v[1])), o.vectors);
      force[0](bob.position.clone().add(v(0, .1)), v(s.extra.coriolisX, 0, -s.extra.coriolisY), o.forces && rotating);
      force[1](bob.position.clone().add(v(0, .25)), v(s.extra.centrifugalX, 0, -s.extra.centrifugalY), o.forces && rotating);
      force[2](bob.position, v(-x, 0, y).normalize().multiplyScalar(n(p, 'k') * (s.extra.radius - n(p, 'L'))), o.forces && p.mode === 'spring'); };
  } else if (id === 'accelerator') {
    const synch = p.mode === 'synchrotron', omega = n(p, 'charge') * n(p, 'B') / n(p, 'm');
    const initialRadius = n(p, 'v') / omega, maxSpeed = Math.sqrt(n(p, 'v') ** 2 + 2 * n(p, 'charge') * n(p, 'voltage') * Math.floor(12 * omega / Math.PI) / n(p, 'm'));
    const scale = 2.6 / (synch ? n(p, 'radius') : p.mode === 'uniform' ? initialRadius : maxSpeed / omega);
    const base = 3.4, lift = base + (synch ? 0 : initialRadius * scale), particle = ball(amber, .12), trace = trail(cyan), path = line(0x536d8e);
    const ring = Array.from({ length: 129 }, (_, i) => v(2.8 * Math.cos(i * Math.PI / 64), base + 2.8 * Math.sin(i * Math.PI / 64), -.2)); path(ring);
    if (synch) box(.32, .7, .5, purple).position.set(n(p, 'radius') * scale, base, -.05);
    else { const gap = line(purple); gap([v(0, .5, -.2), v(0, 6.4, -.2)]); }
    const lab = text(synch ? '固定R・BとRFを同期' : '⊙ B：画面手前向き'); lab.position.set(0, 6.6, 0);
    for (const x of [-1.7, 1.7]) for (const y of [1.7, 5.1]) { const dot = text('⊙', '#9284b5'); dot.scale.set(.5, .5, 1); dot.position.set(x, y, -.3); }
    height = 7.4; targetY = 3.4; width = 9;
    apply = (s, o) => { particle.position.set(s.q[0] * scale, lift + s.q[1] * scale, 0); trace(s, particle.position); vel[0](particle.position, v(s.v[0], s.v[1]), o.vectors); force[0](particle.position, v(s.extra.forceX, s.extra.forceY), o.forces); };
  } else if (id === 'millikan') {
    const c = millikanConstants(p), scale = 5 / c.d, drop = ball(amber, .14); height = 7.4; targetY = 3.5; width = 8;
    for (const y of [1, 6]) box(5, .14, 2, 0x7b8fa9).position.set(0, y, 0);
    const upper = text(c.voltage > 0 ? '− 電極' : c.voltage < 0 ? '＋ 電極' : '電極', '#c5b7ff'), lower = text(c.voltage > 0 ? '＋ 電極' : c.voltage < 0 ? '− 電極' : '電極', '#c5b7ff'); upper.position.set(0, 6.5); lower.position.set(0, .5);
    const dimension = text(`間隔 ${p.gap} mm`); dimension.position.set(-2.1, 3.5, .6); const field = arrow(purple); field(v(1.8, c.voltage >= 0 ? 2.3 : 4.7), v(0, Math.sign(c.voltage) * 8), c.voltage !== 0);
    const lab = text(`q = ${p.charge} e`); const ruler = line(0x5b728e); ruler([v(-2, 1), v(-2, 6)]);
    apply = (s, o) => { drop.position.set(0, 1 + s.q[0] * scale, 0); lab.position.copy(drop.position).add(v(1.15, .1)); vel[0](drop.position, v(0, s.v[0] * 1e4), o.vectors);
      force[0](drop.position.clone().add(v(-.2, 0, .2)), v(0, -s.extra.weight * 1e14), o.forces); force[1](drop.position.clone().add(v(.2, 0, .2)), v(0, s.extra.electric * 1e14), o.forces); force[2](drop.position.clone().add(v(0, 0, -.2)), v(0, s.extra.drag * 1e14), o.forces); };
  }
  return { apply, focus, width, height, targetY };
}
