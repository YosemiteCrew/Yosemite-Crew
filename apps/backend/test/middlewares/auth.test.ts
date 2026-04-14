const mockVerify = jest.fn();
const mockDecode = jest.fn();

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    verify: (...args: any[]) => mockVerify(...args),
    decode: (...args: any[]) => mockDecode(...args),
  },
}));

jest.mock("jwks-rsa", () => () => ({
  getSigningKey: jest.fn(),
}));

const verifyIdToken = jest.fn();

jest.mock("firebase-admin", () => ({
  __esModule: true,
  default: {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    auth: () => ({ verifyIdToken }),
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const loadAuth = () => {
  jest.resetModules();
  process.env.COGNITO_REGION = "us-east-1";
  process.env.COGNITO_USER_POOL_ID = "pool";
  process.env.COGNITO_USER_POOL_ID_MOBILE = "pool-mobile";
  process.env.COGNITO_AUDIENCE = "aud";
  return require("../../src/middlewares/auth");
};

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyIdToken.mockResolvedValue({ sub: "user", email: "a@b.com" });
  });

  it("rejects missing auth header", async () => {
    const { authorizeCognito } = loadAuth();
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await authorizeCognito(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid cognito token", async () => {
    const { authorizeCognito } = loadAuth();
    mockVerify.mockImplementation(
      (token: string, key: any, opts: any, cb: any) =>
        cb(null, {
          sub: "user-1",
          email: "a@b.com",
          given_name: "A",
          family_name: "B",
        }),
    );

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = makeRes();
    const next = jest.fn();

    await authorizeCognito(req, res, next);

    expect(req.userId).toBe("user-1");
    expect(req.provider).toBe("cognito");
    expect(next).toHaveBeenCalled();
  });

  it("rejects invalid cognito token", async () => {
    const { authorizeCognito } = loadAuth();
    mockVerify.mockImplementation(
      (token: string, key: any, opts: any, cb: any) => cb(new Error("bad")),
    );

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = makeRes();
    const next = jest.fn();

    await authorizeCognito(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("authorizes mobile token via cognito", async () => {
    const { authorizeCognitoMobile } = loadAuth();
    mockDecode.mockReturnValue({
      iss: "https://cognito-idp.us-east-1.amazonaws.com/pool-mobile",
    });
    mockVerify.mockImplementation(
      (token: string, key: any, opts: any, cb: any) =>
        cb(null, { sub: "user-2", email: "a@b.com" }),
    );

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = makeRes();
    const next = jest.fn();

    await authorizeCognitoMobile(req, res, next);

    expect(req.userId).toBe("user-2");
    expect(req.provider).toBe("cognito");
    expect(next).toHaveBeenCalled();
  });

  it("authorizes mobile token via firebase", async () => {
    const { authorizeCognitoMobile } = loadAuth();
    mockDecode.mockReturnValue({
      iss: "https://securetoken.google.com/project",
    });

    const req: any = { headers: { authorization: "Bearer token" } };
    const res = makeRes();
    const next = jest.fn();

    await authorizeCognitoMobile(req, res, next);

    expect(verifyIdToken).toHaveBeenCalled();
    expect(req.provider).toBe("firebase");
    expect(next).toHaveBeenCalled();
  });
});
