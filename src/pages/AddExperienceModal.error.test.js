jest.mock("axios", () => ({
  post: jest.fn(),
}));

import { getExperienceSaveError } from "./AddExperienceModal";

test("hides technical errors when the database is unavailable", () => {
  expect(
    getExperienceSaveError({
      response: { status: 503, data: { error: "Database is not connected" } },
    })
  ).toBe("تعذر حفظ التجربة الآن. يُرجى المحاولة بعد قليل.");
});

test("preserves actionable validation feedback", () => {
  expect(
    getExperienceSaveError({
      response: { status: 400, data: { error: "الرجاء اختيار تخصص واضح." } },
    })
  ).toBe("الرجاء اختيار تخصص واضح.");
});
