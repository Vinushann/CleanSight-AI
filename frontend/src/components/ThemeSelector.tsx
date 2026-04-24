'use client';
import { useState, useRef, useEffect } from 'react';
import { Palette, Check, ChevronDown } from 'lucide-react';
import { useTheme, themeOptions, ThemeKey } from '@/core/ThemeContext';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = themeOptions.find(t => t.key === theme)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="theme-selector-btn"
        aria-label="Select theme"
      >
        <Palette size={15} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="theme-selector-dropdown">
          {themeOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setTheme(opt.key); setOpen(false); }}
              className={`theme-selector-option ${theme === opt.key ? 'active' : ''}`}
            >
              <div className="flex-1 text-left">
                <p className="theme-option-label">{opt.label}</p>
                <p className="theme-option-desc">{opt.description}</p>
              </div>
              {theme === opt.key && <Check size={16} className="theme-option-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
