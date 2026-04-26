'use client';

import { useEffect, useMemo, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { themeOptions, useTheme } from '@/core/ThemeContext';

type ShortcutItem = {
  keys: string;
  label: string;
  action: () => void;
  group: 'Navigation' | 'Themes' | 'Help';
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="rounded-md px-2 py-1 text-xs font-bold"
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-heading)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.08)',
      }}
    >
      {children}
    </kbd>
  );
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const shortcuts = useMemo<ShortcutItem[]>(
    () => [
      { keys: 'Ctrl + 1', label: 'Go to Overview page', group: 'Navigation', action: () => router.push('/') },
      { keys: 'Ctrl + 2', label: 'Go to Dust page', group: 'Navigation', action: () => router.push('/modules/vishva') },
      {
        keys: 'Ctrl + 3',
        label: 'Go to Air Quality page',
        group: 'Navigation',
        action: () => router.push('/modules/vishva/air-quality'),
      },
      {
        keys: 'Ctrl + 4',
        label: 'Go to Temperature page',
        group: 'Navigation',
        action: () => router.push('/modules/ayathma'),
      },
      {
        keys: 'Ctrl + 5',
        label: 'Go to Temperature page',
        group: 'Navigation',
        action: () => router.push('/modules/ayathma'),
      },
      {
        keys: 'Ctrl + 6',
        label: 'Go to Humidity page',
        group: 'Navigation',
        action: () => router.push('/modules/ayathma/humidity'),
      },
      { keys: 'Ctrl + 7', label: 'Go to CleanSight AI page', group: 'Navigation', action: () => router.push('/chatbot') },
      { keys: 'Ctrl + 8', label: 'Go to Help page', group: 'Navigation', action: () => router.push('/help') },
      {
        keys: 'Opt + 1',
        label: `Switch to ${themeOptions[0].label} theme`,
        group: 'Themes',
        action: () => setTheme(themeOptions[0].key),
      },
      {
        keys: 'Opt + 2',
        label: `Switch to ${themeOptions[1].label} theme`,
        group: 'Themes',
        action: () => setTheme(themeOptions[1].key),
      },
      {
        keys: 'Opt + 3',
        label: `Switch to ${themeOptions[2].label} theme`,
        group: 'Themes',
        action: () => setTheme(themeOptions[2].key),
      },
      { keys: 'Ctrl + /', label: 'Show all keyboard shortcuts', group: 'Help', action: () => setOpen(true) },
    ],
    [router, setTheme]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcutNumber = event.code.startsWith('Digit') ? event.code.replace('Digit', '') : '';
      const targetIsEditable = isEditableTarget(event.target);

      if (event.ctrlKey && event.code === 'Slash') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (targetIsEditable) return;

      const navigationShortcut = shortcuts.find(
        (shortcut) => shortcut.keys.toLowerCase() === `ctrl + ${shortcutNumber}` && event.ctrlKey
      );
      const themeShortcut = shortcuts.find(
        (shortcut) => shortcut.keys.toLowerCase() === `opt + ${shortcutNumber}` && event.altKey
      );
      const matchedShortcut = navigationShortcut || themeShortcut;

      if (!matchedShortcut) return;

      event.preventDefault();
      matchedShortcut.action();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);

  const groupedShortcuts = shortcuts.reduce<Record<ShortcutItem['group'], ShortcutItem[]>>(
    (groups, shortcut) => {
      groups[shortcut.group].push(shortcut);
      return groups;
    },
    { Navigation: [], Themes: [], Help: [] }
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-16"
      style={{ background: 'rgba(15, 23, 42, 0.36)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
      onClick={() => setOpen(false)}
    >
      <section
        className="w-full max-w-3xl rounded-2xl border p-5"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          boxShadow: '0 26px 70px rgba(15, 23, 42, 0.26)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]" style={{ background: 'var(--bg-active)', color: 'var(--text-accent)' }}>
              <Keyboard size={14} />
              Shortcuts
            </div>
            <h2 id="keyboard-shortcuts-title" className="mt-3 text-2xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
              Keyboard shortcuts
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Use these shortcuts to move around CleanSight quickly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-2"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
            aria-label="Close keyboard shortcuts"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {Object.entries(groupedShortcuts).map(([group, groupShortcuts]) => (
            <div key={group} className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                {group}
              </h3>
              <div className="mt-3 grid gap-3">
                {groupShortcuts.map((shortcut) => (
                  <div key={`${shortcut.group}-${shortcut.keys}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {shortcut.label}
                    </span>
                    <ShortcutKey>{shortcut.keys}</ShortcutKey>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
