/** Exam-inspired ideal models. Physics is independent of display; all stored values are SI. */
import type { Params, Sample, Timeline } from './physics.ts';
import { rkStep } from './advanced.ts';
export type ExtendedId = 'railSpring' | 'collisionSpring' | 'loopFlight' | 'crossedFields' | 'lcCircuit' | 'dielectric' | 'gasCycle' | 'gasPiston' | 'standingWave' | 'doppler' | 'interference' | 'refraction' | 'thinLens';
export const extendedDefaults: Record<ExtendedId, Params> = {
  railSpring: { m: 1, M: 1, k: 6, natural: 2, gap: 1, A: 1.55, mode: 'free' },
  collisionSpring: { m: 1, M: 2, k: 5, u: 3, e: 1, mode: 'spring' },
  loopFlight: { m: 1, radius: 1.5, speed: 7.5, mode: 'contact' },
  crossedFields: { m: 1, charge: 1, E: 1, B: 1, vx: 0, vy: 0 },
  lcCircuit: { inductance: 1, capacitance: .2, voltage: 2, a: 2, b: 1, cycles: 3, resistance: .5, mode: 'pump' },
  dielectric: { voltage: 150, epsilon: 4, gap: 1, speed: .01, mode: 'voltage' },
  gasCycle: { amount: .1, cold: 300, hot: 600, ratio: 2, gamma: 1.6666666666666667, mode: 'carnot' },
  gasPiston: { m: 5, k: 100, nA: .12, nB: .12, tempA: 300, tempB: 450, x0: 2, velocity: 0, gamma: 1.6666666666666667, mode: 'adiabatic' },
  standingWave: { length: 6, speed: 3, density: .2, amplitude: .3, harmonic: 2, mix: 0, mode: 'fixed' },
  doppler: { speed: 340, source: 80, observer: -20, wind: 0, frequency: 1, distance: 2000 },
  interference: { wavelength: 550, slit: 1, screen: 2, film: 0, index: 1.5, amplitudeRatio: 1 },
  refraction: { n1: 1.5, n2: 1, angle: 30 },
  thinLens: { focal: 1.5, object: 3, height: .6, mode: 'convex' },
};
export const isExtended = (id: string): id is ExtendedId => Object.hasOwn(extendedDefaults, id);
const n = (p: Params, k: string) => Number(p[k]);
const g = 9.8, rad = Math.PI / 180, Rgas = 8.31446261815324, eps0 = 8.8541878128e-12;
const base = (t: number): Sample => ({ t, q: [], v: [], K: 0, U: 0, Q: 0, W: 0, p: 0, constraint: 0, extra: {}, phase: '' });
function finish(samples: Sample[], options: Partial<Timeline> = {}): Timeline {
  const s = samples[0];
  return { samples, duration: samples.at(-1)!.t, E0: s.K + s.U + s.Q - s.W, p0: s.p, momentumConserved: false, endReason: '', ...options };
}
function sampled(f: (t: number) => Sample, duration: number, options: Partial<Timeline> = {}): Timeline {
  return finish(Array.from({ length: Math.ceil(duration * 60) + 1 }, (_, i) => f(Math.min(i / 60, duration))), options);
}
function ode(y0: number[], duration: number, f: (y: number[], t: number) => number[], output: (y: number[], t: number) => Sample,
  margin?: (y: number[]) => number, reason = ''): Timeline {
  let y = [...y0], t = 0; const out = [output(y, t)];
  for (let i = 1; i <= Math.ceil(duration * 60); i++) {
    const target = Math.min(i / 60, duration); let stopped = false;
    while (t < target - 1e-12) {
      const h = Math.min(1 / 960, target - t), next = rkStep(y, t, h, f);
      if (!next.every(Number.isFinite)) throw new Error('Non-finite physical state');
      if (margin && margin(next) <= 0) {
        let lo = 0, hi = h;
        for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (margin(rkStep(y, t, mid, f)) > 0) lo = mid; else hi = mid; }
        y = rkStep(y, t, hi, f); t += hi; stopped = true; break;
      }
      y = next; t += h;
    }
    out.push(output(y, t)); if (stopped) return finish(out, { endReason: reason });
  }
  return finish(out);
}

