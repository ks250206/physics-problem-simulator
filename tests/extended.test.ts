import test from 'node:test';
import assert from 'node:assert/strict';
import { extendedDefaults, extendedSimulate, gasStages, gasStageAt, interferenceAt, lensValues, refractionValues, waveAt, waveModes, type ExtendedId } from '../src/extended.ts';
import { extendedCatalog } from '../src/extended-catalog.ts';
import { balance, simulate, type Params } from '../src/physics.ts';
const ids = Object.keys(extendedDefaults) as ExtendedId[];
const P = (id: ExtendedId, patch: Params = {}) => ({ ...extendedDefaults[id], ...patch });
const near = (a: number, b: number, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);
const integral = (f: (x: number) => number, a: number, b: number, N = 10000) => { let sum = 0; for (let i = 0; i < N; i++) sum += f(a + (i + .5) * (b - a) / N); return sum * (b - a) / N; };
for (const id of ids) test(`${id}: all named presets have finite monotone states and appropriate diagnostics`, () => {
  for (const pr of extendedCatalog[id].presets!) {
    const tl = simulate(id, P(id, pr.params));
    assert.ok(tl.samples.length > 1, `${id} ${pr.name}`);
    for (let i = 0; i < tl.samples.length; i++) {
      const s = tl.samples[i]; assert.ok([s.t,...s.q,...s.v,s.K,s.U,s.Q,s.W,...Object.values(s.extra)].every(Number.isFinite), `${id} ${pr.name} finite`);
      if (i) assert.ok(s.t > tl.samples[i - 1].t, `${id} ${pr.name} monotone`);
      if (!tl.energyDisabled) assert.ok(Math.abs(balance(s) - tl.E0) / (tl.energyReference ?? Math.max(1, Math.abs(tl.E0))) < 2e-6, `${id} ${pr.name}: energy`);
    }
    if (['doppler','interference','refraction','thinLens'].includes(id)) assert.equal(tl.energyDisabled, true);
  }
});
test('parallel rails: free center of mass, fixed Q and the analytical barrier threshold', () => {
  for (const patch of [{ A: 1 }, { A: 1.7 }, { m: 3, M: .7 }]) {
    const tl = extendedSimulate('railSpring', P('railSpring', patch), 5);
    for (const s of tl.samples) { near(s.p, 0); near(s.extra.cm, tl.samples[0].extra.cm); }
  }
  const low = extendedSimulate('railSpring', P('railSpring', { A: 1 }), 8), high = extendedSimulate('railSpring', P('railSpring', { A: 1.7 }), 8);
  assert.ok(low.samples.every(s => s.extra.separation > 0)); assert.ok(high.samples.some(s => s.extra.separation < 0));
  for (const s of extendedSimulate('railSpring', P('railSpring', { mode:'fixed', gap: 2.4 }), 5).samples) near(s.q[1], 0);
});
test('parallel rail force is minus the independently differentiated spring potential', () => {
  const p = P('railSpring'), tl = extendedSimulate('railSpring', p, 5), h=1e-5;
  const U=(d:number)=>Number(p.k)/2*(Math.hypot(d,Number(p.gap))-Number(p.natural))**2;
  for(const s of tl.samples.filter((_,i)=>i%20===0)) near(s.extra.force,-(U(s.extra.separation+h)-U(s.extra.separation-h))/(2*h),2e-8);
});
test('stopper does not release early, and detects natural-length release without penetration', () => {
  const p=P('railSpring',{mode:'stopper',A:2.4}),tl=extendedSimulate('railSpring',p,8),released=tl.samples.find(s=>s.extra.release>0)!;
  assert.ok(released);near(released.extra.length,Number(p.natural),1e-9);
  for(const s of tl.samples){assert.ok(s.q[0]>-1e-8);if(s.extra.held)near(s.q[0],0);}
  // h>L has no compressed-spring branch; P must remain held until Q crosses it.
  const other=extendedSimulate('railSpring',P('railSpring',{mode:'stopper',gap:2.5,A:1}),3);
  assert.equal(other.samples[0].extra.held,1);assert.ok(other.samples.find(s=>s.extra.release>0));
});
test('collision: impulse, restitution, dissipated energy and adhesive oscillator',()=>{
  for(const e of [0,.2,.7,1]){const p=P('collisionSpring',{e}),tl=extendedSimulate('collisionSpring',p,2),s=tl.samples.find(s=>s.extra.collided)!;
    near(s.p,Number(p.m)*Number(p.u));near(s.v[1]-s.v[0],e*Number(p.u));
    near(s.K+s.Q,Number(p.m)*Number(p.u)**2/2);if(e===0){const end=tl.samples.at(-1)!;near(end.q[1]-end.q[0],.5);near(end.v[1],end.v[0]);}}
});
test('collision stops at second contact rather than interpenetrating',()=>{
  const tl=extendedSimulate('collisionSpring',P('collisionSpring',{m:3,M:1,e:.8}),12);
  assert.match(tl.endReason,/二度目/);near(tl.samples.at(-1)!.q[1]-tl.samples.at(-1)!.q[0],.5,1e-9);
  for(const s of tl.samples)assert.ok(s.q[1]-s.q[0]>=.5-1e-8);
});
test('loop detachment angle agrees with conservation-law result and flight has constant gravity',()=>{
  const p=P('loopFlight'),tl=extendedSimulate('loopFlight',p,4),first=tl.samples.find(s=>s.extra.flying)!;
  assert.ok(first);const R=Number(p.radius),cosTheta=(2*9.8*R-Number(p.speed)**2)/(3*9.8*R);
  near(Math.cos(first.extra.theta),cosTheta,2e-9);near(first.extra.normal,0);
  for(const s of tl.samples.filter(s=>s.extra.flying)){const dt=s.t-first.t;near(s.q[0],first.q[0]+first.v[0]*dt,1e-8);near(s.q[1],first.q[1]+first.v[1]*dt-4.9*dt*dt,1e-8);}
  assert.match(tl.endReason,/再接触/);
});
test('loop one-turn threshold and two-sided rail are distinct',()=>{
  assert.ok(extendedSimulate('loopFlight',P('loopFlight',{speed:9}),3).samples.every(s=>!s.extra.flying));
  assert.ok(extendedSimulate('loopFlight',P('loopFlight',{speed:8,mode:'wire'}),3).samples.some(s=>s.extra.normal<0));
});
test('crossed fields: Lorentz acceleration from independent finite differences, neutral and B=0 limits',()=>{
  for(const patch of [{},{B:-1,charge:-1},{B:0,vx:1},{charge:0}]){const p=P('crossedFields',patch),tl=extendedSimulate('crossedFields',p,2);
    for(let i=1;i<tl.samples.length-1;i+=7){const a=tl.samples[i-1],s=tl.samples[i],b=tl.samples[i+1],dt=b.t-a.t;near((b.v[0]-a.v[0])/dt,Number(p.charge)*Number(p.B)*s.v[1]/Number(p.m),1e-4);near((b.v[1]-a.v[1])/dt,Number(p.charge)*(Number(p.E)-Number(p.B)*s.v[0])/Number(p.m),1e-4);near(s.extra.magneticPower,0);}}
  for(const s of extendedSimulate('crossedFields',P('crossedFields',{vx:1}),3).samples){near(s.q[0],s.t);near(s.q[1],0);}
});
test('LC: known period, charge/current continuity and independently expected a^N amplification',()=>{
  const p=P('lcCircuit'),L=Number(p.inductance),C=Number(p.capacitance),quarter=Math.PI/2*Math.sqrt(L*C);
  const basic=extendedSimulate('lcCircuit',P('lcCircuit',{mode:'none'}),4*quarter);
  near(basic.samples.at(-1)!.q[0],0);near(basic.samples.at(-1)!.v[0],Number(p.voltage)*Math.sqrt(C/L));
  const tl=extendedSimulate('lcCircuit',p,12),events=tl.samples.filter((s,i)=>i>0&&s.extra.switches!==tl.samples[i-1].extra.switches);
  near(events[0].t,quarter);near(events[0].v[0],0);near(events[0].extra.voltage,-Number(p.voltage)*Number(p.a));
  for(let i=0;i<events.length;i++){const e=events[i];if(i%2===0)near(e.v[0],0,1e-10);else near(e.q[0],0,1e-10);}
  near(tl.samples.at(-1)!.K+tl.samples.at(-1)!.U,tl.E0*Number(p.a)**Number(p.cycles),1e-9);
});
test('RLC heat equals independently integrated RI², and R=0 does not dissipate',()=>{
  const p=P('lcCircuit',{mode:'damped',resistance:.8}),tl=extendedSimulate('lcCircuit',p,4);let Q=0;
  for(let i=1;i<tl.samples.length;i++){const a=tl.samples[i-1],b=tl.samples[i];Q+=Number(p.resistance)*(a.v[0]**2+b.v[0]**2)/2*(b.t-a.t);}
  near(Q,tl.samples.at(-1)!.Q,1e-4);
  for(const s of extendedSimulate('lcCircuit',P('lcCircuit',{mode:'damped',resistance:0}),2).samples)near(s.Q,0);
});
test('dielectric: work from independent force integral, battery transfer and correct Q/V invariants',()=>{
  for(const mode of ['voltage','charge']){const p=P('dielectric',{mode}),tl=extendedSimulate('dielectric',p,12),end=tl.samples.at(-1)!,C0=tl.samples[0].extra.capacitance,Q0=tl.samples[0].extra.charge;
    const derivative=C0*(Number(p.epsilon)-1)/.1,V0=Number(p.voltage);const W=integral(x=>.5*(mode==='voltage'?V0:Q0/(C0+derivative*x))**2*derivative,0,.1);
    near(W,-end.extra.external,1e-14);near(end.extra.battery,V0*(end.extra.charge-Q0),1e-14);
    for(const s of tl.samples)near(mode==='voltage'?s.extra.voltage:s.extra.charge,mode==='voltage'?V0:Q0,1e-12);}
});
test('thermal cycles: independent p dV quadrature, analytic efficiency and closure',()=>{
  for(const mode of ['carnot','otto','rectangle']){const p=P('gasCycle',{mode}),stages=gasStages(p),gamma=Number(p.gamma);let net=0;
    for(const stage of stages){const numeric=integral(u=>gasStageAt(stage,u,gamma).P*(stage.to.V-stage.from.V),0,1);near(numeric,gasStageAt(stage,1,gamma).work,2e-5);net+=numeric;if(stage.kind==='adiabatic')near(gasStageAt(stage,1,gamma).heat,0,1e-9);}
    const tl=extendedSimulate('gasCycle',p,12),end=tl.samples.at(-1)!;near(end.extra.cycleWork,net,3e-5);near(end.extra.volume,tl.samples[0].extra.volume);near(end.U,tl.E0,1e-9);near(end.extra.heatIn,end.extra.workBy,1e-9);
    if(mode==='carnot')near(end.extra.efficiency,1-Number(p.cold)/Number(p.hot));if(mode==='otto')near(end.extra.efficiency,1-Number(p.ratio)**(1-gamma));}
});
test('gas piston: symmetric equilibrium, separate adiabatic invariants and pressure-force balance',()=>{
  const stable=extendedSimulate('gasPiston',P('gasPiston',{tempA:300,tempB:300}),3);for(const s of stable.samples){near(s.q[0],2);near(s.v[0],0);}
  const p=P('gasPiston'),tl=extendedSimulate('gasPiston',p,3),gamma=Number(p.gamma),first=tl.samples[0];
  for(const s of tl.samples){near(s.extra.PA*s.extra.volumeA**gamma,first.extra.PA*first.extra.volumeA**gamma,1e-8);near(s.extra.PB*s.extra.volumeB**gamma,first.extra.PB*first.extra.volumeB**gamma,1e-8);near(s.extra.force,.02*(s.extra.PA-s.extra.PB)-Number(p.k)*(s.q[0]-2));}
});
test('standing wave: endpoint conditions and energy from spatial derivative quadrature',()=>{
  for(const mode of ['fixed','free']){const p=P('standingWave',{mode,mix:.7}),L=Number(p.length),mu=Number(p.density),modes=waveModes(p),tl=extendedSimulate('standingWave',p,2);
    for(const s of tl.samples.filter((_,i)=>i%20===0)){near(waveAt(p,0,s.t),0);if(mode==='fixed')near(waveAt(p,L,s.t),0);else near(modes.reduce((z,m)=>z+m.A*m.k*Math.cos(m.k*L)*Math.cos(m.omega*s.t),0),0);
      const K=integral(x=>.5*mu*modes.reduce((a,m)=>a-m.A*m.omega*Math.sin(m.k*x)*Math.sin(m.omega*s.t),0)**2,0,L,3000);
      const U=integral(x=>.5*mu*Number(p.speed)**2*modes.reduce((a,m)=>a+m.A*m.k*Math.cos(m.k*x)*Math.cos(m.omega*s.t),0)**2,0,L,3000);
      near(K,s.K,1e-9);near(U,s.U,1e-9);}}
});
test('Doppler: retarded wavefront intersects observer and equal velocities leave frequency unchanged',()=>{
  const p=P('doppler',{wind:35}),tl=extendedSimulate('doppler',p,12);
  for(const s of tl.samples.filter(s=>s.extra.emission>=0)){const te=s.extra.emission;near(Number(p.source)*te+(Number(p.speed)+Number(p.wind))*(s.t-te),s.q[1],1e-9);}
  const same=extendedSimulate('doppler',P('doppler',{source:80,observer:80,wind:20}),12);near(same.samples[0].extra.observed,1);
  near(tl.samples.find(s=>s.extra.received>0)!.t,Number(p.distance)/(Number(p.speed)+Number(p.wind)-Number(p.observer)),1/60);
});
test('interference: central maximum, half-wave film minimum, symmetry and unequal amplitudes',()=>{
  const p=P('interference');near(interferenceAt(p,0).intensity,1);near(interferenceAt(P('interference',{film:.55,index:1.5}),0).intensity,0,1e-12);
  near(interferenceAt(p,.0027).intensity,interferenceAt(p,-.0027).intensity);
  near(interferenceAt(P('interference',{film:.55,index:1.5,amplitudeRatio:.4}),0).intensity,(.6/1.4)**2);
  near(interferenceAt(P('interference',{amplitudeRatio:0}),.003).intensity,1);
});
test('refraction: Snell, Fermat stationarity, normal Fresnel coefficient and TIR',()=>{
  const p=P('refraction'),z=refractionValues(p),x=Math.tan(z.theta),y=Math.tan(z.thetaT),delta=1e-6;
  const optical=(s:number)=>Number(p.n1)*Math.hypot(1,x+s)+Number(p.n2)*Math.hypot(1,y-s);
  near((optical(delta)-optical(-delta))/(2*delta),0,1e-8);
  near(refractionValues(P('refraction',{angle:0})).reflectance,((1.5-1)/(1.5+1))**2);
  const tir=refractionValues(P('refraction',{angle:55}));assert.equal(tir.tir,1);near(tir.transmittance,0);
  near(refractionValues(P('refraction',{n1:1.4,n2:1.4})).reflectance,0);
});
test('lens: independent chief-ray intersection, real/virtual signs and focal-plane singularity',()=>{
  for(const patch of [{},{object:1},{mode:'concave'}]){const p=P('thinLens',patch),z=lensValues(p),h=Number(p.height);near(h-z.b*h/z.f,-z.b*h/z.a);near(z.imageHeight,-z.b*h/z.a);}
  const z=lensValues(P('thinLens',{object:1.5}));assert.equal(z.atFocus,1);assert.equal(z.b,0);assert.ok(Object.values(z).every(Number.isFinite));
});
test('new parameter validation rejects invalid physical branches rather than hiding NaNs',()=>{
  for(const [id,patch] of [['gasCycle',{gamma:1}],['doppler',{source:900}],['lcCircuit',{cycles:1.5}],['standingWave',{harmonic:2.5}],['collisionSpring',{e:1.1}],['gasPiston',{x0:0}],['dielectric',{epsilon:.5}]] as [ExtendedId,Params][])assert.throws(()=>extendedSimulate(id,P(id,patch),1));
});
test('390 seeded UI-range cases: finite state, unilateral constraints and independent diagnostics',()=>{
  let seed=20261114;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};let worst=0;
  for(const id of ids)for(let trial=0;trial<30;trial++){const p=P(id);for(const c of extendedCatalog[id].controls){if(c.options)p[c.key]=c.options[Math.floor(rnd()*c.options.length)][0];else p[c.key]=Math.min(c.max!,c.min!+Math.round(rnd()*(c.max!-c.min!)/c.step!)*c.step!);}
    const tl=extendedSimulate(id,p,4);for(const s of tl.samples){assert.ok([...s.q,...s.v,...Object.values(s.extra),s.K,s.U,s.Q,s.W].every(Number.isFinite),`${id}: finite`);if(!tl.energyDisabled){const error=Math.abs(balance(s)-tl.E0)/(tl.energyReference??Math.max(1,Math.abs(tl.E0)));worst=Math.max(worst,error);assert.ok(error<1e-5,`${id}: ${error}`);}if(id==='loopFlight'&&p.mode==='contact')assert.ok(s.extra.normal>-1e-7);if(id==='railSpring'&&p.mode==='stopper')assert.ok(s.q[0]>-1e-7);}}
  console.log(`extended seeded sweep: 390 cases; max normalized energy error ${worst}`);
});
