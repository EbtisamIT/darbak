import { markEnglishVersionFresh } from "./englishVersionFreshness";

describe("English version freshness state", () => {
  it("replaces a stale dashboard version immediately after a successful update", () => {
    const versions = markEnglishVersionFresh([
      { _id: "english-1", language: "en", needsLocalizationRefresh: true },
    ], "english-1", "2026-09-10T00:00:00.000Z");

    expect(versions).toHaveLength(1);
    expect(versions[0].needsLocalizationRefresh).toBe(false);
    expect(versions[0].updatedAt).toBe("2026-09-10T00:00:00.000Z");
  });
});
