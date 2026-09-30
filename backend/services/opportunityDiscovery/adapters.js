const { strategies } = require("./strategies");
const { failureCode } = require("./failures");

// Compatibility for v1 callers. Parsing now has one owner: each strategy's
// separate discoverJobs/extractJob/verifyJob methods.
const adapters = Object.fromEntries(Object.entries(strategies).map(([key, strategy]) => [key, async (source, reader) => {
  const discovered = await strategy.discoverJobs(source, reader), jobs = [], warnings = [...discovered.warnings];
  for (const reference of discovered.urls.slice(0, source.metadata.maxPages || 4)) {
    try { const result = await strategy.extractJob(reference, source, reader); jobs.push(...result.jobs); if (result.reason) warnings.push(result.reason); }
    catch (e) { warnings.push(failureCode(e)); }
  }
  return { jobs, warnings: [...new Set(warnings)] };
}]));
module.exports = { adapters, genericCompanyAdapter: adapters.generic, greenhouseAdapter: adapters.greenhouse, leverAdapter: adapters.lever };
