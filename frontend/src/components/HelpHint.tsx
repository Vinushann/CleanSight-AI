'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';

export default function HelpHint({ text }: { text: string }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, caretLeft: 160 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 32);
      const center = rect.left + rect.width / 2;
      const left = Math.min(Math.max(center, 16 + width / 2), window.innerWidth - 16 - width / 2);
      const top = Math.max(16, rect.top - 12);
      const caretLeft = Math.min(Math.max(center - (left - width / 2), 18), width - 18);

      setPosition({ left, top, width, caretLeft });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <span
      className="relative z-20 inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={text}
        aria-describedby={open ? id : undefined}
        className="help-hint-trigger inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold cursor-help transition-all duration-200 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
        style={{
          background: 'var(--help-hint-bg)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--help-hint-border)',
          boxShadow: 'var(--help-hint-shadow)',
        }}
      >
        ?
      </button>

      {mounted && open
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[120] -translate-x-1/2 -translate-y-full rounded-2xl px-4 py-3 text-[13px] leading-5 shadow-2xl"
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                background: 'var(--help-tooltip-bg)',
                color: 'var(--help-tooltip-text)',
                border: '1px solid var(--help-tooltip-border)',
                boxShadow: 'var(--help-tooltip-shadow)',
                backdropFilter: 'blur(18px) saturate(140%)',
              }}
            >
              {text}
              <span
                aria-hidden="true"
                className="absolute bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 rounded-[3px]"
                style={{
                  left: position.caretLeft,
                  background: 'var(--help-tooltip-caret-bg)',
                  borderRight: '1px solid var(--help-tooltip-border)',
                  borderBottom: '1px solid var(--help-tooltip-border)',
                }}
              />
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
