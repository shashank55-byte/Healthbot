import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardTrends from './DashboardTrends';

const FILTERS = [7, 30, 90];

function normalizeTrendResponse(payload) {
  if (Array.isArray(payload)) {
    return { records: payload, daily: payload, time_series: payload, checkins: payload.length, range_days: 7 };
  }

  const records = Array.isArray(payload?.records)
    ? payload.records
    : Array.isArray(payload?.series)
      ? payload.series
      : [];

  return {
    ...payload,
    records,
    daily: Array.isArray(payload?.daily) ? payload.daily : records,
    time_series: Array.isArray(payload?.time_series) ? payload.time_series : records,
    checkins: Number(payload?.checkins) || records.length,
    alerts: Array.isArray(payload?.alerts) ? payload.alerts : [],
    insights: Array.isArray(payload?.insights) ? payload.insights : [],
    range_days: Number(payload?.range_days) || 7
  };
}

function average(records, key) {
  const values = records.map((item) => Number(item?.[key] ?? item?.score)).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeLabs(healthRecords = []) {
  const analyzed = healthRecords.filter((record) => record?.status === 'Analyzed');
  const abnormalCount = analyzed.reduce((count, record) => count + (record.analysis?.abnormalValues?.length || 0), 0);
  const maxRisk = analyzed.reduce((max, record) => Math.max(max, Number(record.recordRiskScore) || 0), 0);
  return { count: analyzed.length, abnormalCount, maxRisk };
}

export default function TrendsView({ trend, healthRecords = [], onTrendChange }) {
  const [rangeDays, setRangeDays] = useState(Number(trend?.range_days) || 7);
  const [loadingRange, setLoadingRange] = useState(false);
  const trendRecords = Array.isArray(trend) ? trend : (trend?.time_series || trend?.records || []);
  const labSummary = useMemo(() => summarizeLabs(healthRecords), [healthRecords]);

  const avgSeverity = trendRecords.length > 0 ? average(trendRecords, 'severity') : 0;
  const avgRisk = trendRecords.length > 0 ? average(trendRecords, 'risk_score') : 0;
  const avgConfidence = trendRecords.length > 0 ? average(trendRecords, 'confidence') : 0;
  const latest = trendRecords[trendRecords.length - 1] || null;
  const riskOutlook = latest?.risk_score > 70 || latest?.score > 70 ? 'High' : latest?.risk_score > 40 || latest?.score > 40 ? 'Medium' : 'Low';
  const insights = Array.isArray(trend?.insights) && trend.insights.length
    ? trend.insights
    : [trend?.trend_analysis?.message || 'stable condition'];

  const loadRange = async (days) => {
    setRangeDays(days);
    setLoadingRange(true);
    try {
      const response = await fetch(`http://localhost:5000/api/health-trends?days=${days}`);
      const payload = await response.json();
      onTrendChange?.(normalizeTrendResponse(payload));
    } catch (_) {
      onTrendChange?.(normalizeTrendResponse(trend));
    } finally {
      setLoadingRange(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Health Trends</h2>
          <p className="text-sm font-semibold text-gray-500 mt-1">Intelligent monitoring across symptoms, risk, confidence, and lab context.</p>
        </div>
        <div className="flex gap-2">
          {FILTERS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => loadRange(days)}
              disabled={loadingRange}
              className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                rangeDays === days
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Average Severity</p>
          <h3 className="text-3xl font-black text-teal-700">{(avgSeverity / 10).toFixed(1)} <span className="text-sm text-gray-300">/ 10</span></h3>
          <p className="text-[10px] text-teal-600 font-bold mt-2">Symptom burden</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Average Risk</p>
          <h3 className="text-3xl font-black text-orange-600">{Math.round(avgRisk)}%</h3>
          <p className="text-[10px] text-orange-500 font-bold mt-2">Latest outlook: {riskOutlook}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Confidence</p>
          <h3 className="text-3xl font-black text-blue-600">{Math.round(avgConfidence)}%</h3>
          <p className="text-[10px] text-blue-500 font-bold mt-2">{trendRecords.length} check-ins tracked</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lab Tests</p>
          <h3 className="text-3xl font-black text-violet-700">{labSummary.count}</h3>
          <p className="text-[10px] text-violet-600 font-bold mt-2">{labSummary.abnormalCount} abnormal markers</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-h-[430px]">
          <DashboardTrends trend={trend} healthRecords={healthRecords} />
        </div>
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Insights</p>
            <div className="space-y-3">
              {insights.slice(0, 3).map((insight, index) => (
                <div key={`${insight}-${index}`} className="rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-sm font-black text-gray-900">{insight}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Alerts</p>
            {(trend?.alerts || []).length > 0 ? (
              <div className="space-y-3">
                {trend.alerts.map((alert, index) => (
                  <div key={`${alert.type}-${index}`} className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-widest text-orange-600">{alert.message}</p>
                    <p className="text-xs font-semibold text-orange-900 mt-1">{alert.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold text-gray-500">No active trend alerts.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
