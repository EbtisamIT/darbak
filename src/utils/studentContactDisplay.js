const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;

export const getStudentContactEmails = (contact = {}) =>
  Array.from(new Set([contact?.email, ...(Array.isArray(contact?.emails) ? contact.emails : [])]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => emailPattern.test(value))));

export const getStudentContactUrl = (contact = {}) => {
  for (const value of [contact?.applicationUrl, contact?.url]) {
    if (typeof value !== "string" || /\s/.test(value)) continue;
    try {
      const parsed = new URL(value);
      if (["http:", "https:"].includes(parsed.protocol) && !parsed.username &&
        !parsed.password && parsed.hostname.includes(".")) return parsed.href;
    } catch {
      // Try the next structured URL field.
    }
  }
  return "";
};

export const isStudentContactNameSafe = (name) =>
  typeof name === "string" && name.trim().length >= 4 &&
  !/@|https?:\/\/|(?:^|\s)\d+(?:\s+\d+){1,}(?:\s|$)/i.test(name);

export const getStudentContactLabel = (contact = {}, channel = "") => {
  const type = String(contact?.contactType || "");
  if (channel === "url" || (!channel && getStudentContactUrl(contact))) {
    return /تدريب|برامج الطلبة|COOP/i.test(type) ? "بوابة التدريب" : "رابط التقديم";
  }
  return /تدريب مباشر|بريد التقديم|إيميل التقديم/i.test(type)
    ? "بريد التقديم"
    : "بريد التواصل";
};

// Raw note, usage, confidence, source and review fields are never student copy.
export const getStudentContactNote = (contact = {}) =>
  typeof contact?.studentNote === "string" &&
    !/(مستخرج|مصدر|صفحة\s*\d|مراجعة|موثوقية|تحقق|تحذير|extraction|review|confidence)/i.test(contact.studentNote)
    ? contact.studentNote.trim()
    : "";
