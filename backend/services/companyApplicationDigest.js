const INITIAL_DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const DIGEST_LEASE_MS = 15 * 60 * 1000;

const asDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeCountRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((item) => ({
      label: (item?.label || "غير محدد").toString().trim() || "غير محدد",
      count: Number(item?.count || 0),
    }))
    .filter((item) => item.count > 0)
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label, "ar")
    );

const getDigestWindowStart = (company = {}, cutoff = new Date()) =>
  asDate(company.lastApplicationDigestSentAt) ||
  new Date(cutoff.getTime() - INITIAL_DIGEST_LOOKBACK_MS);

const getMillisecondsUntilNextRiyadhDigest = (now = new Date()) => {
  const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
  const riyadhNow = new Date(now.getTime() + RIYADH_OFFSET_MS);
  let nextRun = Date.UTC(
    riyadhNow.getUTCFullYear(),
    riyadhNow.getUTCMonth(),
    riyadhNow.getUTCDate(),
    17,
    0,
    0,
    0
  );
  if (nextRun <= now.getTime()) nextRun += 24 * 60 * 60 * 1000;
  return Math.max(nextRun - now.getTime(), 1000);
};

const formatRequestCount = (count = 0) => {
  const safeCount = Number(count || 0);
  if (safeCount === 1) return "طلب جديد واحد";
  if (safeCount === 2) return "طلبان جديدان";
  if (safeCount >= 3 && safeCount <= 10) return `${safeCount} طلبات جديدة`;
  return `${safeCount} طلبًا جديدًا`;
};

const buildCompanyApplicationDigestSubject = ({
  newApplicationCount = 0,
  campaigns = [],
  majors = [],
  cities = [],
} = {}) => {
  const countLabel = formatRequestCount(newApplicationCount);
  const cleanMajors = normalizeCountRows(majors)
    .map((item) => item.label)
    .filter((label) => label !== "غير محدد")
    .slice(0, 2);
  const cleanCities = normalizeCountRows(cities)
    .map((item) => item.label)
    .filter((label) => label !== "غير محدد")
    .slice(0, 2);
  const hasCompactBreakdown =
    campaigns.length === 1 && cleanMajors.length > 0 && cleanCities.length > 0;

  if (hasCompactBreakdown) {
    const detailed = `دربك | ${countLabel} — ${cleanMajors.join("، ")} | ${cleanCities.join(" و")}`;
    if (detailed.length <= 90) return detailed;
  }

  return `دربك | ${countLabel} على فرصكم التدريبية`;
};

const buildBreakdownText = (title, rows = []) => {
  const values = normalizeCountRows(rows);
  if (!values.length) return "";
  return [title, ...values.map((item) => `${item.label}: ${item.count}`)].join("\n");
};

const buildBreakdownHtml = (title, rows = []) => {
  const values = normalizeCountRows(rows);
  if (!values.length) return "";
  return `
    <div style="margin-top:18px">
      <strong style="display:block;margin-bottom:6px;color:#0f172a">${escapeHtml(title)}</strong>
      ${values
        .map(
          (item) =>
            `<div style="display:flex;justify-content:space-between;gap:16px;padding:4px 0;color:#334155"><span>${escapeHtml(
              item.label
            )}</span><strong>${item.count}</strong></div>`
        )
        .join("")}
    </div>`;
};

