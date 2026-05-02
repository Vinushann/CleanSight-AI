'use client';

import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  CircuitBoard,
  Cloud,
  Cpu,
  Database,
  HelpCircle,
  LayoutDashboard,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Thermometer,
  TrendingUp,
  Waves,
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
    title: 'Start a session',
    text: 'Open Controller, enter House ID, Room ID, and session stage (`before`, `during`, or `after`), then start collection.',
    icon: Radio,
  },
  {
    title: 'Verify live flow',
    text: 'Go to Realtime and confirm sensor packets move from sensors to ESP32, then through Backend API and Firebase.',
    icon: Activity,
  },
  {
    title: 'Check health',
    text: 'Open Device Health Monitor to validate ESP32 status and detect sensor issues like repeated zero dust readings.',
    icon: ShieldCheck,
  },
  {
    title: 'Read predictions',
    text: 'Use Edge AI Analytics to inspect cleanliness trend, anomaly rate, prediction drift, and forecast behavior.',
    icon: Sparkles,
  },
];

const sections: DocSection[] = [
  {
    id: 'sensors-models',
    title: 'Sensors and Models',
    eyebrow: 'Hardware and TinyML stack',
    icon: BrainCircuit,
    body: 'CleanSight IoT uses three physical sensors and three TinyML models on the ESP32. Raw sensor values and model outputs are stored together for analytics.',
    items: [
      {
        title: 'DHT22 (temperature + humidity)',
        text: 'Captures ambient temperature and relative humidity. These values are used in health checks and model feature inputs.',
      },
      {
        title: 'MQ-135 (air quality)',
        text: 'Captures gas/air-quality signal used in the anomaly and cleanliness context.',
      },
      {
        title: 'GP2Y1010 (dust)',
        text: 'Captures particulate dust concentration used for real-time warnings and forecast analysis.',
      },
      {
        title: 'Cleanliness classifier model',
        text: 'Embedded model exported as `cleanliness_classifier_model.h` (`cleanliness_classifier.tflite`) to estimate cleanliness score/status.',
      },
      {
        title: 'Anomaly detector model',
        text: 'Embedded model exported as `anomaly_detector_model.h` (`anomaly_detector.tflite`) to classify normal vs anomaly behavior.',
      },
      {
        title: 'Dust forecaster model',
        text: 'Embedded model exported as `dust_forecaster_model.h` (`dust_forecaster.tflite`) to predict next dust behavior.',
      },
    ],
  },
  {
    id: 'data-flow',
    title: 'Data Flow',
    eyebrow: 'End-to-end pipeline',
    icon: TrendingUp,
    body: 'The IoT pipeline moves both raw sensor readings and prediction payloads together so the dashboard can interpret real-time and historical behavior.',
    items: [
      {
        title: 'Sensors -> ESP32',
        text: 'DHT22, MQ-135, and GP2Y1010 readings are collected by ESP32. TinyML inference runs on-device to produce prediction fields.',
      },
      {
        title: 'ESP32 -> Backend API',
        text: 'ESP32 sends sensor values plus model outputs (`cleanliness`, `anomaly`, `next_dust`, model metadata) to ingestion endpoints.',
      },
      {
        title: 'Backend API -> Firebase',
        text: 'Backend validates and stores session + reading documents in Firebase, preserving stage (`before/during/after`) and model fields.',
      },
      {
        title: 'Firebase -> Dashboard',
        text: 'Realtime, Device Health, and Edge AI Analytics pages read this stored data to render live status, health logic, and prediction charts.',
      },
    ],
  },
  {
    id: 'controller',
    title: 'Controller',
    eyebrow: 'Session control page',
    icon: Radio,
    body: 'Controller is the entry point for IoT collection. It defines the session context used by all other IoT pages.',
    items: [
      {
        title: 'Required fields',
        text: 'House ID, Room ID, and Session Type are mandatory. Session Type must be `before`, `during`, or `after`.',
      },
      {
        title: 'Start and stop',
        text: 'Start creates the active session. Stop closes it. The status panel always displays current session metadata.',
      },
      {
        title: 'Conflict protection',
        text: 'When a session is active, controls are locked and the page attempts to recover existing active context after refresh.',
      },
      {
        title: 'Why this matters',
        text: 'Stage labels from Controller are later used in Edge AI Analytics for before/during/after comparisons.',
      },
    ],
  },
  {
    id: 'realtime',
    title: 'Realtime',
    eyebrow: 'Live packet visualization',
    icon: Activity,
    body: 'Realtime shows packets moving through the architecture and confirms whether live collection is healthy.',
    items: [
      {
        title: 'Live path view',
        text: 'Shows connectors from sensors to ESP32, then to Backend API, Firebase, and Dashboard nodes.',
      },
      {
        title: 'Sensor cards',
        text: 'Displays latest Temp, Humidity, AQ, and Dust values with visual pulse when new readings arrive.',
      },
      {
        title: 'Prediction stream',
        text: 'ESP32 stage includes model prediction payload movement beyond raw sensor values.',
      },
      {
        title: 'Operational read',
        text: 'Use status chips (`Live collecting`, `Waiting for readings`, `Stopped`) to quickly diagnose flow state.',
      },
    ],
  },
  {
    id: 'edge-ai-analytics',
    title: 'Edge AI Analytics',
    eyebrow: 'Prediction interpretation',
    icon: Sparkles,
    body: 'Edge AI Analytics converts stored prediction data into decision-ready charts and model explanations.',
    items: [
      {
        title: 'Primary outputs',
        text: 'Shows latest cleanliness score, next predicted cleanliness, predicted dust, anomaly pressure, and drift indicators.',
      },
      {
        title: 'Core charts',
        text: 'Prediction drift timeline, stage-by-stage model behavior, forecast risk map, and status distribution.',
      },
      {
        title: 'Model explanations',
        text: 'Surfaces stored `prediction_reason` and `anomaly_reason` text to explain why model outputs were produced.',
      },
      {
        title: 'Stage intelligence',
        text: 'Before/During/After groupings reveal whether cleaning interventions improved predicted and actual outcomes.',
      },
    ],
  },
  {
    id: 'device-health-monitor',
    title: 'Device Health Monitor',
    eyebrow: 'Hardware reliability checks',
    icon: Cpu,
    body: 'Device Health Monitor validates the ESP32 and sensor stream quality for the active session.',
    items: [
      {
        title: 'Component status cards',
        text: 'Independent status for ESP32, DHT22, MQ135, and GP2Y1010 using current reading validity.',
      },
      {
        title: 'Dust zero watch',
        text: 'Inspects recent dust readings and warns when repeated zeros suggest a stuck dust sensor path.',
      },
      {
        title: 'Latest snapshot',
        text: 'Shows latest packet values for temperature, humidity, air quality, and dust in one operational panel.',
      },
      {
        title: 'Recent alerts',
        text: 'Lists validation/duplicate alerts from backend notification services for quick triage.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    eyebrow: 'Operations and admin tooling',
    icon: Settings,
    body: 'Settings provides operational controls for exports, retention, diagnostics, and connectivity.',
    items: [
      {
        title: 'System status',
        text: 'Shows API health, backend URL, and Firestore connectivity state.',
      },
      {
        title: 'Export utilities',
        text: 'Exports the active session readings to CSV/JSON for offline analysis.',
      },
      {
        title: 'Notification and retention controls',
        text: 'Configures local notification behavior and data retention preferences.',
      },
      {
        title: 'Recovery actions',
        text: 'Includes test notification generation and Firebase reconnect actions for ops troubleshooting.',
      },
    ],
  },
];

function SectionCard({ section, index }: { section: DocSection; index: number }) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-lg border p-5"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
            style={{
              background: 'var(--bg-active)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border-active)',
            }}
          >
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
          <div
            key={item.title}
            className="rounded-lg border p-4"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}
          >
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

const architectureItems = [
  {
    label: 'Sensors',
    text: 'DHT22, MQ-135, GP2Y1010',
    icon: CircuitBoard,
  },
  {
    label: 'Edge compute',
    text: 'ESP32 + TinyML runtime',
    icon: Cpu,
  },
  {
    label: 'API',
    text: 'Ingestion + validation',
    icon: Cloud,
  },
  {
    label: 'Storage',
    text: 'Firebase sessions/readings',
    icon: Database,
  },
  {
    label: 'Analytics UI',
    text: 'Realtime + Edge AI charts',
    icon: BarChart3,
  },
];

export default function IoTHelpPage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section
        id="overview"
        className="rounded-lg border p-6"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 92%, var(--bg-main) 8%) 0%, var(--bg-card) 100%)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: 'var(--bg-active)',
                color: 'var(--text-accent)',
                border: '1px solid var(--border-active)',
              }}
            >
              <BookOpen size={14} />
              CleanSight IoT Documentation
            </div>
            <h1 className="mt-4 text-3xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
              Help & Documentation
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              This guide follows the same dashboard documentation design and focuses only on the IoT stack:
              Controller, Realtime, Edge AI Analytics, Device Health Monitor, and Settings, including sensors,
              TinyML models, and full data flow.
            </p>
          </div>
          <div
            className="grid min-w-[220px] gap-2 rounded-lg border p-4 text-sm"
            style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}
          >
            <div className="flex items-center gap-2 font-bold" style={{ color: 'var(--text-heading)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--badge-good-text)' }} />
              Recommended workflow
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>
              Start session, verify realtime flow, check health, inspect Edge AI predictions, then manage exports/settings.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <nav
            className="rounded-lg border p-3"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}
            aria-label="IoT documentation table of contents"
          >
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
              Contents
            </p>
            <div className="grid gap-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Icon size={15} style={{ color: 'var(--accent-primary)' }} />
                    {section.title}
                  </a>
                );
              })}
              <a
                href="#architecture"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <BarChart3 size={15} style={{ color: 'var(--accent-primary)' }} />
                Architecture Snapshot
              </a>
              <a
                href="#overview"
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <HelpCircle size={15} style={{ color: 'var(--accent-primary)' }} />
                Page Overview
              </a>
            </div>
          </nav>
        </aside>

        <div className="flex flex-col gap-6">
          <section
            className="rounded-lg border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
                Quick Start
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickStart.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="rounded-lg border p-4"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={18} style={{ color: 'var(--accent-primary)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                        Step {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {sections.map((section, index) => (
            <SectionCard key={section.id} section={section} index={index} />
          ))}

          <section
            id="architecture"
            className="scroll-mt-24 rounded-lg border p-5"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-card)' }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={20} style={{ color: 'var(--accent-primary)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>
                Architecture Snapshot
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              Reference chain: <strong>Sensors {'->'} ESP32 {'->'} Backend API {'->'} Firebase {'->'} Dashboard</strong>.
              Raw readings and model predictions travel together and are persisted with session context.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {architectureItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border p-4"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} style={{ color: 'var(--accent-primary)' }} />
                      <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                        {item.label}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
