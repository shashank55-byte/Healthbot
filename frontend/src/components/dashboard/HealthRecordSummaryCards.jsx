import React from 'react';
import { motion } from 'framer-motion';

const toneStyles = {
  teal: {
    icon: 'bg-teal-50 text-teal-600',
    accent: 'bg-teal-500'
  },
  red: {
    icon: 'bg-red-50 text-red-600',
    accent: 'bg-red-500'
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600',
    accent: 'bg-amber-500'
  },
  blue: {
    icon: 'bg-blue-50 text-blue-600',
    accent: 'bg-blue-500'
  },
  gray: {
    icon: 'bg-gray-50 text-gray-500',
    accent: 'bg-gray-400'
  }
};

function SummaryCard({ label, value, detail, icon, tone = 'teal', index }) {
  const styles = toneStyles[tone] || toneStyles.teal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-4 shadow-sm min-h-[132px]"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.accent}`} />
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 leading-relaxed">
            {label}
          </p>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black ${styles.icon}`}>
            {icon}
          </div>
        </div>
        <div>
          <p className="truncate text-2xl font-black text-gray-900" title={String(value)}>
            {value}
          </p>
          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-gray-400" title={detail}>
            {detail}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function HealthRecordSummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Uploaded Records',
      value: summary.totalRecords,
      detail: `${summary.analyzedRecords} analyzed and stored`,
      icon: 'DOC',
      tone: 'teal'
    },
    {
      label: 'High-Risk Reports',
      value: summary.highRiskReports,
      detail: summary.highRiskReports > 0 ? 'Needs clinician review' : 'No high-risk reports found',
      icon: '!',
      tone: summary.highRiskReports > 0 ? 'red' : 'gray'
    },
    {
      label: 'Latest Report Risk Score',
      value: summary.latestRiskScore,
      detail: summary.latestRiskLabel,
      icon: '%',
      tone: summary.latestRiskTone
    },
    {
      label: 'Last Uploaded Document',
      value: summary.lastUploadedDocument,
      detail: summary.lastUploadedDate,
      icon: 'UP',
      tone: 'blue'
    },
    {
      label: 'Pending Analysis Count',
      value: summary.pendingAnalysisCount,
      detail: summary.pendingAnalysisCount > 0 ? 'Analysis in progress or queued' : 'All uploads analyzed',
      icon: '...',
      tone: summary.pendingAnalysisCount > 0 ? 'amber' : 'gray'
    }
  ];

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card, index) => (
        <SummaryCard key={card.label} {...card} index={index} />
      ))}
    </section>
  );
}
