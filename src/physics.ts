/** SI units; deterministic physics, independent of rendering. */
export type SceneId = 'track' | 'spring' | 'induction' | 'pulley';
export type Params = Record<string, number | string>;
export interface Sample {
  t: number; q: number[]; v: number[]; K: number; U: number; Q: number; W: number;
  p: number; constraint: number; extra: Record<string, number>; phase: string;
}
export interface Timeline {
  samples: Sample[]; duration: number; E0: number; p0: number;
  momentumConserved: boolean; endReason: string;
}
export const FPS = 60;
export const TRACK_HALF_WIDTH = 3;
export const defaults: Record<SceneId, Params> = {
  track: { m: 1, M: 4, h: 2.4, q0: -2.2, v0: 0, drop: 0, g: 9.8, shape: 'bowl', fixed: 0 },
  spring: { m1: 1, m2: 2, k: 8, A: 0.8, V: 0.35, L: 3 },
  induction: { m: 1, B: 1, L: 1.8, R: 2, v0: 0.6, F: 0.7, mode: 'speed' },
  pulley: { m1: 3, m2: 1.5, m3: 1.2, g: 9.8, mode: 'compound' },
};
const n = (p: Params, key: string) => Number(p[key]);
export const balance = (s: Sample) => s.K + s.U + s.Q - s.W;
export const relativeError = (s: Sample, E0: number) => Math.abs(balance(s) - E0) / Math.max(1, Math.abs(E0));
export function profile(q: number, p: Params): { y: number; d: number; dd: number } {
  const r = q / TRACK_HALF_WIDTH, h = n(p, 'h');
  if (p.shape === 'flat') return { y: 0.65 + h * r ** 4, d: 4 * h * r ** 3 / 3, dd: 12 * h * r ** 2 / 9 };
  const skew = p.shape === 'asymmetric' ? 0.28 : 0;
  return { y: 0.65 + h * (r * r + skew * r ** 3), d: h * (2 * r + 3 * skew * r * r) / 3, dd: h * (2 + 6 * skew * r) / 9 };
}
function rk4(q: number, u: number, dt: number, accel: (q: number, u: number) => number): [number, number] {
  const a = accel(q, u), ub = u + dt * a / 2, b = accel(q + dt * u / 2, ub);
  const uc = u + dt * b / 2, c = accel(q + dt * ub / 2, uc), ud = u + dt * c, d = accel(q + dt * uc, ud);
  return [q + dt * (u + 2 * ub + 2 * uc + ud) / 6, u + dt * (a + 2 * b + 2 * c + d) / 6];
}
/** Normal impulse with a horizontally free/fixed surface. e=0 captures into contact. */
export function impact(m: number, M: number, slope: number, vx: number, vy: number, V: number, fixed = false, e = 0) {
  const nx = -slope / Math.hypot(1, slope), ny = 1 / Math.hypot(1, slope);
  const vn = (vx - V) * nx + vy * ny;
  const J = vn < 0 ? -(1 + e) * vn / (1 / m + (fixed ? 0 : nx * nx / M)) : 0;
  const vx2 = vx + J * nx / m, vy2 = vy + J * ny / m, V2 = fixed ? 0 : V - J * nx / M;
  const loss = (m * (vx * vx + vy * vy - vx2 * vx2 - vy2 * vy2) + M * (V * V - V2 * V2)) / 2;
  return { vx: vx2, vy: vy2, V: V2, loss: Math.max(0, loss), J };
}
export function trackTimeline(p: Params, duration = 12, substeps = 8): Timeline {
  const m = n(p, 'm'), M = n(p, 'M'), g = n(p, 'g'), fixed = !!n(p, 'fixed');
  const mass = m + M, beta = fixed ? 1 : M / mass;
  let q = n(p, 'q0'), u = n(p, 'v0'), t = 0, heat = 0, contact = n(p, 'drop') === 0;
  const q0 = q, P = m * u;
  let flight = { x: q, y: profile(q, p).y + n(p, 'drop'), vx: u, vy: 0, X: 0, V: 0 };
  let endReason = '';
  const accel = (x: number, v: number) => { const f = profile(x, p); return -f.d * (g + f.dd * v * v) / (beta + f.d * f.d); };
  const sample = (): Sample => {
    const f = profile(q, p);
    const X = contact ? (fixed ? 0 : (m * q0 + P * t - m * q) / mass) : flight.X;
    const V = contact ? (fixed ? 0 : (P - m * u) / mass) : flight.V;
    const x = contact ? X + q : flight.x, y = contact ? f.y : flight.y;
    const vx = contact ? V + u : flight.vx, vy = contact ? f.d * u : flight.vy;
    const N = contact ? m * (g + f.dd * u * u + f.d * accel(q, u)) * Math.hypot(1, f.d) : 0;
    return { t, q: [X, x, y], v: [V, vx, vy], K: (M * V * V + m * (vx * vx + vy * vy)) / 2,
      U: m * g * y, Q: heat, W: 0, p: M * V + m * vx, constraint: contact ? y - profile(x - X, p).y : 0,
      extra: { N, slope: f.d, relative: q, cm: (M * X + m * x) / mass, contact: Number(contact) },
      phase: contact ? '曲面上を滑走' : '自由落下（接触前）' };
  };
  const samples = [sample()];
  const advance = (dt: number) => {
    if (contact) { [q, u] = rk4(q, u, dt, accel); t += dt; return; }
    const at = (h: number) => ({ x: flight.x + flight.vx * h, y: flight.y + flight.vy * h - g * h * h / 2,
      vx: flight.vx, vy: flight.vy - g * h, X: flight.X + flight.V * h, V: flight.V });
    const next = at(dt);
    if (next.y > profile(next.x - next.X, p).y) { flight = next; q = next.x - next.X; t += dt; return; }
    let lo = 0, hi = dt;
    for (let i = 0; i < 42; i++) { const mid = (lo + hi) / 2, a = at(mid); if (a.y > profile(a.x - a.X, p).y) lo = mid; else hi = mid; }
    flight = at(hi); q = flight.x - flight.X; t += hi;
    const hit = impact(m, M, profile(q, p).d, flight.vx, flight.vy, flight.V, fixed);
    heat += hit.loss; u = hit.vx - hit.V; contact = true;
    const rest = dt - hi; [q, u] = rk4(q, u, rest, accel); t += rest;
  };
  for (let i = 1; i <= Math.ceil(duration * FPS); i++) {
    const target = Math.min(i / FPS, duration);
    for (let j = 0; j < substeps; j++) {
      advance((target - t) / (substeps - j));
      if (Math.abs(q) >= TRACK_HALF_WIDTH - 0.015) { endReason = '台の端に到達。端からの飛び出し以降はモデル対象外です。'; break; }
    }
    samples.push(sample()); if (endReason) break;
  }
  return { samples, duration: t, E0: balance(samples[0]), p0: samples[0].p, momentumConserved: !fixed, endReason };
}
export function springSample(p: Params, t: number): Sample {
  const m1 = n(p, 'm1'), m2 = n(p, 'm2'), k = n(p, 'k'), A = n(p, 'A'), V = n(p, 'V'), L = n(p, 'L');
  const mass = m1 + m2, mu = m1 * m2 / mass, omega = Math.sqrt(k / mu);
  const extension = A * Math.cos(omega * t), dr = -A * omega * Math.sin(omega * t), r = L + extension;
  const x1 = V * t - m2 * r / mass, x2 = V * t + m1 * r / mass, v1 = V - m2 * dr / mass, v2 = V + m1 * dr / mass;
  return { t, q: [x1, x2], v: [v1, v2], K: (m1 * v1 * v1 + m2 * v2 * v2) / 2,
    U: k * extension * extension / 2, Q: 0, W: 0, p: m1 * v1 + m2 * v2, constraint: 0,
    extra: { cm: V * t, V, mu, omega, period: 2 * Math.PI / omega, extension, force: k * extension }, phase: '重心の等速運動 ＋ 相対座標の単振動' };
}
export function inductionSample(p: Params, t: number): Sample {
  const m = n(p, 'm'), B = n(p, 'B'), L = n(p, 'L'), R = n(p, 'R'), v0 = n(p, 'v0');
  const c = (B * L) ** 2 / R, gamma = c / m;
  let v: number, x: number, Q: number, W: number, F: number;
  if (p.mode === 'speed') { v = v0; x = v * t; F = c * v; Q = c * v * v * t; W = Q; }
  else {
    F = p.mode === 'force' ? n(p, 'F') : 0;
    const z = gamma * t;
    const phi1 = Math.abs(z) < 1e-4 ? 1 - z / 2 + z * z / 6 - z ** 3 / 24 + z ** 4 / 120 : -Math.expm1(-z) / z;
    const phi2 = Math.abs(z) < 1e-4 ? 0.5 - z / 6 + z * z / 24 - z ** 3 / 120 + z ** 4 / 720 : (1 - phi1) / z;
    v = v0 * Math.exp(-z) + F / m * t * phi1;
    x = v0 * t * phi1 + F / m * t * t * phi2;
    W = F * x; Q = W - m * (v * v - v0 * v0) / 2; if (c === 0) Q = 0;
  }
  const current = B * L * v / R;
  return { t, q: [x], v: [v], K: m * v * v / 2, U: 0, Q, W, p: m * v, constraint: 0,
    extra: { emf: B * L * v, current, Fmag: -c * v, Fext: F, power: current * current * R, gamma, tau: gamma ? 1 / gamma : Infinity },
    phase: p.mode === 'speed' ? '外力で速度を一定に保持' : p.mode === 'force' ? '一定外力で加速 → 終端速度' : '磁気ブレーキで減速' };
}
/** Downward coordinates. J is the derivative of total rope length with respect to each coordinate. */
export function pulleySystem(p: Params) {
  const mode = String(p.mode), g = n(p, 'g');
  const masses = mode === 'compound' ? [n(p, 'm1'), n(p, 'm2'), n(p, 'm3')] : [n(p, 'm1'), n(p, 'm2')];
  const J = mode === 'compound' ? [2, 1, 1] : mode === 'movable' ? [1, 2] : [1, 1];
  const tension = g * J.reduce((a, b) => a + b, 0) / J.reduce((sum, j, i) => sum + j * j / masses[i], 0);
  const a = masses.map((m, i) => g - J[i] * tension / m);
  const q0 = mode === 'compound' ? [2.6, 3.4, 3.4] : mode === 'movable' ? [2.7, 3] : [2.6, 2.6];
  let limit = 12;
  const positiveGap = (gap: number, acceleration: number) => { if (acceleration < -1e-12) limit = Math.min(limit, Math.sqrt(2 * gap / -acceleration)); };
  q0.forEach((q, i) => { positiveGap(q - 0.8, a[i]); positiveGap(4.5 - q, -a[i]); });
  if (mode === 'compound') {
    const yp = 4 - q0[0]; positiveGap(yp - 0.85, -a[0]); positiveGap(3.6 - yp, a[0]);
    [1, 2].forEach(i => positiveGap(q0[i] - yp - 0.85, a[i] + a[0]));
  }
  if (mode === 'movable') positiveGap(q0[1] - 1.5, a[1]);
  return { masses, J, tension, a, q0, limit };
}
export function pulleySample(p: Params, t: number): Sample {
  const { masses, J, tension, a, q0 } = pulleySystem(p), g = n(p, 'g');
  const q = q0.map((x, i) => x + a[i] * t * t / 2), v = a.map(x => x * t);
  return { t, q, v, K: masses.reduce((s, m, i) => s + m * v[i] * v[i] / 2, 0),
    U: masses.reduce((s, m, i) => s + m * g * (5.2 - q[i]), 0), Q: 0, W: 0,
    p: masses.reduce((s, m, i) => s + m * v[i], 0), constraint: J.reduce((s, j, i) => s + j * (q[i] - q0[i]), 0),
    extra: { tension, topTension: p.mode === 'compound' ? 2 * tension : tension, a1: a[0], a2: a[1], a3: a[2] ?? 0, pulleyDown: 4 - q[0] },
    phase: '理想糸の長さ一定・質量のない滑車' };
}
export function simulate(id: SceneId, params: Params, duration = 12): Timeline {
  const p = { ...defaults[id], ...params };
  for (const [key, value] of Object.entries(p)) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`Invalid parameter: ${key}`);
  for (const key of ['m', 'M', 'm1', 'm2', 'm3', 'R', 'k', 'L', 'g', 'h']) if (key in p && n(p, key) <= 0) throw new Error(`${key} must be positive`);
  if (id === 'track') return trackTimeline(p, duration);
  const end = id === 'pulley' ? Math.min(duration, pulleySystem(p).limit) : duration;
  const sample = id === 'spring' ? springSample : id === 'induction' ? inductionSample : pulleySample;
  const samples = Array.from({ length: Math.ceil(end * FPS) + 1 }, (_, i) => sample(p, Math.min(i / FPS, end)));
  return { samples, duration: end, E0: balance(samples[0]), p0: samples[0].p, momentumConserved: id === 'spring',
    endReason: end < duration ? 'おもり・滑車が装置の可動範囲に到達するため停止しました。衝突後は対象外です。' : '' };
}
