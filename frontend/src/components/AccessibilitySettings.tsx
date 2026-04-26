'use client';

import type { AccessibilityFontSize, AccessibilityPreferences } from '@/core/AccessibilityContext';
import { useAccessibility } from '@/core/AccessibilityContext';

type ToggleKey = Exclude<keyof AccessibilityPreferences, 'fontSize'>;

interface ToggleSetting {
  key: ToggleKey;
  label: string;
  helper: string;
}

const toggleSettings: ToggleSetting[] = [
  {
    key: 'highContrast',
    label: 'High Contrast Mode',
    helper: 'Uses stronger contrast for backgrounds, text, borders, cards, and buttons to support low-vision users.',
  },
  {
    key: 'iconTextLabels',
    label: 'Icon + Text Labels',
    helper: 'Shows text beside icon-only controls and keeps navigation labels visible for users who cannot rely on icons alone.',
  },
  {
    key: 'colorBlindFriendly',
    label: 'Color-Blind Friendly Mode',
    helper: 'Replaces red and green status colors with safer blue and orange tones across charts, badges, alerts, and indicators.',
  },
  {
    key: 'reduceMotion',
    label: 'Reduce Motion / Animation',
    helper: 'Reduces transitions, hover movement, loading animation, and smooth scrolling for motion-sensitive users.',
  },
];

const fontSizeOptions: Array<{ value: AccessibilityFontSize; label: string; helper: string }> = [
  { value: 'small', label: 'Small', helper: 'More content fits on screen.' },
  { value: 'medium', label: 'Medium', helper: 'Default dashboard size.' },
  { value: 'large', label: 'Large', helper: 'Improves readability across the dashboard.' },
];

function ToggleRow({ setting }: { setting: ToggleSetting }) {
  const { preferences, updatePreference } = useAccessibility();
  const enabled = preferences[setting.key];

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{setting.label}</h4>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{setting.helper}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => updatePreference(setting.key, !enabled)}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors"
          style={{
            background: enabled ? 'var(--accent-primary)' : 'var(--border-color)',
            borderColor: enabled ? 'var(--border-active)' : 'var(--border-color)',
          }}
        >
          <span className="sr-only">{enabled ? `Turn off ${setting.label}` : `Turn on ${setting.label}`}</span>
          <span
            className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: enabled ? 'translateX(1.35rem)' : 'translateX(0.2rem)' }}
          />
        </button>
      </div>
      <span className="mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: enabled ? 'var(--bg-active)' : 'var(--bg-card)', color: enabled ? 'var(--text-accent)' : 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  );
}

export default function AccessibilitySettings() {
  const { preferences, updatePreference } = useAccessibility();

  return (
    <section className="cs-card flex flex-col gap-5 lg:col-span-2" aria-labelledby="accessibility-settings-title">
      <div>
        <h3 id="accessibility-settings-title" className="text-base font-semibold pb-2" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>
          Accessibility Settings
        </h3>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tune the dashboard display for readability, safer color cues, clearer controls, and reduced motion. Your choices are saved on this device.
        </p>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Font Size Adjustment</h4>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Applies Small, Medium, or Large text globally across the dashboard. Medium is the default.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Dashboard font size">
          {fontSizeOptions.map((option) => {
            const selected = preferences.fontSize === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => updatePreference('fontSize', option.value)}
                className="rounded-lg border px-3 py-2 text-left transition-colors"
                style={{
                  background: selected ? 'var(--bg-active)' : 'var(--bg-card)',
                  borderColor: selected ? 'var(--border-active)' : 'var(--border-color)',
                  color: selected ? 'var(--text-accent)' : 'var(--text-primary)',
                }}
              >
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-0.5 block text-[11px]" style={{ color: selected ? 'var(--text-accent)' : 'var(--text-muted)' }}>{option.helper}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {toggleSettings.map((setting) => (
          <ToggleRow key={setting.key} setting={setting} />
        ))}
      </div>
    </section>
  );
}
