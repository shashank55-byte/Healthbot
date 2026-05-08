import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';

const METRICS = {
  severity: { label: 'Severity', color: '#0f766e', key: 'severity' },
  risk_score: { label: 'Risk Score', color: '#ea580c', key: 'risk_score' },
  confidence: { label: 'Confidence', color: '#2563eb', key: 'confidence' }
};

function formatDate(value, fallback) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function normalizePoint(point, index) {
  const score = Math.round(Number(point?.score ?? point?.risk_score ?? point?.severity) || 0);
  const riskScore = Math.round(Number(point?.risk_score ?? score) || 0);
  const severity = Math.round(Number(point?.severity ?? score) || 0);
  const confidence = Math.round(Number(point?.confidence) || 0);
  const timestamp = Number(point?.timestamp) || (point?.date ? new Date(point.date).getTime() : Date.now());

  return {
    ...point,
    name: formatDate(timestamp || point?.date, `#${index + 1}`),
    timestamp,
    severity,
    risk_score: riskScore,
    score: riskScore,
    confidence,
    level: point?.level || (riskScore >= 71 ? 'High' : riskScore >= 31 ? 'Moderate' : 'Low'),
    symptoms: Array.isArray(point?.symptoms) ? point.symptoms : Array.isArray(point?.symptom_history) ? point.symptom_history : [],
    lab_tests: Array.isArray(point?.lab_tests) ? point.lab_tests : []
  };
}

function getTrendRecords(trend) {
  const records = Array.isArray(trend)
    ? trend
    : Array.isArray(trend?.time_series)
      ? trend.time_series
      : Array.isArray(trend?.daily)
        ? trend.daily
        : Array.isArray(trend?.records)
          ? trend.records
          : [];

  return records.map(normalizePoint);
}

function buildLabSummary(healthRecords = []) {
  return healthRecords
    .filter((record) => record?.documentType === 'Lab Report' || record?.analysis?.abnormalValues?.length)
    .flatMap((record) => (record.analysis?.abnormalValues || []).map((item) => ({
      name: item.parameter || item.name,
      value: item.value,
      status: item.status,
      severity: item.severity,
      source: record.fileName || record.name
    })))
    .slice(0, 4);
}