/** Two parallel frictionless rails. Fixed Q and free P,Q reproduce the core 2026 Science Tokyo setting. */
export function railSpring(p: Params, duration: number): Timeline {
  const m = n(p, 'm'), M = n(p, 'M'), k = n(p, 'k'), L = n(p, 'natural'), h = n(p, 'gap'), A = n(p, 'A');
  const fixed = p.mode === 'fixed', stopper = p.mode === 'stopper'; let held = stopper, released = -1;
  let y = stopper ? [0, -A, 0, 0] : fixed ? [A, 0, 0, 0] : [A, -A, 0, 0], t = 0;
  const force = (z: number[]) => { const d = z[0] - z[1], length = Math.hypot(d, h); return -k * (length - L) * d / length; };
  const f = (z: number[]) => { const F = force(z); return [held ? 0 : z[2], fixed ? 0 : z[3], held ? 0 : F / m, fixed ? 0 : -F / M]; };
  const output = (): Sample => { const d = y[0] - y[1], length = Math.hypot(d, h); return { ...base(t), q: y.slice(0, 2), v: y.slice(2),
    K: (m * y[2] ** 2 + M * y[3] ** 2) / 2, U: k * (length - L) ** 2 / 2, p: m * y[2] + M * y[3],
    extra: { length, force: force(y), separation: d, barrier: h < L ? k * (L - h) ** 2 / 2 : 0, cm: (m * y[0] + M * y[1]) / (m + M), held: +held, release: released, threshold: h < L ? Math.sqrt(L * (L - h)) : 0 },
    phase: held ? 'Pはストッパーに接触・Qのみ運動' : fixed ? 'Qを固定した非線形振動' : '二体の反作用・非線形振動' }; };
  if (held && force(y) >= 0) { held = false; released = 0; }
  const samples = [output()];
  for (let i = 1; i <= Math.ceil(duration * 60); i++) {
    const target = Math.min(i / 60, duration);
    while (t < target - 1e-12) {
      const dt = Math.min(1 / 960, target - t), next = rkStep(y, t, dt, f);
      if (held && force(next) >= 0) {
        let lo = 0, hi = dt;
        for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (force(rkStep(y, t, mid, f)) < 0) lo = mid; else hi = mid; }
        y = rkStep(y, t, hi, f); t += hi; held = false; released = t;
        if (t > samples.at(-1)!.t + 1e-10) samples.push(output());
        continue;
      }
      if (stopper && !held && released >= 0 && t > released + 1e-6 && next[0] < 0 && next[2] < 0) {
        let lo = 0, hi = dt;
        for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (rkStep(y, t, mid, f)[0] > 0) lo = mid; else hi = mid; }
        y = rkStep(y, t, hi, f); t += hi; samples.push(output()); return finish(samples, { endReason: 'Pがストッパーへ再接触。再衝突以降は扱いません。' });
      }
      y = next; t += dt;
    }
    if (t > samples.at(-1)!.t + 1e-10) samples.push(output());
  }
  return finish(samples, { momentumConserved: !fixed && !stopper });
}

/** First hard collision followed by a free or spring-bound target; e=0 is adhesive capture. */
export function collisionSpring(p: Params, duration: number): Timeline {
  const m = n(p, 'm'), M = n(p, 'M'), u = n(p, 'u'), e = n(p, 'e'), k = p.mode === 'free' ? 0 : n(p, 'k');
  const hit = 1.5 / u, a = (m - e * M) * u / (m + M), b = (1 + e) * m * u / (m + M), loss = m * M / (m + M) * (1 - e * e) * u * u / 2;
  const omega = Math.sqrt(k / (e === 0 ? m + M : M));
  const after = (t: number) => { const x = omega ? b * Math.sin(omega * t) / omega : b * t, v = b * Math.cos(omega * t); return e === 0 ? [x - .5, x, v, v] : [-.5 + a * t, x, a, v]; };
  let end = duration, reason = '';
  if (e > 0 && k > 0) {
    let previous = 0;
    for (let t = 1 / 600; t <= duration - hit; t += 1 / 600) {
      const z = after(t), gap = z[1] - z[0] - .5;
      if (gap < 0) { let lo = previous, hi = t; for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2, q = after(mid); if (q[1] - q[0] > .5) lo = mid; else hi = mid; } end = hit + hi; reason = '二度目の接触に到達。二度目以降の衝突はモデル対象外です。'; break; } previous = t;
    }
  }
  const out = (t: number): Sample => { const collided = t >= hit - 1e-12, z = collided ? after(Math.max(0, t - hit)) : [-2 + u * t, 0, u, 0];
    return { ...base(t), q: z.slice(0, 2), v: z.slice(2), K: (m * z[2] ** 2 + M * z[3] ** 2) / 2, U: k * z[1] ** 2 / 2, Q: collided ? loss : 0, p: m * z[2] + M * z[3],
      extra: { collisionTime: hit, collided: +collided, loss, force: -k * z[1], cm: (m * z[0] + M * z[1]) / (m + M), v1After: a, v2After: b }, phase: !collided ? '衝突前：標的は静止' : e === 0 ? '完全非弾性衝突・接着して運動' : '反発後：ばね振動と等速運動' }; };
  const result = sampled(out, end, { momentumConserved: k === 0, endReason: reason });
  if (hit < end) { result.samples.push(out(Math.max(0, hit - 1e-8)), out(hit)); result.samples.sort((a, b) => a.t - b.t); result.samples = result.samples.filter((s, i, all) => i === 0 || s.t > all[i - 1].t); }
  return result;
}

