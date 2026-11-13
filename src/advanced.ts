/** Advanced idealized models. SI throughout; rendering scales are separate. */
import type { Params, Sample, Timeline } from './physics.ts';
export type AdvancedId = 'cartSpring' | 'cartPendulum' | 'pendulum' | 'coupledPendulum' | 'elasticPendulum' | 'conveyor' | 'relative' | 'rotating' | 'accelerator' | 'millikan';
export const advancedDefaults: Record<AdvancedId, Params> = {
  cartSpring: { M: 4, m1: 1, m2: 1.5, k1: 8, k2: 6, A: .45, B: -.15, V: .2, F: 0, mode: 'free', frame: 'ground' },
  cartPendulum: { M: 3, m: 1, L: 2, angle: 40, omega: 0, V: 0, a: 1.5, k: 3, mode: 'free', frame: 'ground' },
  pendulum: { m: 1, L: 2, angle: 50, omega: 0, mode: 'rod' },
  coupledPendulum: { m1: 1, m2: 1, L: 2, k: .8, angle1: 18, angle2: 0 },
  elasticPendulum: { m: 1, L: 1.2, k: 16, extension: .55, angle: 25, radial: 0, omega: 0 },
  conveyor: { mode: 'pair', m1: 1, m2: 1, k: 5, angle: 15, muk: .5358983848622454, mus: .9, V: .9, extension: .5072853284009407, v1: 0, v2: .9 },
  relative: { m: 1, V: .8, a: 1.2, u: .6, vy: 5, h: .8, frame: 'cart' },
  rotating: { m: 1, k: 3, L: 1, r: 2, v: 2, Omega: 1, mode: 'free', frame: 'rotating' },
  accelerator: { m: 1, charge: 1, B: 1, v: 1.2, voltage: .3, radius: 2, mode: 'cyclotron' },
  millikan: { radius: 1, charge: 5, voltage: 300, gap: 3, rho: 900, mode: 'voltage' },
};
export const isAdvanced = (id: string): id is AdvancedId => Object.hasOwn(advancedDefaults, id);
const N = (p: Params, k: string) => Number(p[k]);
const g = 9.8, fps = 60, rad = Math.PI / 180;
const bal = (s: Sample) => s.K + s.U + s.Q - s.W;
export function rkStep(y: number[], t: number, h: number, f: (y: number[], t: number) => number[]): number[] {
  const a = f(y, t), b = f(y.map((v, i) => v + h * a[i] / 2), t + h / 2);
  const c = f(y.map((v, i) => v + h * b[i] / 2), t + h / 2), d = f(y.map((v, i) => v + h * c[i]), t + h);
  return y.map((v, i) => v + h * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
}
function finish(samples: Sample[], momentumConserved = false, endReason = '', smallEnergy = false): Timeline {
  const first = samples[0];
  return { samples, duration: samples.at(-1)!.t, E0: bal(first), p0: first.p, momentumConserved, endReason,
    energyReference: smallEnergy ? Math.max(1e-30, Math.abs(first.K) + Math.abs(first.U), ...samples.map(s => Math.abs(s.W))) : undefined,
    energyDisplayScale: smallEnergy ? 1e15 : 1, energyUnit: smallEnergy ? 'fJ' : 'J' };
}
/** Fixed small step RK4; stop surfaces are located by bisection, not clamped positions. */
function integrate(y0: number[], duration: number, derivative: (y: number[], t: number) => number[],
  sample: (y: number[], t: number) => Sample, opts: { momentum?: boolean; margin?: (y: number[], t: number) => number; reason?: string } = {}): Timeline {
  let y = [...y0], t = 0; const samples = [sample(y, t)];
  if (opts.margin && opts.margin(y, 0) <= 0) return finish(samples, opts.momentum, opts.reason);
  for (let i = 1; i <= Math.ceil(duration * fps); i++) {
    const target = Math.min(i / fps, duration); let stopped = false;
    while (t < target - 1e-13) {
      const dt = Math.min(1 / 960, target - t), next = rkStep(y, t, dt, derivative);
      if (!next.every(Number.isFinite)) throw new Error('Numerical state is non-finite');
      if (opts.margin && opts.margin(next, t + dt) <= 0) {
        let lo = 0, hi = dt;
        for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (opts.margin(rkStep(y, t, mid, derivative), t + mid) > 0) lo = mid; else hi = mid; }
        y = rkStep(y, t, hi, derivative); t += hi; stopped = true; break;
      }
      y = next; t += dt;
    }
    samples.push(sample(y, t));
    if (stopped) return finish(samples, opts.momentum, opts.reason);
  }
  return finish(samples, opts.momentum);
}
function base(t: number): Sample { return { t, q: [], v: [], K: 0, U: 0, Q: 0, W: 0, p: 0, constraint: 0, extra: {}, phase: '' }; }

