import { useCounterStore } from "../../stores/counterStore";

const baseCounter = {
  orgId: "org-1",
  appointmentsUsed: 1,
  toolsUsed: 2,
  usersActiveCount: 1,
  usersBillableCount: 1,
};

describe("counter store", () => {
  beforeEach(() => {
    useCounterStore.setState({
      countersByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
  });

  it("sets counters and indexes by orgId", () => {
    useCounterStore.getState().setCounters([baseCounter]);

    const state = useCounterStore.getState();
    expect(state.countersByOrgId["org-1"]).toEqual(baseCounter);
    expect(state.status).toBe("loaded");
  });

  it("patches and increments counters", () => {
    useCounterStore.getState().setCounters([baseCounter]);

    useCounterStore.getState().patchCounter("org-1", { toolsUsed: 5 });
    useCounterStore.getState().increaseAppointmentsUsed("org-1", 2);

    const state = useCounterStore.getState();
    expect(state.countersByOrgId["org-1"].toolsUsed).toBe(5);
    expect(state.countersByOrgId["org-1"].appointmentsUsed).toBe(3);
  });

  it("clamps counters at zero on decrease", () => {
    useCounterStore.getState().setCounters([baseCounter]);

    useCounterStore.getState().decreaseToolsUsed("org-1", 5);
    useCounterStore.getState().decreaseUsersBillableCount("org-1", 2);

    const counter = useCounterStore.getState().countersByOrgId["org-1"];
    expect(counter.toolsUsed).toBe(0);
    expect(counter.usersBillableCount).toBe(0);
  });

  it("removes counter for org", () => {
    useCounterStore.getState().setCounters([baseCounter]);
    useCounterStore.getState().removeCounterForOrg("org-1");

    expect(useCounterStore.getState().countersByOrgId["org-1"]).toBeUndefined();
  });
});
