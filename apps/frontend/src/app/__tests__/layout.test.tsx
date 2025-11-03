import React from "react";

jest.mock("@/app/components/SessionInitializer", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sessioninitializer-mock">{children}</div>
  ),
}));

import { metadata } from "@/app/layout";

describe("RootLayout", () => {
  test("exports correct metadata", () => {
    expect(metadata.title).toBe("Yosemite Crew");
    expect(metadata.description).toBe(
      "Get Yosemite Crew PMS for your pet business"
    );
    expect(metadata.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "/favicon.ico" }),
        expect.objectContaining({ url: "/favicon-32x32.png" }),
        expect.objectContaining({ url: "/favicon-16x16.png" }),
      ])
    );
    expect(metadata.manifest).toBe("/site.webmanifest");
  });
});
