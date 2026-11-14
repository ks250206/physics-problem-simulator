import { catalog } from './catalog';
import { gasStages, gasStageAt, interferenceAt, isExtended, type ExtendedId } from './extended';
import type { Params, Sample, SceneId, Timeline } from './physics';
const num = (value: number) => !Number.isFinite(value) ? '—' : Math.abs(value) > 1e4 || (value !== 0 && Math.abs(value) < .01) ? value.toExponential(1) : value.toFixed(Math.abs(value) < 10 ? 2 : 1);
export function extendedMetrics(id: string, s: Sample, p: Params): (string | number)[][] {
  const e = s.extra;
  switch (id) {
    case 'railSpring': return [['ばねの長さ ℓ', e.length, 'm'], ['相対座標 xP−xQ', e.separation, 'm'], ['ポテンシャル障壁', e.barrier, 'J']];
    case 'collisionSpring': return [['入射側の速度', s.v[0], 'm/s'], ['標的の速度', s.v[1], 'm/s'], ['衝突で発生した損失', s.Q, 'J']];
    case 'loopFlight': return [['垂直抗力 N', e.normal, 'N'], ['速さ', e.speed, 'm/s'], ['一周条件の初速', e.threshold, 'm/s']];
    case 'crossedFields': return [['水平速度 vx', s.v[0], 'm/s'], ['鉛直速度 vy', s.v[1], 'm/s'], ['磁気力の仕事率', e.magneticPower, 'W']];
    case 'lcCircuit': return [['コンデンサー電圧', e.voltage, 'V'], ['電流 I', e.current, 'A'], ['極板操作の回数', e.switches, '回']];
    case 'dielectric': return [['静電容量', e.capacitance * 1e12, 'pF'], ['引き込む力', e.force * 1e6, 'μN'], ['電池がした仕事', e.battery * 1e6, 'μJ']];
    case 'gasCycle': return [['温度 T', e.temperature, 'K'], ['1周期の仕事', e.cycleWork, 'J'], ['熱効率 η', e.efficiency * 100, '%']];
    case 'gasPiston': return [['左室温度 TA', e.TA, 'K'], ['右室温度 TB', e.TB, 'K'], ['ピストンへの合力', e.force, 'N']];
    case 'standingWave': return [['主モードの周波数', e.frequency, 'Hz'], ['主モードの波長', e.wavelength, 'm'], ['張力', e.tension, 'N']];
    case 'doppler': return [['観測周波数（到達後）', e.observed, 'Hz'], ['前方の波長', e.wavelength, 'm'], ['受信した波面', e.received, '枚']];
    case 'interference': return [['検出位置 y', e.screenY * 1e3, 'mm'], ['規格化強度', e.intensity, ''], ['近軸近似の縞間隔', e.spacing * 1e3, 'mm']];
    case 'refraction': return [['屈折角', e.tir ? '全反射' : e.thetaT * 180 / Math.PI, e.tir ? '' : '°'], ['反射率 R', e.reflectance * 100, '%'], ['臨界角', Number(p.n1) > Number(p.n2) ? e.critical : 'なし', Number(p.n1) > Number(p.n2) ? '°' : '']];
    case 'thinLens': return [['像の距離 b', e.atFocus ? '無限遠' : e.b, e.atFocus ? '' : 'm'], ['横倍率', e.atFocus ? '定義なし' : e.magnification, ''], ['像の種類', e.atFocus ? '無限遠' : e.virtual ? '虚像' : '実像', '']];
    default: return [];
  }
}
type Point = [number, number];
interface Curve { label: string; points: Point[]; color: string }
function Plot({ title, xlabel, ylabel, curves, marker }: { title: string; xlabel: string; ylabel: string; curves: Curve[]; marker?: Point }) {
  const finite = curves.flatMap(c => c.points).filter(p => p.every(Number.isFinite));
  if (!finite.length) return null;
  const xmin = Math.min(...finite.map(p => p[0])), xmax = Math.max(xmin + 1e-9, ...finite.map(p => p[0]));
  const lo = Math.min(0, ...finite.map(p => p[1])), hi = Math.max(0, ...finite.map(p => p[1])), padding = Math.max(1e-9, hi - lo) * .08;
  const ymin = lo - padding, ymax = hi + padding, x = (v: number) => 66 + 590 * (v - xmin) / (xmax - xmin), y = (v: number) => 162 - 125 * (v - ymin) / (ymax - ymin);
  return <div className="observable-chart"><h4>{title}</h4><svg viewBox="0 0 700 207" role="img" aria-label={title}>
    {[0, .5, 1].map(t => <g key={t}><line x1="66" x2="656" y1={y(ymin + t * (ymax - ymin))} y2={y(ymin + t * (ymax - ymin))} stroke="#28384c" strokeDasharray="3 5"/><text x="58" y={y(ymin + t * (ymax - ymin)) + 4} textAnchor="end">{num(ymin + t * (ymax - ymin))}</text></g>)}
    {curves.map(curve => <path key={curve.label} d={curve.points.filter(p => p.every(Number.isFinite)).map((p, i) => `${i ? 'L' : 'M'}${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke={curve.color} strokeWidth="2"/>)}
    {marker?.every(Number.isFinite) && <circle cx={x(marker[0])} cy={y(marker[1])} r="5" fill="#ffbc70" stroke="#101a2b" strokeWidth="2"/>}
    <text x="66" y="185">{num(xmin)}</text><text x="656" y="185" textAnchor="end">{num(xmax)}</text><text x="360" y="202" textAnchor="middle">{xlabel}</text><text x="12" y="20">{ylabel}</text>
  </svg><div className="legend">{curves.map(c => <span key={c.label} style={{ color: c.color }}>{c.label}</span>)}</div></div>;
}
const cyan = '#63e6ce', purple = '#b3a1ff';
export function ObservablePanel({ id, s, p, timeline }: { id: SceneId; s: Sample; p: Params; timeline: Timeline }) {
  if (!isExtended(id)) return null;
  const samples = timeline.samples.filter((_, i) => i % Math.max(1, Math.floor(timeline.samples.length / 420)) === 0);
  const history = (key: string, scale = 1): Point[] => samples.map(a => [a.t, a.extra[key] * scale]);
  let plots: React.ReactNode;
  if (id === 'gasCycle') {
    const full = gasStages(p).flatMap(stage => Array.from({ length: 81 }, (_, i) => { const z = gasStageAt(stage, i / 80, Number(p.gamma)); return [z.V * 1e3, z.P / 1000] as Point; }));
    plots = <Plot title="p–V図：囲まれた面積が1周期の仕事" xlabel="体積 V / L" ylabel="圧力 p / kPa" curves={[{ label: '1サイクルの経路', points: full, color: cyan }]} marker={[s.extra.volume * 1e3, s.extra.pressure / 1000]}/>;
  } else if (id === 'lcCircuit') {
    plots = <><Plot title="コンデンサーの電圧" xlabel="時刻 / s" ylabel="V / V" curves={[{ label: 'V=Q/C（容量切替では不連続）', points: history('voltage'), color: cyan }]} marker={[s.t, s.extra.voltage]}/><Plot title="コイルの電流" xlabel="時刻 / s" ylabel="I / A" curves={[{ label: 'I（瞬時の極板操作でも連続）', points: history('current'), color: purple }]} marker={[s.t, s.extra.current]}/></>;
  } else if (id === 'interference') {
    const points: Point[] = Array.from({ length: 721 }, (_, i) => { const y = -.006 + .012 * i / 720; return [y * 1000, interferenceAt(p, y).intensity]; });
    plots = <Plot title="スクリーン上の干渉強度" xlabel="スクリーン位置 y / mm" ylabel="規格化強度 I/Imax" curves={[{ label: '光路差から計算した強度', points, color: cyan }]} marker={[s.q[0] * 1000, s.extra.intensity]}/>;
  } else if (id === 'railSpring') {
    const extent = Math.max(3, 2 * Number(p.A)), points: Point[] = Array.from({ length: 401 }, (_, i) => { const d = -extent + 2 * extent * i / 400; return [d, Number(p.k) / 2 * (Math.hypot(d, Number(p.gap)) - Number(p.natural)) ** 2]; });
    plots = <Plot title="相対座標のポテンシャルと障壁" xlabel="xP−xQ / m" ylabel="U / J" curves={[{ label: 'ばねのエネルギー', points, color: cyan }, { label: '全エネルギー E₀', points: [[-extent, timeline.E0], [extent, timeline.E0]], color: purple }]} marker={[s.extra.separation, s.U]}/>;
  } else if (id === 'gasPiston') {
    plots = <Plot title="左右の圧力：合力の向きを比較" xlabel="時刻 / s" ylabel="圧力 / kPa" curves={[{ label: '左室 pA', points: history('PA', .001), color: cyan }, { label: '右室 pB', points: history('PB', .001), color: purple }]}/>;
  } else if (id === 'doppler') {
    plots = <Plot title="観測者が受け取る位相（到達前は0）" xlabel="時刻 / s" ylabel="受信信号（規格化）" curves={[{ label: '遅延した発信時刻から求めた信号', points: history('signal'), color: cyan }]} marker={[s.t, s.extra.signal]}/>;
  } else if (id === 'standingWave') {
    plots = <Plot title="弦の変位：節と境界条件" xlabel="位置 x / m" ylabel="変位 y / m" curves={[{ label: '現在の変位（SI値）', points: s.q.map((y, i) => [Number(p.length) * i / 80, y]), color: cyan }]}/>;
  } else if (id === 'dielectric') {
    plots = <Plot title="挿入長による静電引力の変化" xlabel="挿入長 / cm" ylabel="力 F / μN" curves={[{ label: '挿入方向の引力', points: samples.map(a => [a.q[0] * 100, a.extra.force * 1e6]), color: cyan }]} marker={[s.q[0] * 100, s.extra.force * 1e6]}/>;
  } else if (id === 'loopFlight') {
    plots = <Plot title="垂直抗力：0になると拘束が外れる" xlabel="時刻 / s" ylabel="N / N" curves={[{ label: '法線反力', points: history('normal'), color: cyan }]} marker={[s.t, s.extra.normal]}/>;
  } else if (id === 'collisionSpring' || id === 'crossedFields') {
    plots = <Plot title={id === 'collisionSpring' ? '衝突前後の速度' : '水平・鉛直速度'} xlabel="時刻 / s" ylabel="速度 / m s⁻¹" curves={[{ label: id === 'collisionSpring' ? '入射側' : 'vx', points: samples.map(a => [a.t, a.v[0]]), color: cyan }, { label: id === 'collisionSpring' ? '標的' : 'vy', points: samples.map(a => [a.t, a.v[1]]), color: purple }]}/>;
  } else if (id === 'refraction') {
    plots = <div className="optics-diagnostic"><strong>{s.extra.tir ? '全反射：透過する光線なし' : `Snellの法則の残差 ${s.extra.residual.toExponential(1)}`}</strong><p>反射率 R + 透過率 T = {(s.extra.reflectance + s.extra.transmittance).toFixed(6)}</p><p>全反射時に「架空の屈折角」を表示せず、幾何光線が存在しないと判定します。</p></div>;
  } else {
    plots = <div className="optics-diagnostic"><strong>{s.extra.atFocus ? '像は無限遠：出射光は平行' : `レンズの式の残差 ${s.extra.lensResidual.toExponential(1)} m⁻¹`}</strong><p>{s.extra.virtual ? '虚像は実光線の後方延長の交点。そこへ光が集まるわけではありません。' : '実像は出射光線が実際に交わる位置。焦点上では有限の交点がなくなります。'}</p></div>;
  }
  return <section className="observable-panel" data-testid="observable-panel"><div className="eyebrow">OBSERVABLES · 観測量</div>{plots}{timeline.timeLabel && <p className="diagnostic-note">{timeline.timeLabel}：実際の物理時間とは区別しています。</p>}</section>;
}
const groups: { title: string; ids: SceneId[]; gaps: string }[] = [
  { title: '多体・ばね・振り子', ids: ['track', 'spring', 'cartSpring', 'cartPendulum', 'pendulum', 'coupledPendulum', 'elasticPendulum', 'railSpring'], gaps: 'ばねから物体が離れる多段階問題、二重振り子、衝突を含む連成系は未実装。' },
  { title: '摩擦・衝突・拘束', ids: ['pulley', 'conveyor', 'collisionSpring', 'loopFlight'], gaps: '剛体の転倒・転がり、糸の切断後、滑車の慣性、反復衝突は未実装。' },
  { title: '相対運動・慣性力', ids: ['relative', 'rotating'], gaps: '回転角速度が変化する系、地球の自転・フーコー振り子は未実装。' },
  { title: '電磁気・回路', ids: ['induction', 'accelerator', 'millikan', 'crossedFields', 'lcCircuit', 'dielectric'], gaps: '有限磁場への出入、ダイオード、交流定常応答、複数コンデンサー回路、相対論的加速器は未実装。' },
  { title: '熱力学', ids: ['gasCycle', 'gasPiston'], gaps: '凝縮・相変化、実在気体、半透膜、液中容器の全工程は未実装。' },
  { title: '波動・音・光', ids: ['standingWave', 'doppler', 'interference', 'refraction', 'thinLens'], gaps: '動く壁での反射、気柱、回折包絡、多重反射、複数レンズ、プリズムの全装置は未実装。' },
];
export function CoveragePanel({ changeScene }: { changeScene: (id: SceneId) => void }) {
  return <div className="coverage-panel" role="tabpanel"><h3>実装済みの設定と、まだ扱っていない範囲</h3><p>実験数は計算モデルの数です。「過去問27問を完全再現」「全年度を網羅」という意味ではありません。各実験の出典欄で原問題確認・出題意図確認・独自発展を区別しています。</p><div className="coverage-groups">{groups.map(group => <article key={group.title}><h4>{group.title}</h4><div>{group.ids.map(id => <button key={id} onClick={() => changeScene(id)}>{catalog[id].title} ↗</button>)}</div><p><b>未実装：</b>{group.gaps}</p></article>)}</div><p>万有引力・天体、流体、原子物理（光電効果・X線・核反応）も次のカバレッジ対象です。</p><a href="https://github.com/ks250206/physics-problem-simulator/blob/main/docs/COVERAGE.md" target="_blank" rel="noreferrer">年度・大学・再現レベルの対応表 ↗</a></div>;
}
