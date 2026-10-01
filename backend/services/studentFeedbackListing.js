// At least two letters, not just the same letter repeated. This is a text
// presence filter, not sentiment analysis: short criticism stays visible.
const WRITTEN_FEEDBACK_PATTERN = "^(?=(?:[^\\p{L}]*\\p{L}){2})(?![^\\p{L}]*(\\p{L})(?:[^\\p{L}]*\\1)*[^\\p{L}]*$)";

const writtenFeedbackFilter = () => ({
  $expr: {
    $regexMatch: {
      input: {
        $cond: [
          { $ne: [{ $trim: { input: { $ifNull: ["$originalFeedbackText", ""] } } }, ""] },
          "$originalFeedbackText",
          { $ifNull: ["$feedbackText", ""] },
        ],
      },
      regex: WRITTEN_FEEDBACK_PATTERN,
      options: "i",
    },
  },
});

const getFeedbackListOptions = (query = {}) => {
  const tab = ["written", "all", "publishable", "published"].includes(query.tab) ? query.tab : "written";
  const page = Number(query.page);
  const limit = Number(query.limit);
  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    limit: Number.isSafeInteger(limit) ? Math.min(Math.max(limit, 10), 100) : 30,
    filter: tab === "all" ? {}
      : tab === "published" ? { publicConsent: true, published: true }
        : { ...writtenFeedbackFilter(), ...(tab === "publishable" ? { publicConsent: true, published: false } : {}) },
  };
};

async function listStudentFeedback(Model, query) {
  const { page: requestedPage, limit, filter } = getFeedbackListOptions(query);
  const total = await Model.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const rows = await Model.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  return { rows, pagination: { page, limit, total, totalPages } };
}

module.exports = { WRITTEN_FEEDBACK_PATTERN, writtenFeedbackFilter, getFeedbackListOptions, listStudentFeedback };