/** Vertical circle: unilateral contact -> ballistic flight -> first recontact, without invisible forces. */
export function loopFlight(p: Params, duration: number): Timeline {
  const m = n(p, 'm'), R = n(p, 'radius'), speed = n(p, 'speed'); let state = [0, speed / R], t = 0, flying = false, detached = -1;
  const circle = (y: number[]) => [y[1], -g / R * Math.sin(y[0])];
  const flight = (y: number[]) => [y[2], y[3], 0, -g];
  const normal = (y: number[]) => m * (R * y[1] ** 2 + g * Math.cos(y[0]));
  const output = (): Sample => { const [x, y, vx, vy] = flying ? state : [R * Math.sin(state[0]), R * (1 - Math.cos(state[0])), R * state[1] * Math.cos(state[0]), R * state[1] * Math.sin(state[0])];
    return { ...base(t), q: [x, y], v: [vx, vy], K: m * (vx * vx + vy * vy) / 2, U: m * g * y, extra: { normal: flying ? 0 : normal(state), flying: +flying, detached, speed: Math.hypot(vx, vy), threshold: Math.sqrt(5 * g * R), theta: flying ? Math.atan2(x, R - y) : state[0] }, phase: flying ? '垂直抗力ゼロで離脱 → 放物運動' : p.mode === 'wire' ? '両側拘束のレール上（引く力も許容）' : '円形レール内側を滑走' }; };
  const samples = [output()];
  for (let i = 1; i <= Math.ceil(duration * 60); i++) {
    const target = Math.min(i / 60, duration);
    while (t < target - 1e-12) {
      const h = Math.min(1 / 960, target - t), f = flying ? flight : circle, next = rkStep(state, t, h, f);
      if (!flying && p.mode !== 'wire' && normal(next) < 0) {
        let lo = 0, hi = h; for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (normal(rkStep(state, t, mid, circle)) > 0) lo = mid; else hi = mid; }
        state = rkStep(state, t, hi, circle); t += hi; const theta = state[0], w = state[1]; state = [R * Math.sin(theta), R * (1 - Math.cos(theta)), R * w * Math.cos(theta), R * w * Math.sin(theta)]; flying = true; detached = t; samples.push(output()); continue;
      }
      const margin = (z: number[]) => R * R - z[0] ** 2 - (z[1] - R) ** 2;
      if (flying && t > detached + 1e-3 && margin(next) < -1e-10) {
        let lo = 0, hi = h; for (let j = 0; j < 40; j++) { const mid = (lo + hi) / 2; if (margin(rkStep(state, t, mid, flight)) > 0) lo = mid; else hi = mid; }
        state = rkStep(state, t, hi, flight); t += hi; samples.push(output()); return finish(samples, { endReason: '飛行後、レールに再接触。再衝突後の運動は対象外です。' });
      }
      state = next; t += h;
    }
    if (t > samples.at(-1)!.t + 1e-10) samples.push(output());
  }
  return finish(samples);
}

