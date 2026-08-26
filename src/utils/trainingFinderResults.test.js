import { selectOrganizationResultScope } from "./trainingFinderResults";

const organizations = [
  { id: "exact", _locationScore: 4, _specialtyScore: 4 },
  { id: "related-city", _locationScore: 4, _specialtyScore: 2 },
  { id: "city", _locationScore: 4, _specialtyScore: 0 },
  { id: "national", _locationScore: 1, _specialtyScore: 2 },
];

test("keeps exact city and major matches ahead of broader fallbacks", () => {
  const result = selectOrganizationResultScope(organizations, {
    hasCity: true,
    hasSpecialty: true,
  });

  expect(result.scope).toBe("مطابقة للتخصص والمدينة");
  expect(result.items.map((item) => item.id)).toEqual(["exact"]);
});

test("uses related major nationally only after city fallbacks are empty", () => {
  const result = selectOrganizationResultScope(
    organizations.filter((item) => item.id === "national"),
    { hasCity: true, hasSpecialty: true }
  );

  expect(result.scope).toBe("تخصص قريب في المملكة");
  expect(result.items.map((item) => item.id)).toEqual(["national"]);
});
