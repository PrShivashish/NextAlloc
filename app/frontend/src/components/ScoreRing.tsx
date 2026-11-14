import React from 'react';

export function ScoreRing({
  value,
  size = 72,
  stroke = 7,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamped / 100);
  const color =
    clamped >= 80
      ? 'var(--na-status-success-text)'
      : clamped >= 50
        ? 'var(--na-accent)'
        : 'var(--na-status-error-text)';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ? `${label}: ` : 'Score '}${Math.round(clamped)} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--na-well)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-display tabular-nums font-bold text-[var(--na-ink-primary)]"
          style={{ fontSize: size / 4.4 }}
        >
          {Math.round(clamped)}
        </span>
        {label && (
          <span className="text-[11px] font-medium text-[var(--na-ink-secondary)]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
