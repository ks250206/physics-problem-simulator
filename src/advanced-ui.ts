import type { Params, Sample } from './physics';
export function advancedMetrics(id: string, s: Sample, p: Params): (string | number)[][] {
  switch (id) {
    case 'cartSpring': return [['台車の加速度', s.extra.aCart, 'm/s²'], ['台車に対する v₁', s.extra.rel1, 'm/s'], ['台車に対する v₂', s.extra.rel2, 'm/s']];
    case 'cartPendulum': return [['棒の角度', s.q[1] * 180 / Math.PI, '°'], ['台車の加速度', s.extra.ax, 'm/s²'], [p.mode === 'accelerated' ? 'つり合い角' : '台車系の慣性力', p.mode === 'accelerated' ? s.extra.equilibrium : s.extra.pseudo, p.mode === 'accelerated' ? '°' : 'N']];
    case 'pendulum': return [['角度（鉛直下基準）', s.extra.angle, '°'], [p.mode === 'string' ? '糸の張力' : '軸力（負は圧縮）', s.extra.tension, 'N'], ['小角近似の周期', s.extra.periodSmall, 's']];
    case 'coupledPendulum': return [['振り子1の K＋Ug', s.extra.E1, 'J'], ['振り子2の K＋Ug', s.extra.E2, 'J'], ['連結ばねの弾性エネルギー', s.extra.spring, 'J']];
    case 'elasticPendulum': return [['ばねの長さ', s.extra.radius, 'm'], ['伸び', s.extra.extension, 'm'], ['角度', s.extra.angle, '°']];
    case 'conveyor': return [['A−ベルトの相対速度', s.extra.slip, 'm/s'], ['Aが受ける摩擦力', s.extra.friction, 'N'], ['滑り／追従の切替回数', s.extra.transitions, '回']];
    case 'relative': return [['車から見た水平位置', s.extra.relativeX, 'm'], ['車から見た水平速度', s.extra.relativeV, 'm/s'], ['車系の慣性力', s.extra.pseudo, 'N']];
    case 'rotating': return [['回転系の vx′', s.extra.rvx, 'm/s'], ['回転系の vy′', s.extra.rvy, 'm/s'], ['地上系の角運動量', s.extra.angularMomentum, 'kg·m²/s']];
    case 'accelerator': return [['磁束密度', s.extra.field, 'T'], ['曲率半径', s.extra.radius, 'm'], ['RF加速回数', s.extra.kicks, '回']];
    case 'millikan': return [['鉛直速度', s.v[0] * 1e3, 'mm/s'], ['実際の印加電圧', s.extra.voltage, 'V'], ['電荷 q', s.extra.charge, 'C']];
    default: return [];
  }
}
