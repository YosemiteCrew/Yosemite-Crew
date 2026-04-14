const jwtDecodeMock = jest.fn();
const jwtVerifyMock = jest.fn();
const firebaseVerifyIdTokenMock = jest.fn();

jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    decode: (...args: unknown[]) => jwtDecodeMock(...args),
    verify: (...args: unknown[]) => jwtVerifyMock(...args),
  },
}));

jest.mock("firebase-admin", () => ({
  __esModule: true,
  __verifyIdToken: firebaseVerifyIdTokenMock,
  default: {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    auth: () => ({ verifyIdToken: firebaseVerifyIdTokenMock }),
  },
}));

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("authorizeCognitoMobile", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "pool",
      COGNITO_USER_POOL_ID_MOBILE: "mobile-pool",
      COGNITO_AUDIENCE: "audience",
      GOOGLE_APPLICATION_CREDENTIALS: "{}",
    };
    jwtDecodeMock.mockReset();
    jwtVerifyMock.mockReset();
    firebaseVerifyIdTokenMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("accepts Cognito mobile tokens", async () => {
    jwtDecodeMock.mockReturnValue({
      iss: "https://cognito-idp.us-east-1.amazonaws.com/mobile-pool",
      sub: "cog-user",
      email: "cog@example.com",
    });
    jwtVerifyMock.mockImplementation(
      (
        _token: string,
        _key: unknown,
        _opts: unknown,
        cb: (err: unknown, decoded?: unknown) => void,
      ) => {
        cb(null, { sub: "cog-user", email: "cog@example.com" });
      },
    );

    const { authorizeCognitoMobile } =
      await import("../../src/middlewares/auth");

    const req = {
      headers: { authorization: "Bearer test-token" },
    } as any;
    const res = createResponse();
    const next = jest.fn();

    await authorizeCognitoMobile(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("cog-user");
    expect(req.provider).toBe("cognito");
  });

  it("accepts Firebase mobile tokens", async () => {
    jwtDecodeMock.mockReturnValue({
      iss: "https://securetoken.google.com/project-id",
    });
    firebaseVerifyIdTokenMock.mockResolvedValue({
      sub: "fb-user",
      email: "fb@example.com",
    });

    const { authorizeCognitoMobile } =
      await import("../../src/middlewares/auth");

    const req = {
      headers: { authorization: "Bearer test-token" },
    } as any;
    const res = createResponse();
    const next = jest.fn();

    await authorizeCognitoMobile(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe("fb-user");
    expect(req.provider).toBe("firebase");
  });
});
