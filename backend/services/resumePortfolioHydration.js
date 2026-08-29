const cleanText = (value = "", maxLength = 900) =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const hasValue = (value) =>
  Array.isArray(value)
    ? value.length > 0
    : Boolean(value && value.toString().trim());

const isInvalidResumePersonalValue = (key = "", value = "") => {
  if (key !== "phone") return false;
  const digits = cleanText(value, 40).replace(/[^0-9٠-٩]/g, "");
  // A previous resume flow persisted a numeric zero as a phone value. Treat
  // it as missing, while preserving real phone numbers as strings.
  return digits.length < 8;
};

const uniqueText = (current = [], fallback = []) => {
  const seen = new Set();
  return [...(Array.isArray(current) ? current : []), ...(Array.isArray(fallback) ? fallback : [])]
    .filter(Boolean)
    .filter((item) => {
      const key = cleanText(item, 160).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const entryFingerprint = (entry = {}) =>
  [entry.title, entry.organization || entry.subtitle, entry.period, entry.url]
    .map((value) => cleanText(value, 180).toLowerCase())
    .join("|");

const mergeEntries = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const existing = new Set(merged.map(entryFingerprint));

  (Array.isArray(fallback) ? fallback : []).forEach((entry) => {
    const fingerprint = entryFingerprint(entry);
    if (fingerprint && !existing.has(fingerprint)) {
      existing.add(fingerprint);
      merged.push(entry);
    }
  });

  return merged;
};

const mergeLanguages = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const names = new Set(merged.map((language) => cleanText(language?.name, 80).toLowerCase()));
  (Array.isArray(fallback) ? fallback : []).forEach((language) => {
    const name = cleanText(language?.name, 80).toLowerCase();
    if (name && !names.has(name)) {
      names.add(name);
      merged.push(language);
    }
  });
  return merged;
};

const mergeLinks = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const urls = new Set(merged.map((link) => cleanText(link?.url, 260).toLowerCase()));
  (Array.isArray(fallback) ? fallback : []).forEach((link) => {
    const url = cleanText(link?.url, 260).toLowerCase();
    if (url && !urls.has(url)) {
      urls.add(url);
      merged.push(link);
    }
  });
  return merged;
};

const buildPortfolioHeadline = (portfolio = {}) => {
  const major = cleanText(portfolio.major, 120);
  const statusLabels = {
    student: "طالب/ة",
    graduate: "خريج/ة",
    expected_graduate: "متوقع/ة التخرج",
  };
  const stage = cleanText(portfolio.degreeLevel, 120);
  if (!major) return "";
  if (portfolio.professionalHeadline?.trim()) return cleanText(portfolio.professionalHeadline, 140);
  if (statusLabels[portfolio.studentStatus]) return `${statusLabels[portfolio.studentStatus]} ${major}`;
  const confirmedStage = stage.match(/(?:طالبة|طالب|خريجة|خريج)/)?.[0];
  return confirmedStage ? `${confirmedStage} ${major}` : `متخصص/ة في ${major}`;
};

const mapPortfolioEntry = (entry = {}, prefix = "portfolio-entry", index = 0) => {
  const title = cleanText(entry.title || entry.name, 140);
  const organization = cleanText(entry.organization || entry.issuer || entry.provider, 180);
  const description = cleanText(entry.description || entry.details, 900);
  return {
    id: entry._id?.toString?.() || `${prefix}-${index}-${title || organization || "item"}`,
    title,
    subtitle: organization,
    organization,
    period: cleanText(entry.period || entry.year, 90),
    startDate: cleanText(entry.startDate, 40),
    endDate: cleanText(entry.endDate || entry.year, 40),
    isCurrent: Boolean(entry.isCurrent),
    location: cleanText(entry.location, 90),
    url: cleanText(entry.url || entry.link, 260),
    description,
    details: description,
    achievements: description
      ? [{ id: `${prefix}-${index}-detail`, text: description, html: `<p>${escapeHtml(description)}</p>` }]
      : [],
  };
};

