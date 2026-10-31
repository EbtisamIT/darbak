const OUTREACH_STATUSES = ["not_contacted", "verification_sent", "waiting_response", "followup_sent", "verified_from_reply", "rejected_from_reply", "no_response"];
const FOLLOWUP_DELAY_MS = 4 * 86400000;

function needsFollowup(row, now = new Date()) {
  return Boolean(row?.verificationContactedAt && !row.verificationFollowupAt && !row.verificationRespondedAt &&
    ["verification_sent", "waiting_response"].includes(row.outreachStatus) &&
    now - new Date(row.verificationContactedAt) >= FOLLOWUP_DELAY_MS);
}

function outreachUpdate(row, action, input = {}, now = new Date()) {
  if (!row) throw new Error("احفظي مراجعة القناة قبل متابعة التواصل.");
  if (action === "mark_contacted") {
    if (row.verificationContactedAt) throw new Error("تم تسجيل التواصل مسبقًا.");
    return { outreachStatus: "verification_sent", verificationContactedAt: now };
  }
  if (action === "mark_waiting") {
    if (!row.verificationContactedAt || !["verification_sent", "waiting_response"].includes(row.outreachStatus)) throw new Error("حالة المتابعة غير صالحة.");
    return { outreachStatus: "waiting_response" };
  }
  if (action === "mark_followup") {
    if (!needsFollowup(row, now)) throw new Error("المتابعة غير مستحقة أو أرسلت سابقًا.");
    return { outreachStatus: "followup_sent", verificationFollowupAt: now };
  }
  if (action === "mark_no_response") {
    if (!row.verificationFollowupAt || row.verificationRespondedAt) throw new Error("حالة عدم الرد غير صالحة.");
    return { outreachStatus: "no_response" };
  }
  if (action === "record_response") {
    if (!row.verificationContactedAt) throw new Error("سجلي التواصل قبل الرد.");
    const note = String(input.note || "").trim();
    if (!note || note.length > 1000) throw new Error("ملاحظة الرد مطلوبة وبحد أقصى 1000 حرف.");
    const decision = String(input.decision || "pending");
    if (!["pending", "verified", "rejected"].includes(decision)) throw new Error("قرار الرد غير صالح.");
    if (decision === "verified" && !(row.verificationStatus === "verified" && row.acceptsTrainingApplications && row.evidenceType === "official_company_reply")) throw new Error("وثقي الرد الرسمي ودليل التدريب في مراجعة القناة أولًا.");
    if (decision === "rejected" && row.verificationStatus !== "rejected") throw new Error("سجلي سبب الاستبعاد في مراجعة القناة أولًا.");
    return { outreachStatus: decision === "verified" ? "verified_from_reply" : decision === "rejected" ? "rejected_from_reply" : "waiting_response",
      verificationRespondedAt: now, verificationResponseNote: note };
  }
  throw new Error("إجراء المتابعة غير صالح.");
}

function outreachCounters(rows) {
  const counts = Object.fromEntries(OUTREACH_STATUSES.map((status) => [status, 0]));
  for (const row of rows) counts[row.outreachStatus || "not_contacted"] += 1;
  return { contacted: rows.filter((row) => Boolean(row.verificationContactedAt)).length,
    awaitingResponse: rows.filter((row) => !row.verificationRespondedAt && ["verification_sent", "waiting_response", "followup_sent"].includes(row.outreachStatus)).length,
    verifiedFromReplies: counts.verified_from_reply, rejectedFromReplies: counts.rejected_from_reply,
    noResponse: counts.no_response };
}

module.exports = { needsFollowup, outreachUpdate, outreachCounters };
