import React from 'react';
import { LabResultTest } from '@/app/features/integrations/services/types';

type ParsedCultureResult = {
  summary: Array<{ label: string; value: string }>;
  isolates: string[];
  susceptibility: Array<{ antibiotic: string; interpretation: string; mic: string }>;
  interpretation: string[];
};

const SUSCEPTIBILITY_TOKENS = new Set(['S', 'I', 'R', 'T', 'F', 'N/I']);

const tryParseSummaryOrIsolate = (line: string, parsed: ParsedCultureResult): boolean => {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return false;
  const beforeColon = line.slice(0, colonIndex).trim();
  const afterColon = line.slice(colonIndex + 1).trim();
  if (!beforeColon || !afterColon) return false;
  const isolatePrefix = beforeColon.toLowerCase().startsWith('isolate ');
  if (!isolatePrefix) {
    parsed.summary.push({ label: beforeColon, value: afterColon });
    return true;
  }
  const isolateNumber = Number.parseInt(beforeColon.slice('isolate '.length).trim(), 10);
  if (Number.isFinite(isolateNumber)) {
    parsed.isolates.push(afterColon);
    return true;
  }
  return false;
};

const isMicHeaderLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  if (!lower.startsWith('isolate ')) return false;
  const micIndex = lower.indexOf(' mic');
  if (micIndex === -1) return false;
  const isolateNumber = Number.parseInt(line.slice('isolate '.length, micIndex).trim(), 10);
  return Number.isFinite(isolateNumber);
};

const tryParseSusceptibility = (line: string, parsed: ParsedCultureResult): boolean => {
  const parts = line.split(/\s+/);
  if (parts.length < 3) return false;
  const interpretationToken = parts.at(-2)!.toUpperCase();
  if (!SUSCEPTIBILITY_TOKENS.has(interpretationToken)) return false;
  const antibiotic = parts.slice(0, -2).join(' ').trim();
  const mic = parts.at(-1)!.trim();
  if (antibiotic && mic) {
    parsed.susceptibility.push({ antibiotic, interpretation: interpretationToken, mic });
  }
  return true;
};

const parseCultureResult = (raw: string): ParsedCultureResult => {
  const lines = raw
    .replaceAll('\r', '')
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
      parsed.interpretation.push(line.replaceAll('**', '').trim());
      continue;
    }
    if (inInterpretation) {
      parsed.interpretation.push(line);
      continue;
    }
    if (tryParseSummaryOrIsolate(line, parsed)) continue;
    if (isMicHeaderLine(line)) continue;
    tryParseSusceptibility(line, parsed);
  }

  return parsed;
};

const LabResultValue = ({ test }: { test: LabResultTest }) => {
  const resultText = String(test.result ?? '');
  const isCultureLike =
    /culture results/i.test(String(test.name ?? '')) && /isolate/i.test(resultText);

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
          {parsed.summary.map((item) => (
            <React.Fragment key={`summary-${item.label}-${item.value}`}>
              <div className="text-caption-1 text-text-secondary">{item.label}</div>
              <div className="text-caption-1 text-text-primary whitespace-pre-wrap break-words">
                {item.value}
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : null}

      {parsed.isolates.length > 0 ? (
        <div className="flex flex-col gap-1">
          {parsed.isolates.map((isolate, idx) => (
            <div key={`isolate-${isolate}`} className="text-caption-1 text-text-primary">
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
                <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">
                  Antibiotic
                </th>
                <th className="text-left text-caption-1 text-text-tertiary py-1 pr-2">Result</th>
                <th className="text-left text-caption-1 text-text-tertiary py-1">MIC</th>
              </tr>
            </thead>
            <tbody>
              {parsed.susceptibility.map((row) => (
                <tr
                  key={`sus-${row.antibiotic}-${row.interpretation}-${row.mic}`}
                  className="border-b border-card-border last:border-0"
                >
                  <td className="text-caption-1 text-text-primary py-1 pr-2">{row.antibiotic}</td>
                  <td className="text-caption-1 text-text-primary py-1 pr-2">
                    {row.interpretation}
                  </td>
                  <td className="text-caption-1 text-text-primary py-1">{row.mic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {parsed.interpretation.length > 0 ? (
        <details>
          <summary className="text-caption-1 text-text-secondary cursor-pointer">
            Interpretation notes
          </summary>
          <div className="text-caption-1 text-text-secondary whitespace-pre-wrap break-words mt-1">
            {parsed.interpretation.join('\n')}
          </div>
        </details>
      ) : null}
    </div>
  );
};

export default LabResultValue;
