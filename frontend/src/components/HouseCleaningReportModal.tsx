'use client';

import { useState } from 'react';
import { Download, FileText, Mail, Printer, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  METRIC_META,
  metricSummary,
  stageComparisonInsight,
  type AnomalyFlag,
} from '@/core/iotDataUtils';
import type { MetricKey, ReadingPoint, SessionRecord, SessionType, VisualizationPayload } from '@/core/iotTypes';

type ChartRow = ReadingPoint & {
  chartLabel: string;
  chartDateLabel: string;
  ts: number;
};

type StageAverage = {
  stage: SessionType;
  value: number;
};

type CleaningDecision = {
  cleaning_effectiveness: 'effective' | 'partially_effective' | 'not_effective';
  recommended_action: 'monitor' | 'reclean_required' | 'urgent_attention';
};

type HouseCleaningReportModalProps = {
  open: boolean;
  onClose: () => void;
  data: VisualizationPayload;
  rows: ChartRow[];
  dustByStage: StageAverage[];
  airByStage: StageAverage[];
  anomalies: AnomalyFlag[];
  decision: CleaningDecision;
};

const stageColors: Record<SessionType, string> = {
  before: '#EAB308',
  during: '#F97316',
  after: '#22C55E',
};

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function getReportTimeline(sessions: SessionRecord[]) {
  const starts = sessions
    .map((session) => session.start_time || session.created_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));
  const ends = sessions
    .map((session) => session.end_time || session.updated_at)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));

  return {
    start: starts.length ? new Date(Math.min(...starts.map((date) => date.getTime()))).toISOString() : null,
    end: ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))).toISOString() : null,
  };
}

function getStageValue(rows: StageAverage[], stage: SessionType): number {
  return rows.find((row) => row.stage === stage)?.value ?? 0;
}

function getImprovementPercent(before: number, after: number): number | null {
  if (!before || !after) return null;
  return Number((((before - after) / before) * 100).toFixed(1));
}

function buildStageBars(rows: StageAverage[], label: string, color: string): string {
  const chartWidth = 440;
  const chartHeight = 230;
  const left = 54;
  const right = 24;
  const top = 24;
  const bottom = 44;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const barWidth = 58;
  const gap = plotWidth / rows.length;
  const ticks = [0, 0.5, 1].map((ratio) => Number((maxValue * ratio).toFixed(0)));

  return `
    <div class="chart-card">
      <h3>${label}</h3>
      <svg class="report-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${label}">
        <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" rx="14" fill="#ffffff" />
        ${ticks
          .map((tick) => {
            const y = top + plotHeight - (tick / maxValue) * plotHeight;
            return `
              <line x1="${left}" y1="${y}" x2="${chartWidth - right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
              <text x="${left - 10}" y="${y + 4}" text-anchor="end" font-size="10" fill="#64748b">${tick}</text>
            `;
          })
          .join('')}
        <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#94a3b8" stroke-width="1.2" />
        <line x1="${left}" y1="${top + plotHeight}" x2="${chartWidth - right}" y2="${top + plotHeight}" stroke="#94a3b8" stroke-width="1.2" />
        ${rows
          .map((row, index) => {
            const height = Math.max(6, (row.value / maxValue) * plotHeight);
            const x = left + gap * index + gap / 2 - barWidth / 2;
            const y = top + plotHeight - height;
            return `
              <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="8" fill="${stageColors[row.stage] || color}" />
              <text x="${x + barWidth / 2}" y="${Math.max(14, y - 8)}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">${row.value.toFixed(2)}</text>
              <text x="${x + barWidth / 2}" y="${chartHeight - 14}" text-anchor="middle" font-size="12" fill="#334155">${row.stage.toUpperCase()}</text>
            `;
          })
          .join('')}
      </svg>
    </div>
  `;
}

