import * as T from 'three';
import type { Params, Sample } from './physics';
import type { ViewOptions } from './world';
import { crossedFields, gasStages, interferenceAt, lensValues, refractionValues, type ExtendedId } from './extended';
const cyan = 0x63e6ce, amber = 0xffbc70, purple = 0xb3a1ff, red = 0xff7285, muted = 0x58718c;
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const n = (p: Params, key: string) => Number(p[key]);
export function buildExtendedWorld(group: T.Group, id: ExtendedId, p: Params) {
  const material = (color: number, opacity = 1) => new T.MeshStandardMaterial({ color, roughness: .38, metalness: .25, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
  function box(w: number, h: number, d: number, color = muted, opacity = 1) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), material(color, opacity)); group.add(m); return m; }
  function ball(r = .16, color = cyan) { const m = new T.Mesh(new T.SphereGeometry(r, 24, 16), material(color)); group.add(m); return m; }
  function text(label: string, color = '#dce9f3') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 80; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#101a2be8'; ctx.beginPath(); ctx.roundRect(2, 4, 508, 72, 12); ctx.fill(); ctx.fillStyle = color; ctx.font = '600 25px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 256, 40, 495);
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), transparent: true, depthTest: false })); sprite.scale.set(2.75, .43, 1); group.add(sprite); return sprite;
  }
  function line(color = cyan, max = 600, opacity = 1) {
    const geometry = new T.BufferGeometry(), buffer = new T.BufferAttribute(new Float32Array(max * 3), 3); buffer.setUsage(T.DynamicDrawUsage); geometry.setAttribute('position', buffer); geometry.setDrawRange(0, 0);
    const object = new T.Line(geometry, new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); object.frustumCulled = false; group.add(object);
    return (pts: T.Vector3[]) => { pts.slice(0, max).forEach((pt, i) => buffer.setXYZ(i, pt.x, pt.y, pt.z)); buffer.needsUpdate = true; geometry.setDrawRange(0, Math.min(max, pts.length)); };
  }
  function dash(a: T.Vector3, b: T.Vector3, color = purple) { const geometry = new T.BufferGeometry().setFromPoints([a, b]); const l = new T.Line(geometry, new T.LineDashedMaterial({ color, dashSize: .13, gapSize: .09 })); l.computeLineDistances(); group.add(l); }
  function spring(color = 0xc9d7e8) { const draw = line(color, 161); return (a: T.Vector3, b: T.Vector3) => { const axis = b.clone().sub(a), normal = v(-axis.y, axis.x).normalize(); draw(Array.from({ length: 161 }, (_, i) => { const u = i / 160, envelope = Math.min(1, u * 12, (1 - u) * 12); return a.clone().addScaledVector(axis, u).addScaledVector(normal, .09 * Math.sin(20 * Math.PI * u) * envelope).add(v(0, 0, .09 * Math.cos(20 * Math.PI * u) * envelope)); })); }; }
  function arrow(color = cyan) { const a = new T.ArrowHelper(v(1), v(), 1, color, .18, .1); a.visible = false; group.add(a); return (pos: T.Vector3, vec: T.Vector3, visible: boolean, rawLength = false) => { const length = vec.length(); a.visible = visible && length > 1e-10; if (!a.visible) return; a.position.copy(pos); a.setDirection(vec.clone().normalize()); a.setLength(rawLength ? length : Math.min(1.7, .28 + .12 * length), .17, .1); }; }
  function trace() { const draw = line(muted, 600), points: T.Vector3[] = []; let last = -1; return (s: Sample, pt: T.Vector3) => { if (s.t < last || s.t - last > .4) points.length = 0; if (last !== s.t) { points.push(pt.clone()); if (points.length > 580) points.shift(); draw(points); last = s.t; } }; }
  let width = 9, height = 6.8, targetY = 3;
  let apply: (s: Sample, o: ViewOptions) => void = () => {};
  const focus = (_s: Sample, _o: ViewOptions) => 0;
  if (id === 'railSpring') {
    const gap = n(p, 'gap'), y0 = 2, y1 = 2 + gap, a = ball(.22), b = ball(.22, amber), coil = spring(); height = gap + 4; targetY = 2 + gap / 2;
    [y0, y1].forEach(y => box(8, .07, .12).position.set(0, y, -.06)); const la = text('P（水平レール）', '#92f3df'), lb = text(p.mode === 'fixed' ? 'Q 固定' : 'Q（水平レール）', '#ffcf98');
    if (p.mode === 'stopper') { box(.12, .7, .65, red).position.set(-.25, y0, 0); text('P ≥ 0 のストッパー').position.set(-2, y0 - .8, 0); }
    if (p.mode === 'fixed') box(.2, .65, .7).position.set(0, y1, -.35);
    const va = arrow(), vb = arrow(), fa = arrow(red), fb = arrow(red);
    apply = (s, o) => { a.position.set(s.q[0], y0, 0); b.position.set(s.q[1], y1, 0); coil(a.position, b.position); la.position.copy(a.position).add(v(0, -.6)); lb.position.copy(b.position).add(v(0, .65)); va(a.position, v(s.v[0]), o.vectors); vb(b.position, v(s.v[1]), o.vectors); fa(a.position.clone().add(v(0, 0, .3)), v(s.extra.force), o.forces); fb(b.position.clone().add(v(0, 0, .3)), v(-s.extra.force), o.forces); };
  } else if (id === 'collisionSpring') {
    height = 4.3; targetY = 1.5; width = 10;
    const m = n(p, 'm'), M = n(p, 'M'), u = n(p, 'u'), e = n(p, 'e'), aVelocity = (m - e * M) * u / (m + M), bVelocity = (1 + e) * m * u / (m + M);
    const w = Math.sqrt(n(p, 'k') / (e === 0 ? m + M : M));
    const scale = Math.min(1, 7 / (3 + (p.mode === 'free' ? 12 * Math.max(Math.abs(aVelocity), bVelocity) : Math.abs(aVelocity) * 12 * +(e !== 0) + bVelocity / w)));
    const a = box(.4, .55, .7, cyan), b = box(.4, .55, .7, amber), coil = spring(), va = arrow(), vb = arrow(), fa = arrow(red);
    box(10, .13, 1.5).position.set(0, .8, 0); const wall = box(.15, 1.4, 1, muted); wall.position.set(4, 1.45, 0); wall.visible = p.mode === 'spring';
    const la = text('入射物体 m', '#92f3df'), lb = text('標的 M', '#ffcf98'); text('座標は共通縮尺・物体寸法は模式表示').position.set(0, .35, 1);
    apply = (s, o) => { a.position.set(-1 + scale * s.q[0], 1.15, 0); b.position.set(-1 + scale * s.q[1], 1.15, 0); if (p.mode === 'spring') coil(b.position.clone().add(v(.2)), v(3.9, 1.15)); la.position.copy(a.position).add(v(-.5, 1)); lb.position.copy(b.position).add(v(.6, .55)); va(a.position, v(s.v[0]), o.vectors); vb(b.position, v(s.v[1]), o.vectors); fa(b.position.clone().add(v(0, 0, .4)), v(s.extra.force), o.forces); };
  } else if (id === 'loopFlight') {
    const R = n(p, 'radius'); width = Math.max(7, 2 * R + 3); height = 2 * R + 2.5; targetY = R + .8;
    line(muted)(Array.from({ length: 241 }, (_, i) => v(R * Math.sin(i * Math.PI / 120), .6 + R * (1 - Math.cos(i * Math.PI / 120)))));
    box(2 * R + 1, .12, 1.3).position.y = .43; const body = ball(.15), trail = trace(), vel = arrow(), normal = arrow(amber); text('最下点から出発・内側の円軌道').position.set(0, 2 * R + 1.4, 0);
    apply = (s, o) => { body.position.set(s.q[0], .6 + s.q[1], .06); trail(s, body.position); vel(body.position, v(...s.v), o.vectors); normal(body.position.clone().add(v(0, 0, .3)), v(-Math.sin(s.extra.theta), Math.cos(s.extra.theta)).multiplyScalar(s.extra.normal), o.forces); (body.material as T.MeshStandardMaterial).color.setHex(s.extra.flying ? amber : cyan); };
  } else if (id === 'crossedFields') {
    const tl = crossedFields(p, 12), xs = tl.samples.map(s => s.q[0]), ys = tl.samples.map(s => s.q[1]);
    const xmin = Math.min(0, ...xs), xmax = Math.max(0, ...xs), ymin = Math.min(0, ...ys), ymax = Math.max(0, ...ys), scale = Math.min(1, 7 / Math.max(1, xmax - xmin), 4 / Math.max(1, ymax - ymin));
    const point = (x: number, y: number) => v((x - (xmin + xmax) / 2) * scale, 3 + (y - (ymin + ymax) / 2) * scale, .12);
    box(8.5, 5, .08, 0x244250, .3).position.set(0, 3, -.12); const body = ball(.13), path = trace(), vel = arrow(), electric = arrow(red), magnetic = arrow(purple);
    for (const x of [-3, -1, 1, 3]) for (const y of [1.5, 3, 4.5]) { const marker = text(n(p, 'B') < 0 ? '⊗' : n(p, 'B') > 0 ? '⊙' : '·', '#466e85'); marker.scale.set(.3, .3, 1); marker.position.set(x, y, -.04); }
    text('E：鉛直　B：画面に垂直').position.set(0, 5.9, 0);
    apply = (s, o) => { body.position.copy(point(s.q[0], s.q[1])); path(s, body.position); vel(body.position, v(s.v[0], s.v[1]), o.vectors); electric(body.position.clone().add(v(0, 0, .2)), v(0, s.extra.electric), o.forces); magnetic(body.position.clone().add(v(0, 0, .4)), v(s.extra.Fx, s.extra.Fy - s.extra.electric), o.forces); };
  } else if (id === 'lcCircuit') {
    height = 6.5; targetY = 3; const left = -3, right = 3, top = 4.7, bottom = 1.5;
    const wire = line(muted), coil = spring(purple); wire([v(left, top), v(left, bottom), v(-1.2, bottom)]); line(muted)([v(1.2, bottom), v(right, bottom), v(right, top)]); coil(v(-1.2, bottom, .12), v(1.2, bottom, .12));
    const plate1 = box(.1, 1, 1.1, cyan), plate2 = box(.1, 1, 1.1, amber), lead1 = line(muted), lead2 = line(muted);
    const tags = [text('−Q / +Q の極板'), text('コイル L', '#c8baff')]; tags[0].position.set(0, 5.6, 0); tags[1].position.set(0, .9, 0);
    if(p.mode === 'damped'){ box(.42,.7,.55,0x91787a).position.set(left,3.1,0); text('抵抗 R').position.set(left,3.9,0); }
    const direction = arrow(cyan), charges = Array.from({ length: 10 }, (_, i) => ball(.07, i % 2 ? amber : cyan));
    apply = (s, o) => { const gap = .5 * s.extra.gapRatio; plate1.position.set(-gap / 2, top, 0); plate2.position.set(gap / 2, top, 0); lead1([v(left, top), v(-gap / 2, top)]); lead2([v(gap / 2, top), v(right, top)]); (plate1.material as T.MeshStandardMaterial).color.setHex(s.q[0] >= 0 ? cyan : amber); (plate2.material as T.MeshStandardMaterial).color.setHex(s.q[0] >= 0 ? amber : cyan);
      charges.forEach((body, i) => { const side = i % 2 ? 1 : -1; body.position.set(side * (gap / 2 - .08), top - .4 + .2 * Math.floor(i / 2), .58); body.visible = Math.abs(s.q[0]) > .02 * (1 + Math.floor(i / 2)); }); direction(v(right, 3.2, .2), v(0, -s.extra.current), o.vectors); };
  } else if (id === 'dielectric') {
    const top = box(5, .14, 2, cyan, .65), bottom = box(5, .14, 2, amber, .65); top.position.set(0, 3.7, 0); bottom.position.set(0, 2.3, 0);
    const slab = box(5, 1.15, 1.85, purple, .45), force = arrow(red); text(p.mode === 'voltage' ? '電池接続：電圧一定' : '電池なし：電荷一定').position.set(0, 5, 0); text('誘電体を外力でゆっくり挿入').position.set(0, 1.4, 0); width = 13;
    if (p.mode === 'voltage') { line(muted)([v(2.5, 3.7), v(3.5, 3.7), v(3.5, 2.3), v(2.5, 2.3)]); box(.3, .55, .6, 0xa3b9d1).position.set(3.5, 3, 0); }
    apply = (s, o) => { slab.position.set(-5 + 50 * s.q[0], 3, 0); force(v(-2 + 50 * s.q[0], 3, 1.1), v(s.extra.force * 1e6), o.forces); };
  } else if (id === 'gasCycle' || id === 'gasPiston') {
    width = 10; height = 6; targetY = 2.8;
    box(7.2, .12, 2).position.set(0, 1.3, 0); box(.15, 2.1, 2).position.set(-3.6, 2.35, 0); box(.15, 2.1, 2).position.set(3.6, 2.35, 0);
    box(7.2, .12, 2, muted, .35).position.set(0, 3.4, 0); const glass = box(7.2, 2.1, .05, 0x34566c, .14); glass.position.set(0, 2.35, 1);
    const piston = box(.16, 2.05, 1.9, 0xc6d8e7, .85), coil = spring(purple), gasA = box(1, 1.95, 1.85, cyan, .11), gasB = box(1, 1.95, 1.85, amber, .11);
    const particles = Array.from({ length: 40 }, (_, i) => ball(.045, i < 20 ? cyan : amber));
    const ta = text(id === 'gasPiston' ? '気体 A' : '理想気体', '#92f3df'), tb = text(id === 'gasPiston' ? '気体 B' : '外部ピストン', '#ffcf98'); ta.position.set(-2.1, 4, 0); tb.position.set(2.1, 4, 0);
    text('粒子は模式表示：分子動力学計算ではありません').position.set(0, .7, 0);
    let Vmax = 1; if (id === 'gasCycle') Vmax = Math.max(...gasStages(p).flatMap(stage => [stage.from.V, stage.to.V]));
    apply = (s) => { const x = id === 'gasPiston' ? -3.6 + 7.2 * s.q[0] / 4 : -3.6 + 7 * s.extra.volume / Vmax;
      piston.position.set(x, 2.35, 0); const aWidth = Math.max(.04, x + 3.5), bWidth = Math.max(.04, 3.5 - x); gasA.scale.x = aWidth; gasA.position.set(-3.5 + aWidth / 2, 2.35, 0); gasB.scale.x = bWidth; gasB.position.set(x + bWidth / 2, 2.35, 0); gasB.visible = id === 'gasPiston';
      if (id === 'gasPiston') coil(v(x + .08, 3.02, .2), v(3.5, 3.02, .2));
      particles.forEach((part, i) => { const a = i < 20, start = a ? -3.5 : x + .1, span = a ? aWidth : bWidth; part.visible = a || id === 'gasPiston'; part.position.set(start + span * (.08 + .84 * ((i * .6180339 + s.t * .13) % 1)), 1.55 + 1.55 * ((i * .4142 + s.t * .19) % 1), -.7 + 1.4 * ((i * .732 + s.t * .11) % 1)); }); };
  } else if (id === 'standingWave') {
    const length = n(p, 'length'); width = length + 3; height = 5; targetY = 2.5;
    const wave = line(cyan, 241), neutral = line(muted); neutral([v(-length / 2, 2.5), v(length / 2, 2.5)]);
    box(.12, 2, .7).position.set(-length / 2, 2.5, 0); if (p.mode === 'fixed') box(.12, 2, .7).position.set(length / 2, 2.5, 0); else { box(.06, 2, .08, amber).position.set(length / 2, 2.5, 0); text('自由端：傾き0', '#ffcf98').position.set(length / 2, 3.9, 0); }
    const bead = ball(.1, amber); text('変位 y：振幅は4倍に拡大').position.set(0, .9, 0);
    apply = s => { wave(s.q.map((y, i) => v(-length / 2 + length * i / 80, 2.5 + 4 * y))); bead.position.set(0, 2.5 + 4 * s.q[40], .05); };
  } else if (id === 'doppler') {
    width = 11; height = 7; targetY = 3;
    const D = n(p, 'distance'), scale = 7 / (D + 12 * Math.max(0, n(p, 'source'), n(p, 'observer'))), x = (value: number) => -3.5 + value * scale;
    const source = ball(.18), observer = box(.28, .6, .3, amber), a = text('音源', '#92f3df'), b = text('観測者', '#ffcf98'), circles = Array.from({ length: 26 }, () => line(cyan, 129, .35));
    text('放出した波面も風とともに移動').position.set(0, 6, 0);
    apply = s => { source.position.set(x(s.q[0]), 3, .1); observer.position.set(x(s.q[1]), 3, .1); a.position.copy(source.position).add(v(0, .65)); b.position.copy(observer.position).add(v(0, -.7));
      circles.forEach((draw, i) => { const te = i / n(p, 'frequency'), age = s.t - te; if (age < 0) { draw([]); return; } const center = n(p, 'source') * te + n(p, 'wind') * age, radius = n(p, 'speed') * age * scale; draw(Array.from({ length: 129 }, (_, j) => { const theta = j / 128 * 2 * Math.PI; return v(x(center) + radius * Math.cos(theta), 3 + radius * Math.sin(theta)); })); }); };
  } else if (id === 'interference') {
    width = 10; const slits = [v(-2, 2.3), v(-2, 3.7)]; box(.15, 5, .8).position.set(-2, 3, 0); slits.forEach(pt => box(.19, .25, 1, cyan).position.copy(pt));
    const rays = [line(cyan), line(amber)], screen = box(.15, 5, 1.2, 0x273b51); screen.position.set(3, 3, 0);
    for (let i = 0; i < 180; i++) { const y = -.006 + .012 * i / 179, I = interferenceAt(p, y).intensity; const color = new T.Color().setRGB(.08 + .25 * I, .1 + .8 * I, .18 + .5 * I); box(.2, 4.8 / 180, 1.24, color.getHex()).position.set(3, 3 + y * 400, .05); }
    const detector = ball(.09, red); if (n(p, 'film') > 0) box(.3, .6, 1, purple, .55).position.set(-1.3, 2.3, 0);
    text('二つのスリット（間隔は拡大）').position.set(-2, 5.9, 0); text('スクリーン ±6mm').position.set(3, 5.9, 0);
    apply = s => { detector.position.set(2.8, 3 + s.q[0] * 400, .15); rays.forEach((draw, i) => draw([slits[i], detector.position])); };
  } else if (id === 'refraction') {
    const z = refractionValues(p), center = v(0, 3), incident = v(-3 * Math.sin(z.theta), 3 + 3 * Math.cos(z.theta)), reflected = v(3 * Math.sin(z.theta), 3 + 3 * Math.cos(z.theta)), transmitted = v(3 * Math.sin(z.thetaT), 3 - 3 * Math.cos(z.thetaT));
    box(8, 2.8, .15, 0x426e8e, .3).position.set(0, 1.5, -.15); line(muted)([v(-4, 3), v(4, 3)]); dash(v(0, .2), v(0, 6.1), muted);
    line(cyan)([incident, center]); line(amber)([center, reflected]); if (!z.tir) line(purple)([center, transmitted]);
    text(`入射側 n₁=${p.n1}`).position.set(-2.5, 5.8, 0); text(`透過側 n₂=${p.n2}`).position.set(-2.5, .7, 0);
    text(z.tir ? '全反射：透過光線なし' : '角度は法線から測る').position.set(2, 3.4, .2); const photon = ball(.1);
    apply = s => { const u = (s.t % 6) / 6; photon.position.copy(u < .5 ? incident.clone().lerp(center, 2 * u) : center.clone().lerp(z.tir ? reflected : transmitted, 2 * u - 1)).add(v(0, 0, .1)); };
  } else if (id === 'thinLens') {
    const z = lensValues(p), h = n(p, 'height'), scale = Math.min(1, 4 / Math.max(z.a, Math.min(8, Math.abs(z.b)))), mid = 3;
    width = 11; height = 7; targetY = mid;
    const shape = new T.Shape(); const edge=p.mode==='concave'?.28:.06,control=p.mode==='concave'?.11:-.5; shape.moveTo(-edge,-2);shape.quadraticCurveTo(control,0,-edge,2);shape.lineTo(edge,2);shape.quadraticCurveTo(-control,0,edge,-2);shape.closePath();
    const lens = new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.6,bevelEnabled:false,curveSegments:24}),material(0x8eaef9,.28));lens.position.set(0,mid,-.3);group.add(lens);
    line(muted)([v(-5, mid), v(5, mid)]); [-1, 1].forEach(sign => { const pt = ball(.045, purple); pt.position.set(sign * Math.abs(z.f) * scale, mid, 0); text(sign < 0 ? 'F' : 'F′').position.copy(pt.position).add(v(0, -.4)); });
    const obj = v(-z.a * scale, mid + h), top = v(0, mid + h), img = v(z.b * scale, mid + z.imageHeight); arrow(cyan)(v(obj.x, mid), v(0, h), true, true);
    line(cyan)([obj, top]); line(amber)([obj, v(0, mid)]);
    const clipRay = (origin: T.Vector3, direction: T.Vector3) => { const extent = Math.min(5 / Math.max(1e-8, Math.abs(direction.x)), 2.7 / Math.max(1e-8, Math.abs(direction.y))); return origin.clone().addScaledVector(direction, extent); };
    const dir1 = v(1, -h / (z.f * scale)), dir2 = v(1, -h / (z.a * scale)); line(cyan)([top, clipRay(top, dir1)]); line(amber)([v(0, mid), clipRay(v(0, mid), dir2)]);
    if (!z.atFocus && Math.abs(img.x) < 4.7 && Math.abs(z.imageHeight) < 2.6) { arrow(z.virtual ? purple : amber)(v(img.x, mid), v(0, z.imageHeight), true, true); if (z.virtual) { dash(top, img); dash(v(0, mid), img); } text(z.virtual ? '正立の虚像' : '倒立の実像', z.virtual ? '#c8baff' : '#ffcf98').position.set(img.x, z.imageHeight < 0 ? .6 : 5.7, 0); }
    else text(z.atFocus ? '像は無限遠：出射光は平行' : '像は表示範囲外：数値を参照').position.set(1.5, 5.7, 0);
    text(p.mode === 'concave' ? '凹レンズ（記号的表示）' : '凸レンズ').position.set(0, .5, 0); text('物体', '#92f3df').position.set(obj.x, 4.6, 0);
  }
  return { width, height, targetY, apply, focus };
}
