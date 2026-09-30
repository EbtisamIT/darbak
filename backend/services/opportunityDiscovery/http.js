const https = require("https");
const dns = require("dns").promises;
const ipaddr = require("ipaddr.js");
const robotsParser = require("robots-parser");
const { cleanOpportunityUrl } = require("../opportunityCandidateData");

const USER_AGENT = "DarbakDiscovery/1.0 (+https://darbak.space)";
const MAX_BYTES = 2 * 1024 * 1024;
function error(code) { const e = new Error(code); e.code = code; return e; }
function allowedUrl(value, source) {
  try {
    const url = new URL(cleanOpportunityUrl(value));
    if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password) return false;
    return source.metadata.scopes.some((scope) => {
      const s = new URL(scope);
      return url.origin === s.origin && (url.pathname === s.pathname || url.pathname.startsWith(s.pathname.endsWith("/") ? s.pathname : `${s.pathname}/`));
    });
  } catch { return false; }
}
function publicAddress(address) {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}
async function pinnedRequest(url, { timeout = 8000 } = {}) {
  let dnsTimer, addresses;
  try {
    addresses = await Promise.race([
      dns.lookup(url.hostname, { all: true }),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(error("DNS_TIMEOUT")), timeout); }),
    ]);
  } finally { clearTimeout(dnsTimer); }
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw error("NON_PUBLIC_ADDRESS");
  const chosen = addresses[0];
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json,text/plain", "Accept-Encoding": "identity" },
      // Pin the validated address for this connection; avoid DNS rebinding.
      lookup: (_host, options, cb) => options.all ? cb(null, [chosen]) : cb(null, chosen.address, chosen.family),
    }, (res) => {
      const chunks = []; let size = 0;
      res.on("data", (chunk) => { size += chunk.length; if (size > MAX_BYTES) req.destroy(error("RESPONSE_TOO_LARGE")); else chunks.push(chunk); });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8"), url: url.href }));
      res.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(error("REQUEST_TIMEOUT")), timeout);
    req.on("close", () => clearTimeout(timer)); req.on("error", reject);
  });
}

function createReader(source, { transport = pinnedRequest, wait = (ms) => new Promise((r) => setTimeout(r, ms)), deadline = Date.now() + 60000 } = {}) {
  const robots = new Map(), cache = new Map(); let requests = 0, lastAt = 0;
  async function request(url) {
    if (Date.now() > deadline) throw error("SOURCE_TIME_LIMIT");
    if (++requests > Math.min(40, source.metadata.maxRequests || 8)) throw error("SOURCE_REQUEST_LIMIT");
    await wait(Math.max(0, 600 - (Date.now() - lastAt))); lastAt = Date.now();
    return transport(url);
  }
  async function checkRobots(url) {
    if (!robots.has(url.origin)) {
      let robotsUrl = new URL("/robots.txt", url), res;
      for (let i = 0; i <= 3; i++) {
        res = await request(robotsUrl);
        if (![301, 302, 303, 307, 308].includes(res.status)) break;
        const next = new URL(res.headers.location || "", robotsUrl);
        // A robots redirect may not widen trust to another host or arbitrary path.
        if (i === 3 || next.origin !== url.origin || next.pathname !== "/robots.txt" || next.username || next.password) throw error("ROBOTS_REDIRECT_UNAPPROVED");
        robotsUrl = next;
      }
      if (res.status !== 404 && res.status !== 200) throw error("ROBOTS_UNAVAILABLE");
      robots.set(url.origin, robotsParser(robotsUrl.href, res.status === 200 ? res.text : ""));
    }
    const rules = robots.get(url.origin);
    if (rules.isAllowed(url.href, USER_AGENT) === false) throw error("ROBOTS_DISALLOWED");
    const delay = Number(rules.getCrawlDelay(USER_AGENT) || 0) * 1000;
    if (delay > 10000) throw error("ROBOTS_CRAWL_DELAY_TOO_LONG");
    if (delay) await wait(Math.max(0, delay - (Date.now() - lastAt)));
  }
  async function read(value, redirects = 0, asset = false) {
    if (!allowedUrl(value, source)) throw error("UNAPPROVED_URL_SCOPE");
    const url = new URL(cleanOpportunityUrl(value)); url.hash = "";
    if (cache.has(url.href)) return cache.get(url.href);
    await checkRobots(url);
    const res = await request(url);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (redirects >= 3 || !res.headers.location) throw error("REDIRECT_LIMIT");
      return read(new URL(res.headers.location, url).href, redirects + 1, asset);
    }
    if (res.status < 200 || res.status >= 300) throw error(`HTTP_${res.status}`);
    const contentType = res.headers["content-type"] || "";
    if (!/text\/html|application\/(?:ld\+)?json|text\/plain/i.test(contentType) &&
      !(asset && /(?:application|text)\/(?:javascript|x-javascript|css)/i.test(contentType))) throw error("UNSUPPORTED_CONTENT_TYPE");
    if (/<(?:title|h1)[^>]*>[^<]*(?:captcha|access denied|request rejected|just a moment)|enable javascript and cookies to continue/i.test(res.text.slice(0, 15000))) throw error("SOURCE_BLOCKED");
    cache.set(url.href, res); return res;
  }
  return { read, readAsset: (url) => read(url, 0, true), get requests() { return requests; } };
}
module.exports = { allowedUrl, publicAddress, createReader, pinnedRequest };
