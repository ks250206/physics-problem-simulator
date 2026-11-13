import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, simulate, relativeError } from '../src/physics.ts';
test('160 deterministic UI-range track cases retain finite states, energy and unilateral contact',()=>{
 let seed=4291;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<160;i++){
  const p={...defaults.track,m:.5+7.5*random(),M:.5+7.5*random(),h:1+2*random(),q0:-2.5+5*random(),v0:-1+2*random(),drop:i%2?1.5*random():0,fixed:i%3===0?1:0,shape:['bowl','flat','asymmetric'][i%3]};
  const tl=simulate('track',p);
  for(const s of tl.samples){assert.ok(relativeError(s,tl.E0)<1e-5,JSON.stringify(p));assert.ok(s.extra.N>=-1e-8);assert.ok(s.Q>=0);if(!p.fixed)assert.ok(Math.abs(s.p-tl.p0)<1e-8);}
 }
});
