type SensorType = 'dht22' | 'mq135' | 'gp2y1010';

type SensorCardProps = {
  sensorType: SensorType;
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: string }>;
  pulse?: boolean;
  x: number;
  y: number;
};

function SensorSvg({ sensorType }: { sensorType: SensorType }) {
  if (sensorType === 'dht22') {
    return (
      <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
        <defs>
          <linearGradient id="dhtBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67b8ff" />
            <stop offset="100%" stopColor="#2c7df4" />
          </linearGradient>
        </defs>
        <rect x="26" y="18" width="68" height="84" rx="14" fill="url(#dhtBody)" />
        <rect x="34" y="30" width="52" height="40" rx="8" fill="rgba(255,255,255,0.22)" />
        <g fill="#dff3ff">
          <circle cx="46" cy="82" r="3.3" />
          <circle cx="60" cy="82" r="3.3" />
          <circle cx="74" cy="82" r="3.3" />
          <circle cx="46" cy="94" r="3.3" />
          <circle cx="60" cy="94" r="3.3" />
          <circle cx="74" cy="94" r="3.3" />
        </g>
        <rect x="42" y="102" width="6" height="12" rx="2" fill="#9fc6ff" />
        <rect x="57" y="102" width="6" height="12" rx="2" fill="#9fc6ff" />
        <rect x="72" y="102" width="6" height="12" rx="2" fill="#9fc6ff" />
      </svg>
    );
  }

  if (sensorType === 'mq135') {
    return (
      <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
        <defs>
          <linearGradient id="mqBoard" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f6a543" />
            <stop offset="100%" stopColor="#d46a1f" />
          </linearGradient>
        </defs>
        <rect x="20" y="24" width="80" height="72" rx="16" fill="#11304f" stroke="#67b8ff" strokeWidth="3" />
        <circle cx="60" cy="58" r="22" fill="url(#mqBoard)" />
        <circle cx="60" cy="58" r="10" fill="#ffe3b8" />
        <path d="M30 96h60" stroke="#7bc2ff" strokeWidth="4" strokeLinecap="round" />
        <rect x="34" y="96" width="6" height="14" rx="2" fill="#8bc8ff" />
        <rect x="48" y="96" width="6" height="14" rx="2" fill="#8bc8ff" />
        <rect x="62" y="96" width="6" height="14" rx="2" fill="#8bc8ff" />
        <rect x="76" y="96" width="6" height="14" rx="2" fill="#8bc8ff" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
      <defs>
        <linearGradient id="dustBoard" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7f8fff" />
          <stop offset="100%" stopColor="#5268ff" />
        </linearGradient>
      </defs>
      <rect x="18" y="28" width="84" height="58" rx="14" fill="#132744" stroke="#7caeff" strokeWidth="3" />
      <rect x="32" y="40" width="34" height="18" rx="5" fill="#d5e7ff" opacity="0.85" />
      <circle cx="80" cy="57" r="13" fill="url(#dustBoard)" />
      <path d="M78 20v12M88 20v12" stroke="#a7c6ff" strokeWidth="4" strokeLinecap="round" />
      <rect x="30" y="86" width="8" height="18" rx="2" fill="#9fc6ff" />
      <rect x="46" y="86" width="8" height="18" rx="2" fill="#9fc6ff" />
      <rect x="62" y="86" width="8" height="18" rx="2" fill="#9fc6ff" />
      <rect x="78" y="86" width="8" height="18" rx="2" fill="#9fc6ff" />
    </svg>
  );
}

export default function SensorCard({ sensorType, title, subtitle, values, pulse = false, x, y }: SensorCardProps) {
  return (
    <div
      className={`absolute rounded-2xl border p-4 ${pulse ? 'iot-node-pulse' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: '244px',
        transform: 'translate(-50%, -50%)',
        background:
          'radial-gradient(circle at top left, rgba(77,163,255,0.14), transparent 38%), linear-gradient(160deg, color-mix(in srgb, var(--bg-card) 88%, #12203a 12%), color-mix(in srgb, var(--bg-card) 95%, #070d18 5%))',
        borderColor: 'color-mix(in srgb, var(--border-color) 62%, #4da3ff 38%)',
        boxShadow: '0 14px 34px rgba(0, 8, 24, 0.34)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            border: '1px solid rgba(130, 184, 255, 0.2)',
          }}
        >
          <SensorSvg sensorType={sensorType} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-wide" style={{ color: 'var(--text-heading)' }}>
            {title}
          </p>
          <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {values.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(125, 170, 255, 0.08)',
            }}
          >
            <span className="font-medium uppercase tracking-[0.16em]" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
