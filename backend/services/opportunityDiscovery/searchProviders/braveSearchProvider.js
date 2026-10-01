const { cleanOpportunityUrl } = require("../../opportunityCandidateData");

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const error = (code) => Object.assign(new Error(code), { code });
const plain = (value, max) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
function normalizeResult(row, query) {
  try {
    const url = new URL(cleanOpportunityUrl(row.url));
    url.hash = ""; url.searchParams.sort();
    // Search dates are hints only; never copy these into the extracted advert.
    const date = row.page_age || row.publishedAt;
    const publishedAt = typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) && Number.isFinite(Date.parse(date))
      ? new Date(date).toISOString() : null;
    return { title: plain(row.title, 500), url: url.href, description: plain(row.description, 2000),
      publishedAt, domain: url.hostname, query: plain(query, 600), provider: "brave" };
  } catch { return null; }
}
async function searchOpportunityUrls(query, { signal, limit = 10, freshness = "pm", apiKey = process.env.BRAVE_SEARCH_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey?.trim()) throw error("SEARCH_PROVIDER_NOT_CONFIGURED");
  if (typeof query !== "string" || !query.trim() || query.length > 600) throw error("INVALID_SEARCH_QUERY");
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(20, Math.max(1, limit))));
  url.searchParams.set("freshness", freshness);
  url.searchParams.set("country", "SA");
  url.searchParams.set("search_lang", /[\u0600-\u06ff]/.test(query) ? "ar" : "en");
  url.searchParams.set("result_filter", "web");
  url.searchParams.set("text_decorations", "false");
  const response = await fetchImpl(url, { signal: signal || AbortSignal.timeout(8000), redirect: "error",
    headers: { Accept: "application/json", "X-Subscription-Token": apiKey } });
  if (!response.ok) throw error(response.status === 429 ? "SEARCH_RATE_LIMITED" :
    [401, 403].includes(response.status) ? "SEARCH_AUTH_FAILED" : `SEARCH_HTTP_${response.status}`);
  const body = await response.json();
  if (body.type !== "search" || (body.web?.results !== undefined && !Array.isArray(body.web.results))) throw error("INVALID_SEARCH_RESPONSE");
  return (body.web?.results || []).slice(0, limit).map((row) => normalizeResult(row, query)).filter(Boolean);
}
module.exports = { search: searchOpportunityUrls, searchOpportunityUrls, normalizeResult, name: "brave" };
