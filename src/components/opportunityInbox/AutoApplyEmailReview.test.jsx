import { reviewDisplayStatus } from "./AutoApplyEmailReview";

jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));

describe("Auto Apply email review labels", () => {
  test("separates verified targeted channels from verified general training channels", () => {
    expect(reviewDisplayStatus({ review: {
      verificationStatus: "verified", majors: ["هندسة البرمجيات"], cities: [], remote: true,
    } })).toBe("✅ موثق محدد التخصص والموقع");
    expect(reviewDisplayStatus({ review: {
      verificationStatus: "verified", majors: ["المحاسبة"], cities: [], remote: false,
    } })).toBe("✅ قناة تدريب موثقة عامة");
  });

  test("keeps likely and rejected channels visibly distinct", () => {
    expect(reviewDisplayStatus({ initialStatus: "likely" })).toBe("🟡 مرجح");
    expect(reviewDisplayStatus({ review: { verificationStatus: "rejected" } })).toBe("❌ مستبعد");
  });
});
