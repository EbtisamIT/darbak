const assert = require("assert");
const {
  buildMajorCityProfileUpdates,
  resolveSavedMajorCity,
} = require("../services/studentProfileFacts");

assert.deepStrictEqual(
  resolveSavedMajorCity({
    portfolio: { major: "تقنية المعلومات", city: "الرياض" },
    user: { preferredMajor: "إدارة الأعمال", preferredCity: "جدة" },
  }),
  { major: "تقنية المعلومات", city: "الرياض" },
);

assert.deepStrictEqual(
  resolveSavedMajorCity({
    portfolio: { major: "", city: "" },
    user: { preferredMajor: "علوم الحاسب", preferredCity: "جدة" },
  }),
  { major: "علوم الحاسب", city: "جدة" },
);

assert.deepStrictEqual(
  resolveSavedMajorCity({ portfolio: null, user: { preferredMajor: "تقنية المعلومات", preferredCity: "الرياض" } }),
  { major: "تقنية المعلومات", city: "الرياض" },
);

assert.deepStrictEqual(
  resolveSavedMajorCity({ portfolio: null, user: null }),
  { major: "", city: "" },
);

assert.deepStrictEqual(
  buildMajorCityProfileUpdates({ major: " نظم المعلومات ", city: " الدمام " }),
  { major: "نظم المعلومات", city: "الدمام" },
);
assert.deepStrictEqual(buildMajorCityProfileUpdates({}), {});

console.log("studentProfileFacts tests passed");
