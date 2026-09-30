const GENERAL_QUERIES = [
  '"cooperative training" Saudi Arabia', '"COOP" Saudi Arabia careers',
  '"internship" Saudi Arabia students', '"summer training" Saudi Arabia',
  '"تدريب تعاوني" السعودية', '"فرص تدريب تعاوني"', '"برنامج التدريب التعاوني"', '"طلاب الجامعات" تدريب',
];
function queriesFor(source) {
  return [...new Set([...(source.searchQueries || []),
    `${source.company} internship Saudi Arabia`, `${source.company} تدريب تعاوني`,
    ...[...(source.officialDomains || []), ...(source.careerDomains || [])].flatMap((domain) =>
      [`site:${domain} coop`, `site:${domain} internship`]), ...GENERAL_QUERIES])].slice(0, 24);
}
// Providers are trusted server modules, never request-supplied URLs or code.
// Contract: { search(query, { signal, limit }): Promise<Array<{url}>> }.
function configuredSearchProvider() {
  const path = process.env.DISCOVERY_SEARCH_PROVIDER_MODULE;
  if (!path) return null;
  if (!require("path").isAbsolute(path)) throw new Error("SEARCH_PROVIDER_MODULE_MUST_BE_ABSOLUTE");
  const provider = require(path);
  if (typeof provider.search !== "function") throw new Error("INVALID_SEARCH_PROVIDER");
  return provider;
}
async function searchOpportunityUrls(query, { provider, limit = 10, timeout = 8000 } = {}) {
  if (!provider) return { urls: [], skipped: "SEARCH_PROVIDER_NOT_CONFIGURED", executed: false };
  const controller = new AbortController(); let timer;
  try {
    const rows = await Promise.race([
      provider.search(query, { limit, signal: controller.signal }),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("SEARCH_TIMEOUT")); }, timeout); }),
    ]);
    if (!Array.isArray(rows)) throw new Error("INVALID_SEARCH_RESPONSE");
    // Snippets are deliberately discarded: only the actual official page is evidence.
    return { urls: rows.slice(0, limit).map((row) => row?.url).filter((url) => typeof url === "string" && url.length <= 3000), executed: true };
  } finally { clearTimeout(timer); }
}
module.exports = { GENERAL_QUERIES, queriesFor, searchOpportunityUrls, configuredSearchProvider };
