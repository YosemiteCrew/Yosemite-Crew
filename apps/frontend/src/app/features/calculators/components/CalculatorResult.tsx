import { Text } from '@/app/ui';

export type ResultRow = {
  label: string;
  value: string;
};

type CalculatorResultProps = {
  rows: ResultRow[];
};

const CalculatorResult = ({ rows }: CalculatorResultProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl bg-card-bg p-5"
    >
      <Text as="h3" variant="body-3-emphasis" className="text-text-primary">
        Result
      </Text>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <Text variant="body-4" className="text-text-secondary">
              {row.label}
            </Text>
            <Text variant="body-4-emphasis" className="text-text-primary">
              {row.value}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalculatorResult;
