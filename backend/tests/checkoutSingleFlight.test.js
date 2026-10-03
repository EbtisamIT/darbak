const assert = require("node:assert/strict");
const test = require("node:test");
const { createCheckoutSingleFlight } = require("../services/checkoutSingleFlight");

test("same checkout identity waits for the first response", async () => {
  const started = [];
  let finishFirst;
  const middleware = createCheckoutSingleFlight((req) => req.key, async (req) => {
    started.push(req.id);
    if (req.id === "first") await new Promise((resolve) => { finishFirst = resolve; });
  });
  const first = middleware({ key: "buyer:plan", id: "first" });
  const second = middleware({ key: "buyer:plan", id: "second" });
  assert.deepEqual(started, ["first"]);
  finishFirst();
  await Promise.all([first, second]);
  assert.deepEqual(started, ["first", "second"]);
});

test("different checkout identities can proceed independently", async () => {
  const started = [];
  const middleware = createCheckoutSingleFlight((req) => req.key, async (req) => started.push(req.key));
  await Promise.all([
    middleware({ key: "buyer:a" }),
    middleware({ key: "buyer:b" }),
  ]);
  assert.deepEqual(started, ["buyer:a", "buyer:b"]);
});
