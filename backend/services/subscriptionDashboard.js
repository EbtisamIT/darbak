const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const FEATURE_EVENTS = {
  premiumExperience: ["premium_experience_viewed"],
  premiumOpportunity: ["premium_opportunity_viewed"],
  whereToTrain: ["where_to_train_search"],
  resumeOpened: ["resume_page_view", "resume_preview_viewed"],
  resumeStarted: ["resume_agent_started", "resume_agent_flow_started", "resume_create_scratch_clicked", "resume_use_portfolio_clicked"],
  resumeCompleted: ["resume_agent_draft_approved_frontend"],
  resumeTailored: ["resume_agent_tailor_started", "application_pack_completed"],
  resumeDownloaded: ["resume_pdf_downloaded"],
  emailGenerated: ["application_pack_completed"],
  emailCopied: ["email_copied"],
  portfolioCreated: ["portfolio_saved_from_page", "portfolio_saved"],
  applicationSubmitted: ["company_application_submitted"],
};

const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

const getRiyadhDayStart = (value = new Date()) => {
  const shifted = new Date(new Date(value).getTime() + RIYADH_OFFSET_MS);
  return new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  ) - RIYADH_OFFSET_MS);
};

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const getRange = (daysParam = "30") => {
  const days = ["7", "30", "90"].includes(String(daysParam))
    ? Number(daysParam)
    : 30;
  const todayStart = getRiyadhDayStart();
  return {
    days,
    start: addDays(todayStart, -(days - 1)),
    end: addDays(todayStart, 1),
    todayStart,
    tomorrowStart: addDays(todayStart, 1),
    yesterdayStart: addDays(todayStart, -1),
    weekStart: addDays(todayStart, -6),
    monthStart: new Date(Date.UTC(
      new Date(todayStart.getTime() + RIYADH_OFFSET_MS).getUTCFullYear(),
      new Date(todayStart.getTime() + RIYADH_OFFSET_MS).getUTCMonth(),
      1
    ) - RIYADH_OFFSET_MS),
  };
};

const eventIdentity = {
  $cond: [
    { $and: [{ $ne: ["$actorId", null] }, { $ne: ["$actorId", ""] }] },
    "$actorId",
    "$visitorId",
  ],
};

const distinctEventUsers = async (AnalyticsEvent, match = {}) => {
  const rows = await AnalyticsEvent.aggregate([
    { $match: match },
    { $project: { identity: eventIdentity } },
    { $match: { identity: { $nin: [null, ""] } } },
    { $group: { _id: "$identity" } },
  ]);
  return rows.map((row) => String(row._id));
};

const getUniqueEventStats = async (AnalyticsEvent, eventNames, match, actorIds = null) => {
  const baseMatch = {
    ...match,
    eventName: { $in: eventNames },
    ...(actorIds ? { actorId: { $in: actorIds } } : {}),
  };
  const [row] = await AnalyticsEvent.aggregate([
    { $match: baseMatch },
    { $project: { identity: eventIdentity } },
    {
      $group: {
        _id: null,
        events: { $sum: 1 },
        identities: { $addToSet: "$identity" },
      },
    },
    {
      $project: {
        _id: 0,
        events: 1,
        users: {
          $size: {
            $filter: {
              input: "$identities",
              as: "identity",
              cond: { $and: [{ $ne: ["$$identity", null] }, { $ne: ["$$identity", ""] }] },
            },
          },
        },
      },
    },
  ]);
  return { users: safeNumber(row?.users), events: safeNumber(row?.events) };
};

const getEventStatsByKey = async (AnalyticsEvent, match, actorIds) => {
  const entries = await Promise.all(
    Object.entries(FEATURE_EVENTS).map(async ([key, eventNames]) => [
      key,
      await getUniqueEventStats(AnalyticsEvent, eventNames, match, actorIds),
    ])
  );
  return Object.fromEntries(entries);
};

