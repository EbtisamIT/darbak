import React from "react";
import { FiPlus } from "react-icons/fi";
import { ACADEMIC_TRACK_OPTIONS, NO_ACADEMIC_TRACK } from "../../data/academicTracks";

const DEGREES = ["دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];

const ResumeEducationFactsEditor = ({ resume, onChange }) => {
  const personal = resume.personalInfo || {};
  const updatePersonal = (field, value) => onChange({
    ...resume,
    personalInfo: { ...personal, [field]: value },
  });
  const coursework = Array.isArray(personal.relevantCoursework) ? personal.relevantCoursework : [];
  const updateCourse = (index, value) => updatePersonal(
    "relevantCoursework",
    coursework.map((course, courseIndex) => (courseIndex === index ? value : course)),
  );
  const isStudent = ["student", "expected_graduate"].includes(personal.studentStatus);
  const graduationField = isStudent ? "expectedGraduationYear" : "graduationYear";

  return (
    <section id="resume-section-education-facts" className="resume-builder-card resume-education-facts-card">
      <div className="resume-card-title">
        <h3>بيانات التعليم</h3>
        <p>أضف المعلومات المؤكدة فقط. الحقول الاختيارية لن تمنعك من بناء السيرة.</p>
      </div>
      <div className="resume-form-grid">
        <label>
          الدرجة العلمية
          <select value={personal.degree || ""} onChange={(event) => updatePersonal("degree", event.target.value)}>
            <option value="">اختر الدرجة</option>
            {DEGREES.map((degree) => <option key={degree} value={degree}>{degree}</option>)}
            {personal.degree && !DEGREES.includes(personal.degree) ? <option value={personal.degree}>{personal.degree}</option> : null}
          </select>
        </label>
        <label>التخصص<input value={personal.major || ""} onChange={(event) => updatePersonal("major", event.target.value)} placeholder="مثال: علوم الحاسب" /></label>
        <label>الجامعة<input value={personal.university || ""} onChange={(event) => updatePersonal("university", event.target.value)} placeholder="اسم الجامعة" /></label>
        <label>المدينة<input value={personal.city || ""} onChange={(event) => updatePersonal("city", event.target.value)} placeholder="مثال: الرياض" /></label>
        <label>
          الحالة الدراسية
          <select value={personal.studentStatus || ""} onChange={(event) => updatePersonal("studentStatus", event.target.value)}>
            <option value="">اختر الحالة</option>
            <option value="student">طالب/طالبة</option>
            <option value="expected_graduate">متوقع/متوقعة التخرج</option>
            <option value="graduate">خريج/خريجة</option>
          </select>
        </label>
        <label>سنة بداية الدراسة <small>اختياري</small><input value={personal.studyStartYear || ""} onChange={(event) => updatePersonal("studyStartYear", event.target.value)} inputMode="numeric" placeholder="مثال: 2023" /></label>
        <label>
          {isStudent ? "سنة التخرج المتوقعة" : "سنة التخرج"}
          <input value={personal[graduationField] || ""} onChange={(event) => updatePersonal(graduationField, event.target.value)} inputMode="numeric" placeholder="مثال: 2027" />
        </label>
        <label>المعدل <small>اختياري</small><input value={personal.gpa || ""} onChange={(event) => updatePersonal("gpa", event.target.value)} inputMode="decimal" placeholder="مثال: 4.70" /></label>
        <label>
          مقياس المعدل
          <select value={personal.gpaScale || ""} onChange={(event) => updatePersonal("gpaScale", event.target.value)}>
            <option value="">اختر المقياس</option>
            <option value="4">4</option><option value="5">5</option><option value="100">100</option>
          </select>
        </label>
        <label className="resume-grid-wide">
          هل عندك مسار أكاديمي أو تركيز داخل تخصصك؟ <small>اختياري</small>
          <select value={personal.academicTrack || ""} onChange={(event) => updatePersonal("academicTrack", event.target.value)}>
            <option value="">اختر المسار الأكاديمي</option>
            <option value={NO_ACADEMIC_TRACK}>لا يوجد مسار أكاديمي</option>
            {ACADEMIC_TRACK_OPTIONS.map((track) => <option key={track.value} value={track.value}>{track.ar}</option>)}
          </select>
        </label>
      </div>
      <div className="resume-coursework-editor">
        <div className="resume-mini-title">
          <div><strong>مقررات ذات صلة</strong><small>اختياري — لا نضيف مقررات من التخصص تلقائيًا.</small></div>
          <button type="button" onClick={() => updatePersonal("relevantCoursework", [...coursework, ""])}><FiPlus aria-hidden="true" /> إضافة مقرر</button>
        </div>
        {coursework.map((course, index) => (
          <div className="resume-simple-row" key={`course-${index}`}>
            <input aria-label={`المقرر ${index + 1}`} value={course} onChange={(event) => updateCourse(index, event.target.value)} placeholder="مثال: قواعد البيانات" />
            <button type="button" onClick={() => updatePersonal("relevantCoursework", coursework.filter((_, courseIndex) => courseIndex !== index))}>حذف</button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ResumeEducationFactsEditor;
