import {
  getOpportunityPersonalization,
  rankOpportunitiesForPersonalization,
} from "./trainingFinderRanking";

const context = {
  specialty: "تقنية المعلومات",
  majorCategories: ["الحاسب والتقنية"],
  city: "الخبر",
  now: new Date("2026-10-08T00:00:00Z").getTime(),
};

const fixtures = [
  { _id: "datavolt", organizationName: "DataVolt", title: "IT Intern", city: "الرياض", specialties: ["تقنية المعلومات"], status: "active" },
  { _id: "hiyz", organizationName: "وكالة حيّز", title: "تدريب تعاوني", city: "الدمام", specialties: ["تقنية المعلومات"], status: "active" },
  { _id: "synapse", organizationName: "Synapse", title: "Operations Excellence", city: "الخبر", majorCategories: ["الحاسب والتقنية"], status: "active" },
  { _id: "new-murabba", organizationName: "NEW MURABBA", title: "COOP Program", city: "الخبر", status: "active" },
  { _id: "sidf", organizationName: "SIDF", title: "تدريب تعاوني", city: "الرياض", status: "active" },
  { _id: "zory", organizationName: "ZORY AI", title: "Internship", trainingMode: "remote", specialties: ["تقنية المعلومات"], status: "active" },
  { _id: "zid", organizationName: "Zid", title: "تدريب عن بعد", trainingMode: "remote", status: "active" },
  { _id: "henkel", organizationName: "Henkel", title: "Digital Intern", city: "الرياض", specialties: ["نظم المعلومات"], status: "active" },
  { _id: "kpmg", organizationName: "KPMG", title: "Audit Internship", city: "منطقة المدينة", cities: ["جدة", "الخبر"], specialties: ["المحاسبة"], status: "active" },
];

const match = (id, options = context) => getOpportunityPersonalization({
  opportunity: fixtures.find((item) => item._id === id),
  ...options,
});

test("real audit shapes receive exact, related, broad, unknown, and location tiers", () => {
  expect(match("hiyz")).toMatchObject({ majorMatch: "EXACT", locationMatch: "SAME_REGION", tier: 1 });
  expect(match("datavolt")).toMatchObject({ majorMatch: "EXACT", locationMatch: "OTHER_CITY", tier: 2 });
  expect(match("synapse")).toMatchObject({ majorMatch: "BROAD", locationMatch: "EXACT_CITY", tier: 2 });
  expect(match("new-murabba")).toMatchObject({ majorMatch: "UNKNOWN", tier: 3 });
  expect(match("sidf")).toMatchObject({ majorMatch: "UNKNOWN", tier: 3 });
  expect(match("zory")).toMatchObject({ majorMatch: "EXACT", locationMatch: "REMOTE", tier: 1 });
  expect(match("zid")).toMatchObject({ majorMatch: "UNKNOWN", locationMatch: "REMOTE", tier: 3 });
  expect(match("henkel", { specialty: "نظم المعلومات", city: "الرياض" }))
    .toMatchObject({ majorMatch: "EXACT", locationMatch: "EXACT_CITY", tier: 1 });
  expect(match("kpmg", { specialty: "المحاسبة", city: "الخبر" }))
    .toMatchObject({ locationMatch: "EXACT_CITY", tier: 1 });
});

test("city-only can rank unknown majors, but major-only cannot promote them", () => {
  expect(match("new-murabba", { city: "الخبر" }).tier).toBe(1);
  expect(match("new-murabba", { specialty: "تقنية المعلومات" }).tier).toBe(3);
  expect(match("zid", { city: "الخبر" }).tier).toBe(1);
  expect(match("datavolt", { specialty: "تقنية المعلومات" }).tier).toBe(1);
  expect(match("henkel", { specialty: "تقنية المعلومات" }).tier).toBe(2);
});

test("labels never exceed two and do not claim unknown or broad major is exact", () => {
  expect(match("hiyz").labels).toEqual(["مطابق لتخصصك", "في منطقتك"]);
  expect(match("datavolt").labels).toEqual(["مطابق لتخصصك", "مدينة أخرى"]);
  expect(match("synapse").labels).toEqual(["في مدينتك"]);
  expect(match("new-murabba").labels).toEqual(["في مدينتك"]);
  expect(match("zory").labels).toEqual(["مطابق لتخصصك", "عن بُعد"]);
  expect(match("zid").labels).toEqual(["عن بُعد"]);
  fixtures.forEach((opportunity) => {
    expect(getOpportunityPersonalization({ opportunity, ...context }).labels.length)
      .toBeLessThanOrEqual(2);
  });
});

test("ranking retains every opportunity and is deterministic across ties", () => {
  const ranked = rankOpportunitiesForPersonalization(fixtures, context);
  expect(ranked).toHaveLength(fixtures.length);
  expect(new Set(ranked.map((item) => item._id))).toEqual(new Set(fixtures.map((item) => item._id)));
  expect(ranked.map((item) => item._id)).toEqual(
    rankOpportunitiesForPersonalization([...fixtures].reverse(), context)
      .map((item) => item._id)
  );
  expect(ranked.slice(0, 2).map((item) => item._id)).toEqual(["zory", "hiyz"]);
});

test("open, newest, then stable id break equal-score ties", () => {
  const same = [
    { _id: "b", specialties: ["تقنية المعلومات"], city: "الخبر", status: "active", createdAt: "2026-10-01" },
    { _id: "a", specialties: ["تقنية المعلومات"], city: "الخبر", status: "active", createdAt: "2026-10-01" },
    { _id: "closed", specialties: ["تقنية المعلومات"], city: "الخبر", status: "expired", createdAt: "2026-10-07" },
    { _id: "new", specialties: ["تقنية المعلومات"], city: "الخبر", status: "active", createdAt: "2026-10-06" },
  ];
  expect(rankOpportunitiesForPersonalization(same, context).map((item) => item._id))
    .toEqual(["new", "a", "b", "closed"]);
});

test("without a major or city, backend ordering is untouched", () => {
  expect(rankOpportunitiesForPersonalization(fixtures)).toEqual(fixtures);
});
