type DataBubbleProps = {
  label: string;
  valueText: string;
  x: number;
  y: number;
  color: string;
};

export default function DataBubble({ label, valueText, x, y, color }: DataBubbleProps) {
  return (
    <div
      className="absolute rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        background: color,
        color: '#f8fbff',
        border: '1px solid rgba(255,255,255,0.26)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
        transition: 'left 720ms cubic-bezier(0.22, 1, 0.36, 1), top 720ms cubic-bezier(0.22, 1, 0.36, 1)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}: {valueText}
    </div>
  );
}

