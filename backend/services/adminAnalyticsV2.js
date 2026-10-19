const DAY_MS = 86400000;
const RECORD_SOURCE = "__authoritative_record";
const STAGES = ["student", "graduate", "unknown"];
const TABS = ["overview", "audience", "behaviour", "conversion", "content", "rewards", "subscriptions"];

const parseRange = (query = {}, now = new Date()) => {
  const choice = String(query.range || "30");
  const days = { today: 1, "7": 7, "30": 30 }[choice] || 30;
  const riyadhDay = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const dayStart = new Date(Date.UTC(riyadhDay.getUTCFullYear(), riyadhDay.getUTCMonth(), riyadhDay.getUTCDate()) - 3 * 60 * 60 * 1000);
  let end = new Date(dayStart.getTime() + DAY_MS);
  let start = new Date(end.getTime() - days * DAY_MS);
  if (choice === "custom") {
    const from = new Date(`${query.from || ""}T00:00:00+03:00`);
    const to = new Date(`${query.to || ""}T00:00:00+03:00`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) &&
        to >= from && to.getTime() - from.getTime() <= 90 * DAY_MS) {
      start = from;
      end = new Date(to.getTime() + DAY_MS);
    } else throw new Error("INVALID_DATE_RANGE");
  }
  return { start, end, previousStart: new Date(start.getTime() - (end - start)) };
};

const safeFilter = (query = {}) => ({
  lifecycleStage: STAGES.includes(query.lifecycleStage) ? query.lifecycleStage : "",
  major: typeof query.major === "string" ? query.major.trim().slice(0, 90) : "",
  city: typeof query.city === "string" ? query.city.trim().slice(0, 80) : "",
  source: typeof query.source === "string" ? query.source.trim().slice(0, 60) : "",
});

const pct = (numerator, denominator) => denominator ? Math.round(1000 * numerator / denominator) / 10 : null;
const asCount = (row) => Number(row?.count || 0);
const dateMatch = (range, field = "createdAt") => ({ [field]: { $gte: range.start, $lt: range.end } });
const identity = { $cond: [{ $ne: ["$actorId", ""] }, "$actorId", "$visitorId"] };

const eventMatch = (range, filter, names = []) => ({
  ...dateMatch(range),
  ...(names.length ? { eventName: { $in: names } } : {}),
  ...(filter.major ? { major: filter.major } : {}),
  ...(filter.city ? { city: filter.city } : {}),
  ...(filter.source ? { "metadata.source": filter.source } : {}),
});

const eventCounts = async (Event, match) => Event.aggregate([
  { $match: match },
  { $group: { _id: "$eventName", count: { $sum: 1 } } },
]).then((rows) => Object.fromEntries(rows.map((row) => [row._id, row.count])));

const uniqueActors = async (Event, match) => Event.aggregate([
  { $match: match },
  { $project: { identity } },
  { $match: { identity: { $nin: ["", null] } } },
  { $group: { _id: "$identity" } },
  { $count: "count" },
]).then((rows) => asCount(rows[0]));

const topField = async (Model, match, field, limit = 8) => Model.aggregate([
  { $match: { ...match, [field]: { $nin: [null, ""] } } },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1, _id: 1 } },
  { $limit: limit },
]).then((rows) => rows.map((row) => ({ label: String(row._id), count: row.count })));

