import {
  getStudentContactEmails,
  getStudentContactLabel,
  getStudentContactNote,
  getStudentContactUrl,
  isStudentContactNameSafe,
} from "./studentContactDisplay";

test("uses only complete structured email and URL values", () => {
  const contact = {
    email: "mustafa.khamees@aramco.com 391 390 389",
    emails: ["careers@example.com", "jobs@example.com 391", "careers@example.com"],
    url: "https://www.aramco.com/en/careers/student-opportunities",
  };
  expect(getStudentContactEmails(contact)).toEqual(["careers@example.com"]);
  expect(getStudentContactUrl(contact)).toBe(contact.url);
  expect(getStudentContactUrl({ url: "javascript:alert(1)" })).toBe("");
  expect(getStudentContactUrl({ url: "https://example.com 391" })).toBe("");
});

test("keeps extraction and reviewer metadata out of student notes", () => {
  expect(getStudentContactNote({
    note: "الإيميلات مستخرجة من ملف وسائل التواصل، صفحة 3.",
    confidence: "متوسطة - مصدر عام",
    reviewerNote: "راجع البريد",
  })).toBe("");
  expect(getStudentContactNote({ studentNote: "قدّم عبر صفحة البرامج." })).toBe("قدّم عبر صفحة البرامج.");
  expect(getStudentContactNote({ studentNote: "مستخرج من صفحة 3" })).toBe("");
});

test("shows channel labels without making generic inboxes sound like verified applications", () => {
  expect(getStudentContactLabel({ email: "info@example.com", contactType: "بريد تواصل/تقديم" })).toBe("بريد التواصل");
  expect(getStudentContactLabel({ email: "training@example.com", contactType: "إيميل تدريب مباشر" })).toBe("بريد التقديم");
  expect(getStudentContactLabel({ url: "https://example.com/coop", contactType: "بوابة برامج الطلبة" })).toBe("بوابة التدريب");
});

test("rejects malformed extracted organization names", () => {
  expect(isStudentContactNameSafe("أرامكو السعودية")).toBe(true);
  expect(isStudentContactNameSafe("SA")).toBe(false);
  expect(isStudentContactNameSafe("389 390 391 mustafa.khamees@ aramco.com")).toBe(false);
});
