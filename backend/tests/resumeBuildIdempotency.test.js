const assert = require("node:assert/strict");
const { test } = require("node:test");
const { claimResumeBuild, isValidBuildRequestId } = require("../services/resumeBuildIdempotency");

const firstId = "92d4307e-86e2-4f5b-9469-512a0764774c";
const secondId = "56d23512-a13a-4f55-85aa-f521d3a78216";
const owner = { contact: "qa@example.invalid", accessCodeHash: "qa-hash" };

const createSessionStore = () => {
  const sessions = new Map();
  let creates = 0;
  return {
    get creates() { return creates; },
    async create(session) {
      await Promise.resolve();
      if (sessions.has(session.sessionId)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      creates += 1;
      sessions.set(session.sessionId, session);
      return session;
    },
    async findOne(query) {
      const session = sessions.get(query.sessionId);
      return session?.contact === query.contact && session.accessCodeHash === query.accessCodeHash
        ? session
        : null;
    },
  };
};

test("same build ID claims one Agent session across simultaneous HTTP requests", async () => {
  const Session = createSessionStore();
  const args = {
    Session,
    sessionId: firstId,
    owner,
    sourceFactsHash: "source-a",
    sessionFields: { ...owner, status: "generating", collectedFacts: { answers: [] } },
  };
  const claims = await Promise.all([claimResumeBuild(args), claimResumeBuild(args)]);
  let modelCalls = 0;
  let pendingDrafts = 0;
  claims.forEach((claim) => {
    if (!claim.created) return;
    modelCalls += 1;
    pendingDrafts += 1;
  });
  assert.equal(Session.creates, 1);
  assert.equal(modelCalls, 1);
  assert.equal(pendingDrafts, 1);
  assert.deepEqual(claims.map((claim) => claim.created).sort(), [false, true]);
  assert.equal(claims[0].session.sessionId, claims[1].session.sessionId);
});

test("source changes or another account cannot reuse an operation", async () => {
  const Session = createSessionStore();
  const args = {
    Session, sessionId: firstId, owner, sourceFactsHash: "source-a",
    sessionFields: { ...owner, status: "generating" },
  };
  await claimResumeBuild(args);
  await assert.rejects(claimResumeBuild({ ...args, sourceFactsHash: "source-b" }),
    (error) => error.code === "RESUME_BUILD_SOURCE_CONFLICT");
  await assert.rejects(claimResumeBuild({ ...args, owner: { ...owner, contact: "other@example.invalid" } }),
    (error) => error.code === "RESUME_BUILD_ID_COLLISION");
  assert.equal(Session.creates, 1);
});

test("a later explicit build and a failed-build retry use new IDs", async () => {
  const Session = createSessionStore();
  const base = { Session, owner, sessionFields: { ...owner, status: "generating" } };
  await claimResumeBuild({ ...base, sessionId: firstId, sourceFactsHash: "source-a" });
  await claimResumeBuild({ ...base, sessionId: secondId, sourceFactsHash: "source-b" });
  assert.equal(Session.creates, 2);
  assert.equal(isValidBuildRequestId(firstId), true);
  assert.equal(isValidBuildRequestId("invalid"), false);
});