function buildTrendChart(rows: ChartRow[], metric: MetricKey, label: string, color: string): string {
  const values = rows
    .map((row) => Number(row[metric] ?? 0))
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return `
      <div class="chart-card">
        <h3>${label}</h3>
        <div class="empty-chart">Not enough readings to draw a trend.</div>
      </div>
    `;
  }

  const chartWidth = 440;
  const chartHeight = 230;
  const left = 54;
  const right = 24;
  const top = 24;
  const bottom = 42;
  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(maxValue - minValue, 1);
  const maxPoints = 34;
  const sampledRows = rows.filter((_, index) => {
    if (rows.length <= maxPoints) return true;
    return index % Math.ceil(rows.length / maxPoints) === 0 || index === rows.length - 1;
  });
  const sampledValues = sampledRows.map((row) => Number(row[metric] ?? 0));
  const points = sampledValues
    .map((value, index) => {
      const x = left + (index / Math.max(sampledValues.length - 1, 1)) * plotWidth;
      const y = top + plotHeight - ((value - minValue) / range) * plotHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const firstLabel = sampledRows[0]?.chartLabel || '';
  const lastLabel = sampledRows[sampledRows.length - 1]?.chartLabel || '';

  return `
    <div class="chart-card">
      <h3>${label}</h3>
      <svg class="report-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="${label}">
        <rect x="0" y="0" width="${chartWidth}" height="${chartHeight}" rx="14" fill="#ffffff" />
        <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#94a3b8" stroke-width="1.2" />
        <line x1="${left}" y1="${top + plotHeight}" x2="${chartWidth - right}" y2="${top + plotHeight}" stroke="#94a3b8" stroke-width="1.2" />
        <line x1="${left}" y1="${top}" x2="${chartWidth - right}" y2="${top}" stroke="#e5e7eb" stroke-width="1" />
        <line x1="${left}" y1="${top + plotHeight / 2}" x2="${chartWidth - right}" y2="${top + plotHeight / 2}" stroke="#e5e7eb" stroke-width="1" />
        <text x="${left - 10}" y="${top + 4}" text-anchor="end" font-size="10" fill="#64748b">${maxValue.toFixed(0)}</text>
        <text x="${left - 10}" y="${top + plotHeight + 4}" text-anchor="end" font-size="10" fill="#64748b">${minValue.toFixed(0)}</text>
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${sampledValues
          .map((value, index) => {
            if (index !== 0 && index !== sampledValues.length - 1) return '';
            const x = left + (index / Math.max(sampledValues.length - 1, 1)) * plotWidth;
            const y = top + plotHeight - ((value - minValue) / range) * plotHeight;
            return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" />`;
          })
          .join('')}
        <text x="${left}" y="${chartHeight - 12}" text-anchor="start" font-size="11" fill="#334155">${firstLabel}</text>
        <text x="${chartWidth - right}" y="${chartHeight - 12}" text-anchor="end" font-size="11" fill="#334155">${lastLabel}</text>
      </svg>
    </div>
  `;
}

function buildPrintableReportHtml({
  data,
  rows,
  dustByStage,
  airByStage,
  anomalies,
  decision,
}: Omit<HouseCleaningReportModalProps, 'open' | 'onClose'>): string {
  const timeline = getReportTimeline(data.sessions);
  const dustBefore = getStageValue(dustByStage, 'before');
  const dustAfter = getStageValue(dustByStage, 'after');
  const airBefore = getStageValue(airByStage, 'before');
  const airAfter = getStageValue(airByStage, 'after');
  const dustImprovement = getImprovementPercent(dustBefore, dustAfter);
  const airImprovement = getImprovementPercent(airBefore, airAfter);
  const dustSummary = metricSummary(rows, 'dust');
  const airSummary = metricSummary(rows, 'air_quality');
  const temperatureSummary = metricSummary(rows, 'temperature');
  const humiditySummary = metricSummary(rows, 'humidity');
  const generatedAt = new Date().toLocaleString();
  const dustTrendChart = buildTrendChart(rows, 'dust', 'Dust Trend During Cleaning Window', '#2563eb');
  const airTrendChart = buildTrendChart(rows, 'air_quality', 'Air Quality Trend During Cleaning Window', '#0891b2');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Cleaning Completion Report - ${data.house_id} ${data.room_id}</title>
        <style>
          * { box-sizing: border-box; }
          html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; background: #f8fafc; }
          .page { width: 190mm; margin: 0 auto; padding: 9mm 10mm; background: #ffffff; }
          .letterhead { display: grid; grid-template-columns: 78px 1fr; gap: 14px; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
          .leaf { width: 72px; height: 48px; }
          .company { text-align: center; }
          .company h1 { margin: 0; letter-spacing: 5px; font-family: Georgia, serif; font-size: 27px; line-height: 1.05; }
          .company p { margin: 2px 0 0; font-size: 12.5px; font-weight: 700; line-height: 1.25; }
          .title-row { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; margin-top: 18px; }
          .report-title { margin: 0; font-size: 23px; letter-spacing: 1.8px; text-transform: uppercase; }
          .report-chip { border: 1px solid #cbd5e1; border-radius: 999px; padding: 7px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; background: #f8fafc; }
          .muted { color: #475569; font-size: 13px; line-height: 1.45; }
          .section-heading { margin: 18px 0 8px; font-size: 14px; letter-spacing: 1px; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 12px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 12px; }
          .card, .chart-card, .kpi { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; break-inside: avoid; background: #ffffff; }
          .card h3, .chart-card h3, .kpi h3 { margin: 0 0 7px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #334155; }
          .card p { margin: 4px 0; font-size: 12.5px; line-height: 1.35; }
          .kpi .value { font-size: 20px; font-weight: 900; color: #0f172a; }
          .kpi .caption { font-size: 10.5px; color: #64748b; margin-top: 2px; }
          .summary { margin-top: 12px; padding: 14px; border-radius: 14px; background: #ecfdf5; border: 1px solid #86efac; break-inside: avoid; }
          .summary h3 { margin: 0 0 8px; font-size: 16px; }
          .summary p { margin: 7px 0; font-size: 13.5px; line-height: 1.45; }
          .summary strong { text-transform: capitalize; }
          .charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
          .report-chart { width: 100%; height: auto; display: block; }
          .empty-chart { min-height: 160px; display: grid; place-items: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 10px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; break-inside: avoid; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
          th { background: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.6px; }
          .footer { margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10.5px; color: #475569; }
          .page-break { break-before: page; page-break-before: always; }
          @page { size: A4; margin: 10mm; }
          @media print {
            body { background: #ffffff; }
            .page { width: auto; margin: 0; padding: 0; }
            .page-break { break-before: page; page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="letterhead">
            <svg class="leaf" viewBox="0 0 160 100" role="img" aria-label="Fern leaf">
              <path d="M20 80 C58 45, 92 22, 142 10" fill="none" stroke="#059669" stroke-width="9" stroke-linecap="round" />
              ${Array.from({ length: 13 })
                .map((_, index) => {
                  const x = 42 + index * 7;
                  const y = 63 - index * 4;
                  return `<path d="M${x} ${y} L${x - 20} ${y - 12}" stroke="#10b981" stroke-width="5" stroke-linecap="round" />`;
                })
                .join('')}
            </svg>
            <div class="company">
              <h1>FERN JANITORIAL (PVT) LTD</h1>
              <p>Tel. No : 011 5650783 / Fax : 011 2852486</p>
              <p>email : info@fernjanitorial.com</p>
              <p>Web : www.fernjanitorial.com, www.starandfern.com</p>
              <p>78 B1, PAGODA ROAD, NUGEGODA.</p>
            </div>
          </header>

          <section class="title-row">
            <div>
              <h2 class="report-title">Cleaning Completion Report</h2>
              <p class="muted">Generated on ${generatedAt}. This report confirms the cleaning activity recorded by CleanSight AI sensor monitoring for the selected house and room.</p>
            </div>
            <div class="report-chip">Client Report</div>
          </section>

          <h3 class="section-heading">1. Service Location and Timeline</h3>
          <section class="grid">
            <div class="card">
              <h3>Location Details</h3>
              <p><strong>House:</strong> ${data.house_id}</p>
              <p><strong>Room:</strong> ${data.room_id}</p>
              <p><strong>Session filter:</strong> ${data.session_filter || 'All stages'}</p>
              <p><strong>Total sessions:</strong> ${data.sessions.length}</p>
              <p><strong>Total readings:</strong> ${rows.length}</p>
            </div>
            <div class="card">
              <h3>Cleaning Timeline</h3>
              <p><strong>Started:</strong> ${formatDateTime(timeline.start)}</p>
              <p><strong>Ended:</strong> ${formatDateTime(timeline.end)}</p>
              <p><strong>Date range:</strong> ${data.date_from || 'All'} to ${data.date_to || data.date_from || 'All'}</p>
              <p><strong>Device sessions:</strong> ${data.sessions.map((session) => session.session_type).join(', ') || 'Not recorded'}</p>
            </div>
          </section>

          <h3 class="section-heading">2. Cleaning Quality Summary</h3>
          <section class="summary">
            <h3>Cleaning Quality</h3>
            <p>The recorded cleaning is assessed as <strong>${formatLabel(decision.cleaning_effectiveness)}</strong>. Recommended action: <strong>${formatLabel(decision.recommended_action)}</strong>.</p>
            <p>Dust change: ${dustImprovement == null ? 'insufficient before/after data' : `${dustImprovement}% reduction after cleaning`}. Air quality change: ${airImprovement == null ? 'insufficient before/after data' : `${airImprovement}% reduction after cleaning`}.</p>
          </section>

          <section class="kpis">
            <div class="kpi">
              <h3>Dust Avg</h3>
              <div class="value">${dustSummary.average.toFixed(2)}</div>
              <div class="caption">${METRIC_META.dust.unit}</div>
            </div>
            <div class="kpi">
              <h3>Air Quality Avg</h3>
              <div class="value">${airSummary.average.toFixed(2)}</div>
              <div class="caption">${METRIC_META.air_quality.unit}</div>
            </div>
            <div class="kpi">
              <h3>Anomaly Signals</h3>
              <div class="value">${anomalies.length}</div>
              <div class="caption">Sensor review points</div>
            </div>
            <div class="kpi">
              <h3>Readings</h3>
              <div class="value">${rows.length}</div>
              <div class="caption">Total captured points</div>
            </div>
          </section>

          <h3 class="section-heading">3. Before / During / After Evidence</h3>
          <section class="charts">
            ${buildStageBars(dustByStage, 'Dust by Cleaning Stage', '#3b82f6')}
            ${buildStageBars(airByStage, 'Air Quality by Cleaning Stage', '#14b8a6')}
          </section>

          <div class="page-break"></div>

          <h3 class="section-heading">4. Sensor Trend Evidence</h3>
          <section class="charts">
            ${dustTrendChart}
            ${airTrendChart}
          </section>

          <h3 class="section-heading">5. Metric Summary</h3>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Average</th>
                <th>Latest</th>
                <th>Minimum</th>
                <th>Maximum</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Dust</td><td>${dustSummary.average}</td><td>${dustSummary.latest}</td><td>${dustSummary.min}</td><td>${dustSummary.max}</td></tr>
              <tr><td>Air Quality</td><td>${airSummary.average}</td><td>${airSummary.latest}</td><td>${airSummary.min}</td><td>${airSummary.max}</td></tr>
              <tr><td>Temperature</td><td>${temperatureSummary.average}</td><td>${temperatureSummary.latest}</td><td>${temperatureSummary.min}</td><td>${temperatureSummary.max}</td></tr>
              <tr><td>Humidity</td><td>${humiditySummary.average}</td><td>${humiditySummary.latest}</td><td>${humiditySummary.min}</td><td>${humiditySummary.max}</td></tr>
            </tbody>
          </table>

          <h3 class="section-heading">6. Sensor Context and Company Statement</h3>
          <section class="grid">
            <div class="card">
              <h3>Sensor Evidence</h3>
              <p><strong>Anomaly signals:</strong> ${anomalies.length}</p>
              <p><strong>Selected room rank:</strong> ${data.house_context?.selected_room_rank ?? 'Not available'}</p>
              <p><strong>Best room:</strong> ${data.house_context?.best_room ?? 'Not available'}</p>
              <p><strong>Room needing most attention:</strong> ${data.house_context?.most_problematic_room ?? 'Not available'}</p>
            </div>
            <div class="card">
              <h3>Company Statement</h3>
              <p>Fern Janitorial (Pvt) Ltd confirms that cleaning activity was completed for the above house and room. CleanSight AI sensor records were used to document air and environmental conditions before, during, and after the cleaning process.</p>
            </div>
          </section>

          <p class="footer">This report is generated from CleanSight AI dashboard data and should be reviewed with the selected filter context before client submission.</p>
        </main>
      </body>
    </html>
  `;
}

