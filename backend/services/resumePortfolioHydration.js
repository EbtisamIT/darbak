const cleanText = (value = "", maxLength = 900) =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const { normalizeResumeSkills } = require("./resumeSkillNormalization");

// These values are student facts, not resume presentation. Portfolio owns them
// whenever it has a verified value; ResumeProfile only keeps a materialized
// copy for compatibility with the existing resume APIs.
const PROTECTED_PERSONAL_FACT_KEYS = [
  "fullName",
  "email",
  "phone",
  "city",
  "major",
  "university",
  "degree",
  "studentStatus",
  "grammaticalGender",
  "studyStartYear",
  "graduationYear",
  "expectedGraduationYear",
  "gpa",
  "gpaScale",
  "academicTrack",
  "relevantCoursework",
  "linkedinUrl",
  "githubUrl",
  "personalUrl",
  "portfolioUrl",
];

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

const hydrateEducationEntries = (current = [], fallback = []) => {
  const merged = mergeEntries(current, fallback);
  const portfolioEducation = (Array.isArray(fallback) ? fallback : [])[0];
  if (!portfolioEducation) return merged;

  return merged.map((entry) => {
    const sameEducation =
      cleanText(entry.title, 140) === cleanText(portfolioEducation.title, 140) &&
      cleanText(entry.organization || entry.subtitle, 180) ===
        cleanText(portfolioEducation.organization || portfolioEducation.subtitle, 180);
    const missingYear = !hasValue(entry.period) && !hasValue(entry.endDate);
    if (!sameEducation || !missingYear || !hasValue(portfolioEducation.endDate)) return entry;

    return {
      ...entry,
      period: portfolioEducation.period,
      endDate: portfolioEducation.endDate,
      isCurrent: false,
    };
  });
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
    student: { feminine: "طالبة", masculine: "طالب", neutral: "طالب/ة" },
    graduate: { feminine: "خريجة", masculine: "خريج", neutral: "خريج/ة" },
    expected_graduate: { feminine: "متوقعة التخرج", masculine: "متوقع التخرج", neutral: "متوقع/ة التخرج" },
  };
  const stage = cleanText(portfolio.degreeLevel, 120);
  if (!major) return "";
  if (statusLabels[portfolio.studentStatus]) {
    return `${statusLabels[portfolio.studentStatus][portfolio.grammaticalGender] || statusLabels[portfolio.studentStatus].neutral} ${major}`;
  }
  const confirmedStage = stage.match(/(?:طالبة|طالب|خريجة|خريج)/)?.[0];
  return confirmedStage ? `${confirmedStage} ${major}` : `متخصص/ة في ${major}`;
};

