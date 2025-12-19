import React from "react";
import { StepContent, ProgressProps } from "@/app/components/Steps/types";

describe("Steps Types", () => {
  it("should support a valid ProgressProps structure", () => {
    // Arrange: Create steps array
    const steps: StepContent[] = [
      { title: "Step 1", logo: "Logo 1" },
      { title: "Step 2", logo: "Logo 2" },
    ];

    // Arrange: Create the parent props object
    const props: ProgressProps = {
      activeStep: 1,
      steps: steps,
    };

    // Assert: Verify the structure
    expect(props.activeStep).toBe(1);
    expect(props.steps).toHaveLength(2);
    expect(props.steps[0].title).toBe("Step 1");
    // Verify ReactNode compatibility (string is a valid ReactNode)
    expect(props.steps[1].logo).toBe("Logo 2");
  });
});