function getEmailBody({
  data,
  rows,
  dustByStage,
  airByStage,
  anomalies,
  decision,
}: Omit<HouseCleaningReportModalProps, 'open' | 'onClose'>): string {
  const timeline = getReportTimeline(data.sessions);
  const dustImprovement = getImprovementPercent(
    getStageValue(dustByStage, 'before'),
    getStageValue(dustByStage, 'after')
  );
  const airImprovement = getImprovementPercent(
    getStageValue(airByStage, 'before'),
    getStageValue(airByStage, 'after')
  );

  return [
    'Dear Client,',
    '',
    `Please find the cleaning completion report summary for House ${data.house_id}, Room ${data.room_id}.`,
    '',
    `Started: ${formatDateTime(timeline.start)}`,
    `Ended: ${formatDateTime(timeline.end)}`,
    `Total sessions: ${data.sessions.length}`,
    `Total sensor readings: ${rows.length}`,
    `Cleaning quality: ${formatLabel(decision.cleaning_effectiveness)}`,
    `Recommended action: ${formatLabel(decision.recommended_action)}`,
    `Dust improvement: ${dustImprovement == null ? 'insufficient staged data' : `${dustImprovement}% reduction`}`,
    `Air quality improvement: ${airImprovement == null ? 'insufficient staged data' : `${airImprovement}% reduction`}`,
    `Anomaly signals: ${anomalies.length}`,
    '',
    'Regards,',
    'Fern Janitorial (Pvt) Ltd',
  ].join('\n');
}