export function crossedFields(p: Params, duration: number): Timeline {
  const m = n(p, 'm'), q = n(p, 'charge'), E = n(p, 'E'), B = n(p, 'B'), ux = n(p, 'vx'), uy = n(p, 'vy'), w = q * B / m;
  // E is +y; B is +z. The drift is +x. Analytic zero-B limit avoids dividing by B.
  return sampled(t => { let x: number, y: number, vx: number, vy: number;
    if (Math.abs(w) < 1e-9) { vx = ux; vy = uy + q * E / m * t; x = ux * t; y = uy * t + q * E / m * t * t / 2; }
    else { const vd = E / B, a = ux - vd, sn = Math.sin(w * t), cs = Math.cos(w * t); vx = vd + a * cs + uy * sn; vy = uy * cs - a * sn; x = vd * t + a * sn / w + uy * (1 - cs) / w; y = uy * sn / w - a * (1 - cs) / w; }
    return { ...base(t), q: [x, y], v: [vx, vy], K: m * (vx * vx + vy * vy) / 2, U: -q * E * y,
      extra: { drift: B ? E / B : 0, electric: q * E, Fx: q * B * vy, Fy: q * (E - B * vx), magneticPower: vx * q * B * vy + vy * (-q * B * vx), cm: x }, phase: B === 0 ? '電場のみ：放物線' : Math.abs(ux * B - E) < 1e-10 && uy === 0 ? '電気力と磁気力が相殺：速度選別' : 'E×Bドリフト・サイクロイド' };
  }, duration);
}

/** LC exact segment map: charge and inductor current are continuous across instantaneous C changes. */
export function lcCircuit(p: Params, duration: number): Timeline {
  const L = n(p, 'inductance'), C0 = n(p, 'capacitance'), V = n(p, 'voltage'), a = n(p, 'a'), b = n(p, 'b'), mode = String(p.mode);
  const I0 = V * Math.sqrt(C0 / L);
  if (mode === 'damped') {
    const R = n(p, 'resistance');
    const tl = ode([0, I0, 0], duration, y => [-y[1], y[0] / (L * C0) - R * y[1] / L, R * y[1] ** 2], (y, t) => ({ ...base(t), q: [y[0]], v: [y[1]], K: L * y[1] ** 2 / 2, U: y[0] ** 2 / (2 * C0), Q: y[2], extra: { capacitance: C0, voltage: y[0] / C0, current: y[1], gapRatio: 1, switches: 0 }, phase: '抵抗付きRLC：磁場・電場のエネルギーが熱へ' }));
    return { ...tl, energyLabels: ['磁気 EL', '静電 EC', 'ジュール熱', '外部仕事'] };
  }
  let q = 0, I = I0, C = C0, W = 0, t = 0, count = 0;
  const maxSwitches = mode === 'single' ? 1 : mode === 'double' ? 2 : mode === 'pump' ? 2 * n(p, 'cycles') : 0;
  let event = Math.PI / 2 * Math.sqrt(L * C);
  const advance = (dt: number) => { const w = 1 / Math.sqrt(L * C), cs = Math.cos(w * dt), sn = Math.sin(w * dt), old = q; q = old * cs - I / w * sn; I = I * cs + w * old * sn; t += dt; };
  const output = (): Sample => ({ ...base(t), q: [q], v: [I], K: L * I * I / 2, U: q * q / (2 * C), W,
    extra: { capacitance: C, voltage: q / C, current: I, gapRatio: C0 / C, switches: count }, phase: count ? `極板操作 ${count} 回後：電荷・電流は連続` : '初期：Q=0、電流最大から開始' });
  const samples = [output()];
  for (let i = 1; i <= Math.ceil(duration * 60); i++) {
    const target = Math.min(i / 60, duration);
    while (count < maxSwitches && event <= target + 1e-12) {
      advance(Math.max(0, event - t));
      const newC = C0 / (count % 2 === 0 ? a : b); W += q * q / 2 * (1 / newC - 1 / C); C = newC; count++;
      if (t > samples.at(-1)!.t + 1e-10) samples.push(output()); event = t + Math.PI / 2 * Math.sqrt(L * C);
    }
    advance(Math.max(0, target - t)); if (t > samples.at(-1)!.t + 1e-10) samples.push(output());
  }
  return finish(samples, { energyLabels: ['磁気 EL', '静電 EC', 'ジュール熱', '極板操作の仕事'] });
}

