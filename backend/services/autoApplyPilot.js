const mongoose = require("mongoose");

const MAX_PILOT_USERS = 5;

function pilotUserIds(env = process.env) {
  const values = String(env.AUTO_APPLY_PILOT_USER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const unique = [...new Set(values)];
  if (unique.length > MAX_PILOT_USERS || unique.some((value) => !mongoose.isValidObjectId(value))) {
    throw Object.assign(new Error("AUTO_APPLY_PILOT_ALLOWLIST_INVALID"), { status: 503 });
  }
  return unique;
}

function isPilotUser(userId, env = process.env) {
  const ids = pilotUserIds(env);
  return ids.length > 0 && ids.includes(String(userId || ""));
}

function requirePilotUser(req, res, next) {
  try {
    if (!isPilotUser(req.autoApplyUser?._id, process.env)) return res.sendStatus(404);
    next();
  } catch (error) {
    next(error);
  }
}

function configuredLimit(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 50 ? parsed : fallback;
}

function pilotLimits(env = process.env) {
  return {
    total: configuredLimit(env.AUTO_APPLY_PILOT_TOTAL_SEND_LIMIT, 5),
    daily: configuredLimit(env.AUTO_APPLY_PILOT_DAILY_SEND_LIMIT, 5),
  };
}

function assertRealSendEnabled({ userId, env = process.env }) {
  if (env.AUTO_APPLY_REAL_SEND_ENABLED !== "true") {
    throw Object.assign(new Error("AUTO_APPLY_REAL_SEND_DISABLED"), { status: 404 });
  }
  const ids = pilotUserIds(env);
  if (ids.length !== MAX_PILOT_USERS || !ids.includes(String(userId || ""))) {
    throw Object.assign(new Error("AUTO_APPLY_PILOT_NOT_ALLOWED"), { status: 403 });
  }
  return pilotLimits(env);
}

module.exports = {
  MAX_PILOT_USERS,
  pilotUserIds,
  isPilotUser,
  requirePilotUser,
  pilotLimits,
  assertRealSendEnabled,
};
