const fs = require("node:fs");
const path = require("node:path");

const nextDir = path.join(process.cwd(), ".next");
const routesManifest = path.join(nextDir, "routes-manifest.json");
const deterministicManifest = path.join(nextDir, "routes-manifest-deterministic.json");

if (fs.existsSync(routesManifest) && !fs.existsSync(deterministicManifest)) {
  fs.copyFileSync(routesManifest, deterministicManifest);
  process.stdout.write("Created .next/routes-manifest-deterministic.json\n");
}