const authoritativeCount = async ({ Daily, Model, Experience, Reward, metric, range, field = "createdAt", match = {}, segmented = false }) => {
  const directCount = async (scope) => {
    const scoped = { ...match, ...dateMatch(scope, field) };
    if (!Experience || !metric.startsWith("record_reward_")) return Model.countDocuments(scoped);
    const pipeline = [{ $match: scoped }];
    if (metric === "record_reward_resume_finalized") {
      pipeline.push({ $lookup: { from: Reward.collection.name, localField: "rewardId", foreignField: "_id", as: "reward" } },
        { $unwind: "$reward" }, { $set: { experienceId: "$reward.experienceId" } });
    }
    pipeline.push({ $lookup: { from: Experience.collection.name, localField: "experienceId", foreignField: "_id", as: "experience" } },
      { $unwind: "$experience" }, { $match: { "experience.qaTest": { $ne: true } } }, { $count: "count" });
    const [row] = await Model.aggregate(pipeline);
    return asCount(row);
  };
  if (segmented || !Daily) return directCount(range);
  const todayStart = parseRange({ range: "today" }).start;
  const completedEnd = new Date(Math.min(range.end.getTime(), todayStart.getTime()));
  const completedDays = Math.max(0, Math.round((completedEnd - range.start) / DAY_MS));
  if (!completedDays) return directCount(range);
  const firstDay = new Date(range.start.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const endDay = new Date(completedEnd.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const [summary] = await Daily.aggregate([
    { $match: { day: { $gte: firstDay, $lt: endDay }, eventName: metric, source: RECORD_SOURCE } },
    { $group: { _id: null, coveredDays: { $sum: 1 }, count: { $sum: "$count" } } },
  ]);
  if (summary?.coveredDays !== completedDays) return directCount(range);
  const liveCount = range.end > completedEnd
    ? await directCount({ start: completedEnd, end: range.end }) : 0;
  return Number(summary.count || 0) + liveCount;
};

const audienceTopField = async (User, Portfolio, match, field, limit = 8) => {
  const profileValue = `$profile.${field}`;
  const userValue = field === "major" ? "$preferredMajor" : field === "city" ? "$preferredCity" : "";
  const rows = await User.aggregate([
    { $match: match },
    { $lookup: { from: Portfolio.collection.name,
      let: { contact: "$contact", code: "$accessCodeHash" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $ne: ["$$code", ""] },
          { $eq: ["$contact", "$$contact"] }, { $eq: ["$accessCodeHash", "$$code"] },
        ] } } },
        { $project: { [field]: 1 } }, { $limit: 1 },
      ], as: "profile" } },
    { $set: { profile: { $first: "$profile" } } },
    { $project: { value: { $cond: [
      { $and: [{ $ne: [profileValue, null] }, { $ne: [profileValue, ""] }] },
      profileValue, userValue,
    ] } } },
    { $match: { value: { $nin: [null, ""] } } },
    { $group: { _id: "$value", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }, { $limit: limit },
  ]);
  return rows.map((row) => ({ label: String(row._id), count: row.count }));
};

const buildIdentityFunnel = async (Event, match, stages) => {
  const allNames = [...new Set(stages.flatMap((stage) => stage.events))];
  const cumulative = [];
  const flags = {};
  stages.forEach((stage, index) => {
    const hasStage = { $gt: [{ $size: { $setIntersection: ["$events", stage.events] } }, 0] };
    const required = [...cumulative, hasStage];
    flags[`step${index}`] = { $sum: { $cond: [{ $and: required }, 1, 0] } };
    if (!stage.optional) cumulative.push(hasStage);
  });
  const [result] = await Event.aggregate([
    { $match: { ...match, eventName: { $in: allNames } } },
    { $project: { eventName: 1, identity } },
    { $match: { identity: { $nin: ["", null] } } },
    { $group: { _id: "$identity", events: { $addToSet: "$eventName" } } },
    { $group: { _id: null, ...flags } },
  ]);
  return stages.map((stage, index) => {
    let previousRequiredIndex = index - 1;
    while (previousRequiredIndex >= 0 && stages[previousRequiredIndex].optional) previousRequiredIndex -= 1;
    return {
      label: stage.label,
      count: result?.[`step${index}`] || 0,
      optional: Boolean(stage.optional),
      fromPrevious: previousRequiredIndex >= 0 && !stage.optional
        ? pct(result?.[`step${index}`] || 0, result?.[`step${previousRequiredIndex}`] || 0)
        : null,
    };
  });
};

