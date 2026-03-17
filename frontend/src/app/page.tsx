'use client';
import { PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// --- Mock Data ---
const dustTrend = [
  { time: '8am', value: 45 }, { time: '9am', value: 60 }, { time: '10am', value: 90 },
  { time: '11am', value: 120 }, { time: '12pm', value: 80 }, { time: '1pm', value: 55 },
  { time: '2pm', value: 40 }, { time: '3pm', value: 35 }, { time: '4pm', value: 50 },
  { time: '5pm', value: 30 }, { time: '6pm', value: 25 }, { time: '7pm', value: 20 },
];

const tempTrend = [
  { time: 'Mon', value: 1.6 }, { time: 'Tue', value: 2.0 }, { time: 'Wed', value: 2.1 },
  { time: 'Thu', value: 2.8 }, { time: 'Fri', value: 3.1 }, { time: 'Sat', value: 2.5 },
  { time: 'Sun', value: 2.5 }, { time: 'Mon2', value: 2.0 }, { time: 'Tue2', value: 4.3 },
];

const humidityData = [
  { day: 'M1', bar: 65, line: 70 }, { day: 'M2', bar: 75, line: 80 },
  { day: 'M3', bar: 90, line: 85 }, { day: 'M4', bar: 100, line: 95 },
  { day: 'M5', bar: 70, line: 75 }, { day: 'M6', bar: 60, line: 65 },
  { day: 'M7', bar: 85, line: 80 }, { day: 'M8', bar: 80, line: 70 },
  { day: 'M9', bar: 50, line: 55 }, { day: 'M10', bar: 40, line: 45 },
];

// Donut chart for Cleaning Score 
const scoreData = [{ value: 85 }, { value: 15 }];
const SCORE_COLORS = ['#16A34A', '#E5E7EB'];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Row 1: Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cleaning Status */}
        <div className="cs-card flex flex-col items-start">
          <p className="cs-card-header">Cleaning Status</p>
          <div className="mt-auto">
            <span className="badge-good text-lg tracking-wide">GOOD</span>
          </div>
        </div>

        {/* Cleaning Score Donut */}
        <div className="cs-card flex flex-col items-center justify-center">
          <p className="cs-card-header self-start">Cleaning Score</p>
          <div className="relative w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scoreData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {scoreData.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] text-gray-400">Percent</span>
              <span className="text-2xl font-extrabold text-green-600">85%</span>
            </div>
          </div>
        </div>

        {/* Next Cleaning Date */}
        <div className="cs-card flex flex-col items-start">
          <p className="cs-card-header">Next Cleaning Date</p>
          <p className="text-2xl font-extrabold text-purple-700 mt-auto">August 22 2026</p>
        </div>
      </div>

      {/* Row 2: Dust Concentration + IAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="cs-card lg:col-span-2">
          <p className="cs-card-header">Dust Concentration Trend (PM2.5 µg/m³)</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dustTrend}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#7C3AED" fill="url(#purpleGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* IAQ Status Card */}
        <div className="cs-card flex flex-col">
          <p className="cs-card-header">Indoor Air Quality Status (AQI)</p>
          <p className="text-[11px] text-gray-400">Last Update : 02:23 PM</p>
          <div className="flex-1 flex flex-col items-center justify-center gap-1 my-3">
            <p className="text-sm text-gray-500 font-medium">IAQ Index</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-purple-700">79</span>
              <span className="text-xs font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">↑ 5.71%</span>
            </div>
          </div>
          <div className="badge-moderate w-full text-center justify-center">Moderate</div>
        </div>
      </div>

      {/* Row 3: Temperature Variation + Humidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Temperature */}
        <div className="cs-card">
          <p className="cs-card-header">Room Temperature Variation (°C)</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tempTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', r: 4, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Humidity */}
        <div className="cs-card">
          <p className="cs-card-header">Relative Humidity Levels (%)</p>
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={humidityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip />
                <Bar dataKey="bar" fill="#A855F7" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="line" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E', r: 3 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: ML Anomaly Detection */}
      <div className="cs-card">
        <p className="cs-card-header">ML Anomaly Detection</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Records Analyzed</span>
              <span className="font-bold text-purple-700">: 4324</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Anomalies Detected</span>
              <span className="font-bold text-red-500">: 1</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Confidence Level</span>
              <span className="font-bold text-green-600">: 97%</span>
            </div>
          </div>
          <div className="md:col-span-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dustTrend}>
                <defs>
                  <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0edf8" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="url(#anomalyGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
