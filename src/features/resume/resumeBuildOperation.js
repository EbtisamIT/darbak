import { getScopedResumeStorageKey } from "./resumeStorageScope";

export const getResumeBuildOperationKey = (storageScope = "") =>
  getScopedResumeStorageKey("darbak-resume-active-build", storageScope);

export const readResumeBuildOperation = (storage, storageScope = "") => {
  try {
    const value = JSON.parse(storage.getItem(getResumeBuildOperationKey(storageScope)) || "null");
    return typeof value?.id === "string" && value.id ? value : null;
  } catch {
    return null;
  }
};

export const createResumeBuildOperation = (storage, storageScope = "", sourceFactsHash = "", createId = () => window.crypto.randomUUID()) => {
  const active = readResumeBuildOperation(storage, storageScope);
  if (active) return active;
  const operation = {
    id: createId(),
    sourceFactsHash: /^[a-f0-9]{64}$/i.test(sourceFactsHash) ? sourceFactsHash : "",
  };
  storage.setItem(getResumeBuildOperationKey(storageScope), JSON.stringify(operation));
  return operation;
};

export const resolveDraftAgentConfig = (current, activeBuild) => (
  current?.purpose === "create_resume" &&
  current.buildRequestId === (activeBuild?.id || "")
    ? current
    : {
        purpose: "create_resume",
        source: "professional_profile",
        language: "ar",
        opportunityId: "",
        buildRequestId: activeBuild?.id || "",
        factsVersion: activeBuild?.sourceFactsHash || "",
      }
);

export const clearResumeBuildOperation = (storage, storageScope = "", id = "") => {
  const active = readResumeBuildOperation(storage, storageScope);
  if (active && (!id || active.id === id)) {
    storage.removeItem(getResumeBuildOperationKey(storageScope));
  }
};

const inFlightBuildRequests = new Map();

export const runResumeBuildSingleFlight = (id, request) => {
  if (!id) return request();
  if (inFlightBuildRequests.has(id)) return inFlightBuildRequests.get(id);
  const pending = Promise.resolve().then(request).finally(() => {
    if (inFlightBuildRequests.get(id) === pending) inFlightBuildRequests.delete(id);
  });
  inFlightBuildRequests.set(id, pending);
  return pending;
};
