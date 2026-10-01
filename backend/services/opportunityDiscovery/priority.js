function sourceTier(source) {
  const adapter = source.atsProvider || source.metadata?.adapter || "generic";
  if (["teamtailor", "greenhouse", "lever"].includes(adapter)) return 1;
  if (["smartrecruiters", "workday", "oracle", "successfactors"].includes(adapter)) return 2;
  return source.sourceType === "job_board" || source.sourceType === "other" ? 3 : 1;
}

function prioritizeSources(sources, { rotation = 0 } = {}) {
  const ordered = [];
  for (const tier of [1, 2, 3]) {
    const group = sources.filter((source) => sourceTier(source) === tier);
    const offset = group.length ? Math.max(0, Math.floor(rotation)) % group.length : 0;
    ordered.push(...group.slice(offset), ...group.slice(0, offset));
  }
  return ordered;
}

module.exports = { sourceTier, prioritizeSources };
