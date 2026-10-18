// Keep QA contributions out of every student-facing experience query, even
// after an admin approves them to exercise the reward grant path.
const getPublicExperienceFilter = () => ({
  qaTest: { $ne: true },
  $or: [{ status: "approved" }, { status: { $exists: false } }],
});

module.exports = { getPublicExperienceFilter };
