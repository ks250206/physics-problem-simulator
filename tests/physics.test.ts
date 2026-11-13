import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, simulate, springSample, inductionSample, pulleySystem, pulleySample, trackTimeline, impact, balance, relativeError } from '../src/physics.ts';
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b} (tol ${eps})`);
test('spring: momentum, center of mass, energy, period for varied masses', () => {
  for (const m1 of [0.5, 1, 5]) for (const m2 of [0.5, 2, 5]) {
    const p = { ...defaults.spring, m1, m2 }, initial = springSample(p, 0);
    for (let t = 0; t < 12; t += 0.031) { const s = springSample(p, t); near(s.p, initial.p); near(balance(s), balance(initial)); near((m1 * s.q[0] + m2 * s.q[1]) / (m1 + m2), 0.35 * t); }
    near(springSample(p, initial.extra.period).extra.extension, Number(p.A));
  }
});
test('track: all profiles and free/fixed cases conserve energy; free case conserves momentum', () => {
  for (const shape of ['bowl', 'asymmetric', 'flat']) for (const fixed of [0, 1]) {
    const tl = simulate('track', { ...defaults.track, shape, fixed });
    for (const s of tl.samples) { assert.ok(relativeError(s, tl.E0) < 2e-7); if (!fixed) near(s.p, tl.p0, 1e-10); near(s.constraint, 0, 1e-10); assert.ok(s.extra.N >= 0); }
  }
});
test('track: drop event loses mechanical energy but conserves K+U+Q', () => {
  for (const fixed of [0, 1]) {
    const tl = simulate('track', { ...defaults.track, drop: 0.8, fixed });
    assert.equal(tl.samples[0].extra.contact, 0); assert.ok(tl.samples.at(-1)!.Q > 0); assert.ok(tl.samples.some(s => s.extra.contact === 1));
    for (const s of tl.samples) { assert.ok(relativeError(s, tl.E0) < 2e-7, String(relativeError(s, tl.E0))); if (!fixed) near(s.p, tl.p0, 1e-9); }
  }
});
test('impact: restitution, horizontal momentum and energy balance', () => {
  for (const e of [0, 0.5, 1]) for (const slope of [-1, 0, 1]) {
    const h = impact(1, 4, slope, 0, -3, 0, false, e); near(h.vx + 4 * h.V, 0);
    near((-slope * (h.vx - h.V) + h.vy) / Math.hypot(1, slope), e * 3 / Math.hypot(1, slope));
    near((h.vx ** 2 + h.vy ** 2 + 4 * h.V ** 2) / 2 + h.loss, 4.5);
  }
});
test('track: RK4 converges against finer timestep', () => {
  const a = trackTimeline(defaults.track, 4, 2).samples.at(-1)!, b = trackTimeline(defaults.track, 4, 8).samples.at(-1)!, c = trackTimeline(defaults.track, 4, 16).samples.at(-1)!;
  assert.ok(Math.abs(b.q[1] - c.q[1]) < Math.abs(a.q[1] - c.q[1]) / 50);
});
test('induction: work = kinetic change + independently integrated Joule heat', () => {
  for (const mode of ['speed', 'brake', 'force']) for (const B of [-2, -1, 0, 1e-8, 1, 2]) {
    const p = { ...defaults.induction, mode, B }, s = inductionSample(p, 3), first = inductionSample(p, 0); near(balance(s), balance(first), 1e-8);
    let heat = 0; const steps = 2000, dt = 3 / steps;
    for (let i = 0; i <= steps; i++) heat += inductionSample(p, i * dt).extra.power * (i === 0 || i === steps ? 1 : i % 2 ? 4 : 2) * dt / 3;
    near(s.Q, heat, 1e-7); assert.ok(s.extra.Fmag * s.v[0] <= 1e-12);
  }
});
test('induction: zero-field limit and magnetic field reversal', () => {
  const p = { ...defaults.induction, mode: 'force', B: 0 }, s = inductionSample(p, 2); near(s.v[0], Number(p.v0) + Number(p.F) / Number(p.m) * 2); near(s.Q, 0);
  const a = inductionSample({ ...defaults.induction, B: 1 }, 1), b = inductionSample({ ...defaults.induction, B: -1 }, 1); near(a.extra.current, -b.extra.current); near(a.extra.Fmag, b.extra.Fmag);
});
test('pulleys: Newton equations, rope constraint and energy in all topologies', () => {
  for (const mode of ['single', 'movable', 'compound']) for (const m1 of [0.5, 2, 5]) for (const m2 of [0.5, 3, 5]) {
    const p = { ...defaults.pulley, mode, m1, m2 }, sys = pulleySystem(p); near(sys.J.reduce((s, j, i) => s + j * sys.a[i], 0), 0);
    sys.masses.forEach((m, i) => near(m * sys.a[i], m * 9.8 - sys.J[i] * sys.tension)); const initial = pulleySample(p, 0);
    for (const t of [0, sys.limit / 2, sys.limit]) { const s = pulleySample(p, t); near(s.constraint, 0); near(balance(s), balance(initial), 1e-8); }
  }
});
test('pulleys: textbook Atwood acceleration and equilibria', () => {
  near(pulleySystem({ ...defaults.pulley, mode: 'single', m1: 2, m2: 3 }).a[0], -9.8 / 5);
  for (const mode of ['single', 'movable', 'compound']) pulleySystem({ ...defaults.pulley, mode, m1: mode === 'compound' ? 2 : 1, m2: mode === 'movable' ? 2 : 1, m3: 1 }).a.forEach(a => near(a, 0));
});
test('finite monotonic default timelines and invalid-input rejection', () => {
  for (const id of ['track', 'spring', 'induction', 'pulley'] as const) {
    const tl = simulate(id, defaults[id]); assert.ok(tl.samples.length > 2);
    tl.samples.forEach((s, i) => { [s.t, ...s.q, ...s.v, s.K, s.U, s.Q, s.W, s.p].forEach(x => assert.ok(Number.isFinite(x))); if (i) assert.ok(s.t > tl.samples[i - 1].t); });
  }
  assert.throws(() => simulate('spring', { m1: 0 })); assert.throws(() => simulate('induction', { B: NaN }));
});
