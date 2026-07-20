export type ResultRow = {
  label: string;
  value: string;
};

type CalculatorResultProps = {
  rows: ResultRow[];
};

// Uppercase micro-eyebrow, matching the design's "Calculated dose" label.
const EYEBROW_CLASS = 'text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]';

const CalculatorResult = ({ rows }: CalculatorResultProps) => {
  // A single value renders as the design's serif hero (its label becomes the
  // eyebrow); multiple values fall back to a compact label/value list.
  const single = rows.length === 1 ? rows[0] : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 rounded-[14px] border border-[var(--divider)] bg-[var(--inset)] p-4"
    >
      {single ? (
        <>
          <h3 className={EYEBROW_CLASS}>{single.label}</h3>
          <span className="font-newsreader text-[34px] font-normal leading-[1.1] tracking-[-0.02em] tabular-nums text-[var(--ink)]">
            {single.value}
          </span>
        </>
      ) : (
        <>
          <h3 className={EYEBROW_CLASS}>Result</h3>
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <span className="text-[13px] text-[var(--ink-muted)]">{row.label}</span>
                <span className="text-right text-[14px] font-bold tabular-nums text-[var(--ink)]">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CalculatorResult;
