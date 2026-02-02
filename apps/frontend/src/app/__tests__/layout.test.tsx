import React from "react";
import { render, screen } from "@testing-library/react";
import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args) => {
      const message = typeof args[0] === "string" ? args[0] : "";
      // Filter React DOM nesting warnings that occur when testing layout components
      if (
        /cannot be a child of/i.test(message) ||
        /cannot appear as a child of/i.test(message) ||
        /hydration/i.test(message)
      ) {
        return;
      }
      originalError.call(console, ...args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });

  it("renders the layout structure with children", () => {
    render(
      <RootLayout>
        <div data-testid="test-child">Hello World</div>
      </RootLayout>
    );

    const child = screen.getByTestId("test-child");
    expect(child).toBeInTheDocument();
  });

  it("has the correct metadata configuration", () => {
    expect(metadata).toEqual(
      expect.objectContaining({
        title: "Yosemite Crew",
        description: "Get Yosemite Crew PMS for your pet business",
        manifest: "/site.webmanifest",
      })
    );

    expect(Array.isArray(metadata.icons)).toBe(true);
    expect(metadata.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: "/favicon.ico", type: "image/x-icon" }),
        expect.objectContaining({ sizes: "32x32", type: "image/png" }),
      ])
    );
  });
});
