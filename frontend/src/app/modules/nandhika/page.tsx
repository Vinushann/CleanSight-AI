'use client';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>Settings &amp; Administration</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>System configuration and user management</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile */}
        <div className="cs-card flex flex-col gap-4">
          <h3 className="text-base font-semibold pb-2" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>Profile Details</h3>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Name</label>
            <input type="text" disabled value="Jane Supervisor"
              className="w-full rounded-lg p-2.5 text-sm"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input type="text" disabled value="supervisor@cleansight.ai"
              className="w-full rounded-lg p-2.5 text-sm"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Role</label>
            <input type="text" disabled value="Operations Manager"
              className="w-full rounded-lg p-2.5 text-sm"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
          </div>
          <button
            className="text-white rounded-lg py-2.5 font-medium text-sm transition-colors mt-2"
            style={{ background: 'var(--accent-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
          >
            Edit Profile
          </button>
        </div>

        {/* Thresholds */}
        <div className="cs-card flex flex-col gap-4">
          <h3 className="text-base font-semibold pb-2" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)' }}>Sensor Thresholds</h3>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: 'var(--text-secondary)' }}>PM2.5 Alert Threshold</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>35 µg/m³</span>
            </div>
            <input type="range" className="w-full" style={{ accentColor: 'var(--accent-primary)' }} disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: 'var(--text-secondary)' }}>VOC Alert Threshold</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>100 ppb</span>
            </div>
            <input type="range" className="w-full" style={{ accentColor: 'var(--accent-primary)' }} disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: 'var(--text-secondary)' }}>Temperature Max</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>32 °C</span>
            </div>
            <input type="range" className="w-full" style={{ accentColor: 'var(--accent-primary)' }} disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: 'var(--text-secondary)' }}>Humidity Max</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>70 %</span>
            </div>
            <input type="range" className="w-full" style={{ accentColor: 'var(--accent-primary)' }} disabled />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Only system administrators can adjust global anomaly thresholds.</p>
        </div>
      </div>
    </div>
  );
}