export function dielectric(p: Params, duration: number): Timeline {
  const width = .1, length = .1, d = n(p, 'gap') * 1e-3, er = n(p, 'epsilon'), speed = n(p, 'speed'), V0 = n(p, 'voltage');
  const C0 = eps0 * width * length / d, Q0 = C0 * V0, Cp = eps0 * width * (er - 1) / d, U0 = C0 * V0 * V0 / 2, end = Math.min(duration, length / speed);
  return sampled(t => { const x = speed * t, C = C0 + Cp * x, V = p.mode === 'charge' ? Q0 / C : V0, q = C * V, U = C * V * V / 2;
    const battery = p.mode === 'charge' ? 0 : V0 * V0 * (C - C0), external = p.mode === 'charge' ? U - U0 : -(U - U0);
    return { ...base(t), q: [x], v: [speed], U, W: battery + external, extra: { capacitance: C, charge: q, voltage: V, force: V * V * Cp / 2, battery, external }, phase: p.mode === 'charge' ? '電池を外す：Q一定・電圧は低下' : '電池に接続：V一定・電源が仕事をする' };
  }, end, { energyDisplayScale: 1e6, energyUnit: 'μJ', energyReference: Math.max(1e-30, U0), energyLabels: ['運動（準静的）', '静電エネルギー', '散逸', '電源＋外力の仕事'], endReason: end < duration ? '誘電体を完全に挿入しました。端部効果は対象外です。' : '' });
}

export interface GasState { V: number; P: number }
export interface GasStage { from: GasState; to: GasState; kind: 'isothermal' | 'adiabatic' | 'isochoric' | 'isobaric'; name: string }
export function gasStages(p: Params): GasStage[] {
  const amount = n(p, 'amount'), cold = n(p, 'cold'), hot = n(p, 'hot'), ratio = n(p, 'ratio'), gamma = n(p, 'gamma'), v0 = .004;
  const state = (V: number, T: number) => ({ V, P: amount * Rgas * T / V });
  let s: GasState[], kinds: GasStage['kind'][];
  if (p.mode === 'carnot') { const c = (hot / cold) ** (1 / (gamma - 1)); s = [state(v0, hot), state(v0 * ratio, hot), state(v0 * ratio * c, cold), state(v0 * c, cold)]; kinds = ['isothermal', 'adiabatic', 'isothermal', 'adiabatic']; }
  else if (p.mode === 'otto') { const T2 = cold * ratio ** (gamma - 1), T3 = T2 * hot / cold; s = [state(v0 * ratio, cold), state(v0, T2), state(v0, T3), state(v0 * ratio, hot)]; kinds = ['adiabatic', 'isochoric', 'adiabatic', 'isochoric']; }
  else { const low = amount * Rgas * cold / v0, high = low * hot / cold; s = [{ V: v0, P: low }, { V: v0, P: high }, { V: v0 * ratio, P: high }, { V: v0 * ratio, P: low }]; kinds = ['isochoric', 'isobaric', 'isochoric', 'isobaric']; }
  const names = { isothermal: '等温', adiabatic: '断熱', isochoric: '定積', isobaric: '定圧' };
  return s.map((from, i) => ({ from, to: s[(i + 1) % 4], kind: kinds[i], name: `${String.fromCharCode(65 + i)}→${String.fromCharCode(65 + (i + 1) % 4)} ${names[kinds[i]]}` }));
}
export function gasStageAt(stage: GasStage, u: number, gamma: number) {
  const a = stage.from, b = stage.to, V = a.V + (b.V - a.V) * u;
  const P = stage.kind === 'isothermal' ? a.P * a.V / V : stage.kind === 'adiabatic' ? a.P * (a.V / V) ** gamma : a.P + (b.P - a.P) * u;
  const work = stage.kind === 'isothermal' ? a.P * a.V * Math.log(V / a.V) : stage.kind === 'adiabatic' ? (a.P * a.V - P * V) / (gamma - 1) : stage.kind === 'isobaric' ? a.P * (V - a.V) : 0;
  const deltaU = (P * V - a.P * a.V) / (gamma - 1);
  return { V, P, work, heat: deltaU + work, U: P * V / (gamma - 1) };
}
export function gasCycle(p: Params, duration: number): Timeline {
  const stages = gasStages(p), gamma = n(p, 'gamma'), ends = stages.map(s => gasStageAt(s, 1, gamma));
  const totalW = ends.reduce((s, e) => s + e.work, 0), absorbed = ends.reduce((s, e) => s + Math.max(0, e.heat), 0);
  return sampled(t => { const phase = Math.min(3, Math.floor(t / 3)), part = Math.min(1, (t - phase * 3) / 3), z = gasStageAt(stages[phase], part, gamma);
    const Wby = ends.slice(0, phase).reduce((s, e) => s + e.work, z.work), Qin = ends.slice(0, phase).reduce((s, e) => s + e.heat, z.heat);
    return { ...base(t), q: [z.V], v: [0], U: z.U, Q: -Qin, W: -Wby, extra: { volume: z.V, pressure: z.P, temperature: z.P * z.V / (n(p, 'amount') * Rgas), heatIn: Qin, workBy: Wby, efficiency: totalW / absorbed, cycleWork: totalW, stage: phase }, phase: `${stages[phase].name}（時刻は工程の表示用）` };
  }, Math.min(duration, 12), { energyLabels: ['運動（準静的）', '内部エネルギー', '放熱 −Qin', '気体へ仕事 −Wby'], timeLabel: '工程の表示時間', endReason: duration >= 12 ? '1サイクル完了。各工程3秒は表示上の割当てで、実際の熱移動速度ではありません。' : '' });
}

