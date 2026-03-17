'use client';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-purple-800">Settings & Administration</h1>
        <p className="text-gray-500 text-sm">System configuration and user management</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile */}
        <div className="cs-card flex flex-col gap-4">
          <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-2">Profile Details</h3>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input type="text" disabled value="Jane Supervisor" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-700" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Email</label>
            <input type="text" disabled value="supervisor@cleansight.ai" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-700" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Role</label>
            <input type="text" disabled value="Operations Manager" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm text-gray-700" />
          </div>
          <button className="bg-purple-700 text-white rounded-lg py-2.5 font-medium text-sm hover:bg-purple-800 transition-colors mt-2">Edit Profile</button>
        </div>

        {/* Thresholds */}
        <div className="cs-card flex flex-col gap-4">
          <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-2">Sensor Thresholds</h3>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">PM2.5 Alert Threshold</span>
              <span className="font-mono text-purple-700 font-bold">35 µg/m³</span>
            </div>
            <input type="range" className="w-full accent-purple-600" disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">VOC Alert Threshold</span>
              <span className="font-mono text-purple-700 font-bold">100 ppb</span>
            </div>
            <input type="range" className="w-full accent-purple-600" disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">Temperature Max</span>
              <span className="font-mono text-purple-700 font-bold">32 °C</span>
            </div>
            <input type="range" className="w-full accent-purple-600" disabled />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">Humidity Max</span>
              <span className="font-mono text-purple-700 font-bold">70 %</span>
            </div>
            <input type="range" className="w-full accent-purple-600" disabled />
          </div>
          <p className="text-xs text-gray-400 mt-1">Only system administrators can adjust global anomaly thresholds.</p>
        </div>
      </div>
    </div>
  );
}
