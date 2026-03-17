'use client';
import { PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const gasTrend = [
  { time: '8am', value: 88 }, { time: '9am', value: 92 }, { time: '10am', value: 85 },
  { time: '11am', value: 90 }, { time: '12pm', value: 88 }, { time: '1pm', value: 95 },
  { time: '2pm', value: 87 }, { time: '3pm', value: 92 }, { time: '4pm', value: 90 },
  { time: '5pm', value: 85 }, { time: '6pm', value: 88 }, { time: '7pm', value: 91 },
];

const anomalyTrend = [
  { day: '24', value: 30000 }, { day: '25', value: 50000 }, { day: '26', value: 60000 },
  { day: '27', value: 40000 }, { day: '28', value: 90000 }, { day: '29', value: 70000 },
  { day: '30', value: 170000 }, { day: '01', value: 110000 },
];

const beforeAQ = [{ value: 75.5 }, { value: 24.5 }];
const afterAQ = [{ value: 24.5 }, { value: 75.5 }];

export default function AirQualityPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Before vs After + Anomaly Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Before vs After */}
        <div className="cs-card lg:col-span-2">
          <p className="cs-card-header text-base">Air Quality Improvement (Before Vs After Cleaning)</p>
          <div className="grid grid-cols-2 gap-8 mt-4">
            {/* Before Cleaning */}
            <div className="flex flex-col items-center">
              <div className="stage-before w-full mb-4">Before Cleaning</div>
              <p className="text-xs text-gray-400 mb-1">Timestamp</p>
              <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 13:45:02</p>
              <p className="text-xs text-gray-500 text-center mb-4">Air Quality Index<br/>Volatile Organic Compound<br/>concentration</p>
              <div className="relative w-28 h-28 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={beforeAQ} cx="50%" cy="50%" innerRadius={35} outerRadius={48} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#DC2626" />
                      <Cell fill="#FEE2E2" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold text-red-600">75.5%</span>
                  <span className="text-[10px] text-gray-400">Air Quality</span>
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">VOC Level (ppm)</p>
                  <div className="w-14 h-2 rounded-full bg-red-400 mt-1"></div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Air Quality Status</p>
                  <div className="w-14 h-2 rounded-full bg-red-600 mt-1"></div>
                </div>
              </div>
            </div>

            {/* After Cleaning */}
            <div className="flex flex-col items-center">
              <div className="stage-after w-full mb-4">After Cleaning</div>
              <p className="text-xs text-gray-400 mb-1">Timestamp</p>
              <p className="text-xs font-semibold text-gray-600 mb-3">13 03 2026 : 13:45:02</p>
              <p className="text-xs text-gray-500 text-center mb-4">Satisfied Value<br/>Satisfied helps us explain</p>
              <div className="relative w-28 h-28 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={afterAQ} cx="50%" cy="50%" innerRadius={35} outerRadius={48} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill="#16A34A" />
                      <Cell fill="#DCFCE7" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold text-green-600">24.5%</span>
                  <span className="text-[10px] text-gray-400">VOC Improvement %</span>
                </div>
              </div>
              <div className="flex gap-4 mt-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">VOC Level (ppm)</p>
                  <div className="w-14 h-2 rounded-full bg-green-400 mt-1"></div>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Air Quality Status</p>
                  <div className="w-14 h-2 rounded-full bg-green-600 mt-1"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Anomaly Detection */}
        <div className="cs-card flex flex-col">
          <div className="flex items-center justify-between">
            <p className="cs-card-header">Air Quality Signal Anomaly Detection</p>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px]">✓</span>
              <span className="text-xs text-gray-500">Status:</span>
              <span className="text-xs font-bold text-green-600">Normal</span>
            </div>
          </div>
          <div className="flex-1 h-40 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={anomalyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(v) => `${v/1000}K`} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6B21A8" strokeWidth={2} dot={{ fill: '#6B21A8', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="text-sm">
              <span className="text-gray-500">Current Signal: </span>
              <span className="font-bold text-purple-700">1239</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Threshold Range: </span>
              <span className="font-bold text-green-600">1100 - 2100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Gas Sensor Signal Trend */}
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
    </div>
  );
}