export function cartSpring(p: Params, duration: number): Timeline {
  const M = N(p, 'M'), m1 = N(p, 'm1'), m2 = N(p, 'm2'), k1 = N(p, 'k1'), k2 = N(p, 'k2');
  const fixed = p.mode === 'fixed', F = p.mode === 'forced' ? N(p, 'F') : 0, V = fixed ? 0 : N(p, 'V');
  const forces = (y: number[]) => { const f1 = k1 * (y[1] - y[0] + 1), f2 = k2 * (y[2] - y[1] - 2); return [f1 + F, -f1 + f2, -f2]; };
  return integrate([0, -1 + N(p, 'A'), 1 + N(p, 'B'), V, V, V], duration, y => {
    const f = forces(y); return [y[3], y[4], y[5], fixed ? 0 : f[0] / M, f[1] / m1, f[2] / m2];
  }, (y, t) => ({ ...base(t), q: y.slice(0, 3), v: y.slice(3),
    K: (M * y[3] ** 2 + m1 * y[4] ** 2 + m2 * y[5] ** 2) / 2,
    U: (k1 * (y[1] - y[0] + 1) ** 2 + k2 * (y[2] - y[1] - 2) ** 2) / 2, W: F * y[0],
    p: M * y[3] + m1 * y[4] + m2 * y[5],
    extra: { cm: (M * y[0] + m1 * y[1] + m2 * y[2]) / (M + m1 + m2), aCart: fixed ? 0 : forces(y)[0] / M, rel1: y[4] - y[3], rel2: y[5] - y[3], f1: forces(y)[1], f2: forces(y)[2] },
    phase: fixed ? '固定台車：二自由度の連成振動' : '台車も反作用で動く三体・二ばね系' }),
  { momentum: !fixed && F === 0, margin: y => Math.min(y[1] - y[0] + 2.65, y[2] - y[1] - .45, y[0] + 2.65 - y[2]), reason: '物体が台車の壁・他の物体に到達。衝突後は対象外です。' });
}
export function cartPendulum(p: Params, duration: number): Timeline {
  const M = N(p, 'M'), m = N(p, 'm'), L = N(p, 'L'), k = p.mode === 'spring' ? N(p, 'k') : 0;
  const fixed = p.mode === 'fixed', prescribed = p.mode === 'accelerated', a = prescribed ? N(p, 'a') : 0;
  const V = fixed ? 0 : N(p, 'V');
  function motion(y: number[]) {
    const [X, theta, v, w] = y, s = Math.sin(theta), c = Math.cos(theta);
    const ax = fixed ? 0 : prescribed ? a : (-k * X + m * L * s * w * w + m * g * s * c) / (M + m * s * s);
    const alpha = -(g * s + ax * c) / L;
    const support = (M + m) * ax + m * L * (c * alpha - s * w * w);
    return { ax, alpha, support, v };
  }
  return integrate([0, N(p, 'angle') * rad, V, N(p, 'omega'), 0], duration, y => {
    const d = motion(y); return [y[2], y[3], d.ax, d.alpha, prescribed ? d.support * y[2] : 0];
  }, (y, t) => {
    const [X, theta, v, w, W] = y, d = motion(y), vx = v + L * Math.cos(theta) * w, vy = L * Math.sin(theta) * w;
    return { ...base(t), q: [X, theta], v: [v, w], K: (M * v * v + m * (vx * vx + vy * vy)) / 2,
      U: m * g * L * (1 - Math.cos(theta)) + k * X * X / 2, W, p: M * v + m * vx,
      extra: { ax: d.ax, alpha: d.alpha, vx, vy, pseudo: -m * d.ax, tension: m * (g * Math.cos(theta) - d.ax * Math.sin(theta) + L * w * w), cm: X + m * L * Math.sin(theta) / (M + m), equilibrium: -Math.atan2(a, g) / rad },
      phase: prescribed ? '加速台車：見かけの重力が傾く' : p.mode === 'spring' ? '台車ばねと振り子のエネルギー交換' : fixed ? '支点固定の振り子' : '自由台車と振り子の反作用' };
  }, { momentum: !fixed && !prescribed && k === 0 });
}
export function pendulum(p: Params, duration: number): Timeline {
  const m = N(p, 'm'), L = N(p, 'L');
  const tension = (y: number[]) => m * (g * Math.cos(y[0]) + L * y[1] ** 2);
  return integrate([N(p, 'angle') * rad, N(p, 'omega')], duration, y => [y[1], -g * Math.sin(y[0]) / L], (y, t) => ({
    ...base(t), q: [y[0]], v: [y[1]], K: m * L * L * y[1] ** 2 / 2, U: m * g * L * (1 - Math.cos(y[0])),
    extra: { tension: tension(y), periodSmall: 2 * Math.PI * Math.sqrt(L / g), angle: y[0] / rad, speed: L * y[1] },
    phase: p.mode === 'string' ? '糸の張力が非負の範囲を計算' : '有限振幅・軽い剛体棒の振り子（回転可能）' }),
    { margin: p.mode === 'string' ? tension : undefined, reason: '張力が 0 に到達（または初期から負）。糸がたるむため停止。以後の放物運動・再緊張は対象外です。' });
}
export function coupledPendulum(p: Params, duration: number): Timeline {
  const m1 = N(p, 'm1'), m2 = N(p, 'm2'), L = N(p, 'L'), k = N(p, 'k'), D = 3;
  function coupling(y: number[]) {
    const dx = D + L * (Math.sin(y[1]) - Math.sin(y[0])), dy = L * (Math.cos(y[0]) - Math.cos(y[1]));
    const r = Math.hypot(dx, dy), extension = r - D, f = k * extension / Math.max(r, 1e-9);
    return { fx: f * dx, fy: f * dy, extension, r };
  }
  return integrate([N(p, 'angle1') * rad, N(p, 'angle2') * rad, 0, 0], duration, y => {
    const { fx, fy } = coupling(y);
    return [y[2], y[3], -g / L * Math.sin(y[0]) + (fx * Math.cos(y[0]) + fy * Math.sin(y[0])) / (m1 * L),
      -g / L * Math.sin(y[1]) - (fx * Math.cos(y[1]) + fy * Math.sin(y[1])) / (m2 * L)];
  }, (y, t) => {
    const c = coupling(y), E1 = m1 * L * L * y[2] ** 2 / 2 + m1 * g * L * (1 - Math.cos(y[0]));
    const E2 = m2 * L * L * y[3] ** 2 / 2 + m2 * g * L * (1 - Math.cos(y[1]));
    return { ...base(t), q: y.slice(0, 2), v: y.slice(2), K: L * L * (m1 * y[2] ** 2 + m2 * y[3] ** 2) / 2,
      U: m1 * g * L * (1 - Math.cos(y[0])) + m2 * g * L * (1 - Math.cos(y[1])) + k * c.extension ** 2 / 2,
      extra: { E1, E2, spring: k * c.extension ** 2 / 2, extension: c.extension, samePeriod: 2 * Math.PI / Math.sqrt(g / L), oppositePeriod: 2 * Math.PI / Math.sqrt(g / L + 2 * k / m1) },
      phase: '二つの振り子をつなぐばね：同相・逆相・うなり' };
  }, { margin: y => coupling(y).r - .4, reason: '二つの物体が接近。物体どうしの衝突は対象外です。' });
}
export function elasticPendulum(p: Params, duration: number): Timeline {
  const m = N(p, 'm'), L = N(p, 'L'), k = N(p, 'k'), theta = N(p, 'angle') * rad, r = L + N(p, 'extension');
  const vr = N(p, 'radial'), w = N(p, 'omega');
  return integrate([r * Math.sin(theta), -r * Math.cos(theta), vr * Math.sin(theta) + r * w * Math.cos(theta), -vr * Math.cos(theta) + r * w * Math.sin(theta)], duration,
    y => { const r = Math.hypot(y[0], y[1]), c = -k * (r - L) / (m * r); return [y[2], y[3], c * y[0], c * y[1] - g]; },
    (y, t) => { const r = Math.hypot(y[0], y[1]); return { ...base(t), q: y.slice(0, 2), v: y.slice(2),
      K: m * (y[2] ** 2 + y[3] ** 2) / 2, U: m * g * (y[1] + 4) + k * (r - L) ** 2 / 2,
      extra: { radius: r, extension: r - L, force: k * (r - L), angle: Math.atan2(y[0], -y[1]) / rad, radial: (y[0] * y[2] + y[1] * y[3]) / r },
      phase: '伸び縮みと揺れの非線形な連成' }; },
    { margin: y => Math.min(Math.hypot(y[0], y[1]) - .15, 3.65 + y[1]), reason: 'ばねが支点に接近、または物体が床に到達。接触後は対象外です。' });
}

