'use client';

export default function HelpHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold cursor-help"
      style={{
        background: 'var(--bg-input)',
        color: 'var(--text-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      ?
    </span>
  );
}
