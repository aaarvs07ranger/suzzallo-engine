const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const sourceNextDir = path.join(packageRoot, ".next");

function ensureDeterministicManifest(nextDir) {
  const routesManifest = path.join(nextDir, "routes-manifest.json");
  const deterministicManifest = path.join(nextDir, "routes-manifest-deterministic.json");

  if (fs.existsSync(routesManifest) && !fs.existsSync(deterministicManifest)) {
    fs.copyFileSync(routesManifest, deterministicManifest);
    process.stdout.write(`Created ${path.relative(packageRoot, deterministicManifest) || deterministicManifest}\n`);
  }
}

if (!fs.existsSync(sourceNextDir)) {
  process.stdout.write(`Skipped postbuild compatibility step because ${sourceNextDir} does not exist\n`);
  process.exit(0);
}

ensureDeterministicManifest(sourceNextDir);
