'use client';

import {
  AlertTriangle,
  BarChart3,
  Beaker,
  BookOpen,
  Bot,
  CalendarDays,
  CheckCircle2,
  Gauge,
  HelpCircle,
  Keyboard,
  LayoutDashboard,
  LineChart,
  Radio,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react';

type DocSection = {
  id: string;
  title: string;
  eyebrow: string;
  icon: typeof LayoutDashboard;
  body: string;
  items: Array<{ title: string; text: string }>;
};

const quickStart = [
  {
    title: 'Choose a date range',
    text: 'Use From and To in the top bar, then press Apply. This refreshes the available houses and rooms for that period.',
    icon: CalendarDays,
  },
  {
    title: 'Select house, room, and session',
    text: 'Pick a house, room, and either All Sessions or a specific stage: Before, During, or After.',
    icon: SlidersHorizontal,
  },
  {
    title: 'Run Search',
    text: 'Search loads the dashboard visualization data and locks the active analysis context into the context bar.',
    icon: Search,
  },
  {
    title: 'Read charts left to right',
    text: 'Start with summary cards, then trends, insights, stage comparisons, session drill-downs, and assistant explanations.',
    icon: LineChart,
  },
];

const demoVideoUrl = '/api/help/demo-video';

const sections: DocSection[] = [
  {
    id: 'overview',
    title: 'Overview Page',
    eyebrow: 'Start here',
    icon: LayoutDashboard,
    body: 'The Overview page is the main control room for comparing dust, air quality, temperature, and humidity across a selected house, room, session stage, and date range.',
    items: [
      {
        title: 'Start state',
        text: 'When no data is loaded, the page asks you to choose filters from the top bar or use See Latest Cleaning Session. That button loads the newest available cleaning-session data using all session stages.',
      },
      {
        title: 'Metric cards',
        text: 'Dust and Air Quality show the latest value for the current range. Selecting either card changes the focused metric used by the Overview Trend and Insight Summary. Anomaly Signals counts suspicious sensor points. Decision Output summarizes cleaning effectiveness and recommended action.',
      },
      {
        title: 'Overview Trend chart',
        text: 'This multi-line chart compares Dust, Air Quality, Temperature, and Humidity over time. The boldest line follows the selected metric. Use the legend to identify each metric, hover for exact values, and drag the brush at the bottom to narrow the time window.',
      },
      {
        title: 'Insight Summary',
        text: 'This panel converts chart movement into plain-language interpretation. It reports whether the selected metric improved after cleaning, the before/during/after values, suspicious points, active stage filter, and selected-room comparison against the house average.',
      },
      {
        title: 'Stage comparison charts',
        text: 'Before / During / After Comparison shows dust averages by cleaning stage. Air Quality Stage Comparison does the same for air quality. Clicking a dust stage bar filters the linked dashboard view to that stage.',
      },
    ],
  },
  {
    id: 'filters',
    title: 'Global Filters and Context',
    eyebrow: 'Every chart depends on this',
    icon: SlidersHorizontal,
    body: 'The top bar controls the dataset used across the dashboard, sensor pages, and chatbot context.',
    items: [
      {
        title: 'Date Apply vs Search',
        text: 'Apply refreshes the list of available houses and rooms for the chosen date range. Search loads actual visualization data for the selected house, room, and session type.',
      },
      {
        title: 'House and room selectors',
        text: 'House controls the available rooms. If a selected room is not available for a new date or house, the app automatically selects the first valid room.',
      },
      {
        title: 'Session type selector',
        text: 'All Sessions combines before, during, and after readings. Before, During, and After isolate one cleaning stage from the API response.',
      },
      {
        title: 'Persistent context bar',
        text: 'After Search, a sticky context bar shows the applied house, room, session filter, date range, selected stage, drill-down session, and current brush window. Reset View clears stage, brush, and drill-down interactions.',
      },
    ],
  },
  {
    id: 'dust',
    title: 'Dust Sensor Page',
    eyebrow: 'GP2Y1010 sensor analytics',
    icon: Wind,
    body: 'The Dust page focuses only on dust concentration. Dust is lower-is-better, so falling values after cleaning usually indicate improvement.',
    items: [
      {
        title: 'Top metric cards',
        text: 'Latest Dust shows the newest value in PM ug/m3. Average Dust summarizes the current filtered range. Anomaly Points counts high readings or sudden spikes. Condition is based on the P95 dust value against the critical limit.',
      },
      {
        title: 'Dust trend chart',
        text: 'The line chart shows dust movement over time. The X-axis is time, the Y-axis is dust concentration, and the brush narrows the visible time range used by linked panels.',
      },
      {
        title: 'Dust Quality Improvement cards',
        text: 'Before uses yellow to represent baseline caution, During uses red to represent active disturbance or risk, and After uses green to represent cleaner conditions. The circular ring shows dust load or reduction percentage, and the bottom strips show average dust, safe target, current dust, or reduction against the before baseline.',
      },
      {
        title: 'Session-level comparison',
        text: 'This chart compares average dust by individual session, labeled with house, room, and stage. Use it to find which session contributed most to the final result.',
      },
      {
        title: 'Session drill-down',
        text: 'Select a session from the list to update the Selected Session Trend. Sessions with anomalies are marked so operators can inspect them first.',
      },
    ],
  },
  {
    id: 'air-quality',
    title: 'Air Quality Page',
    eyebrow: 'MQ135 gas sensor analytics',
    icon: Beaker,
    body: 'The Air Quality page focuses on air pollution readings. Air quality is lower-is-better in this application.',
    items: [
      {
        title: 'Status interpretation',
        text: 'Readings up to 80 are Good, readings up to 150 are Moderate, and readings above 150 are Poor. Use these labels for quick operational decisions.',
      },
      {
        title: 'Air quality trend',
        text: 'The chart shows air quality index movement over time. A downward after-cleaning pattern is usually positive because it means pollutant concentration reduced.',
      },
      {
        title: 'Air Quality Improvement cards',
        text: 'Before uses red to show the original air load. After uses green to show recovery after cleaning. The circular ring shows air load or improvement, while the strips show AQI average, cleaner-air score, and final status.',
      },
      {
        title: 'Insight and decision panel',
        text: 'This panel explains whether air quality decreased or increased after cleaning and shows the selected room compared with the house baseline.',
      },
    ],
  },
  {
    id: 'temperature-humidity',
    title: 'Temperature and Humidity Pages',
    eyebrow: 'DHT11 environment analytics',
    icon: Thermometer,
    body: 'Temperature and Humidity pages use the same analytics structure as other metric pages, but they focus on indoor comfort and environmental stability.',
    items: [
      {
        title: 'Temperature page',
        text: 'Use this page to inspect how hot or cool the room was before, during, and after cleaning. The condition card compares P95 temperature against the configured limit.',
      },
      {
        title: 'Humidity page',
        text: 'Use this page to inspect relative humidity movement. High humidity can indicate poor drying, ventilation issues, or room conditions that need follow-up.',
      },
      {
        title: 'Shared charts',
        text: 'Both pages include latest, average, anomaly, condition, trend, stage comparison, session-level comparison, session drill-down, and selected-session trend views.',
      },
    ],
  },
  {
    id: 'iot',
    title: 'IoT Collection Page',
    eyebrow: 'Capture sensor sessions',
    icon: Radio,
    body: 'The IoT page starts and stops live collection sessions for a specific house, room, and cleaning stage.',
    items: [
      {
        title: 'Required fields',
        text: 'Enter House ID, Room ID, and Session Type. Session Type must be before, during, or after so the analytics pages can compare cleaning stages correctly.',
      },
      {
        title: 'Start Collect',
        text: 'Start Collect creates a new active collection session. While a session is active, the form is locked so the session metadata cannot drift.',
      },
      {
        title: 'Stop Collect',
        text: 'Stop Collect closes the active session. The Collection Status panel shows current status, active session ID, house, room, and stage.',
      },
      {
        title: 'Recommended collection order',
        text: 'Record Before before cleaning starts, During while cleaning is in progress, and After once cleaning is complete and the room has settled.',
      },
    ],
  },
  {
    id: 'assistant',
    title: 'CleanSight AI',
    eyebrow: 'Ask about the data',
    icon: Bot,
    body: 'CleanSight AI can list cleaned houses, explain trends, compare sessions, investigate anomalies, and suggest next actions using the current dashboard context.',
    items: [
      {
        title: 'Context-aware answers',
        text: 'The assistant receives the selected house, room, session filter, date range, current page, and chart type. Ask questions after Search for the most specific answers.',
      },
      {
        title: 'Inline charts',
        text: 'When CleanSight AI returns a chart payload, the response can include an interactive line chart directly inside the chat message.',
      },
      {
        title: 'Two entry points',
        text: 'Use the CleanSight AI page for a full-height assistant workspace or the floating message button for quick questions while staying on the current dashboard page.',
      },
      {
        title: 'Good prompts',
        text: 'Demo flow: list houses cleaned last week, visualize dust for house "fern" and room "room1", explain the chart from start to finish, explain me in Sinhala, then explain me in Tamil.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings and Themes',
    eyebrow: 'System preferences',
    icon: Settings,
    body: 'Settings currently presents profile details and configured threshold references, while the theme selector changes the dashboard visual style.',
    items: [
      {
        title: 'Profile details',
        text: 'The profile area shows supervisor identity and role information. Current fields are display-only in this version.',
      },
      {
        title: 'Sensor thresholds',
        text: 'Thresholds show PM2.5, VOC, Temperature Max, and Humidity Max references. These are disabled for normal users and indicate administrator-controlled limits.',
      },
      {
        title: 'Theme selector',
        text: 'The palette button in the top bar switches between Clean Minimal, Analytical, and Dark Technical visual themes while preserving the same dashboard behavior.',
      },
    ],
  },
];

const chartRules = [
  {
    title: 'Line charts',
    text: 'Use line charts to understand movement over time. Rising dust or air quality values usually mean conditions are worsening; falling values after cleaning usually mean improvement.',
  },
  {
    title: 'Bar charts',
    text: 'Use bar charts to compare stages or sessions. Taller bars mean higher average readings for that metric.',
  },
  {
    title: 'Circular rings',
    text: 'Use circular rings on improvement cards as a quick percentage summary. The number in the center is the main interpretation, and the strips below provide the supporting values.',
  },
  {
    title: 'Brush control',
    text: 'Drag the brush below a trend chart to focus on a smaller time window. Linked summaries, anomaly counts, and drill-downs update to that window.',
  },
  {
    title: 'Tooltips and legends',
    text: 'Hover a chart to see exact values. Use legends to identify metrics and colored series.',
  },
  {
    title: 'Anomalies',
    text: 'Anomalies are points flagged by metric limits or sudden changes. Treat them as investigation signals, not automatic failures.',
  },
];

const glossary = [
  ['Before', 'Sensor readings recorded before cleaning starts.'],
  ['During', 'Readings captured while cleaning is happening. Values can temporarily spike because particles are disturbed.'],
  ['After', 'Readings captured after cleaning is complete. This is the key stage for final effectiveness.'],
  ['P95', 'The 95th percentile value. It helps identify high-end exposure without relying only on a single maximum.'],
  ['Room vs house baseline', 'The selected room compared with the average for the house. Positive values indicate the room is higher than the house average.'],
  ['Cleaning effectiveness', 'A combined dust and air quality decision that labels cleaning as effective, partially effective, or not effective.'],
];

const keyboardShortcuts = [
  ['Ctrl + 1', 'Go to Overview page'],
  ['Ctrl + 2', 'Go to Dust page'],
  ['Ctrl + 3', 'Go to Air Quality page'],
  ['Ctrl + 4', 'Go to Temperature page'],
  ['Ctrl + 5', 'Go to Temperature page'],
  ['Ctrl + 6', 'Go to Humidity page'],
  ['Ctrl + 7', 'Go to CleanSight AI page'],
  ['Ctrl + 8', 'Go to Help page'],
  ['Opt + 1', 'Switch to Clean Air theme'],
  ['Opt + 2', 'Switch to Clear Contrast theme'],
  ['Opt + 3', 'Switch to Graphite Night theme'],
  ['Ctrl + /', 'Show the shortcut popup from anywhere'],
];

function SectionCard({ section, index }: { section: DocSection; index: number }) {
  const Icon = section.icon;

  return (
    <section id={section.id} className="scroll-mt-24 rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: 'var(--bg-active)', color: 'var(--accent-primary)', border: '1px solid var(--border-active)' }}>
            <Icon size={20} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              {section.eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
              {index + 1}. {section.title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {section.body}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {section.items.map((item) => (
          <div key={item.title} className="rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-lg border p-6" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 92%, var(--bg-main) 8%) 0%, var(--bg-card) 100%)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--bg-active)', color: 'var(--text-accent)', border: '1px solid var(--border-active)' }}>
              <BookOpen size={14} />
              CleanSight AI Product Manual
            </div>
            <h1 className="mt-4 text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
              Help & Documentation
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              This guide explains how to use the complete CleanSight AI dashboard, how to read each chart, how to collect IoT sessions, and how to interpret cleaning effectiveness across dust, air quality, temperature, and humidity.
            </p>
          </div>
          <div className="grid min-w-[220px] gap-2 rounded-lg border p-4 text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text-heading)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--badge-good-text)' }} />
              Recommended workflow
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Filter data, run Search, inspect Overview, open metric pages, then ask the assistant for interpretation.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <nav className="rounded-lg border p-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }} aria-label="Documentation table of contents">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Contents
            </p>
            <div className="grid gap-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    <Icon size={15} style={{ color: 'var(--accent-primary)' }} />
                    {section.title}
                  </a>
                );
              })}
              <a href="#chart-guide" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <BarChart3 size={15} style={{ color: 'var(--accent-primary)' }} />
                Chart Reading Guide
              </a>
              <a href="#keyboard-shortcuts" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <Keyboard size={15} style={{ color: 'var(--accent-primary)' }} />
                Keyboard Shortcuts
              </a>
              <a href="#glossary" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <HelpCircle size={15} style={{ color: 'var(--accent-primary)' }} />
                Glossary
              </a>
            </div>
          </nav>
        </aside>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Quick Start</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickStart.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                    <div className="flex items-center justify-between">
                      <Icon size={18} style={{ color: 'var(--accent-primary)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Step {index + 1}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{step.title}</h3>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{step.text}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                  Demo walkthrough
                </h3>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  Watch the recorded demo to see the recommended workflow from filtering data to reading the dashboard and using the assistant.
                </p>
                <div className="mt-4 grid gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>1. Apply the date range and load a session.</p>
                  <p>2. Review the Overview page and metric pages.</p>
                  <p>3. Use the assistant for explanations and comparisons.</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                <video
                  controls
                  preload="metadata"
                  className="block w-full"
                  style={{ aspectRatio: '16 / 9', background: 'black' }}
                  aria-label="CleanSight AI demo walkthrough video"
                >
                  <source src={demoVideoUrl} type="video/mp4" />
                  Your browser does not support the embedded demo video.
                </video>
              </div>
            </div>
          </section>

          {sections.map((section, index) => (
            <SectionCard key={section.id} section={section} index={index} />
          ))}

          <section id="chart-guide" className="scroll-mt-24 rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2">
              <Gauge size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Chart Reading Guide</h2>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              CleanSight charts are built for comparison: compare time, stages, sessions, and before/after changes before deciding whether a room needs monitoring or recleaning.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {chartRules.map((rule) => (
                <div key={rule.title} className="rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{rule.title}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{rule.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="keyboard-shortcuts" className="scroll-mt-24 rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2">
              <Keyboard size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Keyboard Shortcuts</h2>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              Shortcuts work across the application. Press Ctrl + / at any time to open the shortcut popup above the current page.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              {keyboardShortcuts.map(([keys, description]) => (
                <div key={keys} className="flex items-center justify-between gap-3 rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {description}
                  </span>
                  <kbd className="shrink-0 rounded-md px-2 py-1 text-xs font-bold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-heading)' }}>
                    {keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          <section id="glossary" className="scroll-mt-24 rounded-lg border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} style={{ color: 'var(--accent-tertiary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Glossary and Troubleshooting</h2>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {glossary.map(([term, definition]) => (
                <div key={term} className="rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{term}</h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{definition}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text-heading)' }}>
                <RefreshCw size={16} style={{ color: 'var(--accent-primary)' }} />
                When data does not appear
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                Check the date range first, press Apply, choose an available house and room, then press Search. If charts still do not appear, confirm that IoT sessions exist for the selected house, room, and stage.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
