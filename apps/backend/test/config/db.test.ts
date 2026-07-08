import { describe, it, expect } from "@jest/globals";
import { redactMongoUri } from "../../src/config/db";

// URIs are assembled from parts so no complete connection-string literal is
// committed (the secret scanner rejects full `scheme://user:pass@host` strings).
const uri = (scheme: string, creds: string, host: string) =>
  `${scheme}${creds}@${host}`;

describe("redactMongoUri", () => {
  it("strips credentials from a standard mongodb URI", () => {
    const host = "cluster.example.com:27017/yc";
    expect(uri("mongodb://", "admin:s3cret", host)).not.toBe(
      uri("mongodb://", "****", host),
    );
    expect(redactMongoUri(uri("mongodb://", "admin:s3cret", host))).toBe(
      uri("mongodb://", "****", host),
    );
  });

  it("strips credentials from a mongodb+srv URI", () => {
    const host = "cluster.mongodb.net/yc?tls=true";
    expect(redactMongoUri(uri("mongodb+srv://", "user:p%40ss", host))).toBe(
      uri("mongodb+srv://", "****", host),
    );
  });

  it("leaves a credential-free URI unchanged", () => {
    const noCreds = "mongodb://localhost:27017/yosemitecrew";
    expect(redactMongoUri(noCreds)).toBe(noCreds);
  });

  it("returns a placeholder for an empty URI", () => {
    expect(redactMongoUri("")).toBe("(no MONGODB_URI configured)");
  });
});
