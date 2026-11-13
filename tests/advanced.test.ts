import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, simulate, relativeError, type SceneId, type Params } from '../src/physics.ts';
import { advancedDefaults, elementaryCharge, millikanConstants } from '../src/advanced.ts';
const close = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} (tol ${tolerance})`);
const run = (id: SceneId, p: Params = {}, duration = 12) => simulate(id, { ...defaults[id], ...p }, duration);
for (const id of Object.keys(advancedDefaults) as SceneId[]) {
  test(`${id}: finite state, increasing times, independent energy balance`, () => {
    const timeline = run(id);
    let last = -1;
    for (const s of timeline.samples) {
      assert.ok(s.t > last); last = s.t;
      for (const value of [...s.q, ...s.v, s.K, s.U, s.Q, s.W, ...Object.values(s.extra)]) assert.ok(Number.isFinite(value), `${id}: non-finite`);
      assert.ok(s.Q >= -1e-12);
      assert.ok(relativeError(s, timeline.E0, timeline.energyReference) < 2e-6, `${id}: energy drift`);
      if (timeline.momentumConserved) close(s.p, timeline.p0, 2e-8);
    }
  });
}
test('free three-body cart: center of mass moves uniformly', () => {
  const tl = run('cartSpring', { M: .7, m1: 3, m2: 2, V: -.3 });
  const cm0 = tl.samples[0].extra.cm;
  for (const s of tl.samples) close(s.extra.cm, cm0 - .3 * s.t, 1e-8);
});
test('forced cart: external impulse equals momentum change', () => {
  const tl = run('cartSpring', { mode: 'forced', F: .5 });
  for (const s of tl.samples) close(s.p - tl.p0, .5 * s.t, 1e-8);
});
test('cart pendulum: free small-angle acceleration is enhanced by recoil', () => {
  const theta = .01 * Math.PI / 180, p = { ...defaults.cartPendulum, angle: .01, M: 3, m: 1, L: 2 };
  const a = run('cartPendulum', p, .02).samples[0].extra.alpha;
  close(a, -9.8 / 2 * theta * (1 + 1 / 3), 1e-9);
});
test('accelerated pendulum equilibrium remains stationary in the cart frame', () => {
  const a = 2, theta = -Math.atan(a / 9.8) * 180 / Math.PI;
  const tl = run('cartPendulum', { mode: 'accelerated', a, angle: theta, V: 0 });
  for (const s of tl.samples) { close(s.q[1], theta * Math.PI / 180, 1e-10); close(s.q[0], a * s.t * s.t / 2, 1e-8); }
});
test('pendulum small angle period matches the linear limit', () => {
  const period = 2 * Math.PI * Math.sqrt(2 / 9.8), tl = run('pendulum', { angle: .1 }, period);
  close(tl.samples.at(-1)!.q[0], .1 * Math.PI / 180, 1e-10);
});
test('string pendulum terminates at zero tension; rigid rod keeps rotating', () => {
  const string = run('pendulum', { mode: 'string', angle: 0, omega: 4.6 });
  assert.ok(string.duration < 2); close(string.samples.at(-1)!.extra.tension, 0, 1e-8);
  assert.ok(run('pendulum', { mode: 'rod', angle: 0, omega: 4.6 }).samples.at(-1)!.q[0] > 2 * Math.PI);
});
test('coupled in-phase pendulums do not stretch the connecting spring', () => {
  const tl = run('coupledPendulum', { angle1: 10, angle2: 10 });
  for (const s of tl.samples) { close(s.q[0], s.q[1], 1e-10); close(s.extra.extension, 0, 1e-10); }
});
test('coupled pendulums transfer energy instead of independently oscillating', () => {
  const tl = run('coupledPendulum');
  assert.ok(Math.max(...tl.samples.map(s => s.extra.E2)) > .8 * tl.E0);
});
test('vertical elastic pendulum agrees with independent harmonic solution', () => {
  const m = 1, k = 16, L = 1.2, extension = .8, omega = Math.sqrt(k / m), req = L + m * 9.8 / k;
  for (const s of run('elasticPendulum', { m, k, L, angle: 0, extension }).samples) {
    close(s.q[0], 0, 1e-12); close(-s.q[1], req + (L + extension - req) * Math.cos(omega * s.t), 1e-8);
  }
});
test('horizontal conveyor: analytic capture time, motor work and heat', () => {
  const mu = .2, m = 1, V = 1, capture = V / (mu * 9.8);
  const tl = run('conveyor', { mode: 'single', angle: 0, muk: mu, mus: .4, V, v1: 0, m1: m }, 2);
  for (const s of tl.samples) {
    const t = Math.min(s.t, capture); close(s.v[0], mu * 9.8 * t, 2e-8);
    close(s.Q, m * mu * 9.8 * (V * t - mu * 9.8 * t * t / 2), 1e-7);
    close(s.W, m * mu * 9.8 * V * t, 1e-7);
  }
  const last = tl.samples.at(-1)!; close(last.Q, .5, 1e-7); close(last.W, 1, 1e-7); assert.equal(last.extra.sticking, 1);
});
test('Tokyo-style pair changes from kinetic to static friction', () => {
  const tl = run('conveyor');
  assert.ok(tl.samples.some(s => s.extra.sticking === 0)); assert.ok(tl.samples.some(s => s.extra.sticking === 1));
  for (const s of tl.samples.filter(s => s.extra.sticking)) { close(s.extra.slip, 0); assert.ok(Math.abs(s.extra.friction) <= s.extra.staticLimit + 1e-7); }
});
test('accelerated projectile frame transform and fictitious acceleration', () => {
  const p = { V: .8, a: 1.2, u: 0, vy: 5, h: .8, m: 2 };
  for (const s of run('relative', p).samples) { close(s.extra.relativeX, -.5 * p.a * s.t ** 2); close(s.extra.relativeV, -p.a * s.t); close(s.extra.pseudo, -p.m * p.a); }
});
test('free rotating observer: centrifugal and Coriolis acceleration match second derivative', () => {
  const tl = run('rotating', { mode: 'free', Omega: 1, m: 1 }, 2), h = 1 / 60;
  for (let i = 1; i < tl.samples.length - 1; i++) {
    const prev = tl.samples[i - 1].extra, e = tl.samples[i].extra, next = tl.samples[i + 1].extra;
    close((next.rx - 2 * e.rx + prev.rx) / h ** 2, e.coriolisX + e.centrifugalX, .002);
    close((next.ry - 2 * e.ry + prev.ry) / h ** 2, e.coriolisY + e.centrifugalY, .002);
  }
});
test('central spring circular orbit is stationary in co-rotating coordinates', () => {
  const tl = run('rotating', { mode: 'spring', m: 1, k: 2, L: 1, r: 2, v: 2, Omega: 1 });
  for (const s of tl.samples) { close(s.extra.rx, 2, 2e-8); close(s.extra.ry, 0, 2e-8); close(s.extra.angularMomentum, 4, 2e-8); }
});
test('uniform magnetic field: exact radius and period; no magnetic work', () => {
  const p = { mode: 'uniform', m: 1, charge: 1, B: 1, v: 1.2 }, tl = run('accelerator', p, 2 * Math.PI);
  for (const s of tl.samples) { close(Math.hypot(s.q[0], s.q[1] + 1.2), 1.2, 1e-9); close(s.K, .72, 1e-10); close(s.W, 0); }
  close(tl.samples.at(-1)!.q[0], 0, 1e-9); close(tl.samples.at(-1)!.q[1], 0, 1e-9);
});
test('cyclotron kicks and synchrotron fixed reference radius are distinct', () => {
  const cycl = run('accelerator', { mode: 'cyclotron' });
  assert.ok(cycl.samples.at(-1)!.extra.radius > cycl.samples[0].extra.radius);
  for (const s of cycl.samples) close(s.W, .3 * s.extra.kicks, 1e-10);
  const synch = run('accelerator', { mode: 'synchrotron', radius: 2 });
  for (const s of synch.samples) { close(Math.hypot(...s.q), 2, 1e-8); close(s.extra.field, s.extra.speed / 2, 1e-10); }
  assert.ok(synch.samples.at(-1)!.extra.field > synch.samples[0].extra.field);
});
test('oil drop: SI charge, buoyancy, Stokes terminal speed and levitation', () => {
  const p = { ...defaults.millikan, mode: 'off' }, c = millikanConstants(p);
  close(c.q / elementaryCharge, 5, 1e-12); close(c.terminal, -c.weight / c.b, 1e-15);
  const tl = run('millikan', { mode: 'balance' });
  for (const s of tl.samples) { close(s.q[0], .0015, 1e-15); close(s.v[0], 0, 1e-16); }
  assert.ok(tl.energyReference! < 1e-12);
  close(millikanConstants({ ...p, radius: 2 }).terminal / c.terminal, 4, 1e-10);
});
test('oil drop electrode crossing is resolved at physical radius', () => {
  const tl = run('millikan', { voltage: -1000 }, 12), c = millikanConstants({ ...defaults.millikan, voltage: -1000 });
  assert.ok(tl.endReason); close(tl.samples.at(-1)!.q[0], c.r, 1e-14);
});
test('invalid physical parameters fail explicitly', () => {
  assert.throws(() => run('accelerator', { charge: 0 })); assert.throws(() => run('millikan', { radius: 0 })); assert.throws(() => run('cartSpring', { k1: 0 }));
  assert.throws(() => run('conveyor', { muk: -.1 })); assert.throws(() => run('pendulum', {}, -1));
});
test('tangent velocity contact is captured at pi/sqrt(2k/m), not missed by sign-only detection', () => {
  const tl = run('conveyor', {}, 2), first = tl.samples.find(s => s.extra.sticking === 1)!;
  const expected = Math.PI / Math.sqrt(10);
  assert.ok(first.t >= expected && first.t - expected < 1 / 60 + 1e-8);
});
test('seeded advanced parameter sweep: 200 cases, state and balance checks', () => {
  let seed = 20261114; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const mix = (a: number, b: number) => a + (b - a) * random();
  const ids = Object.keys(advancedDefaults) as SceneId[]; let maxError = 0;
  for (const id of ids) for (let j = 0; j < 20; j++) {
    const p = { ...defaults[id] };
    if ('m' in p) p.m = mix(.5, 4); if ('M' in p) p.M = mix(.5, 6);
    if ('m1' in p) p.m1 = mix(.5, 4); if ('m2' in p) p.m2 = mix(.5, 4);
    if (id === 'cartSpring') { p.k1 = mix(1, 20); p.k2 = mix(1, 20); p.mode = ['free', 'fixed', 'forced'][j % 3]; p.F = mix(-1, 1); }
    if (id === 'cartPendulum') { p.mode = ['free', 'fixed', 'accelerated', 'spring'][j % 4]; p.angle = mix(-65, 65); p.a = mix(-3, 3); }
    if (id === 'pendulum') { p.mode = j % 2 ? 'string' : 'rod'; p.angle = mix(-140, 140); p.omega = mix(-7, 7); }
    if (id === 'coupledPendulum') { p.angle1 = mix(-30, 30); p.angle2 = mix(-30, 30); p.k = mix(.2, 4); }
    if (id === 'elasticPendulum') { p.k = mix(10, 35); p.angle = mix(-55, 55); p.extension = mix(.1, .9); }
    if (id === 'conveyor') { p.mode = j % 2 ? 'pair' : 'single'; p.muk = mix(.01, .8); p.mus = mix(.1, 1.4); p.angle = mix(0, 25); p.v1 = mix(-.5, 1.5); p.v2 = mix(-.5, 1.5); }
    if (id === 'relative') { p.a = mix(-3, 3); p.u = mix(-2, 2); }
    if (id === 'rotating') { p.mode = j % 2 ? 'spring' : 'free'; p.Omega = mix(-2, 2); p.v = mix(0, 4); }
    if (id === 'accelerator') { p.mode = ['uniform', 'cyclotron', 'synchrotron'][j % 3]; p.B = mix(.5, 2); p.voltage = mix(0, .8); }
    if (id === 'millikan') { p.mode = ['off', 'voltage', 'balance'][j % 3]; p.radius = mix(.5, 2); p.voltage = mix(-1000, 1000); p.charge = Math.ceil(mix(1, 20)); }
    const tl = run(id, p, 4);
    for (const s of tl.samples) {
      assert.ok([...s.q, ...s.v, s.K, s.U, s.Q, s.W].every(Number.isFinite), `${id} case ${j}`);
      const error = relativeError(s, tl.E0, tl.energyReference); maxError = Math.max(maxError, error);
      assert.ok(error < 1e-5, `${id} case ${j}: drift ${error}`);
      if (tl.momentumConserved) close(s.p, tl.p0, 2e-7);
    }
  }
  console.log('advanced seeded sweep: 200 cases; maximum energy balance error', maxError);
});
