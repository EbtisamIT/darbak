import {
  getResumeCompletionItems,
  getSummaryMetrics,
  isSummaryTooLong,
} from "./resumeValidation";

describe("professional summary acceptance threshold", () => {
  const saraSummary = "Management Information Systems student with hands-on project experience in business analysis. Built a Power BI project that organizes and presents business data clearly. Focuses on applying information systems knowledge to practical business and data needs.";

  it("accepts Sara's three-sentence English summary without a long-summary warning", () => {
    expect(getSummaryMetrics(saraSummary)).toEqual({ wordCount: 35, sentenceCount: 3 });
    expect(isSummaryTooLong(saraSummary)).toBe(false);

    const summaryItem = getResumeCompletionItems({ summary: saraSummary })
      .find((item) => item.title === "النبذة المهنية");
    expect(summaryItem.status).toBe("complete");
    expect(summaryItem.detail).toBe("طول النبذة مناسب.");
  });

  it("warns only when the summary exceeds four sentences or roughly 100 words", () => {
    expect(isSummaryTooLong("One. Two. Three. Four. Five.")).toBe(true);
    expect(isSummaryTooLong(Array.from({ length: 101 }, (_, index) => `word${index}`).join(" "))).toBe(true);
  });
});
