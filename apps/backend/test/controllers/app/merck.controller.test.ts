import { MerckMobileController } from "../../../src/controllers/app/merck.controller";
import { MerckService } from "../../../src/services/merck.service";

jest.mock("../../../src/services/merck.service", () => {
  const actual = jest.requireActual("../../../src/services/merck.service");
  return {
    ...actual,
    MerckService: {
      searchConsumer: jest.fn(),
    },
  };
});

const mockedMerckService = MerckService as unknown as {
  searchConsumer: jest.Mock;
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("MerckMobileController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forces consumer audience for mobile search", async () => {
    mockedMerckService.searchConsumer.mockResolvedValueOnce({
      entries: [],
      meta: { total: 0 },
    });

    const req = {
      query: { q: "dog", audience: "PROV" },
    } as unknown as {
      params: Record<string, string>;
      query: Record<string, string>;
    };

    const res = createResponse();

    await MerckMobileController.searchManuals(req as any, res as any);

    expect(mockedMerckService.searchConsumer).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "dog",
        audience: "PAT",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