const mapPortfolioEntry = (entry = {}, prefix = "portfolio-entry", index = 0) => {
  const title = cleanText(entry.title || entry.name, 140);
  const organization = cleanText(entry.organization || entry.issuer || entry.provider, 180);
  const description = cleanText(entry.description || entry.details, 900);
  return {
    id: entry.id || entry._id?.toString?.() || `${prefix}-${index}-${title || organization || "item"}`,
    title,
    subtitle: organization,
    organization,
    period: cleanText(entry.period || entry.year, 90),
    startDate: cleanText(entry.startDate, 40),
    endDate: cleanText(entry.endDate || entry.year, 40),
    isCurrent: Boolean(entry.isCurrent),
    location: cleanText(entry.location, 90),
    url: cleanText(entry.url || entry.credentialUrl || entry.link, 260),
    technologies: Array.isArray(entry.technologies)
      ? entry.technologies.map((technology) => cleanText(technology, 80)).filter(Boolean)
      : [],
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
    portfolio.academicTrack && `المسار الأكاديمي: ${portfolio.academicTrack}`,
    portfolio.graduationYear && `سنة التخرج: ${portfolio.graduationYear}`,
    portfolio.expectedGraduationYear && `التخرج المتوقع: ${portfolio.expectedGraduationYear}`,
    portfolio.gpa && `المعدل: ${portfolio.gpa}${portfolio.gpaScale ? ` / ${portfolio.gpaScale}` : ""}`,
    ...(Array.isArray(portfolio.relevantCoursework) && portfolio.relevantCoursework.length
      ? [`مقررات ذات صلة: ${portfolio.relevantCoursework.join("، ")}`]
      : []),
  ].filter(Boolean).join(" · ");
  const hasPracticalExperience = Array.isArray(portfolio.experiences) && portfolio.experiences.some((entry) =>
    Boolean(cleanText(entry?.title || entry?.description || entry?.organization, 160))
  );
  const candidateIsStudent = ["student", "expected_graduate"].includes(portfolio.studentStatus);
  const defaultSectionOrder = candidateIsStudent && !hasPracticalExperience
    ? ["summary", "education", "projects", "skills", "experience", "certifications", "volunteering", "languages", "links"]
    : ["summary", "experience", "education", "projects", "skills", "certifications", "volunteering", "languages", "links"];

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
      grammaticalGender: cleanText(portfolio.grammaticalGender, 20),
      studyStartYear: cleanText(portfolio.studyStartYear, 20),
      graduationYear: cleanText(portfolio.graduationYear, 20),
      expectedGraduationYear: cleanText(portfolio.expectedGraduationYear, 20),
      gpa: cleanText(portfolio.gpa, 20),
      gpaScale: cleanText(portfolio.gpaScale, 20),
      academicTrack: cleanText(portfolio.academicTrack, 120),
      relevantCoursework: uniqueText([], portfolio.relevantCoursework).map((course) => cleanText(course, 120)),
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
          period: cleanText(portfolio.graduationYear || portfolio.expectedGraduationYear, 20),
          startDate: cleanText(portfolio.studyStartYear, 20),
          endDate: cleanText(portfolio.graduationYear || portfolio.expectedGraduationYear, 20),
          isCurrent:
            !portfolio.graduationYear &&
            ["student", "expected_graduate"].includes(portfolio.studentStatus),
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
    skills: normalizeResumeSkills((Array.isArray(portfolio.skills) ? portfolio.skills : []).map((skill) => cleanText(skill, 60))),
    sectionOrder: sectionOrder.length ? sectionOrder : defaultSectionOrder,
    hiddenSections: [],
    settings: { language: "ar", direction: "rtl", density: "comfortable", fontSize: "medium", template: "clean", accentColor: "#42cfc3" },
  };
};

const buildVerifiedResumeFacts = (portfolio = {}, contact = "", options = {}) => {
  const payload = mapPortfolioToResumePayload(portfolio, contact, options);
  return {
    personalInfo: payload.personalInfo,
    education: payload.education,
    experiences: payload.experiences,
    projects: payload.projects,
    certifications: payload.certifications,
    volunteering: payload.volunteering,
    languages: payload.languages,
    links: payload.links,
    skills: payload.skills,
    professionalContext: cleanText(portfolio.bio, 900),
  };
};

