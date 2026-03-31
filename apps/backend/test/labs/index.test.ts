jest.mock("src/services/lab-order.service", () => {
  class LabOrderServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { LabOrderServiceError };
});

import { getLabOrderAdapter } from "src/labs";
import { IdexxOrderAdapter } from "src/labs/idexx/idexx-order.adapter";

describe("labs index", () => {
  it("returns adapter for IDEXX", () => {
    const adapter = getLabOrderAdapter("IDEXX");
    expect(adapter).toBeInstanceOf(IdexxOrderAdapter);
  });
});
