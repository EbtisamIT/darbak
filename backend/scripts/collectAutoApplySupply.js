const mongoose = require("mongoose");
const { runAutoApplySupplyDiscovery } = require("../services/autoApplySupplyCollector");

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--write", "--load-brave-env"].includes(arg))) throw new Error("INVALID_ARGUMENT");
  const preview = !args.includes("--write");
  if (args.includes("--load-brave-env")) {
    if (!preview) throw new Error("SEARCH_ENV_PREVIEW_ONLY");
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      const fs = require("node:fs");
      const path = require("node:path");
      const file = process.env.AUTO_APPLY_SUPPLY_PREVIEW_ENV_FILE || path.resolve(__dirname, "../.env");
      if (fs.existsSync(file)) {
        const env = require("dotenv").parse(fs.readFileSync(file));
        if (env.BRAVE_SEARCH_API_KEY) process.env.BRAVE_SEARCH_API_KEY = env.BRAVE_SEARCH_API_KEY;
      }
    }
  }
  if (!preview) {
    if (process.env.AUTO_APPLY_SUPPLY_COLLECTOR_ENABLED !== "true") throw new Error("SUPPLY_COLLECTOR_DISABLED");
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI_REQUIRED");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  }
  try {
    const report = await runAutoApplySupplyDiscovery({ preview });
    console.log(JSON.stringify(report));
    if (["failed", "already_running"].includes(report.status)) process.exitCode = 1;
  } finally {
    if (!preview) await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error("SUPPLY_COLLECTOR_CLI_FAILED");
  process.exitCode = 1;
});
