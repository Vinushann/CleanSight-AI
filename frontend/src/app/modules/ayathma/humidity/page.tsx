'use client';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const humidityTrend = [
  { time: '8am', value: 50 }, { time: '9am', value: 48 }, { time: '10am', value: 52 },
  { time: '11am', value: 55 }, { time: '12pm', value: 65 }, { time: '1pm', value: 62 },
  { time: '2pm', value: 55 }, { time: '3pm', value: 50 }, { time: '4pm', value: 48 },
  { time: '5pm', value: 46 }, { time: '6pm', value: 45 }, { time: '7pm', value: 44 },
  { time: '8pm', value: 45 },
];

const recoveryData = [
  { min: '0', value: 68 }, { min: '3', value: 62 }, { min: '6', value: 56 },
  { min: '9', value: 52 }, { min: '12', value: 49 }, { min: '15', value: 46 },
  { min: '18', value: 45 }, { min: '21', value: 45 },
];

const beforeHum = [{ value: 45 }, { value: 55 }];
const duringHum = [{ value: 68 }, { value: 32 }];
const afterHum = [{ value: 46 }, { value: 54 }];

export default function HumidityPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1 – Before / During / After */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="cs-card lg:col-span-2">
          <p className="cs-card-header text-base">Humidity Change (Before Vs After Cleaning)</p>
          <div className="grid grid-cols-3 gap-6 mt-4">
            {/* Before */}
            <div className="flex flex-col items-center">
              <div className="stage-before w-full mb-4">Before Cleaning</div>
              <p className="text-xs text-gray-400 mb-3">13 03 2026 : 10:34:14</p>
              <div className="relative w-24 h-24 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={beforeHum} cx="50%" cy="50%" innerRadius={30} outerRadius={42} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#3B82F6" />
                      <Cell fill="#DBEAFE" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-blue-600">45%</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Relative Humidity</p>
              <div className="badge-good text-xs mt-2">Normal</div>
            </div>

            {/* During */}
            <div className="flex flex-col items-center">
              <div className="stage-during w-full mb-4">During Cleaning</div>
              <p className="text-xs text-gray-400 mb-3">13 03 2026 : 13:45:02</p>
              <div className="relative w-24 h-24 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={duringHum} cx="50%" cy="50%" innerRadius={30} outerRadius={42} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#F97316" />
                      <Cell fill="#FED7AA" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-orange-500">68%</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Peak Humidity</p>
              <div className="badge-moderate text-xs mt-2">Elevated</div>
            </div>

            {/* After */}
            <div className="flex flex-col items-center">
              <div className="stage-after w-full mb-4">After Cleaning</div>
              <p className="text-xs text-gray-400 mb-3">13 03 2026 : 14:00:00</p>
              <div className="relative w-24 h-24 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={afterHum} cx="50%" cy="50%" innerRadius={30} outerRadius={42} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#16A34A" />
                      <Cell fill="#DCFCE7" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-extrabold text-green-600">46%</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Recovered</p>
              <div className="badge-good text-xs mt-2">Normal</div>
            </div>
          </div>
        </div>

        {/* Side cards */}
        <div className="flex flex-col gap-5">
          <div className="cs-card">
            <p className="cs-card-header">Current Humidity</p>
            <p className="text-[11px] text-gray-400">Last Update : 02:23 PM</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-extrabold text-purple-700">46</span>
              <span className="text-xl font-bold text-purple-700">%</span>
              <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full ml-2">↑ 2.2%</span>
            </div>
            <div className="badge-good w-full text-center justify-center mt-3">Normal Range</div>
          </div>

          <div className="cs-card">
            <p className="cs-card-header">Recovery Time</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-3xl font-extrabold text-green-600">15</span>
              <span className="text-sm text-gray-500">minutes</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">From 68% peak → 46% normal</p>
            <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <p className="text-[10px] text-green-600 font-medium mt-1">✓ Fully recovered</p>
          </div>
        </div>
      </div>

      {/* Row 2: Humidity Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="cs-card">
          <div className="flex justify-between items-center">
            <p className="cs-card-header">Humidity Trend</p>
            <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">1h ⌄</span>
          </div>
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={humidityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[30, 80]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 4, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cs-card">
          <p className="cs-card-header">Humidity Recovery Curve</p>
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recoveryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="min" tick={{ fontSize: 10, fill: '#9CA3AF' }} label={{ value: 'Minutes', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[40, 75]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', r: 4, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