const getRetention = async (Event, range, actorFilter = {}) => {
  // One indexed pass over the selected period. An identity is considered
  // retained only when it returns on a different UTC day after its first day.
  const rows = await Event.aggregate([
    { $match: { eventName: "page_view", ...dateMatch(range), ...actorFilter } },
    { $project: { identity, day: { $dateTrunc: { date: "$createdAt", unit: "day" } } } },
    { $match: { identity: { $nin: ["", null] } } },
    { $group: { _id: "$identity", days: { $addToSet: "$day" } } },
    { $project: { days: { $sortArray: { input: "$days", sortBy: 1 } } } },
  ]);
  const result = { users: rows.length, d1: null, d7: null, d30: null, sevenDayReturnRate: null };
  if (!rows.length) return result;
  for (const days of [1, 7, 30]) {
    let eligible = 0;
    let returned = 0;
    rows.forEach((row) => {
      const first = new Date(row.days[0]).getTime();
      if (range.end.getTime() - first < days * DAY_MS) return;
      eligible += 1;
      if (row.days.some((date) => new Date(date).getTime() - first >= days * DAY_MS)) returned += 1;
    });
    result[`d${days}`] = pct(returned, eligible);
  }
  result.sevenDayReturnRate = result.d7;
  return result;
};

const buildAdminAnalyticsTab = async (models, tab, query = {}) => {
  if (!TABS.includes(tab)) throw new Error("INVALID_ANALYTICS_TAB");
  const { Event, User, Experience, Reward, Snapshot, Subscription, Tracker, Opportunity, Company, Portfolio, Daily, Feedback, Tracking } = models;
  const range = parseRange(query);
  const tracking = Tracking ? await Tracking.findById("analytics-v2").select("startedAt").lean() : null;
  const trackingStartedAt = tracking?.startedAt || null;
  const trackingAvailable = Boolean(trackingStartedAt && range.end > new Date(trackingStartedAt));
  const observedCount = (value) => trackingAvailable || value > 0 ? value : null;
  const filter = safeFilter(query);
  const userFilter = {
    contact: { $ne: "" },
    isAdmin: { $ne: true },
    ...(filter.lifecycleStage ? { lifecycleStage: filter.lifecycleStage } : {}),
    ...(filter.major ? { preferredMajor: filter.major } : {}),
    ...(filter.city ? { preferredCity: filter.city } : {}),
  };
  const profileSegmented = Boolean(filter.lifecycleStage || filter.major || filter.city);
  const selectedUserIds = profileSegmented ? await User.distinct("_id", userFilter) : null;
  const sourceActorIds = filter.source ? await Event.distinct("actorId", {
    ...dateMatch(range), "metadata.source": filter.source, actorId: { $type: "string", $ne: "" },
  }) : null;
  const sourceSet = sourceActorIds ? new Set(sourceActorIds.map(String)) : null;
  const userIds = sourceSet
    ? (selectedUserIds ? selectedUserIds.map(String).filter((id) => sourceSet.has(id)) : [...sourceSet])
    : selectedUserIds;
  const segmented = Boolean(userIds);
  const audienceUserFilter = filter.source ? { ...userFilter, _id: { $in: userIds } } : userFilter;
  const actorFilter = userIds ? { actorId: { $in: userIds.map(String) } } : {};
  // A source selects the identified audience at its entry event. Subsequent
  // funnel steps often have no source metadata, so keep those events in view.
  const eventBase = { ...eventMatch(range, {}), ...actorFilter };
  const ownerFilter = userIds ? { $in: userIds } : null;
  const payload = { tab, range: { start: range.start, end: range.end }, filter,
    trackingStartedAt, trackingAvailable, generatedAt: new Date() };

  if (tab === "overview") {
    const previous = { start: range.previousStart, end: range.start };
    const [activeUsers, previousActive, newUsers, previousNew, returningUsers, applyClicks, tracked, subscriptions, approved, finalized, retention] = await Promise.all([
      uniqueActors(Event, { ...eventBase, eventName: "page_view" }),
      uniqueActors(Event, { ...eventMatch(previous, {}), ...actorFilter, eventName: "page_view" }),
      authoritativeCount({ Daily, Model: User, metric: "record_user_signup", range, match: {
        ...userFilter, ...(filter.source ? { _id: { $in: userIds } } : {}),
      }, segmented }),
      User.countDocuments({ ...userFilter, ...dateMatch(previous), ...(filter.source ? { _id: { $in: userIds } } : {}) }),
      Event.aggregate([
        { $match: { ...eventBase, eventName: "page_view", actorId: segmented ? actorFilter.actorId : { $type: "string", $regex: /^[a-f0-9]{24}$/i } } },
        { $group: { _id: "$actorId" } },
        { $addFields: { userObjectId: { $toObjectId: "$_id" } } },
        { $lookup: { from: User.collection.name, localField: "userObjectId", foreignField: "_id", as: "user" } },
        { $unwind: "$user" },
        { $match: { "user.createdAt": { $lt: range.start }, "user.isAdmin": { $ne: true }, "user.contact": { $ne: "" } } },
        { $count: "count" },
      ]).then((rows) => asCount(rows[0])),
      Event.countDocuments({ ...eventBase, eventName: "opportunity_apply_clicked" }),
      authoritativeCount({ Daily, Model: Tracker, metric: "record_application", range,
        match: ownerFilter ? { studentId: ownerFilter } : {}, segmented }),
      Event.countDocuments({ ...eventBase, eventName: "subscription_completed", "metadata.paymentKind": "new_subscription" }),
      authoritativeCount({ Daily, Model: Experience, metric: "record_experience_approved", range, field: "reviewedAt",
        match: { status: "approved", qaTest: { $ne: true }, ...(ownerFilter ? { submittedByUserId: ownerFilter } : {}) }, segmented }),
      authoritativeCount({ Daily, Model: Snapshot, Experience, Reward, metric: "record_reward_resume_finalized", range, field: "finalizedAt",
        match: ownerFilter ? { userId: ownerFilter } : {}, segmented }),
      getRetention(Event, range, actorFilter),
    ]);
    payload.kpis = [
      { key: "activeUsers", label: "المستخدمون النشطون", value: observedCount(activeUsers), previous: observedCount(previousActive), trackedSince: true },
      { key: "newUsers", label: "مستخدمون جدد", value: newUsers, previous: previousNew },
      { key: "returningUsers", label: "حسابات عادت للنشاط", value: observedCount(returningUsers), previous: null, trackedSince: true },
      { key: "sevenDayReturnRate", label: "العودة بعد 7 أيام", value: retention.sevenDayReturnRate, unit: "%", previous: null, trackedSince: true },
      { key: "applyClicks", label: "نقرات التقديم", value: observedCount(applyClicks), previous: null, trackedSince: true },
      { key: "applicationsTracked", label: "تقديمات محفوظة", value: tracked, previous: null },
      { key: "newSubscriptions", label: "اشتراكات جديدة مؤكدة", value: observedCount(subscriptions), previous: null, trackedSince: true },
      { key: "approvedExperiences", label: "تجارب معتمدة", value: approved, previous: null },
      { key: "rewardResumesFinalized", label: "سير مكافأة مكتملة", value: finalized, previous: null },
    ];
  }

  if (tab === "audience") {
    const [stages, majors, cities, graduationYears, universities] = await Promise.all([
      User.aggregate([{ $match: audienceUserFilter }, { $group: { _id: "$lifecycleStage", count: { $sum: 1 } } }]),
      audienceTopField(User, Portfolio, audienceUserFilter, "major"),
      audienceTopField(User, Portfolio, audienceUserFilter, "city"),
      audienceTopField(User, Portfolio, audienceUserFilter, "graduationYear"),
      audienceTopField(User, Portfolio, audienceUserFilter, "university"),
    ]);
    const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, stages.find((row) => row._id === stage)?.count || 0]));
    stageCounts.unknown += stages.filter((row) => !STAGES.includes(row._id)).reduce((sum, row) => sum + row.count, 0);
    payload.audience = { stages: stageCounts, majors, cities, graduationYears, universities,
      profileLimitations: "تظهر سنوات التخرج والجامعات التي أضافها أصحاب الملفات المهنية فقط." };
  }

  if (tab === "behaviour") {
    const names = [
      "training_finder_opened", "where_to_train_search", "opportunity_detail_viewed", "opportunity_apply_clicked",
      "my_applications_opened", "student_applications_page_viewed", "company_page_viewed", "experience_card_opened",
      "interview_details_opened", "premium_gate_opened", "checkout_started",
      "add_experience_started", "add_experience_submitted", "reward_opened",
      "reward_resume_started", "reward_ai_used", "reward_resume_previewed",
      "reward_resume_finalized", "reward_resume_downloaded",
    ];
    payload.events = await eventCounts(Event, { ...eventBase, eventName: { $in: names } });
    payload.behaviourHistoryAvailable = trackingAvailable || Object.values(payload.events).some((count) => count > 0);
    payload.retention = await getRetention(Event, range, actorFilter);
    const activeActorIds = (await Event.distinct("actorId", {
      ...eventBase, eventName: "page_view", actorId: segmented ? actorFilter.actorId : { $type: "string", $regex: /^[a-f0-9]{24}$/i },
    })).map(String);
    const [users, trackerIds, rewardIds] = await Promise.all([
      User.find({ _id: { $in: activeActorIds } }).select("_id lifecycleStage isPremium premiumExpiresAt").lean(),
      Tracker.distinct("studentId", { studentId: { $in: activeActorIds } }),
      Reward.distinct("userId", { userId: { $in: activeActorIds } }),
    ]);
    const trackerSet = new Set(trackerIds.map(String));
    const rewardSet = new Set(rewardIds.map(String));
    const now = new Date();
    const groups = {
      student: [], graduate: [], free: [], paid: [], usedApplications: [], noApplications: [], rewardUser: [], noReward: [],
    };
    users.forEach((user) => {
      const id = String(user._id);
      if (user.lifecycleStage === "student") groups.student.push(id);
      if (user.lifecycleStage === "graduate") groups.graduate.push(id);
      groups[user.isPremium && (!user.premiumExpiresAt || user.premiumExpiresAt > now) ? "paid" : "free"].push(id);
      groups[trackerSet.has(id) ? "usedApplications" : "noApplications"].push(id);
      groups[rewardSet.has(id) ? "rewardUser" : "noReward"].push(id);
    });
    const retentionSegments = await Promise.all(Object.entries(groups).map(async ([key, ids]) => ({
      key, users: ids.length,
      d7: ids.length ? (await getRetention(Event, range, { actorId: { $in: ids } })).d7 : null,
    })));
    payload.retentionSegments = retentionSegments;
    const firstDay = new Date(range.start.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lastDay = new Date(range.end.getTime() - 1 + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    payload.dailyActivity = await Daily.aggregate([
      { $match: { day: { $gte: firstDay, $lte: lastDay }, eventName: "page_view",
        ...(filter.lifecycleStage ? { lifecycleStage: filter.lifecycleStage } : {}),
        ...(filter.major ? { major: filter.major } : {}),
        ...(filter.city ? { city: filter.city } : {}),
        ...(filter.source ? { source: filter.source } : {}),
      } },
      { $group: { _id: "$day", count: { $sum: "$count" } } },
      { $sort: { _id: 1 } },
    ]).then((rows) => rows.map((row) => ({ label: row._id, count: row.count })));
  }

  if (tab === "conversion" || tab === "rewards") {
    const [submitted, approved, granted, redeemed, finalized] = await Promise.all([
      authoritativeCount({ Daily, Model: Experience, metric: "record_experience_submitted", range,
        match: { qaTest: { $ne: true }, ...(ownerFilter ? { submittedByUserId: ownerFilter } : {}) }, segmented }),
      authoritativeCount({ Daily, Model: Experience, metric: "record_experience_approved", range, field: "reviewedAt",
        match: { status: "approved", qaTest: { $ne: true }, ...(ownerFilter ? { submittedByUserId: ownerFilter } : {}) }, segmented }),
      authoritativeCount({ Daily, Model: Reward, Experience, metric: "record_reward_granted", range, field: "grantedAt",
        match: ownerFilter ? { userId: ownerFilter } : {}, segmented }),
      authoritativeCount({ Daily, Model: Reward, Experience, metric: "record_reward_redeemed", range, field: "redeemedAt",
        match: { status: "redeemed", ...(ownerFilter ? { userId: ownerFilter } : {}) }, segmented }),
      authoritativeCount({ Daily, Model: Snapshot, Experience, Reward, metric: "record_reward_resume_finalized", range, field: "finalizedAt",
        match: ownerFilter ? { userId: ownerFilter } : {}, segmented }),
    ]);
    const [opportunity, contribution, reward, subscription] = await Promise.all([
      buildIdentityFunnel(Event, eventBase, [
        { label: "فتح وين أتدرب", events: ["training_finder_opened", "where_to_train_search"] },
        { label: "فتح فرصة", events: ["opportunity_detail_viewed"] },
        { label: "ضغط تقديم", events: ["opportunity_apply_clicked"] },
        { label: "حفظ تقديم", events: ["application_created"] },
        { label: "فتح تقديماتي", events: ["my_applications_opened", "student_applications_page_viewed"] },
      ]),
      buildIdentityFunnel(Event, eventBase, [
        { label: "بدأ المشاركة", events: ["add_experience_started"] },
        { label: "أرسل التجربة", events: ["experience_submitted"] },
        { label: "اعتمدت", events: ["experience_approved"] },
      ]),
      buildIdentityFunnel(Event, eventBase, [
        { label: "مكافأة منحت", events: ["reward_granted"] },
        { label: "فُتحت المكافأة", events: ["reward_opened"] },
        { label: "بدأت السيرة", events: ["reward_resume_started"] },
        { label: "اقتراح AI", events: ["reward_ai_used"], optional: true },
        { label: "المعاينة", events: ["reward_resume_previewed"] },
        { label: "اعتمدت السيرة", events: ["resume_finalized"] },
        { label: "تنزيل PDF", events: ["reward_resume_downloaded"] },
      ]),
      buildIdentityFunnel(Event, eventBase, [
        { label: "ظهرت بوابة الاشتراك", events: ["premium_gate_opened"] },
        { label: "بدأ الدفع", events: ["checkout_started", "premium_checkout_started"] },
        { label: "اشتراك ناجح", events: ["subscription_completed"] },
      ]),
    ]);
    payload.funnels = { opportunity, contribution, reward, subscription };
    if (tab === "rewards") {
      payload.metrics = {
        submitted, approved, granted, redeemed, finalized,
        // Conversion rates use the same identified people across funnel steps.
        // Dividing independently dated record counts can exceed 100% when an
        // approval or redemption happens in a later reporting period.
        approvalRate: contribution[2]?.fromPrevious ?? null,
        rewardOpenRate: reward[1]?.fromPrevious ?? null,
        redemptionRate: pct(reward[5]?.count || 0, reward[0]?.count || 0),
        finalizeRate: pct(reward[5]?.count || 0, reward[2]?.count || 0),
        downloadRate: reward[6]?.fromPrevious ?? null,
      };
      const [duration] = await Reward.aggregate([
        { $match: { status: "redeemed", redeemedAt: { $gte: range.start, $lt: range.end }, ...(ownerFilter ? { userId: ownerFilter } : {}) } },
        { $project: { hours: { $divide: [{ $subtract: ["$redeemedAt", "$grantedAt"] }, 3600000] } } },
        { $group: { _id: null, averageHours: { $avg: "$hours" } } },
      ]);
      payload.metrics.averageHoursToFinalize = duration?.averageHours ?? null;
      const [resumeFeedback, contributionFeedback] = await Promise.all([
        Feedback.aggregate([{ $match: { kind: "reward_resume", ...dateMatch(range), ...(ownerFilter ? { userId: ownerFilter } : {}) } },
          { $group: { _id: "$rating", count: { $sum: 1 } } }]),
        Feedback.aggregate([{ $match: { kind: "experience_submission", ...dateMatch(range), ...(ownerFilter ? { userId: ownerFilter } : {}) } },
          { $group: { _id: "$ease", count: { $sum: 1 } } }]),
      ]);
      payload.feedback = {
        resumeRatings: resumeFeedback.map((row) => ({ label: String(row._id), count: row.count })),
        contributionEase: contributionFeedback.map((row) => ({ label: row._id, count: row.count })),
      };
    }
  }

  if (tab === "content") {
    const [majors, cities, companies, opportunities, applies, viewApplyRows] = await Promise.all([
      topField(Event, { ...eventBase, eventName: "where_to_train_search" }, "major"),
      topField(Event, { ...eventBase, eventName: "where_to_train_search" }, "city"),
      topField(Event, { ...eventBase, eventName: "company_page_viewed" }, "metadata.companySlug"),
      topField(Event, { ...eventBase, eventName: "opportunity_detail_viewed" }, "metadata.opportunityId"),
      topField(Event, { ...eventBase, eventName: "opportunity_apply_clicked" }, "metadata.opportunityId"),
      Event.aggregate([
        { $match: { ...eventBase, eventName: { $in: ["opportunity_detail_viewed", "opportunity_apply_clicked"] },
          "metadata.opportunityId": { $type: "string", $ne: "" } } },
        { $group: { _id: "$metadata.opportunityId",
          views: { $sum: { $cond: [{ $eq: ["$eventName", "opportunity_detail_viewed"] }, 1, 0] } },
          applies: { $sum: { $cond: [{ $eq: ["$eventName", "opportunity_apply_clicked"] }, 1, 0] } },
        } },
        { $match: { views: { $gte: 5 } } },
        { $sort: { views: -1, _id: 1 } }, { $limit: 30 },
      ]),
    ]);
    const lowApply = viewApplyRows.filter((row) => row.applies / row.views < 0.05).slice(0, 8)
      .map((row) => ({ label: String(row._id), count: row.views, applies: row.applies }));
    const referencedIds = [...new Set([...opportunities, ...applies, ...lowApply].map((item) => item.label))]
      .filter((id) => /^[a-f0-9]{24}$/i.test(id));
    const names = await Opportunity.find({ _id: { $in: referencedIds } })
      .select("_id title organizationName").lean();
    const nameById = new Map(names.map((item) => [String(item._id), `${item.organizationName} — ${item.title}`]));
    const rename = (items) => items.map((item) => ({ ...item, label: nameById.get(item.label) || "فرصة غير متاحة" }));
    const [coverage] = segmented ? [] : await Company.aggregate([
      { $match: { showInStudentDirectory: true } },
      { $lookup: { from: Experience.collection.name, let: { companyId: "$_id" }, pipeline: [
        { $match: { $expr: { $eq: ["$companyId", "$$companyId"] }, status: "approved", qaTest: { $ne: true } } },
        { $count: "count" },
      ], as: "experiences" } },
      { $project: { count: { $ifNull: [{ $first: "$experiences.count" }, 0] } } },
      { $group: { _id: null,
        zero: { $sum: { $cond: [{ $eq: ["$count", 0] }, 1, 0] } },
        one: { $sum: { $cond: [{ $eq: ["$count", 1] }, 1, 0] } },
      } },
    ]);
    const [majorCoverage, cityCoverage] = await Promise.all([
      topField(Experience, { status: "approved", qaTest: { $ne: true } }, "major", 100),
      topField(Experience, { status: "approved", qaTest: { $ne: true } }, "city", 100),
    ]);
    const majorCounts = new Map(majorCoverage.map((item) => [item.label, item.count]));
    const cityCounts = new Map(cityCoverage.map((item) => [item.label, item.count]));
    payload.content = { majors, cities, companies, opportunities: rename(opportunities), applies: rename(applies),
      highViewsLowApply: rename(lowApply),
      lowCoverageMajors: majors.filter((item) => (majorCounts.get(item.label) || 0) <= 1),
      lowCoverageCities: cities.filter((item) => (cityCounts.get(item.label) || 0) <= 1),
      companiesWithOneExperience: segmented ? null : coverage?.one || 0,
      companiesWithNoExperience: segmented ? null : coverage?.zero || 0,
    };
  }

  if (tab === "subscriptions") {
    const [subscriptionsRecorded, newSubscriptions, renewals, expired, plans, subscriptionFunnel, sources, rewardPurchases] = await Promise.all([
      authoritativeCount({ Daily, Model: Subscription, metric: "record_subscription", range,
        match: { status: { $ne: "pending" } }, segmented }),
      Event.countDocuments({ ...eventBase, eventName: "subscription_completed", "metadata.paymentKind": "new_subscription" }),
      Event.countDocuments({ ...eventBase, eventName: "subscription_completed", "metadata.paymentKind": "renewal" }),
      segmented ? Promise.resolve(null) : Subscription.countDocuments({ expiresAt: { $gte: range.start, $lt: range.end } }),
      topField(Subscription, { ...dateMatch(range), status: { $in: ["active", "expired"] } }, "planId"),
      buildIdentityFunnel(Event, eventBase, [
        { label: "ظهرت بوابة الاشتراك", events: ["premium_gate_opened"] },
        { label: "بدأ الدفع", events: ["checkout_started", "premium_checkout_started"] },
        { label: "اشتراك ناجح", events: ["subscription_completed"] },
      ]),
      topField(Event, { ...eventBase, eventName: "subscription_completed" }, "metadata.source"),
      Event.aggregate([
        { $match: { ...eventBase, eventName: "subscription_completed", "metadata.planKey": "darbak_resume",
          actorId: ownerFilter ? { $in: userIds.map(String) } : { $type: "string", $regex: /^[a-f0-9]{24}$/i } } },
        { $addFields: { actorObjectId: { $toObjectId: "$actorId" } } },
        { $lookup: { from: Reward.collection.name, localField: "actorObjectId", foreignField: "userId", as: "rewards" } },
        { $unwind: "$rewards" },
        { $project: { actorId: 1, days: { $dateDiff: { startDate: "$rewards.grantedAt", endDate: "$createdAt", unit: "day" } } } },
        { $match: { days: { $gte: 0, $lte: 30 } } },
        { $group: { _id: "$actorId", firstDays: { $min: "$days" } } },
        { $group: { _id: null, within7: { $sum: { $cond: [{ $lte: ["$firstDays", 7] }, 1, 0] } },
          within30: { $sum: 1 } } },
      ]),
    ]);
    payload.subscriptions = { subscriptionsRecorded, newSubscriptions: observedCount(newSubscriptions),
      renewals: observedCount(renewals), expired, plans,
      paywallToCheckout: subscriptionFunnel[1]?.fromPrevious ?? null,
      checkoutToPaid: subscriptionFunnel[2]?.fromPrevious ?? null,
      sources,
      rewardUsersBoughtResumeWithin7Days: rewardPurchases[0]?.within7 || 0,
      rewardUsersBoughtResumeWithin30Days: rewardPurchases[0]?.within30 || 0,
    };
  }

  payload.health = {
    lastEventAt: await Event.findOne().sort({ createdAt: -1 }).select("createdAt").lean().then((row) => row?.createdAt || null),
    lastAggregationAt: await Daily.findOne().sort({ updatedAt: -1 }).select("updatedAt").lean().then((row) => row?.updatedAt || null),
  };
  return payload;
};

module.exports = { parseRange, safeFilter, pct, authoritativeCount, buildIdentityFunnel, buildAdminAnalyticsTab, TABS };
