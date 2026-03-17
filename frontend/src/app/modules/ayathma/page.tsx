'use client';
import { PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const tempTrend = [
  { time: '8am', value: 88 }, { time: '9am', value: 90 }, { time: '10am', value: 85 },
  { time: '11am', value: 88 }, { time: '12pm', value: 92 }, { time: '1pm', value: 90 },
  { time: '2pm', value: 87 }, { time: '3pm', value: 85 }, { time: '4pm', value: 88 },
  { time: '5pm', value: 90 }, { time: '6pm', value: 86 }, { time: '7pm', value: 85 },
  { time: '8pm', value: 88 },
];

const beforeTemp = [{ value: 30.2 }, { value: 19.8 }];
const afterTemp = [{ value: 26.6 }, { value: 23.4 }];

export default function TemperaturePage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Before vs After */}
        <div className="cs-card lg:col-span-2">
          <p className="cs-card-header text-base">Room Temperature (Before Vs After Cleaning)</p>
          <div className="grid grid-cols-2 gap-8 mt-4">
            {/* Before */}
            <div className="flex flex-col items-center">
              <div className="stage-before w-full mb-4">Before Cleaning</div>
              <p className="text-xs text-gray-400 mb-1">Timestamp</p>
              <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 13:45:02</p>
              <p className="text-xs text-gray-500 text-center mb-4">Room Temperature<br/>Temperature At Start</p>
              <div className="relative w-32 h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={beforeTemp} cx="50%" cy="50%" innerRadius={40} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#EAB308" />
                      <Cell fill="#FEF9C3" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-yellow-600">30.2 °C</span>
                  <span className="text-[10px] text-gray-400">Temperature</span>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="flex flex-col items-center">
              <div className="stage-after w-full mb-4">After Cleaning</div>
              <p className="text-xs text-gray-400 mb-1">Timestamp</p>
              <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 17:07:11</p>
              <p className="text-xs text-gray-500 text-center mb-4">Room Temperature<br/>Temperature Change During Cleaning</p>
              <div className="relative w-32 h-32 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={afterTemp} cx="50%" cy="50%" innerRadius={40} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#EAB308" />
                      <Cell fill="#FEF9C3" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-yellow-600">26.6 °C</span>
                  <span className="text-[10px] text-gray-400">Temperature</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side cards */}
        <div className="flex flex-col gap-5">
          {/* Indoor Temp */}
          <div className="cs-card">
            <p className="cs-card-header">Indoor Temperature °C</p>
            <p className="text-[11px] text-gray-400">Last Update : 02:23 PM</p>
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-4xl font-extrabold text-purple-700">26</span>
              <span className="text-xl font-bold text-purple-700">°C</span>
              <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full ml-2">↓ 5.71%</span>
            </div>
            <div className="badge-good w-full text-center justify-center mt-3">Good</div>
          </div>

          {/* Evaporation Efficiency */}
          <div className="cs-card">
            <p className="cs-card-header">Evaporation Efficiency Monitor</p>
            <p className="text-[11px] text-gray-400">Last Update : 02:23 PM</p>
            <div className="flex items-center justify-between mt-3 gap-4">
              <div className="text-center flex-1">
                <p className="text-[10px] text-gray-400 mb-1">Predicted Rate</p>
                <p className="text-2xl font-extrabold text-gray-800">0.85<sub className="text-xs font-normal text-gray-400">g / min</sub></p>
              </div>
              <div className="w-px h-10 bg-gray-200"></div>
              <div className="text-center flex-1">
                <p className="text-[10px] text-gray-400 mb-1">Actual Rate</p>
                <p className="text-2xl font-extrabold text-gray-800">0.64<sub className="text-xs font-normal text-gray-400">g / min</sub></p>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">Recommended Mode</p>
            <div className="bg-green-100 text-green-700 text-sm font-bold text-center py-1.5 rounded-full mt-1">Heavy Mopping</div>
          </div>
        </div>
      </div>

      {/* Row 2: Room Temperature Trend */}
      <div className="cs-card">
        <div className="flex justify-between items-center">
          <p className="cs-card-header">Room Temperature Trend</p>
          <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">1h ⌄</span>
        </div>
        <div className="h-52 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 120]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 4, stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
