const isValidDate = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time);
};

const getTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const formatArabicUnit = (value, unit) => {
  const units = {
    minute: ["دقيقة", "دقيقتين", "دقائق"],
    hour: ["ساعة", "ساعتين", "ساعات"],
    day: ["يوم", "يومين", "أيام"],
    week: ["أسبوع", "أسبوعين", "أسابيع"],
    month: ["شهر", "شهرين", "أشهر"],
    year: ["سنة", "سنتين", "سنوات"],
  };

  const [single, dual, plural] = units[unit] || units.day;
  if (value === 1) return single;
  if (value === 2) return dual;
  return `${value} ${plural}`;
};

export const formatRelativeArabicTime = (value, now = Date.now()) => {
  if (!isValidDate(value)) return "";

  const diffMs = Math.max(0, now - getTime(value));
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${formatArabicUnit(minutes, "minute")}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${formatArabicUnit(hours, "hour")}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `قبل ${formatArabicUnit(days, "day")}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `قبل ${formatArabicUnit(weeks, "week")}`;

  const months = Math.floor(days / 30);
  if (months < 12) return `قبل ${formatArabicUnit(months, "month")}`;

  const years = Math.floor(days / 365);
  return `قبل ${formatArabicUnit(Math.max(years, 1), "year")}`;
};

export const formatRelativeShortTime = (value, now = Date.now()) => {
  if (!isValidDate(value)) return "";

  const diffMs = Math.max(0, now - getTime(value));
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${Math.max(years, 1)}y ago`;
};

export const hasMeaningfulUpdate = (createdAt, updatedAt) => {
  const created = getTime(createdAt);
  const updated = getTime(updatedAt);
  if (!created || !updated) return false;
  return updated - created > 2 * 60 * 1000;
};
