import { ReactNode } from 'react';

type FlowNodeProps = {
  title: string;
  subtitle?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  pulse?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};

export default function FlowNode({
  title,
  subtitle,
  x,
  y,
  width = 170,
  height = 88,
  pulse = false,
  icon,
  children,
}: FlowNodeProps) {
  return (
    <div
      className={`absolute rounded-2xl border px-4 py-3 ${pulse ? 'iot-node-pulse' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}px`,
        height: `${height}px`,
        transform: 'translate(-50%, -50%)',
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--bg-card) 90%, #0b162d 10%), color-mix(in srgb, var(--bg-card) 92%, #040a16 8%))',
        borderColor: 'color-mix(in srgb, var(--border-color) 70%, #4da3ff 30%)',
        boxShadow: '0 14px 32px rgba(0, 7, 20, 0.32)',
      }}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'rgba(125, 185, 255, 0.12)', border: '1px solid rgba(149, 200, 255, 0.25)' }}
          >
            {icon}
          </span>
        ) : null}
        <p className="text-sm font-bold tracking-wide" style={{ color: 'var(--text-heading)' }}>
          {title}
        </p>
      </div>
      {subtitle ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </p>
      ) : null}
      {children}
    </div>
  );
}