function getReportEmailMetrics({
  data,
  rows,
  dustByStage,
  airByStage,
  anomalies,
  decision,
}: Omit<HouseCleaningReportModalProps, 'open' | 'onClose'>) {
  const timeline = getReportTimeline(data.sessions);
  const metricSummaries = {
    dust: metricSummary(rows, 'dust'),
    air_quality: metricSummary(rows, 'air_quality'),
    temperature: metricSummary(rows, 'temperature'),
    humidity: metricSummary(rows, 'humidity'),
  };

  return {
    company: 'Fern Janitorial (Pvt) Ltd',
    house_id: data.house_id,
    room_id: data.room_id,
    session_filter: data.session_filter || 'all stages',
    date_from: data.date_from || null,
    date_to: data.date_to || null,
    cleaning_started_at: formatDateTime(timeline.start),
    cleaning_ended_at: formatDateTime(timeline.end),
    sessions_count: data.sessions.length,
    readings_count: rows.length,
    anomaly_signals: anomalies.length,
    cleaning_effectiveness: formatLabel(decision.cleaning_effectiveness),
    recommended_action: formatLabel(decision.recommended_action),
    dust_stage_averages: dustByStage,
    air_quality_stage_averages: airByStage,
    dust_improvement_percent: getImprovementPercent(
      getStageValue(dustByStage, 'before'),
      getStageValue(dustByStage, 'after')
    ),
    air_quality_improvement_percent: getImprovementPercent(
      getStageValue(airByStage, 'before'),
      getStageValue(airByStage, 'after')
    ),
    metric_summaries: metricSummaries,
    room_context: data.house_context
      ? {
          selected_room_rank: data.house_context.selected_room_rank,
          best_room: data.house_context.best_room,
          most_problematic_room: data.house_context.most_problematic_room,
          selected_room_vs_house: data.house_context.selected_room_vs_house,
        }
      : null,
  };
}