export function gasPiston(p: Params, duration: number): Timeline {
  const m = n(p, 'm'), k = n(p, 'k'), S = .02, length = 4, x0 = n(p, 'x0'), nA = n(p, 'nA'), nB = n(p, 'nB'), T0A = n(p, 'tempA'), T0B = n(p, 'tempB'), gamma = n(p, 'gamma');
  const fields = (x: number) => { const TA = p.mode === 'isothermalA' ? T0A : T0A * (x0 / x) ** (gamma - 1), TB = T0B * ((length - x0) / (length - x)) ** (gamma - 1); return { TA, TB, PA: nA * Rgas * TA / (S * x), PB: nB * Rgas * TB / (S * (length - x)) }; };
  const tl = ode([x0, n(p, 'velocity')], duration, y => { const z = fields(y[0]); return [y[1], (S * (z.PA - z.PB) - k * (y[0] - 2)) / m]; }, (y, t) => { const z = fields(y[0]), heat = p.mode === 'isothermalA' ? nA * Rgas * T0A * Math.log(y[0] / x0) : 0;
    return { ...base(t), q: [y[0]], v: [y[1]], K: m * y[1] ** 2 / 2, U: Rgas * (nA * z.TA + nB * z.TB) / (gamma - 1) + k * (y[0] - 2) ** 2 / 2, Q: -heat,
      extra: { ...z, heatIn: heat, force: S * (z.PA - z.PB) - k * (y[0] - 2), volumeA: S * y[0], volumeB: S * (length - y[0]), spring: k * (y[0] - 2) ** 2 / 2 }, phase: p.mode === 'isothermalA' ? '左室は等温・右室は断熱：熱浴との交換あり' : '両室断熱：気体とピストンとばねが連成' };
  }, y => Math.min(y[0] - .15, length - .15 - y[0]), 'ピストンが可動範囲の端に到達。壁との衝突は扱いません。');
  return { ...tl, energyLabels: ['ピストンの運動', '両気体の内部＋ばね', '熱浴への放熱', '外部仕事'] };
}

