import {
  getControlReports,
  hasFailedControl,
  recordControl,
  resetControlsForTest,
} from "src/config/startup-controls";

describe("startup controls", () => {
  beforeEach(() => resetControlsForTest());

  it("reports nothing before any control registers", () => {
    expect(getControlReports()).toEqual([]);
    expect(hasFailedControl()).toBe(false);
  });

  it("distinguishes applied, skipped and failed", () => {
    recordControl("a-applied", "applied");
    recordControl("b-skipped", "skipped", "credentials missing");
    recordControl("c-failed", "failed", "rejected");

    const states = Object.fromEntries(
      getControlReports().map((r) => [r.name, r.state]),
    );
    expect(states).toEqual({
      "a-applied": "applied",
      "b-skipped": "skipped",
      "c-failed": "failed",
    });
  });

  // The distinction this whole module exists for: a control that FAILED to
  // apply must not read the same as one that was never asked to. An environment
  // without Stream credentials has nothing to configure; one whose
  // updateAppSettings was rejected has an absent security control.
  it("alarms on failed but not on skipped", () => {
    recordControl("stream-upload-policy", "skipped", "credentials missing");
    expect(hasFailedControl()).toBe(false);

    recordControl("stream-upload-policy", "failed", "rejected");
    expect(hasFailedControl()).toBe(true);
  });

  it("keeps only the latest state per control", () => {
    recordControl("x", "failed");
    recordControl("x", "applied");
    expect(getControlReports()).toHaveLength(1);
    expect(hasFailedControl()).toBe(false);
  });

  it("never carries a detail unless one was given", () => {
    recordControl("no-detail", "applied");
    expect(getControlReports()[0]).not.toHaveProperty("detail");
  });
});
