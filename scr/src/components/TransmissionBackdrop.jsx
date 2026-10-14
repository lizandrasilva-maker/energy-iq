import { useMemo } from "react";

// Fundo decorativo: linha de transmissão com torres treliçadas de alta tensão
// (autoportantes, circuito duplo: 3 braços de cada lado + cabo para-raios),
// em perspectiva até o horizonte, com cabos em catenária.
// Puramente decorativo: aria-hidden, sem interação, traço de 1 px.

const W = 1600, GROUND = 560;

// Torres da mais próxima (direita) para a mais distante (esquerda)
const TOWERS = [
  { x: 1430, s: 1.0 },
  { x: 1060, s: 0.7 },
  { x: 800, s: 0.5 },
  { x: 615, s: 0.36 },
  { x: 485, s: 0.26 },
  { x: 393, s: 0.19 },
];
const H = 430; // altura da torre na escala 1

/** Geometria de uma torre em coordenadas absolutas. */
function tower({ x, s }) {
  // Perspectiva: quanto mais longe (menor escala), mais alta a base, rumo ao horizonte
  const base = GROUND - (1 - s) * 150;
  const y = (h) => base - h * H * s; // altura relativa (0–1) → y
  const lines = [];
  const L = (x1, y1, x2, y2) => lines.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);

  // Meia-largura do corpo em função da altura (base larga, cintura, topo estreito)
  const half = (h) => {
    if (h <= 0.58) return (70 - (70 - 16) * (h / 0.58)) * s;
    if (h <= 0.92) return (16 - (16 - 9) * ((h - 0.58) / 0.34)) * s;
    return 9 * s * (1 - (h - 0.92) / 0.08) + 2 * s;
  };

  // Pernas
  const levels = [0, 0.08, 0.17, 0.27, 0.38, 0.48, 0.58, 0.66, 0.74, 0.82, 0.92];
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i], b = levels[i + 1];
    L(x - half(a), y(a), x - half(b), y(b));
    L(x + half(a), y(a), x + half(b), y(b));
    // Treliça: horizontal + X em cada painel
    L(x - half(b), y(b), x + half(b), y(b));
    L(x - half(a), y(a), x + half(b), y(b));
    L(x + half(a), y(a), x - half(b), y(b));
  }
  // Pico do para-raios
  L(x - half(0.92), y(0.92), x, y(1));
  L(x + half(0.92), y(0.92), x, y(1));

  // Braços (3 de cada lado): altura, comprimento a partir do corpo
  const arms = [
    { h: 0.62, len: 92 },
    { h: 0.74, len: 112 },
    { h: 0.86, len: 92 },
  ];
  const tips = [];
  for (const { h, len } of arms) {
    const top = y(h), bottom = y(h - 0.035);
    for (const dir of [-1, 1]) {
      const bx = x + dir * half(h), tx = x + dir * (half(h) + len * s);
      L(bx, top, tx, top); // banzo superior
      L(x + dir * half(h - 0.035), bottom, tx, top); // banzo inferior (mísula)
      // diagonais do braço
      const mid = bx + (tx - bx) * 0.5;
      L(bx, bottom, mid, top);
      // isolador pendurado na ponta
      const ins = 22 * s;
      L(tx, top, tx, top + ins);
      tips.push({ x: tx, y: top + ins, arm: `${h}:${dir}` });
    }
  }
  // Para-raios no pico
  tips.push({ x, y: y(1), arm: "top" });
  return { d: lines.join(""), tips };
}

/** Cabo em catenária aproximada (curva quadrática com flecha proporcional ao vão). */
function span(a, b, sag) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${mx.toFixed(1)} ${(my + sag).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export default function TransmissionBackdrop({ className = "" }) {
  const { towers, cables } = useMemo(() => {
    const built = TOWERS.map(tower);
    const cables = [];
    for (let i = 0; i < built.length - 1; i++) {
      const near = built[i], far = built[i + 1];
      near.tips.forEach((tip, k) => {
        const other = far.tips[k];
        const sag = Math.abs(tip.x - other.x) * 0.06 * (tip.arm === "top" ? 0.6 : 1);
        cables.push(span(tip, other, sag));
      });
    }
    // Cabos saindo da torre mais próxima para fora da tela (à direita)
    built[0].tips.forEach((tip) => {
      cables.push(span(tip, { x: W + 40, y: tip.y + 40 }, 30));
    });
    return { towers: built.map((t) => t.d), cables };
  }, []);

  return (
    <svg
      className={`pointer-events-none select-none ${className}`}
      viewBox={`0 0 ${W} ${GROUND + 4}`}
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {cables.map((d, i) => (
          <path key={`c${i}`} d={d} strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        ))}
        {towers.map((d, i) => (
          <path key={`t${i}`} d={d} strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