export function waveModes(p: Params) {
  const L = n(p, 'length'), c = n(p, 'speed'), j = n(p, 'harmonic'), A = n(p, 'amplitude');
  return [j, j + 1].map((mode, i) => { const k = (mode - (p.mode === 'free' ? .5 : 0)) * Math.PI / L; return { k, omega: c * k, A: i === 0 ? A : A * n(p, 'mix') }; });
}
export function waveAt(p: Params, x: number, t: number) { return waveModes(p).reduce((y, z) => y + z.A * Math.sin(z.k * x) * Math.cos(z.omega * t), 0); }
export function standingWave(p: Params, duration: number): Timeline {
  const L = n(p, 'length'), mu = n(p, 'density'), modes = waveModes(p);
  return sampled(t => ({ ...base(t), q: Array.from({ length: 81 }, (_, i) => waveAt(p, i / 80 * L, t)), v: [],
    K: modes.reduce((E, z) => E + mu * L / 4 * (z.A * z.omega * Math.sin(z.omega * t)) ** 2, 0), U: modes.reduce((E, z) => E + mu * L / 4 * (z.A * z.omega * Math.cos(z.omega * t)) ** 2, 0),
    extra: { frequency: modes[0].omega / (2 * Math.PI), wavelength: 2 * Math.PI / modes[0].k, tension: mu * n(p, 'speed') ** 2, endDisplacement: waveAt(p, L, t) }, phase: p.mode === 'free' ? '左端固定・右端自由：自由端は変位の腹' : '両端固定：固定端は変位の節' }), duration);
}
export function doppler(p: Params, duration: number): Timeline {
  const c = n(p, 'speed'), vs = n(p, 'source'), vo = n(p, 'observer'), w = n(p, 'wind'), f = n(p, 'frequency'), D = n(p, 'distance'), end = vs > vo ? Math.min(duration, D / (vs - vo)) : duration;
  const observed = f * (c + w - vo) / (c + w - vs);
  return sampled(t => { const emission = ((c + w - vo) * t - D) / (c + w - vs);
    return { ...base(t), q: [vs * t, D + vo * t], v: [vs, vo], extra: { observed, wavelength: (c + w - vs) / f, emission, received: emission < 0 ? 0 : Math.floor(emission * f + 1e-9) + 1, signal: emission < 0 ? 0 : Math.sin(2 * Math.PI * f * emission) }, phase: emission < 0 ? '最初の波面が観測者へ向かう' : '観測者が波面を受信（媒質速度も考慮）' };
  }, end, { energyDisabled: true, diagnosticNote: '波面の幾何と受信時刻を計算。音源の駆動エネルギー・音の強度はモデル化していません。', endReason: end < duration ? '音源と観測者が同じ位置に到達。通過後は対象外です。' : '' });
}
export function interferenceAt(p: Params, y: number) {
  const d = n(p, 'slit') * 1e-3, D = n(p, 'screen'), lambda = n(p, 'wavelength') * 1e-9, ratio = n(p, 'amplitudeRatio');
  const r1 = Math.hypot(D, y - d / 2), r2 = Math.hypot(D, y + d / 2);
  // Rationalized path difference avoids cancellation near the central fringe.
  const delay = -2 * y * d / (r1 + r2) + (n(p, 'index') - 1) * n(p, 'film') * 1e-6;
  const phase = 2 * Math.PI * delay / lambda, intensity = (1 + ratio * ratio + 2 * ratio * Math.cos(phase)) / (1 + ratio) ** 2;
  return { intensity, delay, phase, spacing: lambda * D / d };
}
export function interference(p: Params, duration: number): Timeline {
  return sampled(t => { const y = -.006 + .012 * t / 12, z = interferenceAt(p, y); return { ...base(t), q: [y], v: [], extra: { ...z, screenY: y }, phase: 'スクリーン上の検出位置を走査（光の伝搬時間ではありません）' }; }, Math.min(12, duration), { energyDisabled: true, timeLabel: '走査の表示時間', diagnosticNote: 'コヒーレントな二光路に対する規格化強度。光路差は厳密幾何、縞間隔の数値だけが近軸近似です。' });
}
export function refractionValues(p: Params) {
  const n1 = n(p, 'n1'), n2 = n(p, 'n2'), theta = n(p, 'angle') * rad, sinT = n1 / n2 * Math.sin(theta), tir = sinT > 1, thetaT = tir ? 0 : Math.asin(Math.min(1, sinT));
  let reflectance = 1;
  if (!tir) { const ci = Math.cos(theta), ct = Math.cos(thetaT), rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct); reflectance = (rs * rs + rp * rp) / 2; }
  return { theta, thetaT, tir: +tir, reflectance, transmittance: 1 - reflectance, critical: n1 > n2 ? Math.asin(n2 / n1) / rad : 90, residual: tir ? 0 : n1 * Math.sin(theta) - n2 * Math.sin(thetaT) };
}
export function refraction(p: Params, duration: number): Timeline {
  const z = refractionValues(p); return sampled(t => ({ ...base(t), q: [Math.min(1, t / 6)], v: [], extra: z, phase: z.tir ? '全反射：透過する幾何光線はない' : '屈折＋反射：角度は境界面の法線基準' }), duration, { energyDisabled: true, timeLabel: '光線を追う表示時間', diagnosticNote: '非吸収性・非磁性媒質の単一平面界面。反射率は無偏光のFresnel係数。光点の速さは表示用で、光速の再現ではありません。' });
}
export function lensValues(p: Params) {
  const f = n(p, 'focal') * (p.mode === 'concave' ? -1 : 1), a = n(p, 'object'), inv = 1 / f - 1 / a, atFocus = Math.abs(inv) < 1e-10;
  const b = atFocus ? 0 : 1 / inv, magnification = atFocus ? 0 : -b / a;
  return { f, a, b, magnification, imageHeight: magnification * n(p, 'height'), atFocus: +atFocus, virtual: +(b < 0), lensResidual: atFocus ? 0 : 1 / f - 1 / a - 1 / b };
}
export function thinLens(p: Params, duration: number): Timeline {
  const z = lensValues(p); return sampled(t => ({ ...base(t), q: [z.a, z.b], v: [], extra: z, phase: z.atFocus ? '物体が焦点上：出射光は平行、像は無限遠' : z.virtual ? '虚像：光線を後ろへ延長して交点を探す' : '実像：スクリーンに結像できる' }), duration, { energyDisabled: true, timeLabel: '光線を追う表示時間', diagnosticNote: '薄レンズ・近軸近似。焦点上は無限遠として扱い、巨大な数値や偽の有限像を表示しません。収差・回折は省略しています。' });
}

