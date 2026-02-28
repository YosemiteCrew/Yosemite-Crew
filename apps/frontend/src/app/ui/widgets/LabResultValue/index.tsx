import React from 'react';
import { LabResultTest } from '@/app/features/integrations/services/types';

type ParsedCultureResult = {
  summary: Array<{ label: string; value: string }>;
  isolates: string[];
  susceptibility: Array<{ antibiotic: string; interpretation: string; mic: string }>;
  interpretation: string[];
};

const parseCultureResult = (raw: string): ParsedCultureResult => {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: ParsedCultureResult = {
    summary: [],
    isolates: [],
    susceptibility: [],
    interpretation: [],
  };

  let inInterpretation = false;
  for (const line of lines) {
    if (line.startsWith('**INTERPRETATION KEY')) {
      inInterpretation = true;
      parsed.interpretation.push(line.replace(/\*\*/g, '').trim());
      continue;
    }
    if (inInterpretation) {
      parsed.interpretation.push(line);
      continue;
    }

    const kvMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (kvMatch && !/^Isolate\s+\d+/i.test(line)) {
      parsed.summary.push({ label: kvMatch[1].trim(), value: kvMatch[2].trim() });
      continue;
    }

    const isolateMatch = line.match(/^Isolate\s+\d+:\s*(.+)$/i);
    if (isolateMatch) {
      parsed.isolates.push(isolateMatch[1].trim());
      continue;
    }

    if (/^Isolate\s+\d+\s+MIC/i.test(line)) {
      continue;
    }

    const susceptibilityMatch = line.match(/^(.+?)\s+([SIRTF]|N\/I)\s+(.+)$/i);
    if (susceptibilityMatch) {
      parsed.susceptibility.push({
        antibiotic: susceptibilityMatch[1].trim(),
        interpretation: susceptibilityMatch[2].trim().toUpperCase(),
        mic: susceptibilityMatch[3].trim(),
      });
    }
  }

  return parsed;
};

const LabResultValue = ({ test }: { test: LabResultTest }) => {
  const resultText = String(test.result ?? '');
  const isCultureLike = /culture results/i.test(String(test.name ?? '')) && /isolate/i.test(resultText);

  if (!isCultureLike) {
    return (
      <>
        {test.result}
        {test.units ? ` ${test.units}` : ''}
      </>
    );
  }

  const parsed = parseCultureResult(resultText);

  return (
    <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
      {parsed.summary.length > 0 ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
          {parsed.summary.map((item, idx) => (
            <React.Fragment key={`summary-${idx}`}>
              <div className="text-caption-1 text-text-secondary">{item.label}</div>
              <div className="text-caption-1 text-text-primary whitespace-pre-wrap break-words">{item.value}</div>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {parsed.isolates.length > 0 ? (
        <div className="flex flex-col gap-1">
          {parsed.isolates.map((isolate, idx) => (
            <div key={`isolate-${idx}`} className="text-caption-1 text-text-primary">
              Isolate {idx + 1}: {isolate}
            </div>
          ))}
        </div>
      ) : null}

      {parsed.susceptibility.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[360px] w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Antibiotic</th>
                <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Result</th>
                <th className="text-left text-caption-1 text-text-tertiary py-1">MIC</th>
              </tr>
            </thead>
            <tbody>
              {parsed.susceptibility.map((row, idx) => (
                <tr key={`sus-${idx}`} className="border-b border-card-border last:border-0">
                  <td className="text-caption-1 text-text-primary py-1 pr-2">{row.antibiotic}</td>
                  <td className="text-caption-1 text-text-primary py-1 pr-2">{row.interpretation}</td>
                  <td className="text-caption-1 text-text-primary py-1">{row.mic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {parsed.interpretation.length > 0 ? (
        <details>
          <summary className="text-caption-1 text-text-secondary cursor-pointer">Interpretation notes</summary>
          <div className="text-caption-1 text-text-secondary whitespace-pre-wrap break-words mt-1">
            {parsed.interpretation.join('\n')}
          </div>
        </details>
      ) : null}
    </div>
  );
};

export default LabResultValue;
