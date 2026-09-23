import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const checker = resolve(
  __dirname,
  "../../../../scripts/check-staged-secrets.js",
);
const git = execFileSync("which", ["git"], { encoding: "utf8" }).trim();

const runChecker = (files: Record<string, string>) => {
  const repository = mkdtempSync(join(tmpdir(), "yc-staged-secret-"));

  try {
    const bin = join(repository, "bin");
    mkdirSync(bin);
    symlinkSync(git, join(bin, "git"));
    const env = { ...process.env, PATH: bin };
    execFileSync("git", ["init", "--quiet"], { cwd: repository });

    for (const [file, content] of Object.entries(files)) {
      const target = join(repository, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
      execFileSync("git", ["add", "-f", "--", file], { cwd: repository });
    }

    const gitControl = spawnSync("git", ["--version"], { env });
    expect(gitControl.status).toBe(0);

    return spawnSync(process.execPath, [checker], {
      cwd: repository,
      encoding: "utf8",
      env,
    });
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
};

test("scans staged text files outside frontend and mobile", () => {
  const value = ["fixture", "only", "not", "credential", "7Q9Z2X8M4"].join("-");
  const result = runChecker({
    "apps/backend/config.js": `const token = "${value}";`,
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /apps\/backend\/config\.js:1 \(generic secret assignment\)/,
  );
});

test("blocks local env files outside frontend and mobile", () => {
  const result = runChecker({
    "packages/database/.env.local": "ordinary fixture prose",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /packages\/database\/\.env\.local:1 \(local secrets file\)/,
  );
});

test("warns when gitleaks is unavailable", () => {
  const result = runChecker({});

  expect(result.status).toBe(0);
  expect(result.stderr).toMatch(/gitleaks is not installed/);
});

test("keeps env examples stageable", () => {
  const result = runChecker({
    "packages/auth/.env.example": "ordinary fixture prose",
  });

  expect(result.status).toBe(0);
  expect(result.stderr).not.toMatch(/local secrets file/);
});

test("allows benign changes to the tracked iOS Info.plist", () => {
  const result = runChecker({
    "apps/mobileAppYC/ios/mobileAppYC/Info.plist":
      "<plist><dict><key>UIAppFonts</key><array><string>Example.otf</string></array></dict></plist>",
  });

  expect(result.status).toBe(0);
  expect(result.stderr).not.toMatch(/local secrets file/);
});

test("still scans the tracked iOS Info.plist content for secrets", () => {
  const value = ["fixture", "only", "not", "credential", "7Q9Z2X8M4"].join("-");
  const result = runChecker({
    "apps/mobileAppYC/ios/mobileAppYC/Info.plist": `<!-- token = "${value}" -->`,
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /apps\/mobileAppYC\/ios\/mobileAppYC\/Info\.plist:1 \(generic secret assignment\)/,
  );
});

test("keeps the untracked Google service plist blocked", () => {
  const result = runChecker({
    "apps/mobileAppYC/ios/GoogleService-Info.plist": "ordinary fixture prose",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(
    /GoogleService-Info\.plist:1 \(local secrets file\)/,
  );
});
