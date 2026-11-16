import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import AutoApplyEmailReview, { reviewDisplayStatus, verificationMessage, toggleField } from "./AutoApplyEmailReview";

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

  test("builds a company-specific verification message without sending it", () => {
    const message = verificationMessage({ company: "جهة اختبار", email: "training@example.org" });
    expect(message).toContain("جهة اختبار");
    expect(message).toContain("training@example.org");
    expect(message).toContain("التخصصات ومدن التدريب");
  });
});

describe("Auto Apply training fields", () => {
  test("toggles a training field on and off without duplicates", () => {
    expect(toggleField([], "تحليل البيانات")).toEqual(["تحليل البيانات"]);
    expect(toggleField(["تحليل البيانات", "الشبكات"], "تحليل البيانات")).toEqual(["الشبكات"]);
  });

  test("sends the chosen training fields with the channel review", async () => {
    axios.get.mockResolvedValue({ data: {
      data: [{ key: "k1", company: "جهة اختبار", email: "training@example.org", initialStatus: "likely", detectedPurpose: "training",
        sourceNames: ["Company"], evidenceUrls: [], review: { verificationStatus: "likely", preferredFields: ["الشبكات"] } }],
      fieldOptions: ["تحليل البيانات", "الشبكات"], page: 1, pages: 1,
      summary: {}, outreach: {}, coverage: { active: [], evergreen: [] },
    } });
    axios.post.mockResolvedValue({ data: { saved: true } });
    render(<AutoApplyEmailReview password="secret" />);
    fireEvent.click(screen.getByRole("button", { name: "مراجعة قنوات بريد التدريب" }));
    expect(await screen.findByText(/مجالات التدريب للمطابقة: الشبكات/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "مراجعة البريد والدليل" }));
    expect(screen.getByRole("checkbox", { name: "الشبكات" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "تحليل البيانات" }));
    fireEvent.click(screen.getByRole("button", { name: "مرجح" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].preferredFields).toEqual(["الشبكات", "تحليل البيانات"]);
  });
});