const mapPortfolioToResumePayload = (portfolio = {}, contact = "", options = {}) => {
  const frontendUrl = options.frontendUrl || "";
  const sectionOrder = options.sectionOrder || [];
  const portfolioUrl = portfolio.slug && frontendUrl ? `${frontendUrl}/p/${portfolio.slug}` : "";
  const educationDescription = [
    portfolio.major,
    portfolio.graduationYear && `سنة التخرج: ${portfolio.graduationYear}`,
    portfolio.gpa && `المعدل: ${portfolio.gpa}${portfolio.gpaScale ? ` / ${portfolio.gpaScale}` : ""}`,
  ].filter(Boolean).join(" · ");

  return {
    personalInfo: {
      fullName: cleanText(portfolio.fullName, 120),
      email: cleanText(portfolio.email || contact, 160),
      phone: cleanText(portfolio.phone, 40),
      city: cleanText(portfolio.city, 80),
      major: cleanText(portfolio.major, 120),
      university: cleanText(portfolio.university, 160),
      degree: cleanText(portfolio.degreeLevel, 80),
      studentStatus: cleanText(portfolio.studentStatus, 40),
      graduationYear: cleanText(portfolio.graduationYear, 20),
      gpa: cleanText(portfolio.gpa, 20),
      gpaScale: cleanText(portfolio.gpaScale, 20),
      linkedinUrl: cleanText(portfolio.linkedinUrl, 260),
      headline: buildPortfolioHeadline(portfolio),
      portfolioUrl,
      githubUrl: cleanText(portfolio.githubUrl, 260),
      personalUrl: cleanText(portfolio.personalWebsite, 260),
      trainingStart: cleanText(portfolio.trainingStart, 40),
      trainingEnd: cleanText(portfolio.trainingEnd, 40),
      trainingField: cleanText(portfolio.targetTrainingField, 160),
    },
    summary: cleanText(portfolio.bio, 900),
    education: portfolio.university
      ? [{
          id: "portfolio-education",
          title: cleanText(portfolio.degreeLevel || portfolio.major, 140),
          subtitle: cleanText(portfolio.university, 180),
          organization: cleanText(portfolio.university, 180),
          period: "",
          startDate: "",
          endDate: "",
          isCurrent: true,
          location: cleanText(portfolio.city, 90),
          url: "",
          description: educationDescription,
          details: cleanText(portfolio.major, 900),
          achievements: [],
        }]
      : [],
    experiences: (portfolio.experiences || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-experience", index)),
    experience: (portfolio.experiences || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-experience", index)),
    projects: (portfolio.projects || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-project", index)),
    certifications: (portfolio.certifications || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-certification", index)),
    volunteering: (portfolio.volunteering || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-volunteering", index)),
    languages: (portfolio.languages || []).map((language, index) => ({
      id: language._id?.toString?.() || `portfolio-language-${index}`,
      name: cleanText(language.name, 70),
      level: cleanText(language.level, 70),
    })).filter((language) => language.name || language.level),
    links: [
      portfolio.linkedinUrl ? { id: "linkedin", label: "LinkedIn", url: cleanText(portfolio.linkedinUrl, 260) } : null,
      portfolio.githubUrl ? { id: "github", label: "GitHub", url: cleanText(portfolio.githubUrl, 260) } : null,
      portfolio.personalWebsite ? { id: "website", label: "الموقع الشخصي", url: cleanText(portfolio.personalWebsite, 260) } : null,
      portfolioUrl ? { id: "portfolio", label: "ملفي المهني", url: portfolioUrl } : null,
    ].filter(Boolean),
    skills: (Array.isArray(portfolio.skills) ? portfolio.skills : []).map((skill) => cleanText(skill, 60)).filter(Boolean),
    sectionOrder,
    hiddenSections: [],
    settings: { language: "ar", direction: "rtl", density: "comfortable", fontSize: "medium", template: "clean", accentColor: "#42cfc3" },
  };
};

const hydrateResumeFromPortfolio = (resume = null, portfolioResume = {}) => {
  if (!resume) return { resume: portfolioResume, patch: portfolioResume, changed: true };

  const currentPersonal = resume.personalInfo || {};
  const personalInfo = { ...currentPersonal };
  Object.entries(portfolioResume.personalInfo || {}).forEach(([key, value]) => {
    if (
      (!hasValue(personalInfo[key]) || isInvalidResumePersonalValue(key, personalInfo[key])) &&
      hasValue(value)
    ) {
      personalInfo[key] = value;
    }
  });

  const currentExperience = Array.isArray(resume.experiences) && resume.experiences.length
    ? resume.experiences
    : resume.experience || [];
  const portfolioExperience = Array.isArray(portfolioResume.experiences) && portfolioResume.experiences.length
    ? portfolioResume.experiences
    : portfolioResume.experience || [];
  const hydrated = {
    ...resume,
    personalInfo,
    summary: hasValue(resume.summary) ? resume.summary : portfolioResume.summary || "",
    education: mergeEntries(resume.education, portfolioResume.education),
    experiences: mergeEntries(currentExperience, portfolioExperience),
    experience: mergeEntries(currentExperience, portfolioExperience),
    projects: mergeEntries(resume.projects, portfolioResume.projects),
    certifications: mergeEntries(resume.certifications, portfolioResume.certifications),
    volunteering: mergeEntries(resume.volunteering, portfolioResume.volunteering),
    languages: mergeLanguages(resume.languages, portfolioResume.languages),
    links: mergeLinks(resume.links, portfolioResume.links),
    skills: uniqueText(resume.skills, portfolioResume.skills),
  };
  const patch = {};
  ["personalInfo", "summary", "education", "experiences", "experience", "projects", "certifications", "volunteering", "languages", "links", "skills"].forEach((key) => {
    if (JSON.stringify(hydrated[key]) !== JSON.stringify(resume[key])) patch[key] = hydrated[key];
  });
  return { resume: hydrated, patch, changed: Object.keys(patch).length > 0 };
};

module.exports = { mapPortfolioToResumePayload, hydrateResumeFromPortfolio };
