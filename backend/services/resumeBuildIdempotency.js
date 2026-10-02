const BUILD_REQUEST_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

const isValidBuildRequestId = (value) =>
  typeof value === "string" && BUILD_REQUEST_ID_PATTERN.test(value);

const claimResumeBuild = async ({ Session, sessionId, owner, sourceFactsHash, sessionFields }) => {
  try {
    const session = await Session.create({
      ...sessionFields,
      sessionId,
      collectedFacts: {
        ...(sessionFields.collectedFacts || {}),
        sourceFactsHash,
      },
    });
    return { session, created: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const session = await Session.findOne({ sessionId, ...owner });
    if (!session) {
      const collision = new Error("Build request belongs to another account.");
      collision.code = "RESUME_BUILD_ID_COLLISION";
      throw collision;
    }
    if (session.collectedFacts?.sourceFactsHash !== sourceFactsHash) {
      const conflict = new Error("Build request source changed.");
      conflict.code = "RESUME_BUILD_SOURCE_CONFLICT";
      throw conflict;
    }
    return { session, created: false };
  }
};

module.exports = { isValidBuildRequestId, claimResumeBuild };
