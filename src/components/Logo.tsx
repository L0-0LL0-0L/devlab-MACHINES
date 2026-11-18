// Diagonal molecular pixel mark + lowercase wordmark.
const CELLS: [number, number][] = [
  [0, 6], [1, 5], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0],
  [2, 6], [4, 4], [6, 2], [0, 4], [4, 0], [3, 5], [5, 3],
];

export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 7 7"
      className={className}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {CELLS.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={0.86} height={0.86} fill="currentColor" opacity={i < 7 ? 1 : 0.55} />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-foreground ${className ?? ""}`}>
      <LogoMark />
      <span className="font-display text-lg font-light tracking-tight">biocode</span>
    </span>
  );
}
