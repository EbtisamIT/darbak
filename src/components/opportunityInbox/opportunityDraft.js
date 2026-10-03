export const inboxStatus = (item) => ["duplicate", "update_existing", "published", "rejected"].includes(item.status) ? item.status :
  item.status === "ready_for_review" || item.reviewStatus === "READY_FOR_REVIEW" || item.status === "ready" ? "ready_for_review" : "needs_verification";
export function opportunityDraft(item) {
  if (item.opportunityDraft) return item.opportunityDraft;
  const note = [item.description,
    item.responsibilities?.length ? "المهام:\n" + item.responsibilities.map((value) => "- " + value).join("\n") : "",
    item.requirements?.length ? "الشروط:\n" + item.requirements.map((value) => "- " + value).join("\n") : "",
  ].filter(Boolean).join("\n\n");
  return { organizationName: item.company || "", title: item.title || "", logoUrl: item.companyLogo || "",
    cities: item.cities || [], city: item.cities?.[0] || "", specialties: item.majors || [], majorCategories: [],
    trainingMode: item.remote ? "remote" : "", applicationMethod: item.applicationUrl ? "website" : "",
    applicationUrl: item.applicationUrl || "", sourceUrl: item.sourceUrl || "", deadline: item.deadline || null,
    note, status: "active", sourceType: "admin", featured: false };
}
