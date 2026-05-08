import React from 'react';
import { generateInsights } from '../utils/assessment';

export default function InsightsSection({ result }) {
  const { reasons, explanation, steps } = generateInsights(result || {});
  return (
    <div className="mt-3 space-y-2">
      <div className="font-semibold">Insights</div>
      <div>
        <div className="font-medium">Possible Reasons:</div>
        <ul className="list-disc ml-5 text-sm">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="font-medium">Explanation:</div>
        <div className="text-sm text-gray-300">{explanation}</div>
      </div>
      <div>
        <div className="font-medium">Suggested Next Step:</div>
        <div className="text-sm">{steps}</div>
      </div>
    </div>
  );
}
