import {
  classifyLocationMatch,
  classifyMajorMatch,
  normalizeCity,
  normalizeMajor,
} from "./trainingFinderTaxonomy";

test("explicit major aliases keep MIS distinct from Information Systems", () => {
  expect(normalizeMajor("IT")).toBe("تقنية المعلومات");
  expect(normalizeMajor("Information Technology")).toBe("تقنية المعلومات");
  expect(normalizeMajor("تقنية المعلومات.")).toBe("تقنية المعلومات");
  expect(normalizeMajor("MIS")).toBe("نظم المعلومات الإدارية");
  expect(normalizeMajor("Information Systems")).toBe("نظم المعلومات");
  expect(classifyMajorMatch({ specialties: ["MIS"] }, "نظم المعلومات")).toBe("RELATED");
});

test("explicit relationships do not turn every computing major into a related match", () => {
  expect(classifyMajorMatch({ specialties: ["نظم المعلومات"] }, "تقنية المعلومات")).toBe("RELATED");
  expect(classifyMajorMatch({ specialties: ["الأمن السيبراني"] }, "تقنية المعلومات")).toBe("NONE");
  expect(classifyMajorMatch({ specialties: ["المالية"] }, "المحاسبة")).toBe("RELATED");
});

test("category-only is broad and missing majors stay unknown", () => {
  expect(classifyMajorMatch(
    { majorCategories: ["الحاسب والتقنية"] },
    "تقنية المعلومات",
    ["الحاسب والتقنية"]
  )).toBe("BROAD");
  expect(classifyMajorMatch({}, "تقنية المعلومات", ["الحاسب والتقنية"]))
    .toBe("UNKNOWN");
  expect(classifyMajorMatch({ specialties: ["علوم الحاسب"] }, "علوم الحاسب"))
    .toBe("EXACT");
});

test("exact city, same region, and remote are separate location facts", () => {
  expect(normalizeCity("الشرقية")).toBe("المنطقة الشرقية");
  expect(normalizeCity("منطقة مكة")).toBe("منطقة مكة المكرمة");
  expect(classifyLocationMatch({ city: "الدمام" }, "الخبر")).toBe("SAME_REGION");
  expect(classifyLocationMatch({ city: "الخبر" }, "الخبر")).toBe("EXACT_CITY");
  expect(classifyLocationMatch({ city: "الرياض" }, "الخبر")).toBe("OTHER_CITY");
  expect(classifyLocationMatch({ city: "مدينة جديدة" }, "مدينة جديدة"))
    .toBe("EXACT_CITY");
  expect(classifyLocationMatch({ trainingMode: "remote", city: "الرياض" }, "الرياض"))
    .toBe("REMOTE");
});

test("multiple cities take precedence over a misleading primary city", () => {
  const kpmg = {
    city: "منطقة المدينة",
    cities: ["منطقة المدينة", "جدة", "الخبر", "المنطقة الشرقية"],
  };
  expect(classifyLocationMatch(kpmg, "الخبر")).toBe("EXACT_CITY");
  expect(classifyLocationMatch({ city: "الرياض", cities: ["جدة"] }, "الرياض"))
    .toBe("OTHER_CITY");
});
