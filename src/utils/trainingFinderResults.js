const scopes = {
  exact: "مطابقة للتخصص والمدينة",
  relatedCity: "تخصص قريب في مدينتك",
  sameCity: "جهات في مدينتك",
  relatedNational: "تخصص قريب في المملكة",
  unfiltered: "جهات مقترحة",
};

export const selectOrganizationResultScope = (
  organizations = [],
  { hasCity = false, hasSpecialty = false } = {}
) => {
  const candidates = Array.isArray(organizations) ? organizations : [];
  const by = (predicate, scope) => {
    const items = candidates.filter(predicate);
    return items.length ? { items, scope } : null;
  };

  if (hasCity && hasSpecialty) {
    return (
      by(
        (organization) =>
          organization._locationScore >= 4 && organization._specialtyScore >= 3,
        scopes.exact
      ) ||
      by(
        (organization) =>
          organization._locationScore >= 4 && organization._specialtyScore >= 2,
        scopes.relatedCity
      ) ||
      by((organization) => organization._locationScore >= 4, scopes.sameCity) ||
      by(
        (organization) => organization._specialtyScore >= 2,
        scopes.relatedNational
      ) || { items: [], scope: "" }
    );
  }

  if (hasCity) {
    return by((organization) => organization._locationScore >= 4, scopes.sameCity) || {
      items: [],
      scope: "",
    };
  }

  if (hasSpecialty) {
    return by(
      (organization) => organization._specialtyScore >= 2,
      scopes.relatedNational
    ) || { items: [], scope: "" };
  }

  return { items: candidates, scope: scopes.unfiltered };
};