/** Hybrid Coulomb friction. Velocity capture/release located within each small step. */
export function conveyor(p: Params, duration: number): Timeline {
  const pair = p.mode === 'pair', m1 = N(p, 'm1'), m2 = N(p, 'm2'), k = pair ? N(p, 'k') : 0;
  const theta = N(p, 'angle') * rad, V = N(p, 'V'), gs = g * Math.sin(theta), normal = m1 * g * Math.cos(theta);
  const kinetic = N(p, 'muk') * normal, staticMax = Math.max(N(p, 'muk'), N(p, 'mus')) * normal;
  let y = pair ? [1 + N(p, 'extension') / 2, -1 - N(p, 'extension') / 2, N(p, 'v1'), N(p, 'v2'), 0, 0] : [0, 0, N(p, 'v1'), 0, 0, 0];
  const other = (z: number[]) => -k * (z[0] - z[1] - 2) - m1 * gs;
  let stick = Math.abs(y[2] - V) < 1e-10 && Math.abs(other(y)) <= staticMax;
  let t = 0, transitions = 0;
  function read(): Sample {
    const f = stick ? -other(y) : -kinetic * (Math.abs(y[2] - V) < 1e-10 ? Math.sign(other(y)) : Math.sign(y[2] - V));
    return { ...base(t), q: y.slice(0, pair ? 2 : 1), v: y.slice(2, pair ? 4 : 3), K: (m1 * y[2] ** 2 + (pair ? m2 * y[3] ** 2 : 0)) / 2,
      U: m1 * gs * y[0] + (pair ? m2 * gs * y[1] + k * (y[0] - y[1] - 2) ** 2 / 2 : 0), Q: y[4], W: y[5],
      extra: { friction: f, slip: y[2] - V, sticking: Number(stick), transitions, extension: pair ? y[0] - y[1] - 2 : 0, normal, staticLimit: staticMax },
      phase: stick ? 'A はベルトに追従：静止摩擦' : 'A はベルトに対して滑る：動摩擦' };
  }
  const samples = [read()]; let endReason = '';
  for (let i = 1; i <= Math.ceil(duration * fps); i++) {
    const target = Math.min(i / fps, duration);
    while (t < target - 1e-12) {
      let remaining = Math.min(1 / 1200, target - t);
      for (let guard = 0; remaining > 1e-12 && guard < 8; guard++) {
        if (stick && Math.abs(other(y)) > staticMax + 1e-9) { stick = false; transitions++; }
        const slipSign = Math.abs(y[2] - V) < 1e-9 ? Math.sign(other(y)) || 1 : Math.sign(y[2] - V);
        const f = (z: number[]) => stick ? -other(z) : -kinetic * slipSign;
        const derivative = (z: number[]) => [stick ? V : z[2], pair ? z[3] : 0, stick ? 0 : (other(z) + f(z)) / m1,
          pair ? (k * (z[0] - z[1] - 2) - m2 * gs) / m2 : 0, stick ? 0 : kinetic * Math.abs(z[2] - V), f(z) * V];
        const next = rkStep(y, t, remaining, derivative);
        // A tangent contact with v=V is possible (Tokyo 2024 equilibrium initial data).
        // A strict sign-change test alone misses this event, so also locate velocity extrema.
        const acc0 = (other(y) + f(y)) / m1, acc1 = (other(next) + f(next)) / m1;
        if (!stick && acc0 * slipSign < 0 && acc1 * slipSign >= 0) {
          let lo = 0, hi = remaining;
          for (let j = 0; j < 38; j++) {
            const mid = (lo + hi) / 2, z = rkStep(y, t, mid, derivative);
            if ((other(z) + f(z)) * slipSign < 0) lo = mid; else hi = mid;
          }
          const touch = rkStep(y, t, hi, derivative);
          if (Math.abs(touch[2] - V) < 1e-9 && Math.abs(other(touch)) <= staticMax + 1e-9) {
            y = touch; y[2] = V; t += hi; remaining -= hi; stick = true; transitions++; continue;
          }
        }
        const release = stick && Math.abs(other(next)) > staticMax;
        const capture = !stick && (y[2] - V) * (next[2] - V) < 0;
        if (release || capture) {
          let lo = 0, hi = remaining;
          for (let j = 0; j < 38; j++) { const mid = (lo + hi) / 2, z = rkStep(y, t, mid, derivative);
            const before = release ? Math.abs(other(z)) <= staticMax : (z[2] - V) * slipSign >= 0;
            if (before) lo = mid; else hi = mid;
          }
          y = rkStep(y, t, hi, derivative); t += hi; remaining -= hi;
          if (release) { stick = false; transitions++; }
          else { y[2] = V; stick = Math.abs(other(y)) <= staticMax + 1e-9; transitions++; }
        } else { y = next; if (stick) y[2] = V; t += remaining; remaining = 0; }
      }
      if (pair && y[0] - y[1] < .5) { endReason = '二つの物体が接近。衝突後は対象外です。'; break; }
      if (Math.max(Math.abs(y[0]), pair ? Math.abs(y[1]) : 0) > 8) { endReason = '描画するベルトの区間端に到達しました。'; break; }
    }
    samples.push(read()); if (endReason) break;
  }
  return finish(samples, false, endReason);
}