const buildCompanyApplicationDigestEmail = ({
  companyName = "",
  portalUrl = "",
  summary = {},
} = {}) => {
  const campaigns = normalizeCountRows(
    (summary.campaigns || []).map((item) => ({
      label: item.title || item.label || "برنامج تدريبي",
      count: item.count,
    }))
  );
  const majors = normalizeCountRows(summary.majors);
  const cities = normalizeCountRows(summary.cities);
  const newApplicationCount = Number(summary.newApplicationCount || 0);
  const totalApplicationCount = Number(summary.totalApplicationCount || 0);
  const pendingReviewCount = Number(summary.pendingReviewCount || 0);
  const subject = buildCompanyApplicationDigestSubject({
    newApplicationCount,
    campaigns,
    majors,
    cities,
  });
  const safePortalUrl = portalUrl.toString();
  const text = [
    `مرحبًا فريق ${companyName || "الشركة"}،`,
    "",
    `وصلتكم اليوم ${formatRequestCount(newApplicationCount)} عبر دربك.`,
    "",
    buildBreakdownText("طلبات اليوم:", campaigns),
    "",
    buildBreakdownText("حسب التخصص:", majors),
    "",
    buildBreakdownText("حسب المدينة:", cities),
    "",
    `إجمالي الطلبات حتى الآن: ${totalApplicationCount}`,
    `بانتظار المراجعة: ${pendingReviewCount}`,
    "",
    "مراجعة المتقدمين:",
    safePortalUrl,
    "",
    "يمكنكم من بوابة دربك مراجعة السير الذاتية، فرز المتقدمين وتحديث حالات الطلبات.",
    "",
    "دربك",
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#111827;background:#f8fafc;padding:24px">
      <div style="max-width:580px;margin:auto;background:#ffffff;border:1px solid #dbe7e3;border-radius:18px;padding:24px">
        <p style="margin:0 0 8px;color:#0f766e;font-weight:700">دربك</p>
        <h2 style="margin:0 0 12px;color:#111827">طلبات جديدة بانتظاركم</h2>
        <p style="margin:0;color:#334155">مرحبًا فريق ${escapeHtml(
          companyName || "الشركة"
        )}،</p>
        <p style="margin:6px 0 0;color:#334155">وصلتكم اليوم <strong>${escapeHtml(
          formatRequestCount(newApplicationCount)
        )}</strong> عبر دربك.</p>
        ${buildBreakdownHtml("طلبات اليوم", campaigns)}
        ${buildBreakdownHtml("حسب التخصص", majors)}
        ${buildBreakdownHtml("حسب المدينة", cities)}
        <div style="margin:20px 0;padding:14px;border-radius:12px;background:#f1f7f5;color:#0f172a">
          <div>إجمالي الطلبات حتى الآن: <strong>${totalApplicationCount}</strong></div>
          <div>بانتظار المراجعة: <strong>${pendingReviewCount}</strong></div>
        </div>
        <a href="${escapeHtml(
          safePortalUrl
        )}" style="display:inline-block;background:#7ddbcd;color:#07100e;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 18px">مراجعة المتقدمين</a>
        <p style="margin:16px 0 0;color:#64748b;font-size:13px">يمكنكم من بوابة دربك مراجعة السير الذاتية، فرز المتقدمين وتحديث حالات الطلبات.</p>
      </div>
    </div>`;

  return { subject, text, html };
};

const runCompanyApplicationDigest = async ({
  repository,
  sendEmail,
  frontendUrl,
  now = new Date(),
  logger = console,
} = {}) => {
  if (!repository || typeof sendEmail !== "function") {
    throw new Error("Company application digest dependencies are required.");
  }

  const cutoff = asDate(now) || new Date();
  const companies = await repository.listDigestCompanies({ cutoff });
  const result = { companiesChecked: companies.length, sent: 0, skipped: 0, failed: 0 };

  for (const candidate of companies) {
    if (candidate.applicationDigestEnabled === false) {
      result.skipped += 1;
      continue;
    }

    const leaseUntil = new Date(cutoff.getTime() + DIGEST_LEASE_MS);
    const company = await repository.acquireDigestLease({
      companyId: candidate.id || candidate._id,
      now: cutoff,
      leaseUntil,
    });
    if (!company) {
      result.skipped += 1;
      continue;
    }

    try {
      const campaigns = await repository.listCompanyCampaigns(company);
      const recipient =
        company.contactEmail ||
        campaigns.find((item) => item.applicationNotificationEmail)
          ?.applicationNotificationEmail ||
        "";
      const portalAccessToken = company.portalAccessToken || "";
      const companySlug = company.slug || "";
      if (!recipient || !portalAccessToken || !companySlug || campaigns.length === 0) {
        await repository.releaseDigestLease(company.id || company._id);
        result.skipped += 1;
        continue;
      }

      const windowStart = getDigestWindowStart(company, cutoff);
      const summary = await repository.getCompanyDigestSummary({
        company,
        campaigns,
        windowStart,
        windowEnd: cutoff,
      });
      if (!summary || Number(summary.newApplicationCount || 0) <= 0) {
        await repository.releaseDigestLease(company.id || company._id);
        result.skipped += 1;
        continue;
      }

      const portalUrl = `${frontendUrl.replace(/\/$/, "")}/company/${encodeURIComponent(
        companySlug
      )}?access=${encodeURIComponent(portalAccessToken)}`;
      const email = buildCompanyApplicationDigestEmail({
        companyName: company.nameAr || company.name || "الشركة",
        portalUrl,
        summary,
      });
      const emailResult = await sendEmail({ recipient, ...email });
      if (emailResult?.emailStatus !== "sent") {
        await repository.releaseDigestLease(company.id || company._id);
        result.failed += 1;
        continue;
      }

      await repository.completeDigest({
        companyId: company.id || company._id,
        windowEnd: cutoff,
        newApplicationCount: Number(summary.newApplicationCount || 0),
      });
      result.sent += 1;
      logger.info?.("Company digest sent", {
        companyId: String(company.id || company._id || ""),
        campaignCount: summary.campaigns?.length || 0,
        newApplicationCount: Number(summary.newApplicationCount || 0),
        timestamp: cutoff.toISOString(),
      });
    } catch (error) {
      await repository.releaseDigestLease(company.id || company._id).catch(() => null);
      result.failed += 1;
      logger.error?.("Company digest failed", {
        companyId: String(company.id || company._id || ""),
        error: error?.message || "unknown_error",
      });
    }
  }

  return result;
};

module.exports = {
  DIGEST_LEASE_MS,
  INITIAL_DIGEST_LOOKBACK_MS,
  buildCompanyApplicationDigestEmail,
  buildCompanyApplicationDigestSubject,
  getDigestWindowStart,
  getMillisecondsUntilNextRiyadhDigest,
  runCompanyApplicationDigest,
};
