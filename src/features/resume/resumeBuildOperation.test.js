import {
  clearResumeBuildOperation,
  createResumeBuildOperation,
  readResumeBuildOperation,
  resolveDraftAgentConfig,
  runResumeBuildSingleFlight,
} from "./resumeBuildOperation";

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("double-click, remount, and route return reuse one active build intent", () => {
  const sessionStorage = storage();
  let creations = 0;
  const createId = () => {
    creations += 1;
    return "92d4307e-86e2-4f5b-9469-512a0764774c";
  };
  const first = createResumeBuildOperation(sessionStorage, "qa", "a".repeat(64), createId);
  const second = createResumeBuildOperation(sessionStorage, "qa", "a".repeat(64), createId);
  const resumed = readResumeBuildOperation(sessionStorage, "qa");
  assertSame(first, second);
  assertSame(first, resumed);
  expect(creations).toBe(1);

  const current = resolveDraftAgentConfig(null, resumed);
  expect(resolveDraftAgentConfig(current, resumed)).toBe(current);
  expect(current.buildRequestId).toBe(first.id);
});

test("completed build clears intent; next explicit update gets a new ID", () => {
  const sessionStorage = storage();
  const first = createResumeBuildOperation(sessionStorage, "qa", "a".repeat(64), () => "first");
  clearResumeBuildOperation(sessionStorage, "qa", first.id);
  expect(readResumeBuildOperation(sessionStorage, "qa")).toBeNull();
  const second = createResumeBuildOperation(sessionStorage, "qa", "b".repeat(64), () => "second");
  expect(second.id).toBe("second");
  expect(second.sourceFactsHash).toBe("b".repeat(64));
});

test("remount while the request is in flight sends only one HTTP start", async () => {
  let requests = 0;
  let finish;
  const request = () => {
    requests += 1;
    return new Promise((resolve) => { finish = resolve; });
  };
  const first = runResumeBuildSingleFlight("qa-in-flight", request);
  const second = runResumeBuildSingleFlight("qa-in-flight", request);
  expect(first).toBe(second);
  await Promise.resolve();
  expect(requests).toBe(1);
  finish({ session: { sessionId: "qa-in-flight" } });
  await Promise.all([first, second]);
  expect(requests).toBe(1);
});

test("failed operation releases the in-flight lock for explicit retry", async () => {
  let requests = 0;
  await expect(runResumeBuildSingleFlight("qa-failed", () => {
    requests += 1;
    return Promise.reject(new Error("provider failed"));
  })).rejects.toThrow("provider failed");
  await runResumeBuildSingleFlight("qa-retry", () => {
    requests += 1;
    return Promise.resolve({ status: "draft_ready" });
  });
  expect(requests).toBe(2);
});

function assertSame(first, second) {
  expect(second).toEqual(first);
}