export function relative(p: Params, duration: number): Timeline {
  const m = N(p, 'm'), V = N(p, 'V'), a = N(p, 'a'), vx = V + N(p, 'u'), vy = N(p, 'vy'), h = N(p, 'h');
  const flight = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g, end = Math.min(duration, flight);
  const samples = Array.from({ length: Math.ceil(end * fps) + 1 }, (_, i) => {
    const t = Math.min(i / fps, end), X = V * t + a * t * t / 2, x = vx * t, y = h + vy * t - g * t * t / 2;
    return { ...base(t), q: [X, x, y], v: [V + a * t, vx, vy - g * t], K: m * (vx * vx + (vy - g * t) ** 2) / 2, U: m * g * y,
      p: m * vx, extra: { relativeX: x - X, relativeV: vx - V - a * t, pseudo: -m * a, landing: flight, cm: x }, phase: 'ボールは空中：台車の加速度はボールに直接作用しない' };
  });
  return finish(samples, true, end < duration ? 'ボールが床面 y = 0 に到達。着地・衝突は対象外です。' : '');
}
export function rotating(p: Params, duration: number): Timeline {
  const m = N(p, 'm'), k = p.mode === 'spring' ? N(p, 'k') : 0, L = N(p, 'L'), Omega = N(p, 'Omega');
  return integrate([N(p, 'r'), 0, 0, N(p, 'v')], duration, y => {
    const r = Math.hypot(y[0], y[1]), factor = k ? -k * (r - L) / (m * r) : 0;
    return [y[2], y[3], factor * y[0], factor * y[1]];
  }, (y, t) => {
    const c = Math.cos(Omega * t), s = Math.sin(Omega * t), x = c * y[0] + s * y[1], z = -s * y[0] + c * y[1];
    const vx = c * y[2] + s * y[3] + Omega * z, vz = -s * y[2] + c * y[3] - Omega * x, r = Math.hypot(x, z);
    return { ...base(t), q: y.slice(0, 2), v: y.slice(2), K: m * (y[2] ** 2 + y[3] ** 2) / 2, U: k * (r - L) ** 2 / 2,
      extra: { rx: x, ry: z, rvx: vx, rvy: vz, coriolisX: 2 * m * Omega * vz, coriolisY: -2 * m * Omega * vx,
        centrifugalX: m * Omega * Omega * x, centrifugalY: m * Omega * Omega * z, angularMomentum: m * (y[0] * y[3] - y[1] * y[2]), radius: r },
      phase: p.frame === 'rotating' ? '回転座標：コリオリ力 ＋ 遠心力' : '実験室座標：架空の力は加えない' };
  }, { margin: y => Math.min(Math.hypot(y[0], y[1]) - .12, 9 - Math.hypot(y[0], y[1])), reason: '支点近傍または観察領域の端に到達しました。' });
}
/** Exact circular arcs with thin RF gap kicks. Synchrotron = ideal reference-orbit map, not a field solver. */
export function accelerator(p: Params, duration: number): Timeline {
  const m = N(p, 'm'), q = N(p, 'charge'), B = N(p, 'B'), v0 = N(p, 'v'), voltage = N(p, 'voltage'), R = N(p, 'radius');
  const synch = p.mode === 'synchrotron', uniform = p.mode === 'uniform';
  let speed = v0, x = synch ? R : 0, y = 0, vx = synch ? 0 : speed, vy = synch ? -speed : 0, t = 0, W = 0, kicks = 0;
  let field = synch ? m * speed / (q * R) : B, omega = q * field / m;
  let nextGap = (synch ? 2 : 1) * Math.PI / omega;
  const read = (): Sample => ({ ...base(t), q: [x, y], v: [vx, vy], K: m * (vx * vx + vy * vy) / 2, W,
    extra: { field, radius: speed / omega, speed, turns: kicks / (synch ? 1 : 2), kicks, rf: omega / (2 * Math.PI), forceX: q * field * vy, forceY: -q * field * vx },
    phase: uniform ? '一様磁場：磁気力は仕事をしない' : synch ? '理想基準軌道：周回ごとに RF キック・B を同期' : 'サイクロトロン：半周ごとの RF キックで半径が増加' });
  const samples = [read()];
  function arc(dt: number) {
    const a = omega * dt, c = Math.cos(a), s = Math.sin(a), oldVx = vx, oldVy = vy;
    x += (oldVx * s + oldVy * (1 - c)) / omega; y += (oldVy * s - oldVx * (1 - c)) / omega;
    vx = oldVx * c + oldVy * s; vy = oldVy * c - oldVx * s; t += dt;
  }
  for (let i = 1; i <= Math.ceil(duration * fps); i++) {
    const target = Math.min(i / fps, duration);
    while (!uniform && nextGap <= target + 1e-12) {
      arc(Math.max(0, nextGap - t)); const nextSpeed = Math.sqrt(speed * speed + 2 * q * voltage / m);
      vx *= nextSpeed / speed; vy *= nextSpeed / speed; speed = nextSpeed; W += q * voltage; kicks++;
      if (synch) { field = m * speed / (q * R); omega = q * field / m; }
      nextGap = t + (synch ? 2 : 1) * Math.PI / omega;
    }
    arc(Math.max(0, target - t)); samples.push(read());
  }
  return finish(samples);
}
export const elementaryCharge = 1.602176634e-19;
export function millikanConstants(p: Params) {
  const r = N(p, 'radius') * 1e-6, d = N(p, 'gap') * 1e-3, volume = 4 * Math.PI * r ** 3 / 3;
  const m = volume * N(p, 'rho'), weight = volume * (N(p, 'rho') - 1.2) * g, b = 6 * Math.PI * 1.81e-5 * r, q = Math.round(N(p, 'charge')) * elementaryCharge;
  const voltage = p.mode === 'balance' ? weight * d / q : p.mode === 'off' ? 0 : N(p, 'voltage');
  return { r, d, m, weight, b, q, voltage, field: voltage / d, tau: m / b, terminal: (q * voltage / d - weight) / b };
}
export function millikan(p: Params, duration: number): Timeline {
  const c = millikanConstants(p), { d, m, weight, b, q, field, tau, terminal: vt } = c;
  function read(t: number): Sample {
    const z = t / tau, one = -Math.expm1(-z), velocity = vt * one;
    // expm1 and Taylor series avoid cancellation in the very short initial transient.
    const dispFactor = z < 1e-3 ? z * z / 2 - z ** 3 / 6 + z ** 4 / 24 - z ** 5 / 120 : z - one;
    const heatFactor = z < 1e-3 ? z ** 3 / 3 - z ** 4 / 4 + 7 * z ** 5 / 60 - z ** 6 / 24 : z - 2 * one - Math.expm1(-2 * z) / 2;
    const dy = vt * tau * dispFactor, y = d / 2 + dy;
    return { ...base(t), q: [y], v: [velocity], K: m * velocity * velocity / 2, U: weight * y,
      Q: b * vt * vt * tau * heatFactor, W: q * field * dy,
      extra: { terminal: vt, tau, voltage: c.voltage, electric: q * field, weight, drag: -b * velocity, charge: q, mass: m, balanceVoltage: weight * d / q },
      phase: p.mode === 'balance' ? '電気力と浮力補正後の重力がつり合う' : '油滴：電気力・重力・浮力・粘性抵抗' };
  }
  let end = duration;
  if (read(end).q[0] <= c.r || read(end).q[0] >= d - c.r) {
    let lo = 0, hi = duration; for (let i = 0; i < 55; i++) { const mid = (lo + hi) / 2, y = read(mid).q[0]; if (y > c.r && y < d - c.r) lo = mid; else hi = mid; } end = hi;
  }
  const samples = Array.from({ length: Math.ceil(end * fps) + 1 }, (_, i) => read(Math.min(i / fps, end)));
  return finish(samples, false, end < duration ? '油滴が電極に到達。接触・電荷交換後は対象外です。' : '', true);
}
export function advancedSimulate(id: AdvancedId, p: Params, duration: number): Timeline {
  for (const key of ['m', 'M', 'm1', 'm2', 'k', 'k1', 'k2', 'L', 'r', 'radius', 'gap']) {
    if (key in p && (!Number.isFinite(N(p, key)) || N(p, key) <= 0)) throw new Error(`${key} must be positive`);
  }
  if (id === 'accelerator' && ['B', 'v', 'charge'].some(key => N(p, key) <= 0)) throw new Error('Accelerator B, speed and positive charge must be positive');
  if (id === 'millikan' && (N(p, 'charge') < 1 || N(p, 'rho') <= 1.2 || N(p, 'gap') * 1e-3 <= 2 * N(p, 'radius') * 1e-6)) throw new Error('Invalid oil-drop geometry or charge');
  if (id === 'conveyor' && (N(p, 'muk') < 0 || N(p, 'mus') < 0)) throw new Error('Friction coefficients must be non-negative');
  const models = { cartSpring, cartPendulum, pendulum, coupledPendulum, elasticPendulum, conveyor, relative, rotating, accelerator, millikan };
  return models[id](p, duration);
}
