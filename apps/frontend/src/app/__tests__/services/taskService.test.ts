import {
  changeTaskStatus,
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
  loadTasksForPrimaryOrg,
  updateTask,
} from "@/app/services/taskService";

const getDataMock = jest.fn();
const postDataMock = jest.fn();
const patchDataMock = jest.fn();

const orgState = { primaryOrgId: "org-1" };
const taskStoreState: any = {
  startLoading: jest.fn(),
  status: "idle",
  setTasksForOrg: jest.fn(),
  upsertTask: jest.fn(),
};

jest.mock("@/app/services/axios", () => ({
  getData: (...args: any[]) => getDataMock(...args),
  postData: (...args: any[]) => postDataMock(...args),
  patchData: (...args: any[]) => patchDataMock(...args),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: { getState: () => orgState },
}));

jest.mock("@/app/stores/taskStore", () => ({
  useTaskStore: { getState: () => taskStoreState },
}));

describe("taskService", () => {
  beforeEach(() => {
    getDataMock.mockReset();
    postDataMock.mockReset();
    patchDataMock.mockReset();
    taskStoreState.startLoading.mockReset();
    taskStoreState.setTasksForOrg.mockReset();
    taskStoreState.upsertTask.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore?.();
    (console.error as jest.Mock).mockRestore?.();
  });

  it("loads tasks for org", async () => {
    getDataMock.mockResolvedValue({ data: [{ _id: "t1" }] });

    await loadTasksForPrimaryOrg();

    expect(getDataMock).toHaveBeenCalledWith("/v1/task/pms/organisation/org-1");
    expect(taskStoreState.setTasksForOrg).toHaveBeenCalledWith("org-1", [
      { _id: "t1" },
    ]);
  });

  it("creates custom task and upserts", async () => {
    postDataMock.mockResolvedValue({ data: { _id: "t1", audience: "EMPLOYEE_TASK" } });

    await createTask({ _id: "", source: "CUSTOM", audience: "EMPLOYEE_TASK" } as any);

    expect(postDataMock).toHaveBeenCalledWith("/v1/task/pms/custom", expect.any(Object));
    expect(taskStoreState.upsertTask).toHaveBeenCalled();
  });

  it("updates task", async () => {
    patchDataMock.mockResolvedValue({ data: { _id: "t1" } });

    await updateTask({ _id: "t1" } as any);

    expect(patchDataMock).toHaveBeenCalledWith("/v1/task/pms/t1", expect.any(Object));
    expect(taskStoreState.upsertTask).toHaveBeenCalled();
  });

  it("changes task status", async () => {
    patchDataMock.mockResolvedValue({ data: { _id: "t1" } });

    await changeTaskStatus({ _id: "t1", status: "COMPLETED" } as any);

    expect(patchDataMock).toHaveBeenCalledWith(
      "/v1/task/pms/t1/status",
      { status: "COMPLETED" }
    );
  });

  it("creates task template", async () => {
    postDataMock.mockResolvedValue({ data: {} });

    await createTaskTemplate({ _id: "", source: "ORG_TEMPLATE" } as any);

    expect(postDataMock).toHaveBeenCalledWith(
      "/v1/task/pms/templates",
      expect.any(Object)
    );
  });

  it("loads templates and library", async () => {
    getDataMock.mockResolvedValue({ data: [] });

    const templates = await getTaskTemplatesForPrimaryOrg();
    const library = await getTaskLibrary();

    expect(templates).toEqual([]);
    expect(library).toEqual([]);
  });
});