const orderVerifiedEntries = (verifiedEntries = [], presentationEntries = []) => {
  const order = new Map(
    (Array.isArray(presentationEntries) ? presentationEntries : [])
      .map((entry, index) => [entry?.id, index])
      .filter(([id]) => Boolean(id))
  );
  return [...verifiedEntries].sort(
    (left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
};

const composeCanonicalResume = (resume = {}, portfolio = {}, contact = "", options = {}) => {
  const verifiedResumeFacts = buildVerifiedResumeFacts(portfolio, contact, options);
  // Existing users without a Portfolio keep their existing resume intact. Once
  // the Portfolio has a fact, that verified fact wins over stale resume copies.
  const hasVerifiedPortfolio = Boolean(portfolio?._id);
  if (!hasVerifiedPortfolio) return { ...resume, verifiedResumeFacts: null };

  const language = options.language || resume.settings?.language || "ar";
  const personalInfo = { ...(resume.personalInfo || {}) };
  PROTECTED_PERSONAL_FACT_KEYS.forEach((key) => {
    const value = verifiedResumeFacts.personalInfo?.[key];
    if (hasValue(value)) personalInfo[key] = value;
  });
  // The headline is always derived from verified facts. English display is
  // localized on the client from these same facts.
  personalInfo.headline = buildPortfolioHeadline(portfolio);

  const composeEntries = (section) => {
    const verified = verifiedResumeFacts[section] || [];
    if (!verified.length) return resume[section] || [];
    const presentation = Array.isArray(resume[section]) ? resume[section] : [];
    const byId = new Map(presentation.map((entry) => [entry?.id, entry]));
    return orderVerifiedEntries(verified, presentation).map((factEntry) => {
      const display = byId.get(factEntry.id) || {};
      // Translation/tailoring may own wording and bullets, but never the
      // identity of the entry. For Arabic master resumes retain the verified
      // Portfolio description so an AI omission cannot erase it.
      const translatedDescription = language === "en"
        ? (display.description || display.details || factEntry.description)
        : factEntry.description;
      return {
        ...factEntry,
        description: translatedDescription,
        details: translatedDescription,
        achievements: Array.isArray(display.achievements) && display.achievements.length
          ? display.achievements
          : factEntry.achievements,
      };
    });
  };

  const experiences = composeEntries("experiences");
  return {
    ...resume,
    personalInfo,
    education: composeEntries("education"),
    experiences,
    experience: experiences,
    projects: composeEntries("projects"),
    certifications: composeEntries("certifications"),
    volunteering: composeEntries("volunteering"),
    languages: verifiedResumeFacts.languages?.length ? verifiedResumeFacts.languages : resume.languages || [],
    links: verifiedResumeFacts.links?.length ? verifiedResumeFacts.links : resume.links || [],
    skills: verifiedResumeFacts.skills?.length ? verifiedResumeFacts.skills : resume.skills || [],
    verifiedResumeFacts,
  };
};

const hydrateResumeFromPortfolio = (resume = null, portfolioResume = {}) => {
  if (!resume) return { resume: portfolioResume, patch: portfolioResume, changed: true };

  const currentPersonal = resume.personalInfo || {};
  const personalInfo = { ...currentPersonal };
  // A profile created from Portfolio has one authoritative source for core
  // identity facts. This repairs stale or cross-account values saved by an old
  // resume draft without touching scratch/manual resume profiles.
  const portfolioOwnsIdentity = resume.workflow?.source === "portfolio";
  Object.entries(portfolioResume.personalInfo || {}).forEach(([key, value]) => {
    if (
      (portfolioOwnsIdentity || !hasValue(personalInfo[key]) || isInvalidResumePersonalValue(key, personalInfo[key])) &&
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
    education: portfolioOwnsIdentity && Array.isArray(portfolioResume.education) && portfolioResume.education.length
      ? portfolioResume.education
      : hydrateEducationEntries(resume.education, portfolioResume.education),
    experiences: mergeEntries(currentExperience, portfolioExperience),
    experience: mergeEntries(currentExperience, portfolioExperience),
    projects: mergeEntries(resume.projects, portfolioResume.projects),
    certifications: mergeEntries(resume.certifications, portfolioResume.certifications),
    volunteering: mergeEntries(resume.volunteering, portfolioResume.volunteering),
    languages: mergeLanguages(resume.languages, portfolioResume.languages),
    links: mergeLinks(resume.links, portfolioResume.links),
    skills: normalizeResumeSkills(uniqueText(resume.skills, portfolioResume.skills)),
  };
  const patch = {};
  ["personalInfo", "summary", "education", "experiences", "experience", "projects", "certifications", "volunteering", "languages", "links", "skills"].forEach((key) => {
    if (JSON.stringify(hydrated[key]) !== JSON.stringify(resume[key])) patch[key] = hydrated[key];
  });
  return { resume: hydrated, patch, changed: Object.keys(patch).length > 0 };
};

module.exports = {
  PROTECTED_PERSONAL_FACT_KEYS,
  mapPortfolioToResumePayload,
  buildVerifiedResumeFacts,
  composeCanonicalResume,
  hydrateResumeFromPortfolio,
};
