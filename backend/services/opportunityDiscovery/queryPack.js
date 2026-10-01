const QUERY_PACK = {
  coop: ['"cooperative training" Saudi Arabia', '"COOP program" Saudi Arabia', '"COOP trainee" Saudi Arabia',
    '"cooperative training program" Riyadh', '"cooperative training program" Jeddah',
    '"تدريب تعاوني" السعودية', '"برنامج التدريب التعاوني" السعودية', '"فرصة تدريب تعاوني" السعودية'],
  internship: ["internship Saudi Arabia students", "internship Riyadh university students", "internship Jeddah students",
    "summer internship Saudi Arabia", "student internship Saudi Arabia", '"تدريب صيفي" السعودية', '"برنامج تدريب طلاب" السعودية'],
};
const int = (value, fallback, max) => Number.isInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
function searchSettings(env = process.env) {
  return { maxQueries: int(env.DISCOVERY_MAX_SEARCH_QUERIES_PER_RUN, 20, 50),
    resultsPerQuery: int(env.DISCOVERY_RESULTS_PER_QUERY, 10, 20),
    concurrency: int(env.DISCOVERY_SEARCH_CONCURRENCY, 3, 5) };
}
function companyQueries(source) {
  return [...new Set([...(source.officialDomains || []).flatMap((domain) =>
    [`site:${domain} internship Saudi Arabia`, `site:${domain} "cooperative training"`, `site:${domain} coop`]),
  ...(source.careerDomains || []).map((domain) => `site:${domain} intern Saudi Arabia`), ...(source.searchQueries || [])])];
}
function planQueries(sources, { maxQueries = 25, rotation = 0 } = {}) {
  sources = require("./priority").prioritizeSources(sources, { rotation });
  const general = [...QUERY_PACK.coop, ...QUERY_PACK.internship], plan = [], seen = new Set();
  const add = (query, sourceKey = null) => { if (!seen.has(query) && plan.length < maxQueries) { seen.add(query); plan.push({ query, sourceKey, freshness: "pm" }); } };
  const offset = Math.max(0, Math.floor(rotation));
  for (let i = 0; i < Math.min(general.length, sources.length ? Math.ceil(maxQueries * 0.4) : maxQueries); i++) add(general[(offset + i) % general.length]);
  // Round-robin across companies first, then alternate terms; bounded per run.
  const companyPlans = sources.map(companyQueries), maxRounds = Math.max(0, ...companyPlans.map((q) => q.length));
  for (let round = 0; round < maxRounds && plan.length < maxQueries; round++) {
    for (let i = 0; i < sources.length && plan.length < maxQueries; i++) {
      const index = i, queries = companyPlans[index];
      if (round < queries.length) add(queries[(offset + round) % queries.length], sources[index].key);
    }
  }
  for (let i = 0; i < general.length; i++) add(general[(offset + i) % general.length]);
  return plan;
}
module.exports = { QUERY_PACK, companyQueries, planQueries, searchSettings };
