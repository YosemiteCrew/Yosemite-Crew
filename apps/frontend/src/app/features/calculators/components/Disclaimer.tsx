import { Badge, Text } from '@/app/ui';

type DisclaimerProps = {
  text: string;
};

const Disclaimer = ({ text }: DisclaimerProps) => {
  return (
    <div
      role="note"
      aria-label="Clinical decision support disclaimer"
      className="flex flex-col gap-2 rounded-2xl bg-warning-100 p-4 sm:flex-row sm:items-center"
    >
      <Badge tone="warning" className="w-fit">
        Clinical decision support
      </Badge>
      <Text variant="caption-1" className="text-warning-700">
        {text}
      </Text>
    </div>
  );
};

export default Disclaimer;