const getPaymentAggregate = async (AnalyticsEvent, range) => {
  const paymentMatch = {
    eventName: "subscription_completed",
    "metadata.provider": "moyasar",
    "metadata.providerPaymentId": { $type: "string", $ne: "" },
  };
  const [summary] = await AnalyticsEvent.aggregate([
    { $match: paymentMatch },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: "$metadata.providerPaymentId",
        createdAt: { $first: "$createdAt" },
        amountSar: { $first: "$metadata.priceSar" },
        actorId: { $first: "$actorId" },
        paymentKind: { $first: "$metadata.paymentKind" },
      },
    },
    {
      $group: {
        _id: null,
        allTimeSar: { $sum: { $convert: { input: "$amountSar", to: "double", onError: 0, onNull: 0 } } },
        todaySar: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", range.todayStart] }, { $convert: { input: "$amountSar", to: "double", onError: 0, onNull: 0 } }, 0],
          },
        },
        weekSar: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", range.weekStart] }, { $convert: { input: "$amountSar", to: "double", onError: 0, onNull: 0 } }, 0],
          },
        },
        monthSar: {
          $sum: {
            $cond: [{ $gte: ["$createdAt", range.monthStart] }, { $convert: { input: "$amountSar", to: "double", onError: 0, onNull: 0 } }, 0],
          },
        },
        newToday: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.todayStart] }, { $eq: ["$paymentKind", "new_subscription"] }] }, 1, 0] } },
        renewalsToday: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.todayStart] }, { $eq: ["$paymentKind", "renewal"] }] }, 1, 0] } },
        newInRange: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.start] }, { $eq: ["$paymentKind", "new_subscription"] }] }, 1, 0] } },
        renewalsInRange: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.start] }, { $eq: ["$paymentKind", "renewal"] }] }, 1, 0] } },
        newLast7Days: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.weekStart] }, { $eq: ["$paymentKind", "new_subscription"] }] }, 1, 0] } },
        renewalsThisMonth: { $sum: { $cond: [{ $and: [{ $gte: ["$createdAt", range.monthStart] }, { $eq: ["$paymentKind", "renewal"] }] }, 1, 0] } },
        renewalTrackingEvents: { $sum: { $cond: [{ $in: ["$paymentKind", ["new_subscription", "renewal"]] }, 1, 0] } },
      },
    },
  ]);
  return summary || {};
};

