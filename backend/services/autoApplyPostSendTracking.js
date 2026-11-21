function trackerFields({ user, item, channel, opportunity, send, now, isTest = false }) {
  const companyName = String(channel.company || "جهة تدريب").trim();
  const city = (channel.cities || []).join("، ");
  return {
    studentId: user._id,
    normalizedEmail: String(user.contact || "").trim().toLowerCase(),
    ...(opportunity?._id ? { opportunityId: opportunity._id } : {}),
    companyName,
    roleTitle: opportunity?.title || "تقديم تدريب تعاوني",
    city,
    sourceType: "auto_apply_email",
    studentStatus: "applied",
    appliedAt: now,
    lastUpdatedAt: now,
    contactEmail: channel.email,
    applicationMethod: "email",
    autoApplySendId: send._id,
    autoApplyPackageId: item._id,
    isTest,
    statusHistory: [{ status: "applied", changedAt: now }],
  };
}

async function upsertAcceptedTracker({ Tracker, user, item, channel, opportunity, send, now, isTest = false }) {
  return Tracker.findOneAndUpdate(
    { studentId: user._id, autoApplyPackageId: item._id, isTest },
    { $setOnInsert: trackerFields({ user, item, channel, opportunity, send, now, isTest }) },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function acceptProviderAndTrack({ sendProvider, markAccepted, createTracker, now = new Date() }) {
  const result = await sendProvider();
  if (!result?.providerMessageId) throw new Error("GMAIL_SEND_RESPONSE_INVALID");
  const accepted = await markAccepted({ providerMessageId: result.providerMessageId, acceptedAt: now });
  await createTracker({ send: accepted, acceptedAt: now });
  return { providerMessageId: result.providerMessageId, acceptedAt: now };
}

module.exports = { trackerFields, upsertAcceptedTracker, acceptProviderAndTrack };
