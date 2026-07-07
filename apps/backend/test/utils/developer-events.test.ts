import {
  emitDeveloperEvent,
  subscribeToDeveloperEvents,
  type DeveloperEvent,
} from "../../src/utils/developer-events";

describe("developer-events bus", () => {
  it("delivers emitted events to subscribers with the full envelope", () => {
    const received: DeveloperEvent[] = [];
    const unsubscribe = subscribeToDeveloperEvents((event) =>
      received.push(event),
    );

    emitDeveloperEvent("api_key.created", "org-1", { keyId: "key-1" });

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "api_key.created",
      organisationId: "org-1",
      data: { keyId: "key-1" },
    });
    expect(new Date(received[0].occurredAt).getTime()).not.toBeNaN();
    unsubscribe();
  });

  it("defaults data to an empty object", () => {
    const received: DeveloperEvent[] = [];
    const unsubscribe = subscribeToDeveloperEvents((event) =>
      received.push(event),
    );

    emitDeveloperEvent("sandbox.deleted", "org-2");

    expect(received[0].data).toEqual({});
    unsubscribe();
  });

  it("fans out one emit to every subscriber", () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribeToDeveloperEvents(first);
    const unsubscribeSecond = subscribeToDeveloperEvents(second);

    emitDeveloperEvent("export.completed", "org-3", { exportJobId: "job-1" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("stops delivery after unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToDeveloperEvents(listener);
    unsubscribe();

    emitDeveloperEvent("usage.threshold_crossed", "org-4", { threshold: 80 });

    expect(listener).not.toHaveBeenCalled();
  });
});
