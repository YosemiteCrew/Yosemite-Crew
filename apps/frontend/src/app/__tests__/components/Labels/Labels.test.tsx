import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Labels from "@/app/components/Labels/Labels";

const subLabelsMock = jest.fn(
  ({ labels, setActiveLabel }: any) => (
    <div data-testid="sub-labels-mock">
      {labels.map((label: any) => (
        <button
          key={label.key}
          data-testid={`sub-${label.key}`}
          onClick={() => setActiveLabel(label.key)}
        >
          {label.name}
        </button>
      ))}
    </div>
  )
);

jest.mock("@/app/components/Labels/SubLabels", () => ({
  __esModule: true,
  default: (props: any) => subLabelsMock(props),
}));

const makeIcon =
  (label: string) =>
  ({ color }: { color?: string }) =>
    <span>{`${label} icon (${color})`}</span>;

const LABELS = [
  {
    key: "info",
    name: "Info",
    icon: makeIcon("Info"),
    iconSize: 24,
    labels: [
      { key: "details", name: "Details" },
      { key: "care", name: "Care" },
    ],
  },
  {
    key: "actions",
    name: "Actions",
    icon: makeIcon("Actions"),
    iconSize: 24,
    labels: [{ key: "log", name: "Log activity" }],
  },
];

describe("<Labels />", () => {
  beforeEach(() => {
    subLabelsMock.mockClear();
  });

  test("renders icon buttons and triggers setActiveLabel", () => {
    const setActiveLabel = jest.fn();
    render(
      <Labels
        labels={LABELS}
        activeLabel="info"
        setActiveLabel={setActiveLabel}
        activeSubLabel="details"
        setActiveSubLabel={jest.fn()}
      />
    );

    const actionButton = screen.getByRole("button", { name: /Actions icon/i });
    fireEvent.click(actionButton);
    expect(setActiveLabel).toHaveBeenCalledWith("actions");
    expect(subLabelsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: LABELS[0].labels,
        activeLabel: "details",
      })
    );
  });

  test("forwards sub label interactions to setActiveSubLabel", () => {
    const setActiveSubLabel = jest.fn();
    render(
      <Labels
        labels={LABELS}
        activeLabel="info"
        setActiveLabel={jest.fn()}
        activeSubLabel="details"
        setActiveSubLabel={setActiveSubLabel}
      />
    );

    fireEvent.click(screen.getByTestId("sub-care"));
    expect(setActiveSubLabel).toHaveBeenCalledWith("care");
  });
});
