interface Props {
  data: { label: string; value: number }[];
  height?: number;
  stroke?: string;
  fill?: string;
}

export function Sparkline({ data, height = 80, stroke = "#3b82f6", fill = "rgba(59,130,246,0.12)" }: Props) {
  if (data.length === 0) return null;
  const W = 600, H = height, PAD = 4;
  const max = Math.max(...data.map(d => d.value), 1);
  const step = (W - PAD * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => {
    const x = PAD + i * step;
    const y = H - PAD - (d.value / max) * (H - PAD * 2);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${H - PAD} L${pts[0][0].toFixed(1)},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill={stroke} opacity={i === pts.length - 1 ? 1 : 0} />
      ))}
    </svg>
  );
}