export default function DashboardTrends({ trend, healthRecords = [], compact = false }) {
  const [metric, setMetric] = useState('risk_score');
  const data = useMemo(() => getTrendRecords(trend), [trend]);
  const labSummary = useMemo(() => buildLabSummary(healthRecords), [healthRecords]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const activeMetric = METRICS[metric];
  const displayData = data.length > 0
    ? data
    : Array.from({ length: compact ? 5 : 7 }, (_, index) => ({
        name: `#${index + 1}`,
        severity: 0,
        risk_score: 0,
        score: 0,
        confidence: 0,
        level: 'Low',
        symptoms: [],
        lab_tests: []
      }));
  const selected = hoveredPoint || selectedPoint || data[data.length - 1] || null;
  const analysis = trend?.trend_analysis;
  const alerts = Array.isArray(trend?.alerts) ? trend.alerts : [];

  const HoverCard = ({ point }) => {
    if (!point) return null;
    const disease = point.diseases?.[0]?.name
      ? `${point.diseases[0].name}${point.diseases[0].probability ? ` (${Math.round(Number(point.diseases[0].probability) <= 1 ? point.diseases[0].probability * 100 : point.diseases[0].probability)}%)` : ''}`
      : 'No disease prediction recorded';
    const labText = point.lab_tests?.[0]?.name
      ? `${point.lab_tests[0].name}: ${point.lab_tests[0].status || point.lab_tests[0].value || 'Recorded'}`
      : 'No lab tests linked';
    const symptomsText = point.symptoms?.length
      ? point.symptoms.slice(0, 5).join(', ')
      : 'No symptoms recorded';
    const statusMessage = point.risk_score >= 75
      ? 'High risk warning'
      : point.risk_score >= 40
        ? 'Monitor closely'
        : 'Stable condition';

    return (
      <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 shadow-xl w-[280px]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Check-in</p>
            <p className="text-white text-sm font-black mt-1">{point.name || 'Check-in'}</p>
          </div>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
            point.risk_score >= 75 ? 'bg-red-500/20 text-red-200' : point.risk_score >= 40 ? 'bg-amber-500/20 text-amber-200' : 'bg-teal-500/20 text-teal-200'
          }`}>
            {point.level || 'Low'}
          </span>
        </div>

        <div className="space-y-2 mb-3">
          {[
            ['Risk score', point.risk_score, '#fb923c'],
            ['Severity', point.severity, '#2dd4bf'],
            ['Confidence', point.confidence, '#60a5fa']
          ].map(([name, value, color]) => (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{name}</p>
                <p className="text-xs font-black text-white">{value}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white/10 px-3 py-2 space-y-1.5">
          <p className="text-xs font-bold text-white">{statusMessage}</p>
          <p className="text-[11px] font-medium text-gray-300">Symptoms: {symptomsText}</p>
          <p className="text-[11px] font-medium text-gray-300">Prediction: {disease}</p>
          <p className="text-[11px] font-medium text-gray-300">Lab: {labText}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col h-full">
      <div className="flex flex-col gap-4 mb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">
            Health Trends <span className="text-[10px] normal-case text-gray-400 font-medium">({trend?.range_days || 7} days)</span>
          </h4>
          {!compact && analysis?.message && (
            <p className="text-xs font-bold text-gray-500 mt-1">{analysis.message}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(METRICS).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                metric === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {alerts.length > 0 && !compact && (
        <div className="mb-4 grid gap-2 md:grid-cols-2">
          {alerts.slice(0, 2).map((alert, index) => (
            <div key={`${alert.type}-${index}`} className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">{alert.message}</p>
              <p className="text-xs font-semibold text-orange-900 mt-1">{alert.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-[210px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 8, right: 12, left: -18, bottom: 8 }}
            onMouseMove={(event) => {
              const activeIndex = Number(event?.activeTooltipIndex);
              const point = Number.isInteger(activeIndex)
                ? displayData[activeIndex]
                : event?.activePayload?.[0]?.payload;
              if (point) {
                setHoveredPoint(point);
                setHoverPosition({
                  x: Math.max(12, Math.min(Number(event?.chartX || 0) + 16, 700)),
                  y: Math.max(12, Math.min(Number(event?.chartY || 0) - 20, 260))
                });
              }
            }}
            onMouseLeave={() => setHoveredPoint(null)}
            onClick={(event) => {
              if (event?.activePayload?.[0]?.payload) setSelectedPoint(event.activePayload[0].payload);
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Line
              name={activeMetric.label}
              type="monotone"
              dataKey={activeMetric.key}
              stroke={activeMetric.color}
              strokeWidth={3}
              dot={(props) => {
                const point = props.payload;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill="#fff"
                    stroke={activeMetric.color}
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onClick={() => setSelectedPoint(point)}
                  />
                );
              }}
              activeDot={(props) => {
                const point = props.payload;
                return (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={8}
                    fill={activeMetric.color}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onClick={() => setSelectedPoint(point)}
                  />
                );
              }}
              animationDuration={900}
            />
          </LineChart>
        </ResponsiveContainer>
        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              left: `min(${hoverPosition.x}px, calc(100% - 300px))`,
              top: `${hoverPosition.y}px`
            }}
          >
            <HoverCard point={hoveredPoint} />
          </div>
        )}
      </div>

      {selected && (!compact || hoveredPoint) && (
        <div className={`${compact ? 'mt-3 grid gap-2 border-t border-gray-100 pt-3' : 'mt-5 grid gap-4 border-t border-gray-100 pt-5 lg:grid-cols-3'}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {hoveredPoint ? 'Hovered Day' : 'Selected Day'}
            </p>
            <p className="text-sm font-black text-gray-900 mt-1">{selected.name}</p>
            {!compact && <p className="text-xs font-bold text-gray-500 mt-1">{selected.label || selected.level}</p>}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Metrics</p>
            <p className="text-xs font-bold text-gray-700 mt-1">
              Severity {selected.severity}% | Risk {selected.risk_score}% | Confidence {selected.confidence}%
            </p>
            <p className="text-xs font-bold text-gray-500 mt-1">Level: {selected.level}</p>
          </div>
          <div className={compact ? 'hidden' : ''}>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Symptoms & Labs</p>
            <p className="text-xs font-bold text-gray-700 mt-1">
              {(selected.symptoms || []).slice(0, 4).join(', ') || 'No symptoms recorded'}
            </p>
            <p className="text-xs font-bold text-gray-500 mt-1">
              {selected.lab_tests?.[0]?.name
                ? `${selected.lab_tests[0].name}: ${selected.lab_tests[0].status || selected.lab_tests[0].value}`
                : labSummary[0]
                  ? `${labSummary[0].name}: ${labSummary[0].status || labSummary[0].value}`
                  : 'No lab tests linked'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
