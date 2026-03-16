import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entry = path.resolve(__dirname, "../main.ts");
const outfile = path.resolve(__dirname, "../../dist/index.js");

try {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    packages: "external",
    target: "es2022",
  });
  console.log("Build succeeded");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}
