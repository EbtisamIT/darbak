import {
  getOpportunityPersonalizationTier,
  rankOpportunitiesForPersonalization,
} from "./trainingFinderRanking";

const context = {
  specialty: "نظم المعلومات",
  majorCategories: ["تقنية المعلومات"],
  cityScope: ["الرياض"],
};

const opportunities = [
  { _id: "other", title: "فرصة عامة", city: "جدة" },
  { _id: "city", title: "فرصة بالرياض", city: "الرياض" },
  { _id: "major", title: "فرصة نظم", majors: ["نظم المعلومات"], city: "جدة" },
  { _id: "both", title: "فرصة نظم بالرياض", majors: ["نظم المعلومات"], city: "الرياض" },
];

test("personalization ranks exact major and city first without removing opportunities", () => {
  const ranked = rankOpportunitiesForPersonalization(opportunities, context);

  expect(ranked.map((item) => item._id)).toEqual(["both", "major", "city", "other"]);
  expect(ranked).toHaveLength(opportunities.length);
});

test("major-only and city-only preferences remain soft ranking context", () => {
  expect(getOpportunityPersonalizationTier({
    opportunity: opportunities[2],
    specialty: "نظم المعلومات",
  })).toBe(2);
  expect(getOpportunityPersonalizationTier({
    opportunity: opportunities[1],
    cityScope: ["الرياض"],
  })).toBe(1);
});

test("without a selection general ordering remains unchanged", () => {
  expect(rankOpportunitiesForPersonalization(opportunities)).toEqual(opportunities);
});
