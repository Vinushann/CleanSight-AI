'use client';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Mock data
const gasTrend = [
  { time: '8am', value: 88 }, { time: '9am', value: 92 }, { time: '10am', value: 85 },
  { time: '11am', value: 90 }, { time: '12pm', value: 88 }, { time: '1pm', value: 95 },
  { time: '2pm', value: 87 }, { time: '3pm', value: 92 }, { time: '4pm', value: 90 },
  { time: '5pm', value: 85 }, { time: '6pm', value: 88 }, { time: '7pm', value: 91 },
];
const monthlyPM = [
  { month: 'Jan', pm10: 40, pm25: 65 }, { month: 'Feb', pm10: 45, pm25: 70 },
  { month: 'Mar', pm10: 50, pm25: 80 }, { month: 'Apr', pm10: 55, pm25: 95 },
  { month: 'May', pm10: 35, pm25: 60 }, { month: 'Jun', pm10: 30, pm25: 50 },
  { month: 'Jul', pm10: 45, pm25: 75 }, { month: 'Aug', pm10: 50, pm25: 85 },
  { month: 'Sep', pm10: 35, pm25: 55 }, { month: 'Oct', pm10: 25, pm25: 40 },
];

const beforeDust = [{ value: 72.02 }, { value: 27.98 }];
const duringDust = [{ value: 85.5 }, { value: 14.5 }];
const afterDust = [{ value: 24.5 }, { value: 75.5 }];

export default function DustSensorPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Before vs During vs After */}
      <div className="cs-card">
        <p className="cs-card-header text-base">Dust Quality Improvement (Before Vs After Cleaning)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          {/* Before Cleaning */}
          <div className="flex flex-col items-center">
            <div className="stage-before w-full mb-4">Before Cleaning</div>
            <p className="text-xs text-gray-400 mb-1">Timestamp</p>
            <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 10:34:14</p>
            <p className="text-xs text-gray-500 text-center mb-4">Dust Pollution<br/>Current air borne particle<br/>concentration detected in the room</p>
            <div className="relative w-28 h-28 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={beforeDust} cx="50%" cy="50%" innerRadius={35} outerRadius={48} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    <Cell fill="#EAB308" />
                    <Cell fill="#FEF9C3" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold text-yellow-600">72.02%</span>
                <span className="text-[10px] text-gray-400">Dust<br/>Pollution</span>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Dust Level</p>
                <p className="text-[10px] text-gray-500">120 µg/m³</p>
                <div className="w-16 h-2 rounded-full bg-blue-500 mt-1"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Safe Dust Limit</p>
                <p className="text-[10px] text-gray-500">50 µg/m³</p>
                <div className="w-16 h-2 rounded-full bg-green-500 mt-1"></div>
              </div>
            </div>
          </div>

          {/* During Cleaning */}
          <div className="flex flex-col items-center">
            <div className="stage-during w-full mb-4">During Cleaning</div>
            <p className="text-xs text-gray-400 mb-1">Timestamp</p>
            <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 13:45:02</p>
            <p className="text-xs text-gray-500 text-center mb-4">Air Dust Concentration<br/>PM2.5 concentration in the room air</p>
            <div className="relative w-28 h-28 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={duringDust} cx="50%" cy="50%" innerRadius={35} outerRadius={48} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    <Cell fill="#DC2626" />
                    <Cell fill="#FEE2E2" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold text-red-600">85.5%</span>
                <span className="text-[10px] text-gray-400">Reduction %</span>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">PM2.5 Level (µg/m³)</p>
                <div className="w-16 h-2 rounded-full bg-red-400 mt-1"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">PM10 Level (µg/m³)</p>
                <div className="w-16 h-2 rounded-full bg-red-600 mt-1"></div>
              </div>
            </div>
          </div>

          {/* After Cleaning */}
          <div className="flex flex-col items-center">
            <div className="stage-after w-full mb-4">After Cleaning</div>
            <p className="text-xs text-gray-400 mb-1">Timestamp</p>
            <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 13:45:02</p>
            <p className="text-xs text-gray-500 text-center mb-4">Air Dust Concentration<br/>PM2.5 concentration in the room air</p>
            <div className="relative w-28 h-28 mb-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={afterDust} cx="50%" cy="50%" innerRadius={35} outerRadius={48} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                    <Cell fill="#16A34A" />
                    <Cell fill="#DCFCE7" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-extrabold text-green-600">24.5%</span>
                <span className="text-[10px] text-gray-400">Reduction %</span>
              </div>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">PM2.5 Level(µg/m³)</p>
                <div className="w-16 h-2 rounded-full bg-green-400 mt-1"></div>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">PM10 Level(µg/m³)</p>
                <div className="w-16 h-2 rounded-full bg-green-600 mt-1"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Gas Sensor + Monthly Seal Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="cs-card">
          <div className="flex justify-between items-center">
            <p className="cs-card-header">Gas Sensor Signal Trend</p>
            <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">1h ⌄</span>
          </div>
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gasTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} domain={[0, 120]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 4, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cs-card">
          <div className="flex justify-between items-center">
            <p className="cs-card-header">Monthly Particulate Trend</p>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span> PM 1.0</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> PM 2.5</span>
            </div>
          </div>
          <div className="h-52 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyPM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <Tooltip />
                <Bar dataKey="pm10" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="pm25" stroke="#22C55E" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