const getDailySubscriptionSeries = async (AnalyticsEvent, Subscription, range) => {
  const start = addDays(range.todayStart, -29);
  const [payments, expirations] = await Promise.all([
    AnalyticsEvent.aggregate([
      {
        $match: {
          eventName: "subscription_completed",
          "metadata.provider": "moyasar",
          "metadata.providerPaymentId": { $type: "string", $ne: "" },
          createdAt: { $gte: start, $lt: range.end },
        },
      },
      { $sort: { createdAt: 1, _id: 1 } },
      { $group: { _id: "$metadata.providerPaymentId", createdAt: { $first: "$createdAt" }, paymentKind: { $first: "$metadata.paymentKind" } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Riyadh" } },
          paymentKind: 1,
        },
      },
      { $group: { _id: { day: "$day", kind: "$paymentKind" }, count: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $match: { expiresAt: { $gte: start, $lt: range.end } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$expiresAt", timezone: "Asia/Riyadh" } },
        },
      },
      { $group: { _id: "$day", count: { $sum: 1 } } },
    ]),
  ]);
  const rows = new Map();
  for (let index = 0; index < 30; index += 1) {
    const day = addDays(start, index).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
    rows.set(day, { date: day, newSubscriptions: 0, renewals: 0, expired: 0 });
  }
  payments.forEach((row) => {
    const item = rows.get(row._id.day);
    if (!item) return;
    if (row._id.kind === "new_subscription") item.newSubscriptions += safeNumber(row.count);
    if (row._id.kind === "renewal") item.renewals += safeNumber(row.count);
  });
  expirations.forEach((row) => {
    const item = rows.get(row._id);
    if (item) item.expired = safeNumber(row.count);
  });
  return Array.from(rows.values());
};

const buildFunnel = async (AnalyticsEvent, match) => {
  const stages = [
    ["visitor", ["page_view"]],
    ["paywall", ["premium_gate_opened", "subscription_reminder_shown"]],
    ["subscribeClick", ["premium_cta_clicked", "premium_plan_selected", "subscription_reminder_clicked"]],
    ["checkout", ["checkout_started", "premium_checkout_started"]],
    ["paid", ["subscription_completed"]],
  ];
  const results = await Promise.all(stages.map(async ([key, eventNames]) => {
    const stats = await getUniqueEventStats(AnalyticsEvent, eventNames, match);
    return [key, stats];
  }));
  const values = Object.fromEntries(results);
  const order = ["visitor", "paywall", "subscribeClick", "checkout", "paid"];
  return order.map((key, index) => ({
    key,
    users: values[key].users,
    events: values[key].events,
    conversion: index === 0 || !values[order[index - 1]].users
      ? null
      : Number(((values[key].users / values[order[index - 1]].users) * 100).toFixed(1)),
  }));
};

const getTopGroups = (AnalyticsEvent, match, expression, limit = 5) =>
  AnalyticsEvent.aggregate([
    { $match: match },
    { $project: { label: expression } },
    { $match: { label: { $type: "string", $ne: "" } } },
    { $group: { _id: "$label", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, label: "$_id", count: 1 } },
  ]);

const buildSubscriptionDashboard = async ({ AnalyticsEvent, Subscription, User, days }) => {
  const range = getRange(days);
  const eventMatch = { createdAt: { $gte: range.start, $lt: range.end } };
  const todayMatch = { createdAt: { $gte: range.todayStart, $lt: range.tomorrowStart } };
  const yesterdayMatch = { createdAt: { $gte: range.yesterdayStart, $lt: range.todayStart } };
  const now = new Date();
  const activeSubscriptionFilter = { status: "active", expiresAt: { $gt: now } };

  const [payments, activeSubscribers, subscriptionCounts, todayUsers, yesterdayUsers, funnel, dailySeries] = await Promise.all([
    getPaymentAggregate(AnalyticsEvent, range),
    User.find({ isPremium: true, premiumExpiresAt: { $gt: now }, isAdmin: { $ne: true } }).select("_id premiumExpiresAt accessSource").lean(),
    Promise.all([
      Subscription.countDocuments(activeSubscriptionFilter),
      Subscription.countDocuments({ provider: "moyasar", status: "pending" }),
      Subscription.countDocuments({ ...activeSubscriptionFilter, provider: "manual" }),
      Subscription.countDocuments({ expiresAt: { $gte: range.todayStart, $lt: range.tomorrowStart } }),
      Subscription.countDocuments({ expiresAt: { $lt: now }, status: { $ne: "cancelled" } }),
      Subscription.countDocuments({
        ...activeSubscriptionFilter,
        aiResumeUsageLimit: { $gt: 0 },
        $expr: { $gte: ["$aiResumeUsageCount", "$aiResumeUsageLimit"] },
      }),
    ]),
    distinctEventUsers(AnalyticsEvent, todayMatch),
    distinctEventUsers(AnalyticsEvent, yesterdayMatch),
    buildFunnel(AnalyticsEvent, eventMatch),
    getDailySubscriptionSeries(AnalyticsEvent, Subscription, range),
  ]);

  const activeActorIds = activeSubscribers.map((user) => String(user._id));
  const [todayUsage, periodUsage, lastWeekUsage, resumeStats, sessionRows, weeklyUsers, monthlyUsers, returningRows, sourceRows, topExperiences, topOpportunities, topCompanies, topMajors, topCities] = await Promise.all([
    getEventStatsByKey(AnalyticsEvent, todayMatch, activeActorIds),
    getEventStatsByKey(AnalyticsEvent, eventMatch, activeActorIds),
    getEventStatsByKey(AnalyticsEvent, { createdAt: { $gte: range.weekStart, $lt: range.end } }, activeActorIds),
    getEventStatsByKey(AnalyticsEvent, eventMatch, null),
    AnalyticsEvent.aggregate([
      { $match: { ...eventMatch, eventName: "user_session" } },
      { $project: { actorId: 1, duration: { $convert: { input: "$metadata.durationSeconds", to: "double", onError: 0, onNull: 0 } } } },
      { $match: { duration: { $gte: 5, $lte: 10800 } } },
      { $group: { _id: "$actorId", total: { $sum: "$duration" }, sessions: { $sum: 1 } } },
    ]),
    distinctEventUsers(AnalyticsEvent, { createdAt: { $gte: range.weekStart, $lt: range.end } }),
    distinctEventUsers(AnalyticsEvent, { createdAt: { $gte: addDays(range.todayStart, -29), $lt: range.end } }),
    AnalyticsEvent.aggregate([
      { $match: { createdAt: { $gte: range.weekStart, $lt: range.end } } },
      { $project: { identity: eventIdentity, day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Riyadh" } } } },
      { $match: { identity: { $nin: [null, ""] } } },
      { $group: { _id: "$identity", days: { $addToSet: "$day" } } },
      { $match: { $expr: { $gte: [{ $size: "$days" }, 2] } } },
      { $count: "count" },
    ]),
    getTopGroups(AnalyticsEvent, { ...eventMatch, eventName: { $in: ["checkout_started", "premium_checkout_started"] } }, { $ifNull: ["$metadata.source", { $ifNull: ["$metadata.sourcePage", "غير معروف"] }] }),
    getTopGroups(AnalyticsEvent, { ...eventMatch, eventName: { $in: ["experience_card_opened", "experience_detail_viewed", "premium_experience_viewed"] } }, { $ifNull: ["$metadata.title", "$metadata.organizationName"] }),
    getTopGroups(AnalyticsEvent, { ...eventMatch, eventName: { $in: ["opportunity_details_clicked", "opportunity_detail_viewed", "premium_opportunity_viewed"] } }, { $ifNull: ["$metadata.opportunityTitle", "$metadata.organizationName"] }),
    getTopGroups(AnalyticsEvent, { ...eventMatch, "metadata.organizationName": { $type: "string", $ne: "" } }, "$metadata.organizationName"),
    getTopGroups(AnalyticsEvent, { ...eventMatch, major: { $type: "string", $ne: "" } }, "$major"),
    getTopGroups(AnalyticsEvent, { ...eventMatch, city: { $type: "string", $ne: "" } }, "$city"),
  ]);

  const featureKeys = Object.keys(FEATURE_EVENTS);
  const todayEngagedIds = await distinctEventUsers(AnalyticsEvent, {
    ...todayMatch,
    actorId: { $in: activeActorIds },
    eventName: { $in: featureKeys.flatMap((key) => FEATURE_EVENTS[key]) },
  });
  const todayEngaged = todayEngagedIds.length;
  // Counting a union is more useful than adding feature KPIs; one student who
  // uses three features remains one engaged subscriber.
  const engagedIds = await distinctEventUsers(AnalyticsEvent, {
    createdAt: { $gte: range.weekStart, $lt: range.end },
    actorId: { $in: activeActorIds },
    eventName: { $in: featureKeys.flatMap((key) => FEATURE_EVENTS[key]) },
  });
  const activeWeekIds = await distinctEventUsers(AnalyticsEvent, {
    createdAt: { $gte: range.weekStart, $lt: range.end },
    actorId: { $in: activeActorIds },
  });
  const active14Ids = await distinctEventUsers(AnalyticsEvent, {
    createdAt: { $gte: addDays(range.todayStart, -13), $lt: range.end },
    actorId: { $in: activeActorIds },
  });
  const inactive7 = Math.max(activeActorIds.length - activeWeekIds.length, 0);
  const inactive14 = Math.max(activeActorIds.length - active14Ids.length, 0);
  const atRisk = activeSubscribers.filter((user) => {
    const expiresAt = new Date(user.premiumExpiresAt || 0);
    return expiresAt > now && expiresAt <= addDays(now, 10) && !activeWeekIds.includes(String(user._id));
  }).length;
  const sessionTotals = sessionRows.reduce((summary, row) => {
    const duration = safeNumber(row.total);
    summary.total += duration;
    summary.sessions += safeNumber(row.sessions);
    if (activeActorIds.includes(String(row._id))) {
      summary.premium += duration;
      summary.premiumSessions += safeNumber(row.sessions);
    } else {
      summary.free += duration;
      summary.freeSessions += safeNumber(row.sessions);
    }
    return summary;
  }, { total: 0, sessions: 0, premium: 0, premiumSessions: 0, free: 0, freeSessions: 0 });
  const resumeFunnel = [
    ["opened", resumeStats.resumeOpened],
    ["started", resumeStats.resumeStarted],
    ["completed", resumeStats.resumeCompleted],
    ["tailored", resumeStats.resumeTailored],
    ["downloaded", resumeStats.resumeDownloaded],
  ].map(([key, stats], index, entries) => ({
    key,
    users: stats?.users || 0,
    events: stats?.events || 0,
    conversion: index && entries[index - 1][1]?.users
      ? Number(((stats.users / entries[index - 1][1].users) * 100).toFixed(1))
      : null,
  }));
  const renewalEligible = subscriptionCounts[3];
  const renewalRate = payments.renewalTrackingEvents && renewalEligible
    ? Number(((safeNumber(payments.renewalsInRange) / renewalEligible) * 100).toFixed(1))
    : null;

  return {
    generatedAt: new Date().toISOString(),
    range: { days: range.days, label: `آخر ${range.days} يوم`, trackingNotice: "تُحتسب مؤشرات الاستخدام والتجديد الدقيقة من تاريخ تفعيل التتبع المرتبط بالحساب." },
    revenue: {
      todaySar: safeNumber(payments.todaySar),
      last7DaysSar: safeNumber(payments.weekSar),
      monthSar: safeNumber(payments.monthSar),
      allTimeSar: safeNumber(payments.allTimeSar),
      source: "moyasar_success_only",
    },
    overview: {
      newSubscribersToday: safeNumber(payments.newToday),
      revenueTodaySar: safeNumber(payments.todaySar),
      activeUsersToday: todayUsers.length,
      activeUsersYesterday: yesterdayUsers.length,
      subscribersUsedFeatureToday: todayEngaged,
      renewalsToday: safeNumber(payments.renewalsToday),
      expiredToday: subscriptionCounts[3],
    },
    subscriptions: {
      active: subscriptionCounts[0],
      newToday: safeNumber(payments.newToday),
      newLast7Days: safeNumber(payments.newLast7Days),
      renewalsToday: safeNumber(payments.renewalsToday),
      renewalsThisMonth: safeNumber(payments.renewalsThisMonth),
      expired: subscriptionCounts[4],
      pendingPayment: subscriptionCounts[1],
      manuallyActivated: subscriptionCounts[2],
      renewalRate,
      renewalEligible,
      renewalTrackingAvailable: Boolean(payments.renewalTrackingEvents),
      dailySeries,
    },
    subscriberUsage: {
      metrics: periodUsage,
      activeWithAnyFeature: engagedIds.length,
      activeWithoutFeatureLast7Days: Math.max(activeActorIds.length - engagedIds.length, 0),
    },
    resume: {
      ...resumeStats,
      funnel: resumeFunnel,
      averageTailorsPerUser: resumeStats.resumeTailored?.users
        ? Number((resumeStats.resumeTailored.events / resumeStats.resumeTailored.users).toFixed(1))
        : 0,
      monthlyLimitReached: subscriptionCounts[5],
    },
    email: {
      generated: resumeStats.emailGenerated,
      copied: resumeStats.emailCopied,
      averagePerUser: resumeStats.emailGenerated?.users
        ? Number((resumeStats.emailGenerated.events / resumeStats.emailGenerated.users).toFixed(1))
        : 0,
    },
    activity: {
      dailyActive: todayUsers.length,
      weeklyActive: weeklyUsers.length,
      monthlyActive: monthlyUsers.length,
      weeklyReturning: safeNumber(returningRows[0]?.count),
      subscribersAbsent7Days: inactive7,
      subscribersAbsent14Days: inactive14,
      averageSessionSeconds: sessionTotals.sessions ? Math.round(sessionTotals.total / sessionTotals.sessions) : 0,
      averagePremiumSessionSeconds: sessionTotals.premiumSessions ? Math.round(sessionTotals.premium / sessionTotals.premiumSessions) : 0,
      averageFreeSessionSeconds: sessionTotals.freeSessions ? Math.round(sessionTotals.free / sessionTotals.freeSessions) : 0,
    },
    funnel,
    attribution: sourceRows,
    content: { experiences: topExperiences, opportunities: topOpportunities, companies: topCompanies, majors: topMajors, cities: topCities },
    risk: { benefiting: engagedIds.length, inactive: inactive7, atRisk },
  };
};

module.exports = {
  buildSubscriptionDashboard,
  getRange,
};
