import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { detectDocumentType } from '../../utils/healthRecordAnalysis';

const riskStyles = {
  Low: 'bg-teal-50 text-teal-700 border-teal-100',
  Moderate: 'bg-amber-50 text-amber-700 border-amber-100',
  High: 'bg-red-50 text-red-700 border-red-100'
};

const statusStyles = {
  Analyzed: 'bg-teal-50 text-teal-700 border-teal-100',
  Pending: 'bg-gray-50 text-gray-500 border-gray-100'
};

const parameterStatusStyles = {
  Normal: 'bg-teal-50 text-teal-700 border-teal-100',
  Low: 'bg-blue-50 text-blue-700 border-blue-100',
  High: 'bg-red-50 text-red-700 border-red-100'
};

const recordFilters = ['All', 'Lab Reports', 'Prescriptions', 'Imaging', 'Abnormal Values', 'High Risk', 'Recently Uploaded'];
const STANDARD_MEDICAL_DISCLAIMER = 'This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.';
const TEXT_READABLE_TYPES = ['txt', 'csv', 'json'];

function formatUploadDate() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRecordTime(record) {
  const parsed = new Date(record?.uploadedAt || record?.uploadDate || record?.date || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRecentlyUploaded(record) {
  const timestamp = getRecordTime(record);
  if (!timestamp) return false;
  return Date.now() - timestamp <= 7 * 24 * 60 * 60 * 1000;
}

function matchesFilter(record, filter) {
  if (filter === 'Lab Reports') return record.documentType === 'Lab Report';
  if (filter === 'Prescriptions') return record.documentType === 'Prescription';
  if (filter === 'Imaging') return record.documentType === 'X-Ray/Scan';
  if (filter === 'Abnormal Values') return (record.abnormalValueCount || record.analysis?.abnormalValues?.length || 0) > 0;
  if (filter === 'High Risk') return record.recordRiskLevel === 'High' || record.analysis?.riskLevel === 'High';
  if (filter === 'Recently Uploaded') return isRecentlyUploaded(record);
  return true;
}

function getRecordSummary(records = []) {
  const analyzed = records.filter((record) => record.status === 'Analyzed');
  const abnormalCount = analyzed.reduce((sum, record) => sum + (record.abnormalValueCount || record.analysis?.abnormalValues?.length || 0), 0);
  const highRiskCount = analyzed.filter((record) => record.recordRiskLevel === 'High' || record.analysis?.riskLevel === 'High').length;
  const averageRisk = analyzed.length
    ? Math.round(analyzed.reduce((sum, record) => sum + (Number(record.recordRiskScore ?? record.analysis?.reportRiskScore) || 0), 0) / analyzed.length)
    : 0;

  return { analyzed: analyzed.length, abnormalCount, highRiskCount, averageRisk };
}

function ParameterTable({ parameters = [] }) {
  if (!parameters.length) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-xs font-bold text-gray-400">
        No structured medical parameters extracted for this document type.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200">
            <th className="py-2 pr-3">Parameter</th>
            <th className="py-2 pr-3">Value</th>
            <th className="py-2 pr-3">Normal Range</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((param, idx) => (
            <tr key={`${param.name}-${idx}`} className="border-b border-gray-100 last:border-0">
              <td className="py-3 pr-3 text-xs font-black text-gray-800">{param.name}</td>
              <td className="py-3 pr-3 text-xs font-bold text-gray-700">{param.value}</td>
              <td className="py-3 pr-3 text-xs font-medium text-gray-500">{param.normalRange || 'Not available'}</td>
              <td className="py-3 pr-3">
                <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${parameterStatusStyles[param.status] || parameterStatusStyles.Normal}`}>
                  {param.status}
                </span>
              </td>
              <td className="py-3 pr-3 text-xs font-medium text-gray-500">{param.clinicalNote || 'Review in clinical context'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilePreview({ record }) {
  const fileType = String(record?.fileType || record?.type || '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType);
  const isPdf = fileType === 'pdf';

  if (record?.url && isImage) {
    return <img src={record.url} alt={record.fileName || record.name} className="w-full h-full object-contain rounded-2xl" />;
  }

  if (record?.url && isPdf) {
    return <iframe src={record.url} title={record.fileName || record.name} className="w-full h-full rounded-2xl border-0" />;
  }

  return (
    <div className="h-full min-h-[260px] bg-gray-50 border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-xs font-black text-gray-400 mb-4">
        {record?.fileType || record?.type || 'DOC'}
      </div>
      <p className="text-sm font-black text-gray-700">{record?.fileName || record?.name}</p>
      <p className="text-xs font-medium text-gray-400 mt-1">Preview is available for image and PDF files. Metadata and AI analysis are shown below.</p>
    </div>
  );
}

function RecordAnalysisModal({ record, onClose, onDownload, onDelete }) {
  if (!record) return null;

  const analysis = record.analysis || {};
  const extractedParameters = analysis.extractedParameters || [];
  const riskScore = typeof analysis.reportRiskScore === 'number' ? analysis.reportRiskScore : 0;
  const abnormal = analysis.abnormal || [];
  const abnormalValues = analysis.abnormalValues || [];
  const riskDrivers = analysis.riskDrivers || [];
  const extraction = analysis.extraction || {};
  const auditTrail = analysis.auditTrail || [];
  const modelTransparency = analysis.modelTransparency || {};
  const labMarkerPrediction = analysis.labMarkerPrediction || null;

  return (
    <div className="fixed inset-0 z-[80] bg-gray-900/50 backdrop-blur-sm p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">Detailed Report Analysis</p>
            <h3 className="text-2xl font-black text-gray-900">{record.fileName || record.name}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              {record.documentType || 'General Medical Document'} | {record.fileType || record.type} | {record.uploadDate || record.date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(record)}
              className="px-4 py-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 text-xs font-black hover:bg-teal-100 transition-all"
            >
              Download
            </button>
            <button
              onClick={() => {
                onDelete(record);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-red-600 text-white border border-red-600 text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
            >
              Remove
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 text-lg font-black hover:bg-gray-200 transition-all"
              aria-label="Close report analysis"
            >
              x
            </button>
          </div>
        </div>

        <div className="p-6 grid lg:grid-cols-[0.95fr_1.25fr] gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 h-[340px]">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">File Preview</p>
              <div className="h-[285px]">
                <FilePreview record={record} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['File size', record.fileSize || record.size],
                ['Status', record.status || 'Pending'],
                ['File type', record.fileType || record.type],
                ['Uploaded', record.uploadDate || record.date],
                ['Extraction', extraction.source || record.extractionSource || 'mock_extraction'],
                ['Confidence', extraction.confidence ? `${extraction.confidence}%` : 'Pending']
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-xs font-bold text-gray-700">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-3xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">AI-Generated Summary</p>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed">{analysis.summary || 'No AI summary available yet.'}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase border ${riskStyles[analysis.riskLevel] || riskStyles.Low}`}>
                  {analysis.riskLevel || 'Low'} Risk
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Risk Score</p>
                  <p className="text-xs font-black text-gray-800">{riskScore}/100</p>
                </div>
                <div className="h-2 bg-white rounded-full border border-gray-100 overflow-hidden">
                  <div
                    className={`${riskScore >= 70 ? 'bg-red-500' : riskScore >= 35 ? 'bg-amber-500' : 'bg-teal-500'} h-full`}
                    style={{ width: `${Math.max(0, Math.min(100, riskScore))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Extracted Medical Parameters</p>
                <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">
                  {extractedParameters.length} parameters
                </span>
              </div>
              <ParameterTable parameters={extractedParameters} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {labMarkerPrediction && (
                <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 rounded-3xl p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Lab Marker ML Prediction</p>
                      <h4 className="text-xl font-black text-indigo-950">{labMarkerPrediction.prediction}</h4>
                      <p className="mt-1 text-xs font-bold text-indigo-700">
                        {labMarkerPrediction.model_name} | confidence {labMarkerPrediction.confidence}%
                      </p>
                    </div>
                    <span className="rounded-xl bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-700">
                      {labMarkerPrediction.used_features?.length || 0} markers used
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {(labMarkerPrediction.probabilities || []).slice(0, 3).map((item) => (
                      <div key={item.label} className="rounded-2xl bg-white/80 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black text-gray-700">{item.label}</p>
                          <p className="text-xs font-black text-indigo-700">{item.probability}%</p>
                        </div>
                        <div className="h-2 rounded-full bg-indigo-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.probability}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] font-bold text-indigo-700 leading-relaxed">
                    {labMarkerPrediction.disclaimer}
                  </p>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">Abnormal Findings</p>
                <div className="space-y-2">
                  {abnormalValues.length ? abnormalValues.map((item, idx) => (
                    <div key={idx} className="bg-white/70 border border-amber-100 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black text-amber-900">{item.parameter}</p>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">{item.severity}</span>
                      </div>
                      <p className="text-xs font-bold text-amber-800 mt-1">{item.value} | {item.normalRange}</p>
                      <p className="text-[10px] font-bold text-amber-700 mt-1">{item.clinicalNote}</p>
                    </div>
                  )) : abnormal.length ? abnormal.map((item, idx) => (
                    <p key={idx} className="text-xs font-bold text-amber-800 bg-white/70 border border-amber-100 rounded-xl px-3 py-2">{item}</p>
                  )) : (
                    <p className="text-xs font-bold text-amber-800">No abnormal findings detected in the mock extraction.</p>
                  )}
                </div>
              </div>

              <div className="bg-teal-50 border border-teal-100 rounded-3xl p-5">
                <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-3">Recommended Action</p>
                <p className="text-sm font-bold text-teal-900 leading-relaxed">{analysis.nextAction || 'Review this document with a qualified healthcare professional.'}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Risk Drivers</p>
                <div className="space-y-2">
                  {riskDrivers.length ? riskDrivers.map((driver, idx) => (
                    <p key={idx} className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">{driver}</p>
                  )) : (
                    <p className="text-xs font-bold text-gray-400">No elevated risk drivers found.</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Analysis Pipeline</p>
                <div className="space-y-2">
                  {auditTrail.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-[9px] font-black text-teal-600">{idx + 1}</span>
                      <p className="text-xs font-bold text-gray-600">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-white rounded-3xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">OCR / ML Readiness</p>
              <p className="text-sm font-bold leading-relaxed mb-3">
                {modelTransparency.realOcrHook || 'Real OCR can be connected later by returning the same extracted-parameter schema.'}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Disclaimer</p>
              <p className="text-sm font-medium leading-relaxed">
                {STANDARD_MEDICAL_DISCLAIMER}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function HealthRecordsView({ records = [], onUpload, onDelete, analyzing }) {
  const fileInputRef = useRef(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const timelineRecords = records
    .filter((record) => matchesFilter(record, activeFilter))
    .slice()
    .sort((a, b) => getRecordTime(b) - getRecordTime(a));
  const recordSummary = getRecordSummary(records);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const readFileText = (file) => new Promise((resolve) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const isReadable = TEXT_READABLE_TYPES.includes(extension) || /^text\//.test(file.type);
    if (!isReadable) {
      resolve({ extractedText: '', contentExtractionStatus: 'OCR not configured for this file type' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve({
      extractedText: String(reader.result || '').slice(0, 25000),
      contentExtractionStatus: 'Readable text extracted'
    });
    reader.onerror = () => resolve({ extractedText: '', contentExtractionStatus: 'Could not read file text' });
    reader.readAsText(file);
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const textResult = await readFileText(file);
    const fileType = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    const uploadDate = formatUploadDate();
    const fileSize = formatFileSize(file.size);
    const newRecord = {
      name: file.name,
      fileName: file.name,
      date: uploadDate,
      uploadDate,
      uploadedAt: new Date().toISOString(),
      size: fileSize,
      fileSize,
      type: fileType,
      fileType,
      documentType: detectDocumentType({ name: file.name }),
      status: 'Pending',
      url: URL.createObjectURL(file),
      extractedText: textResult.extractedText,
      contentExtractionStatus: textResult.contentExtractionStatus
    };

    onUpload(newRecord);
    e.target.value = '';
  };

  const handleDownload = (record) => {
    if (record.url) {
      const link = document.createElement('a');
      link.href = record.url;
      link.download = record.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = (record) => {
    onDelete?.(record);
    if (selectedRecord === record) setSelectedRecord(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Health Records</h2>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            className="bg-teal-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all active:scale-95 flex items-center gap-2"
          >
            Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Analyzed Records', recordSummary.analyzed, 'Completed mock/OCR-ready analysis'],
          ['Abnormal Values', recordSummary.abnormalCount, 'Detected from extracted parameters'],
          ['High Risk Reports', recordSummary.highRiskCount, 'Requires closer review'],
          ['Average Risk Score', `${recordSummary.averageRisk}/100`, 'Across analyzed records']
        ].map(([label, value, detail]) => (
          <div key={label} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs font-bold text-gray-400 mt-1">{detail}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Timeline View</p>
            <p className="text-sm font-bold text-gray-800">Uploaded records in chronological order</p>
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {timelineRecords.length} shown
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {recordFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                activeFilter === filter
                  ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-100'
                  : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        {analyzing && (
          <div className="p-6 bg-teal-50/50 border-b border-teal-100 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></span>
              <p className="text-sm font-bold text-teal-700">AI is analyzing <span className="underline">{analyzing}</span>...</p>
            </div>
            <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Processing Data</span>
          </div>
        )}

        {records.length > 0 ? (
          timelineRecords.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {timelineRecords.map((rec, i) => {
              const analysis = rec.analysis || null;
              const extractedParameters = analysis?.extractedParameters || [];
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRecord(rec)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedRecord(rec);
                  }}
                  className="p-6 hover:bg-gray-50 transition-all group cursor-pointer focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="relative flex flex-col items-center">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-xs font-black shadow-sm relative z-10">
                          DOC
                        </div>
                        {i < timelineRecords.length - 1 && (
                          <div className="absolute top-12 bottom-[-44px] w-px bg-gray-100" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 group-hover:text-teal-600 transition-colors">{rec.fileName || rec.name}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {rec.uploadDate || rec.date} | {rec.documentType || 'General Medical Document'}
                        </p>
                        <p className="text-xs font-medium text-gray-500 mt-1 max-w-2xl line-clamp-2">
                          {analysis?.summary || 'Pending analysis. Upload processing will add a clinical support summary.'}
                        </p>
                        {rec.contentExtractionStatus && (
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            {rec.contentExtractionStatus}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="bg-gray-100 text-gray-400 text-[10px] font-black px-2 py-1 rounded uppercase flex items-center">{rec.fileType || rec.type}</span>
                      <span className={`text-[10px] font-black px-2 py-1 rounded uppercase border flex items-center ${statusStyles[rec.status] || statusStyles.Pending}`}>
                        {rec.status || 'Pending'}
                      </span>
                      {typeof rec.recordRiskScore === 'number' && (
                        <span className={`text-[10px] font-black px-2 py-1 rounded uppercase border flex items-center ${riskStyles[rec.recordRiskLevel] || riskStyles.Low}`}>
                          {rec.recordRiskLevel || 'Low'} Risk
                        </span>
                      )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRecord(rec);
                        }}
                        className="bg-white text-gray-800 font-black text-xs hover:bg-gray-100 px-4 py-2 rounded-xl transition-all border border-gray-200 shadow-sm"
                      >
                        View details
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownload(rec);
                        }}
                        className="bg-teal-50 text-teal-700 border border-teal-100 font-black text-xs hover:bg-teal-100 px-4 py-2 rounded-xl transition-all shadow-sm"
                      >
                        Download
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(rec);
                        }}
                        className="bg-red-600 text-white border border-red-600 font-black text-xs hover:bg-red-700 px-4 py-2 rounded-xl transition-all shadow-lg shadow-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="ml-16 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                    {[
                      ['File name', rec.fileName || rec.name],
                      ['File type', rec.fileType || rec.type],
                      ['Upload date', rec.uploadDate || rec.date],
                      ['File size', rec.fileSize || rec.size],
                      ['Record risk', typeof rec.recordRiskScore === 'number' ? `${rec.recordRiskScore}/100` : 'Pending'],
                      ['Abnormal', rec.abnormalValueCount ?? analysis?.abnormalValues?.length ?? 0]
                    ].map(([label, value]) => (
                      <div key={label} className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                        <p className="text-xs font-bold text-gray-700 truncate" title={value}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {analysis && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="ml-16 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest mb-1">AI Analysis</p>
                          <p className="text-sm text-gray-700 font-medium leading-relaxed">{analysis.summary}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase border ${riskStyles[analysis.riskLevel] || riskStyles.Low}`}>
                            {analysis.riskLevel} Risk
                          </span>
                          {typeof analysis.reportRiskScore === 'number' && (
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                              Score {analysis.reportRiskScore}/100
                            </span>
                          )}
                        </div>
                      </div>

                      {extractedParameters.length > 0 && (
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Extracted Parameters</p>
                            <div className="h-2 w-28 bg-white rounded-full overflow-hidden border border-gray-100">
                              <div
                                className={`h-full ${
                                  (analysis.reportRiskScore || 0) >= 70 ? 'bg-red-500' :
                                  (analysis.reportRiskScore || 0) >= 35 ? 'bg-amber-500' :
                                  'bg-teal-500'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, analysis.reportRiskScore || 0))}%` }}
                              />
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left">
                              <thead>
                                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200">
                                  <th className="py-2 pr-3">Parameter</th>
                                  <th className="py-2 pr-3">Value</th>
                                  <th className="py-2 pr-3">Normal Range</th>
                                  <th className="py-2 pr-3">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {extractedParameters.map((param, idx) => (
                                  <tr key={`${param.name}-${idx}`} className="border-b border-gray-100 last:border-0">
                                    <td className="py-3 pr-3 text-xs font-black text-gray-800">{param.name}</td>
                                    <td className="py-3 pr-3 text-xs font-bold text-gray-700">{param.value}</td>
                                    <td className="py-3 pr-3 text-xs font-medium text-gray-500">{param.normalRange}</td>
                                    <td className="py-3 pr-3">
                                      <span className={`inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${parameterStatusStyles[param.status] || parameterStatusStyles.Normal}`}>
                                        {param.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Detected Health Parameters</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {(analysis.parameters || []).map((param, idx) => (
                              <div key={idx} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                                <p className="text-xs font-black text-gray-800">{param.name}</p>
                                <p className="text-xs text-gray-500 mt-1">{param.value}</p>
                                <p className="text-[10px] font-bold text-teal-600 mt-1 uppercase tracking-wider">{param.status}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Abnormal Indicators</p>
                            <div className="space-y-1.5">
                              {(analysis.abnormal || []).map((item, idx) => (
                                <p key={idx} className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{item}</p>
                              ))}
                            </div>
                          </div>
                          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                            <p className="text-[10px] font-black text-teal-700 uppercase tracking-widest mb-1">Suggested Next Action</p>
                            <p className="text-xs font-bold text-teal-800 leading-relaxed">{analysis.nextAction}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Extraction Source</p>
                          <p className="text-xs font-black text-gray-700">{analysis.extraction?.source || rec.extractionSource || 'mock_extraction'}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">OCR Status</p>
                          <p className="text-xs font-black text-gray-700">{analysis.extraction?.ocrStatus || 'Not configured'}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Confidence</p>
                          <p className="text-xs font-black text-gray-700">{analysis.extraction?.confidence ? `${analysis.extraction.confidence}%` : 'Pending'}</p>
                        </div>
                      </div>

                      <p className="text-[10px] font-bold text-gray-400 leading-relaxed">
                        {analysis.extraction?.note || 'Mock analysis is based on file name and document type. OCR/extraction can be connected later without changing this view.'}
                      </p>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs font-black text-gray-300">
                DOC
              </div>
              <h3 className="text-lg font-bold text-gray-900">No Records Match This Filter</h3>
              <p className="text-sm text-gray-400 font-medium max-w-[280px]">Try another timeline filter or upload a new record.</p>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-xs font-black text-gray-300 opacity-80 border-2 border-dashed border-gray-200">
              DOC
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">No Records Found</h3>
              <p className="text-sm text-gray-400 font-medium max-w-[240px]">Upload your medical reports, medication lists, or scans to keep them in one place.</p>
            </div>
            <button
              onClick={handleUploadClick}
              className="text-teal-600 font-bold text-sm hover:underline"
            >
              Start by uploading a document
            </button>
          </div>
        )}
      </div>
      <RecordAnalysisModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onDownload={handleDownload}
        onDelete={handleDelete}
      />
    </motion.div>
  );
}
