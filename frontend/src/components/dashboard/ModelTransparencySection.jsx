import React from 'react';

export default function ModelTransparencySection({ transparency }) {
  const limits = transparency?.limitations || [];
  const confusionMatrix = transparency?.confusion_matrix;
  const labels = confusionMatrix?.labels || [];
  const matrix = confusionMatrix?.matrix || [];
  const hasMetrics = Number.isFinite(Number(transparency?.accuracy));
  const datasetsUsed = transparency?.datasets_used || [];
  const analysisTrace = transparency?.analysis_trace || {};
  const activeModels = analysisTrace.active_models || [];
  const detectedSymptoms = analysisTrace.detected_symptoms || [];
  const topPredictions = analysisTrace.top_predictions || [];
  const contributors = analysisTrace.contributors || [];
  const validationAudit = transparency?.validation_audit || {};
  const auditWarnings = validationAudit.warnings || [];
  const specializedModels = Object.entries(transparency?.specialized_models || {})
    .filter(([, model]) => model?.available && model?.metrics);

  const formatPercent = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'N/A';
    return `${(numeric * 100).toFixed(2)}%`;
  };

  return (
    <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-sm">
      <div className="mb-5">
        <p className="text-[10px] font-black text-teal-300 uppercase tracking-widest">Analysis / Model Trace</p>
        <h4 className="text-lg font-black">How this analysis was produced</h4>
      </div>

      <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black text-teal-200 uppercase tracking-widest">Current Analysis Trace</p>
            <p className="text-sm font-bold text-white/80">This block changes with the symptoms and vitals entered for this analysis.</p>
          </div>
          {(analysisTrace.risk_score || analysisTrace.risk_level) && (
            <p className="text-xs font-black uppercase tracking-widest text-white/70">
              {analysisTrace.risk_level || 'Risk'} {analysisTrace.risk_score ? `${analysisTrace.risk_score}/100` : ''}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl bg-gray-900/40 p-3">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Detected Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {detectedSymptoms.length > 0 ? detectedSymptoms.map((symptom) => (
                <span key={symptom} className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black text-teal-100">
                  {symptom}
                </span>
              )) : (
                <span className="text-xs font-bold text-white/45">No strong symptom signal detected</span>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-gray-900/40 p-3">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Top Predictions</p>
            <div className="space-y-2">
              {topPredictions.slice(0, 3).map((prediction) => (
                <div key={prediction.name} className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span className="truncate text-white/75">{prediction.name}</span>
                  <span className="text-teal-200">{Number(prediction.probability) || 0}%</span>
                </div>
              ))}
              {topPredictions.length === 0 && <span className="text-xs font-bold text-white/45">No disease prediction returned</span>}
            </div>
          </div>

          <div className="rounded-xl bg-gray-900/40 p-3">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Top Contributors</p>
            <div className="space-y-2">
              {contributors.slice(0, 3).map((item) => (
                <div key={item.label || item.symptom} className="flex items-center justify-between gap-3 text-xs font-bold">
                  <span className="truncate text-white/75">{item.label || item.symptom}</span>
                  <span className="text-teal-200">{item.impact ?? item.contribution ?? 0}</span>
                </div>
              ))}
              {contributors.length === 0 && <span className="text-xs font-bold text-white/45">No contributor breakdown available</span>}
            </div>
          </div>
        </div>

        {activeModels.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {activeModels.map((model) => (
              <div
                key={model.name}
                className={`rounded-xl border p-3 ${model.active ? 'border-teal-300/30 bg-teal-300/10' : 'border-white/10 bg-white/5'}`}
              >
                <p className={`text-xs font-black ${model.active ? 'text-teal-100' : 'text-white/45'}`}>{model.name}</p>
                <p className="mt-1 text-[10px] font-bold leading-snug text-white/50">{model.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Model Type</p>
          <p className="text-sm font-bold leading-relaxed text-white/85">{transparency?.model}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Dataset Registry</p>
          <p className="text-sm font-bold leading-relaxed text-white/85">Static training data and validation metrics below do not change per analysis.</p>
        </div>
      </div>

      {datasetsUsed.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-3">Datasets Used</p>
          <div className="grid gap-2 md:grid-cols-2">
            {datasetsUsed.map((dataset) => (
              <div key={`${dataset.name}-${dataset.purpose}`} className="rounded-xl bg-white/5 p-3">
                <p className="text-xs font-black text-white/85">{dataset.name}</p>
                <p className="mt-1 text-[11px] font-bold text-white/50">{dataset.purpose}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-teal-200">
                  {dataset.rows ?? dataset.samples ?? 'N/A'} samples
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasMetrics && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Training Samples', transparency?.training_samples],
              ['Validation Samples', transparency?.validation_samples],
              ['Disease Classes', transparency?.disease_classes],
              ['Symptoms', transparency?.symptoms]
            ].map(([label, value]) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{value ?? 'N/A'}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Accuracy', transparency?.accuracy],
              ['Precision', transparency?.precision],
              ['Recall', transparency?.recall],
              ['F1-score', transparency?.f1_score]
            ].map(([label, value]) => (
              <div key={label} className="bg-teal-400/10 border border-teal-300/20 rounded-2xl p-3">
                <p className="text-[10px] font-black text-teal-200 uppercase tracking-widest">{label}</p>
                <p className="mt-2 text-xl font-black text-white">{formatPercent(value)}</p>
              </div>
            ))}
          </div>

          {transparency?.evaluation_note && (
            <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-[10px] font-black text-amber-200 uppercase tracking-widest mb-2">Evaluation Note</p>
              <p className="text-sm font-bold leading-relaxed text-white/80">{transparency.evaluation_note}</p>
            </div>
          )}

          {(validationAudit.overfitting_risk || auditWarnings.length > 0) && (
            <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-2">Validation Audit</p>
                  <p className="text-sm font-bold leading-relaxed text-white/80">
                    {validationAudit.recommended_claim || 'Treat these metrics as academic prototype results, not clinical diagnostic accuracy.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="rounded-xl bg-white/10 px-3 py-2 text-white/60">
                    Overfit: {validationAudit.overfitting_risk || 'N/A'}
                  </span>
                  <span className="rounded-xl bg-white/10 px-3 py-2 text-white/60">
                    Data: {validationAudit.dataset_simplicity_risk || 'N/A'}
                  </span>
                </div>
              </div>
              {validationAudit.conservative_accuracy && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/10 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-100">Conservative Reported Accuracy</p>
                    <p className="text-lg font-black text-white">{formatPercent(validationAudit.conservative_accuracy)}</p>
                  </div>
                  {validationAudit.conservative_accuracy_note && (
                    <p className="mt-1 text-xs font-bold leading-relaxed text-white/60">{validationAudit.conservative_accuracy_note}</p>
                  )}
                </div>
              )}
              {auditWarnings.length > 0 && (
                <div className="mt-3 space-y-2">
                  {auditWarnings.slice(0, 3).map((warning) => (
                    <p key={warning} className="text-xs font-bold leading-relaxed text-red-100/80">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {specializedModels.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-3">Specialized Model Metrics</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {specializedModels.map(([key, model]) => (
                  <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-black capitalize text-white">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <p className="mt-1 text-[10px] font-bold text-white/45 line-clamp-2">{model.role}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-black">
                      <span className="text-white/50">Acc</span>
                      <span className="text-right text-teal-200">{formatPercent(model.metrics.accuracy)}</span>
                      <span className="text-white/50">F1</span>
                      <span className="text-right text-teal-200">{formatPercent(model.metrics.f1_score)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transparency?.risk_engine?.formula && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Risk Engine Explanation</p>
              <p className="text-sm font-bold leading-relaxed text-white/75">{transparency.risk_engine.formula}</p>
            </div>
          )}

          {labels.length > 0 && matrix.length > 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Confusion Matrix</p>
                  <p className="text-xs font-bold text-white/60">Rows are actual classes, columns are predicted classes.</p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{labels.length} classes</p>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
                <table className="min-w-[720px] w-full border-collapse text-[10px]">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr>
                      <th className="sticky left-0 z-10 bg-gray-900 p-2 text-left font-black text-white/50">Actual / Pred</th>
                      {labels.map((label) => (
                        <th key={label} className="p-2 text-center font-black text-white/50">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, rowIndex) => (
                      <tr key={labels[rowIndex] || rowIndex} className="border-t border-white/10">
                        <th className="sticky left-0 bg-gray-900 p-2 text-left font-black text-white/60">{labels[rowIndex]}</th>
                        {row.map((value, colIndex) => (
                          <td
                            key={`${rowIndex}-${colIndex}`}
                            className={`p-2 text-center font-bold ${rowIndex === colIndex ? 'text-teal-200 bg-teal-300/10' : 'text-white/60'}`}
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {limits.map((limit, index) => (
          <div key={index} className="bg-white/5 border border-white/10 rounded-2xl p-3">
            <p className="text-[10px] font-black text-teal-300 mb-1">0{index + 1}</p>
            <p className="text-xs font-bold leading-relaxed text-white/75">{limit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
