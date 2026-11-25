const { SOURCES } = require("./opportunityDiscovery/sources");
const { GENERAL_QUERIES, queriesFor } = require("./opportunityDiscovery/search");

const GENERAL = [...new Set([
  '"تدريب تعاوني" السعودية', '"internship" Saudi Arabia students',
  '"تدريب صيفي" السعودية', '"graduate development program" Saudi Arabia training',
  '"برامج طلاب الجامعات" تدريب السعودية', '"university student program" Saudi Arabia training',
  ...GENERAL_QUERIES,
])];

function bound(value, fallback, max, min = 0) {
  const number = Number(value);
  return value && Number.isInteger(number) && number >= min ? Math.min(number, max) : fallback;
}

function settings(env = process.env) {
  return {
    maxQueries: bound(env.AUTO_APPLY_SUPPLY_MAX_QUERIES_PER_RUN, 8, 24),
    maxPages: bound(env.AUTO_APPLY_SUPPLY_MAX_PAGES_PER_RUN, 16, 40),
    maxNew: bound(env.AUTO_APPLY_SUPPLY_MAX_NEW_CANDIDATES_PER_RUN, 25, 100),
    maxRechecks: bound(env.AUTO_APPLY_SUPPLY_MAX_RECHECKS_PER_RUN, 5, 20),
    freshness: ["pd", "pw", "pm"].includes(env.AUTO_APPLY_SUPPLY_SEARCH_FRESHNESS) ? env.AUTO_APPLY_SUPPLY_SEARCH_FRESHNESS : "pw",
    queries: env.AUTO_APPLY_SUPPLY_SEARCH_QUERIES?.split("\n").map((query) => query.trim().slice(0, 300)).filter(Boolean).slice(0, 40),
    watchlist: env.AUTO_APPLY_SUPPLY_WATCHLIST?.split(",").map((key) => key.trim()).filter(Boolean).slice(0, 100),
  };
}

function rotate(values, offset) {
  if (!values.length) return [];
  const start = offset % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function discoveryPlan(config, registry = SOURCES, now = new Date()) {
  const slot = Math.floor(now.getTime() / (6 * 3600000));
  const watched = registry.filter((source) => source.active && source.reviewStatus === "approved" &&
    (!config.watchlist || config.watchlist.includes(source.key)));
  const sources = rotate(watched, slot);
  const general = rotate(config.queries?.length ? config.queries : GENERAL, slot);
  const targeted = sources.map((source) => queriesFor(source)[slot % 2] || source.searchQueries?.[0]).filter(Boolean);
  const queries = [...new Set([...general.slice(0, Math.max(1, Math.ceil(config.maxQueries / 2))), ...targeted, ...general])];
  return { sources, queries: queries.slice(0, config.maxQueries) };
}

module.exports = { settings, discoveryPlan };
