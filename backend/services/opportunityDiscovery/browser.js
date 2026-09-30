// Optional, isolated rendering. Every HTTP resource is supplied by the same
// pinned TLS/robots reader; Chromium itself never gets unrestricted networking.
async function renderPage(url, source, reader, { chromium, executablePath = process.env.DISCOVERY_BROWSER_EXECUTABLE } = {}) {
  if (!executablePath && !chromium) throw new Error("BROWSER_NOT_CONFIGURED");
  const initial = await reader.read(url); // Never retry TLS/robots/HTTP failures in a browser.
  if (/captcha|access denied|sign in to continue|log in to continue/i.test(initial.text)) throw new Error("POLICY_DENIED");
  const engine = chromium || require("playwright-core").chromium;
  const browser = await engine.launch({ executablePath, headless: true, chromiumSandbox: true, timeout: 12000 });
  const timer = setTimeout(() => browser.close().catch(() => {}), 20000);
  try {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false, ignoreHTTPSErrors: false,
      userAgent: "DarbakDiscovery/1.0 (+https://darbak.space)" });
    // WebRTC can open sockets outside HTTP routing; discovery never needs it.
    await context.addInitScript(() => {
      for (const name of ["RTCPeerConnection", "webkitRTCPeerConnection"]) {
        Object.defineProperty(window, name, { value: undefined, configurable: false, writable: false });
      }
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    let denied = false, count = 0;
    await context.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() !== "GET" || !["document", "script", "stylesheet", "xhr", "fetch"].includes(request.resourceType()) || ++count > 20) return route.abort();
      try {
        const response = request.url() === url ? initial : await reader.readAsset(request.url());
        await route.fulfill({ status: response.status, contentType: response.headers?.["content-type"] || "text/html", body: response.text });
      } catch { denied = true; await route.abort(); }
    });
    const page = await context.newPage();
    await page.goto(url, { timeout: 12000, waitUntil: "networkidle" });
    if (denied) throw new Error("BROWSER_RESOURCE_POLICY_DENIED");
    const html = await page.content();
    if (/captcha|access denied|sign in to continue|log in to continue/i.test(html)) throw new Error("POLICY_DENIED");
    return { ...initial, text: html, url: page.url(), fetchMethod: "browser" };
  } finally { clearTimeout(timer); await browser.close(); }
}
module.exports = { renderPage };