async function getAiEmailBody(reportMetrics: ReturnType<typeof getReportEmailMetrics>): Promise<string> {
  const prompt = `
Write a polished professional email to a cleaning-service client.

Use these CleanSight AI report metrics as factual evidence. Do not invent values. Keep it concise, client-friendly, and confident.

Requirements:
- Start with "Dear Client,"
- Mention that Fern Janitorial (Pvt) Ltd completed cleaning for the specified house and room.
- Include the cleaning start/end time, total sessions, total readings, cleaning quality, recommended action, dust improvement, air quality improvement, and anomaly signal count.
- Explain the cleaning result in plain language.
- End with "Regards," and "Fern Janitorial (Pvt) Ltd".
- Return only the email body. No markdown, no subject line.

Report metrics JSON:
${JSON.stringify(reportMetrics, null, 2)}
`.trim();

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      dashboard_context: {
        house_id: reportMetrics.house_id,
        room_id: reportMetrics.room_id,
        selected_page: '/report',
        selected_chart: 'cleaning_report_email',
        filters: {
          session_type: reportMetrics.session_filter,
          date_from: reportMetrics.date_from,
          date_to: reportMetrics.date_to,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Email draft request failed with status ${response.status}`);
  }

  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed || trimmed.includes('OPENAI_API_KEY is not configured')) {
    throw new Error('AI email draft is unavailable.');
  }

  return trimmed;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function printHtmlAsPdf(html: string) {
  const iframe = document.createElement('iframe');
  iframe.title = 'Cleaning report PDF print preview';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';

  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument || iframeWindow?.document;

  if (!iframeWindow || !iframeDocument) {
    iframe.remove();
    return;
  }

  iframe.onload = () => {
    iframeWindow.focus();
    setTimeout(() => {
      iframeWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 150);
  };

  iframeDocument.open();
  iframeDocument.write(html);
  iframeDocument.close();
}

function ReportMetricCard({
  label,
  metric,
  rows,
}: {
  label: string;
  metric: MetricKey;
  rows: ChartRow[];
}) {
  const summary = metricSummary(rows, metric);

  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
        {summary.average.toFixed(2)}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Avg {METRIC_META[metric].unit}
      </p>
    </div>
  );
}

export default function HouseCleaningReportModal({
  open,
  onClose,
  data,
  rows,
  dustByStage,
  airByStage,
  anomalies,
  decision,
}: HouseCleaningReportModalProps) {
  const [emailDrafting, setEmailDrafting] = useState(false);
  const [emailError, setEmailError] = useState('');

  if (!open) return null;

  const timeline = getReportTimeline(data.sessions);
  const dustImprovement = getImprovementPercent(
    getStageValue(dustByStage, 'before'),
    getStageValue(dustByStage, 'after')
  );
  const airImprovement = getImprovementPercent(
    getStageValue(airByStage, 'before'),
    getStageValue(airByStage, 'after')
  );
  const dustInsight = stageComparisonInsight(dustByStage, 'dust');
  const airInsight = stageComparisonInsight(airByStage, 'air_quality');
  const reportHtml = buildPrintableReportHtml({ data, rows, dustByStage, airByStage, anomalies, decision });
  const filenameBase = `cleaning-report-${data.house_id}-${data.room_id}`.replace(/\s+/g, '-').toLowerCase();

  const openPdfPrintWindow = () => {
    printHtmlAsPdf(reportHtml);
  };

  const downloadWordReport = () => {
    downloadBlob(reportHtml, `${filenameBase}.doc`, 'application/msword;charset=utf-8');
  };

  const openEmailWindow = async () => {
    setEmailDrafting(true);
    setEmailError('');
    const subject = `Cleaning Completion Report - House ${data.house_id}, Room ${data.room_id}`;
    const fallbackBody = getEmailBody({ data, rows, dustByStage, airByStage, anomalies, decision });
    let body = fallbackBody;
    const emailWindow = window.open('', '_blank');

    if (emailWindow) {
      emailWindow.document.write(
        '<!doctype html><title>Preparing email...</title><p style="font-family: Arial, sans-serif; padding: 24px;">Preparing AI email draft...</p>'
      );
      emailWindow.document.close();
    }

    try {
      body = await getAiEmailBody(
        getReportEmailMetrics({ data, rows, dustByStage, airByStage, anomalies, decision })
      );
    } catch {
      setEmailError('AI email draft was unavailable, so the standard report email was used.');
    } finally {
      setEmailDrafting(false);
    }

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (emailWindow) {
      emailWindow.location.href = gmailUrl;
    } else {
      window.open(gmailUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto px-4 py-8"
      style={{ background: 'rgba(15, 23, 42, 0.44)', backdropFilter: 'blur(10px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cleaning-report-title"
    >
      <section
        className="w-full max-w-6xl rounded-2xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', boxShadow: '0 28px 80px rgba(15, 23, 42, 0.30)' }}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-2xl border-b p-4 md:flex-row md:items-center md:justify-between" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: 'var(--bg-active)', color: 'var(--accent-primary)' }}>
              <FileText size={20} />
            </div>
            <div>
              <h2 id="cleaning-report-title" className="text-xl font-extrabold" style={{ color: 'var(--text-heading)' }}>
                Cleaning Completion Report
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                House {data.house_id} / Room {data.room_id}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openPdfPrintWindow} className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: 'var(--accent-primary)', color: '#fff' }}>
              <Printer className="mr-1 inline" size={15} />
              PDF
            </button>
            <button type="button" onClick={downloadWordReport} className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)' }}>
              <Download className="mr-1 inline" size={15} />
              Word
            </button>
            <button
              type="button"
              onClick={openEmailWindow}
              disabled={emailDrafting}
              className="rounded-lg px-3 py-2 text-sm font-bold"
              style={{
                background: emailDrafting ? 'var(--border-light)' : 'var(--bg-active)',
                color: emailDrafting ? 'var(--text-muted)' : 'var(--text-accent)',
                border: '1px solid var(--border-active)',
              }}
            >
              <Mail className="mr-1 inline" size={15} />
              {emailDrafting ? 'Drafting...' : 'Email'}
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-2" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }} aria-label="Close report">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {emailError ? (
            <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--badge-moderate-bg)', color: 'var(--badge-moderate-text)' }}>
              {emailError}
            </div>
          ) : null}

          <header className="grid gap-4 border-b pb-5 md:grid-cols-[120px_1fr]" style={{ borderColor: 'var(--border-color)' }}>
            <svg className="h-20 w-28" viewBox="0 0 160 100" role="img" aria-label="Fern leaf">
              <path d="M20 80 C58 45, 92 22, 142 10" fill="none" stroke="#059669" strokeWidth="9" strokeLinecap="round" />
              {Array.from({ length: 13 }).map((_, index) => {
                const x = 42 + index * 7;
                const y = 63 - index * 4;
                return <path key={index} d={`M${x} ${y} L${x - 20} ${y - 12}`} stroke="#10b981" strokeWidth="5" strokeLinecap="round" />;
              })}
            </svg>
            <div className="text-center">
              <h1 className="font-serif text-2xl font-black tracking-[0.18em] md:text-4xl" style={{ color: 'var(--text-heading)' }}>
                FERN JANITORIAL (PVT) LTD
              </h1>
              <p className="mt-2 font-bold" style={{ color: 'var(--text-heading)' }}>Tel. No : 011 5650783 / Fax : 011 2852486</p>
              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>email : info@fernjanitorial.com</p>
              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>Web : www.fernjanitorial.com, www.starandfern.com</p>
              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>78 B1, PAGODA ROAD, NUGEGODA.</p>
            </div>
          </header>

          <section className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border p-4 lg:col-span-2" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                Report statement
              </p>
              <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                Fern Janitorial (Pvt) Ltd confirms that cleaning activity was completed for House {data.house_id}, Room {data.room_id}. CleanSight AI sensor records were used to document conditions before, during, and after cleaning.
              </p>
              <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                Overall cleaning quality is <strong>{formatLabel(decision.cleaning_effectiveness)}</strong>. Recommended action is <strong>{formatLabel(decision.recommended_action)}</strong>.
              </p>
            </div>
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                Basic details
              </p>
              <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p><strong>House:</strong> {data.house_id}</p>
                <p><strong>Room:</strong> {data.room_id}</p>
                <p><strong>Started:</strong> {formatDateTime(timeline.start)}</p>
                <p><strong>Ended:</strong> {formatDateTime(timeline.end)}</p>
                <p><strong>Sessions:</strong> {data.sessions.length}</p>
                <p><strong>Readings:</strong> {rows.length}</p>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetricCard label="Dust" metric="dust" rows={rows} />
            <ReportMetricCard label="Air Quality" metric="air_quality" rows={rows} />
            <ReportMetricCard label="Temperature" metric="temperature" rows={rows} />
            <ReportMetricCard label="Humidity" metric="humidity" rows={rows} />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Cleaning Trend Evidence</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Dust, air quality, temperature, and humidity movement during the selected cleaning window.
              </p>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="chartLabel" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                    <Tooltip />
                    <Legend formatter={(value) => METRIC_META[value as MetricKey]?.label || value} />
                    <Line type="monotone" dataKey="dust" name="Dust" stroke="var(--chart-stroke-1)" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="air_quality" name="Air Quality" stroke="var(--chart-stroke-3)" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="temperature" name="Temperature" stroke="var(--chart-stroke-2)" dot={false} strokeWidth={1.6} />
                    <Line type="monotone" dataKey="humidity" name="Humidity" stroke="var(--chart-fill-1)" dot={false} strokeWidth={1.6} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Before / During / After Quality</h3>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Lower dust and air quality values after cleaning indicate better conditions.
              </p>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dustByStage.map((row) => ({ stage: row.stage, dust: row.value, air_quality: getStageValue(airByStage, row.stage) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="dust" name="Dust Average" radius={[4, 4, 0, 0]}>
                      {dustByStage.map((row) => <Cell key={row.stage} fill={stageColors[row.stage]} />)}
                    </Bar>
                    <Bar dataKey="air_quality" name="Air Quality Average" fill="var(--chart-fill-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Cleaning Interpretation</h3>
              <div className="mt-3 space-y-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                <p>{dustInsight.detail}</p>
                <p>{airInsight.detail}</p>
                <p>Dust improvement: {dustImprovement == null ? 'insufficient before/after data' : `${dustImprovement}% reduction`}.</p>
                <p>Air quality improvement: {airImprovement == null ? 'insufficient before/after data' : `${airImprovement}% reduction`}.</p>
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-input)', borderColor: 'var(--border-light)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Quality Decision</h3>
              <div className="mt-3 rounded-lg px-3 py-2 text-sm font-bold capitalize" style={{ background: 'var(--bg-active)', color: 'var(--text-accent)' }}>
                {formatLabel(decision.cleaning_effectiveness)}
              </div>
              <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                Recommended action: {formatLabel(decision.recommended_action)}. The report includes {anomalies.length} anomaly signal{anomalies.length === 1 ? '' : 's'} for review.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
