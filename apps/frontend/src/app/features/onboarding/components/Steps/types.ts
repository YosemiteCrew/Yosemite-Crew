export type StepContent = {
  title: string;
  logo: React.ReactNode;
};

export type ProgressProps = {
  activeStep: number;
  steps: StepContent[];
}