export function extendedSimulate(id: ExtendedId, p: Params, duration: number): Timeline {
  if (!Number.isFinite(duration) || duration < 0 || duration > 120) throw new Error('Invalid duration');
  for (const value of Object.values(p)) if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Non-finite parameter');
  const positive: Partial<Record<ExtendedId, string[]>> = {
    railSpring: ['m', 'M', 'k', 'natural', 'gap', 'A'], collisionSpring: ['m', 'M', 'k', 'u'], loopFlight: ['m', 'radius'], crossedFields: ['m'],
    lcCircuit: ['inductance', 'capacitance', 'a', 'b'], dielectric: ['epsilon', 'gap', 'speed'], gasCycle: ['amount', 'cold', 'hot', 'ratio'],
    gasPiston: ['m', 'nA', 'nB', 'tempA', 'tempB'], standingWave: ['length', 'speed', 'density', 'harmonic'], doppler: ['speed', 'frequency', 'distance'], interference: ['wavelength', 'slit', 'screen', 'index'], refraction: ['n1', 'n2'], thinLens: ['focal', 'object'],
  };
  for (const key of positive[id] ?? []) if (!(n(p, key) > 0)) throw new Error(`${key} must be positive`);
  if (id === 'collisionSpring' && (n(p, 'e') < 0 || n(p, 'e') > 1)) throw new Error('Restitution must be between 0 and 1');
  if (['gasPiston', 'gasCycle'].includes(id) && n(p, 'gamma') <= 1) throw new Error('gamma must exceed 1');
  if (id === 'gasPiston' && (n(p, 'x0') <= .15 || n(p, 'x0') >= 3.85)) throw new Error('Piston must be inside cylinder');
  if (id === 'gasCycle' && (n(p, 'hot') <= n(p, 'cold') || n(p, 'ratio') <= 1)) throw new Error('Heat engine requires hot > cold and ratio > 1');
  if (id === 'doppler' && Math.max(Math.abs(n(p, 'source') - n(p, 'wind')), Math.abs(n(p, 'observer') - n(p, 'wind'))) >= n(p, 'speed')) throw new Error('Subsonic source and observer required');
  if (id === 'lcCircuit' && (!Number.isInteger(n(p,'cycles')) || n(p,'cycles') < 1 || n(p,'resistance') < 0)) throw new Error('Invalid switching count or resistance');
  if (id === 'standingWave' && (!Number.isInteger(n(p,'harmonic')) || n(p,'harmonic') < 1)) throw new Error('Invalid wave mode');
  if (id === 'gasPiston' && n(p,'k') < 0) throw new Error('Negative stiffness');
  if (id === 'loopFlight' && n(p,'speed') < 0) throw new Error('Negative initial speed');
  if (id === 'dielectric' && n(p,'epsilon') < 1) throw new Error('Relative permittivity must be at least one');
  const solvers = { railSpring, collisionSpring, loopFlight, crossedFields, lcCircuit, dielectric, gasCycle, gasPiston, standingWave, doppler, interference, refraction, thinLens };
  return solvers[id](p, duration);
}
