import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import API_BASE_URL from "../config/api";
import ResumePdfDocument from "../features/resume/ResumePdfDocument";
import { normalizeResume } from "../features/resume/resumeDefaults";
import { cityOptions, specializationOptions } from "../data/trainingOptions";
import { ACCOUNT_MODAL_EVENT, getStoredAccessIdentity } from "../utils/premiumAccess";
import "./AutoApplyPage.css";

const blank = { educationLevel: "", major: "", customMajor: "", preferredFields: [], customField: "",
  preferredCities: [], allowRemote: false, trainingTypes: [], trainingStartDate: "", trainingDuration: "",
  excludedCompanyIds: [], resumeSource: "", resumeSnapshotId: "", mode: "review_first", paused: false };
const statusText = { ready_for_review: "جاهز للتقديم", approved: "اعتمدتِ المسودة", sent: "تم التقديم",
  needs_action: "تحتاج خطوة منك", skipped: "تم تخطيها", failed: "تعذر تجهيزها" };
const educationOptions = [["diploma", "دبلوم"], ["bachelor", "بكالوريوس"], ["master", "ماجستير"], ["other", "مؤهل آخر"]];
const trainingOptions = [["coop", "تدريب تعاوني"], ["internship", "تدريب عملي"], ["summer", "تدريب صيفي"], ["other", "نوع آخر"]];
const headersFor = (identity) => ({ "x-darbak-contact": identity.contact || identity.email || "", "x-darbak-access-code": identity.accessCode || "" });
const disconnectedEmail = { provider: "gmail", connectionStatus: "not_connected", emailAddress: "" };
const disabledTestMode = { enabled: false, recipient: "" };

function ChoiceChips({ label, choices, selected, onChange }) {
  return <fieldset className="auto-apply-choices"><legend>{label}</legend><div>
    {choices.map(([value, text]) => <label key={value} className={selected.includes(value) ? "selected" : ""}>
      <input type="checkbox" checked={selected.includes(value)} onChange={() => onChange(selected.includes(value)
        ? selected.filter((item) => item !== value) : [...selected, value])} />{text}
    </label>)}
  </div></fieldset>;
}

function EmailConnection({ emailIdentity, localConnectionEnabled, busy, onConnect, onDisconnect }) {
  const connected = emailIdentity.connectionStatus === "connected";
  return <div className="auto-apply-email-connection">
    {connected ? <div className="auto-apply-email-connected"><div><strong>Gmail متصل ✓</strong>
      <span dir="ltr">{emailIdentity.emailAddress}</span></div>
      <button type="button" className="secondary" disabled={busy} onClick={onDisconnect}>فصل الاتصال</button></div>
      : <div className="auto-apply-connection-list">
        {localConnectionEnabled ? <button type="button" className="secondary" disabled={busy} onClick={onConnect}>ربط Gmail</button>
          : <span>Gmail · قريبًا</span>}
        <span>Outlook · قريبًا</span>
      </div>}
    {(connected || localConnectionEnabled) && <p className="auto-apply-email-scope">دربك يستخدم صلاحية الإرسال فقط. لا نقرأ صندوق بريدك.</p>}
  </div>;
}

export default function AutoApplyPage() {
  const [, setIdentityRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setIdentityRevision((value) => value + 1);
    window.addEventListener("darbak:access-identity-changed", refresh);
    window.addEventListener("darbak:premium-status-changed", refresh);
    return () => {
      window.removeEventListener("darbak:access-identity-changed", refresh);
      window.removeEventListener("darbak:premium-status-changed", refresh);
    };
  }, []);
  const { contact, email, accessCode } = getStoredAccessIdentity();
  const headers = useMemo(() => headersFor({ contact, email, accessCode }), [contact, email, accessCode]);
  const [profile, setProfile] = useState(blank);
  const [matches, setMatches] = useState([]);
  const [packages, setPackages] = useState([]);
  const [fieldOptions, setFieldOptions] = useState({});
  const [rewardResumeAvailable, setRewardResumeAvailable] = useState(false);
  const [emailIdentity, setEmailIdentity] = useState(disconnectedEmail);
  const [testMode, setTestMode] = useState(disabledTestMode);
  const [testSendResult, setTestSendResult] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [editor, setEditor] = useState({ subject: "", body: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const authenticated = Boolean(headers["x-darbak-contact"] && headers["x-darbak-access-code"]);

  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    try {
      const [state, preview, resume] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/auto-apply/me`, { headers }),
        axios.get(`${API_BASE_URL}/api/auto-apply/matches`, { headers }),
        axios.get(`${API_BASE_URL}/api/auto-apply/existing-resume`, { headers }),
      ]);
      setProfile({ ...blank, ...(state.data.profile || {}), resumeSnapshotId: state.data.profile?.resumeSnapshotId || "",
        trainingStartDate: state.data.profile?.trainingStartDate?.slice(0, 10) || "" });
      setPackages(state.data.packages || []);
      setFieldOptions(state.data.fields || {});
      setMatches(preview.data.matches || []);
      setRewardResumeAvailable(resume.data.rewardResumeAvailable);
      setEmailIdentity(state.data.emailIdentity || disconnectedEmail);
      setTestMode(state.data.testMode || disabledTestMode);
    } catch { setMessage("تعذر تحميل التقديم التلقائي حاليًا."); }
    finally { setLoading(false); }
  }, [authenticated, headers]);
  useEffect(() => {
    // Google sends the student back with a one-time link code in the fragment.
    // Claiming it with this browser's own Darbak login is what connects Gmail.
    const linkCode = new URLSearchParams(window.location.hash.slice(1)).get("gmail_link");
    if (!linkCode) { load(); return; }
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!authenticated) {
      setMessage("سجّل الدخول إلى دربك ثم اربط Gmail من جديد.");
      setLoading(false);
      return;
    }
    axios.post(`${API_BASE_URL}/api/auto-apply/email/gmail/complete`, { linkCode }, { headers })
      .then(() => setMessage("تم ربط Gmail بحسابك."))
      .catch((error) => setMessage(error.response?.data?.error || "تعذر إكمال ربط Gmail. حاول مرة أخرى."))
      .finally(() => load());
  }, [load, authenticated, headers]);
  const update = (fields) => setProfile((current) => ({ ...current, ...fields }));
  const run = async (action, success) => {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await load(); }
    catch (error) { setMessage(error.response?.data?.error || "تعذر إكمال الإجراء حاليًا."); }
    finally { setBusy(false); }
  };
  const uploadBytes = async (bytes, source) => {
    const { data } = await axios.post(`${API_BASE_URL}/api/auto-apply/resume/upload`, bytes,
      { headers: { ...headers, "Content-Type": "application/pdf", "x-auto-apply-resume-source": source } });
    update(data);
    return data;
  };
  const usePaidResume = () => run(async () => {
    const { data } = await axios.get(`${API_BASE_URL}/api/resume/me`, { headers });
    if (!data.exists || !data.masterResumeExists) throw new Error("لا توجد سيرة دربك نهائية لهذا الحساب.");
    const bytes = await (await pdf(<ResumePdfDocument resume={normalizeResume(data.resume)} />).toBlob()).arrayBuffer();
    await uploadBytes(bytes, "darbak_resume");
  }, "حفظنا نسخة ثابتة من سيرتك الحالية. يمكنك استبدالها لاحقًا للتقديمات الجديدة.");
  const uploadFile = (file) => run(async () => {
    if (!file || file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) throw new Error("اختاري PDF بحجم لا يتجاوز 5MB.");
    await uploadBytes(await file.arrayBuffer(), "uploaded");
  }, "حفظنا سيرتك الأساسية للتقديمات الجديدة.");
  const saveProfile = () => run(async () => {
    await axios.put(`${API_BASE_URL}/api/auto-apply/profile`, profile, { headers });
  }, "حُفظت اختياراتك. لا يُرسل دربك أي طلب في الوضع التجريبي.");
  const createPackages = () => run(async () => {
    await axios.post(`${API_BASE_URL}/api/auto-apply/packages/sync`, {}, { headers });
  }, "جُهزت طلبات المراجعة تجريبيًا دون إرسال.");
  const act = (item, action, extra = {}) => run(async () => {
    await axios.patch(`${API_BASE_URL}/api/auto-apply/packages/${item._id}`, { action, ...extra }, { headers });
    setSelectedPackage(null);
  }, action === "approve" ? "وافقتِ على المسودة التجريبية. لم يُرسل أي بريد." : "حُفظ اختيارك.");
  const downloadResume = () => run(async () => {
    const { data } = await axios.get(`${API_BASE_URL}/api/auto-apply/resume/${profile.resumeSnapshotId}/pdf`, { headers, responseType: "blob" });
    const url = URL.createObjectURL(data), anchor = document.createElement("a");
    anchor.href = url; anchor.download = "auto-apply-resume.pdf"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "تم تنزيل نسخة السيرة المحفوظة.");
  const localConnectionEnabled = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const connectGmail = () => run(async () => {
    const { data } = await axios.get(`${API_BASE_URL}/api/auto-apply/email/gmail/connect`, { headers });
    const authorization = new URL(data.authorizationUrl);
    if (authorization.protocol !== "https:" || authorization.hostname !== "accounts.google.com") throw new Error("تعذر بدء ربط Gmail بأمان.");
    window.location.assign(authorization.toString());
  }, "");
  const disconnectGmail = () => run(async () => {
    const { data } = await axios.delete(`${API_BASE_URL}/api/auto-apply/email/gmail`, { headers });
    setEmailIdentity(data || disconnectedEmail);
  }, "تم فصل Gmail عن ملف التقديم.");
  const sendPackageTest = async () => {
    setBusy(true); setMessage(""); setTestSendResult(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auto-apply/packages/${selectedPackage._id}/test-send`,
        editor, { headers });
      setTestSendResult(data);
      setMessage("تم إرسال النسخة التجريبية بنجاح. لم يتم التواصل مع الجهة.");
      await load();
    } catch (error) {
      setMessage(error.response?.data?.error || "تعذر إرسال النسخة التجريبية حاليًا.");
    } finally { setBusy(false); }
  };

  if (!authenticated) return <main className="auto-apply-page" dir="rtl"><section className="auto-apply-panel">
    <h1>التقديم التلقائي بدربك</h1><p>سجّل دخولك أولًا لحفظ اختياراتك ومراجعة طلباتك التجريبية.</p>
    <button onClick={() => window.dispatchEvent(new Event(ACCOUNT_MODAL_EVENT))}>تسجيل الدخول</button>
  </section></main>;
  if (loading) return <main className="auto-apply-page" dir="rtl"><p>جارِ التحميل…</p></main>;
  const possibleFields = [...new Set([...(fieldOptions[profile.major] || []), ...(fieldOptions[profile.customMajor] || []), "أخرى"])];
  const packageCount = (status) => packages.filter((item) => item.status === status).length;
  return <main className="auto-apply-page" dir="rtl">
    <section className="auto-apply-hero"><span className="auto-apply-eyebrow">تجربة محلية · بدون إرسال</span>
      <h1>خلّ طلبات التدريب جاهزة للمراجعة</h1>
      <p>اختاري مجالاتك ومدنك وسيرة أساسية واحدة. يطابق دربك الجهات الموثقة ويجهز لكل جهة رسالة خاصة، ثم تراجعينها قبل أي خطوة لاحقة.</p>
      <strong>الوضع التجريبي: لا تُرسل رسائل ولا تُنشأ تقديمات فعلية.</strong>
    </section>
    {message && <p className="auto-apply-notice" role="status">{message}</p>}
    <div className="auto-apply-layout"><section className="auto-apply-panel" aria-label="إعداد ملف التقديم">
      <h2>١ · اختياراتك</h2><p>مجالات التدريب التي تختارينها هي أساس المطابقة، ولا نستنتج اهتمامات واسعة من التخصص وحده.</p>
      <div className="auto-apply-form-grid"><label>المؤهل<select value={profile.educationLevel} onChange={(event) => update({ educationLevel: event.target.value })}>
        <option value="">اختاري المؤهل</option>{educationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label><label>التخصص<select value={profile.major} onChange={(event) => update({ major: event.target.value, preferredFields: [] })}>
        <option value="">اختاري تخصصك</option>{specializationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select></label><label>تخصص آخر<input value={profile.customMajor} onChange={(event) => update({ customMajor: event.target.value })} placeholder="إذا لم تجدي تخصصك" /></label></div>
      <ChoiceChips label="مجالات التدريب التي تهمك" choices={possibleFields.map((item) => [item, item])}
        selected={profile.preferredFields} onChange={(preferredFields) => update({ preferredFields })} />
      {profile.preferredFields.includes("أخرى") && <label>اكتبي المجال<input value={profile.customField || ""} onChange={(event) => update({ customField: event.target.value })} /></label>}
      <ChoiceChips label="المدن المفضلة" choices={cityOptions.map((city) => [city, city])}
        selected={profile.preferredCities} onChange={(preferredCities) => update({ preferredCities })} />
      <label className="auto-apply-check"><input type="checkbox" checked={profile.allowRemote} onChange={(event) => update({ allowRemote: event.target.checked })} />أقبل التدريب عن بُعد</label>
      <ChoiceChips label="نوع التدريب" choices={trainingOptions} selected={profile.trainingTypes}
        onChange={(trainingTypes) => update({ trainingTypes })} />
      <div className="auto-apply-form-grid"><label>بداية التدريب المفضلة<input type="date" value={profile.trainingStartDate || ""} onChange={(event) => update({ trainingStartDate: event.target.value })} /></label>
        <label>المدة<input value={profile.trainingDuration || ""} onChange={(event) => update({ trainingDuration: event.target.value })} placeholder="مثال: 3 أشهر" /></label></div>
      <label>طريقة العمل<select value={profile.mode} onChange={(event) => update({ mode: event.target.value })}>
        <option value="review_first">أراجع كل طلب أولًا</option><option value="automatic">تلقائي لاحقًا — تجريبي الآن</option>
      </select></label>
      <label className="auto-apply-check"><input type="checkbox" checked={profile.paused} onChange={(event) => update({ paused: event.target.checked })} />إيقاف التقديم التلقائي</label>
      <button disabled={busy} onClick={saveProfile}>حفظ الاختيارات</button>
    </section><div className="auto-apply-side"><section className="auto-apply-panel">
      <h2>٢ · سيرة أساسية واحدة</h2><p>تُستخدم نفس النسخة لكل طلب تجريبي. يمكنك استبدالها يدويًا للتقديمات المستقبلية.</p>
      {profile.resumeSnapshotId && <div className="auto-apply-selected"><span>السيرة المختارة: {profile.resumeSource === "uploaded" ? "PDF مرفوع" : "سيرة دربك"}</span>
        <button type="button" className="secondary" onClick={downloadResume}>تنزيل النسخة</button></div>}
      <div className="auto-apply-actions">{rewardResumeAvailable && <button disabled={busy} onClick={() => run(async () => {
        const { data } = await axios.post(`${API_BASE_URL}/api/auto-apply/resume/from-reward`, {}, { headers }); update(data);
      }, "اخترنا نسخة المكافأة النهائية كسيرة أساسية.")}>استخدام سيرة دربك المحفوظة</button>}
        <button disabled={busy} className="secondary" onClick={usePaidResume}>استخدام سيرتي الحالية بدربك</button>
        <label className="auto-apply-upload">رفع سيرة PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => uploadFile(event.target.files?.[0])} /></label>
      </div></section><section className="auto-apply-panel"><h2>بريد التقديم</h2>
        <p>اربط بريدك حتى تخرج طلبات التدريب من بريدك نفسه مستقبلًا.</p>
        <EmailConnection emailIdentity={emailIdentity} localConnectionEnabled={localConnectionEnabled} busy={busy}
          onConnect={connectGmail} onDisconnect={disconnectGmail} />
        <p>الربط لا يرسل أي رسالة. الإرسال الحقيقي ما زال متوقفًا.</p>
      </section><section className="auto-apply-panel"><h2>٣ · معاينة المطابقة</h2>
        <p>الجهات الجديدة الموثقة تدخل المعاينة تلقائيًا. غياب التخصص أو المدينة في دليل الجهة لا يعني تطابقًا مؤكدًا.</p>
        <strong>{matches.filter((item) => item.eligibility === "eligible").length} مطابقة مؤكدة · {matches.filter((item) => item.eligibility === "needs_review").length} تحتاج مراجعة</strong>
        <div className="auto-apply-match-list">{matches.map((item) => <article key={item.targetKey}><h3>{item.company}</h3>
          <p>{item.title} · {item.cities?.join("، ") || (item.remote ? "عن بُعد" : "المدينة غير محددة")}</p>
          <span>{item.eligibility === "eligible" ? "مطابقة موثقة" : "الأهلية غير مؤكدة"}</span>
          <ul>{[...item.reasons, ...item.blockers].map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </article>)}{matches.length === 0 && <p>لا توجد قنوات موثقة مناسبة لاختياراتك حاليًا.</p>}</div>
        <button disabled={busy || !profile.resumeSnapshotId || profile.paused} onClick={createPackages}>تجهيز طلبات المراجعة تجريبيًا</button>
      </section></div></div>
    <section className="auto-apply-panel auto-apply-dashboard"><h2>لوحة التقديم التجريبية</h2>
      <div className="auto-apply-stats">{[["فرص مناسبة", matches.filter((item) => item.eligibility === "eligible").length], ["جاهزة للمراجعة", packageCount("ready_for_review")],
        ["تم التقديم", packageCount("sent")], ["تحتاج خطوة منك", packageCount("needs_action")], ["تم تخطيها", packageCount("skipped")]].map(([label, count]) =>
          <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
      <p className="auto-apply-status">Auto Apply {profile.paused ? "متوقف" : "جاهز للتجربة"} · لا يتم إرسال أي بريد في V1 التجريبية</p>
      <div className="auto-apply-package-list">{packages.map((item) => <article key={item._id}>
        <div><h3>{matches.find((match) => match.targetKey === item.targetKey)?.company || "جهة تدريب"}</h3>
          <span>{statusText[item.status] || item.status}</span></div>
        <p>طريقة التقديم: بريد إلكتروني · {item.matchedFields?.join("، ") || "المجال غير محدد"}</p>
        <p>السيرة: نسخة أساسية محفوظة · {item.matchReasons?.join(" · ") || item.blockers?.join(" · ")}</p>
        <button className="secondary" onClick={() => { setSelectedPackage(item); setEditor({ subject: item.subject, body: item.body }); setTestSendResult(null); }}>مراجعة الرسالة</button>
        {item.status !== "skipped" && <button className="secondary" disabled={busy} onClick={() => act(item, "skip")}>تخطي</button>}
        {item.companyId && item.status !== "skipped" && <button className="secondary" disabled={busy} onClick={() => act(item, "exclude")}>استبعاد الجهة</button>}
      </article>)}{packages.length === 0 && <p>احفظي الملف والسيرة ثم جهزي الطلبات لرؤية المسودات هنا.</p>}</div>
    </section>
    {selectedPackage && <div className="auto-apply-overlay" onClick={() => setSelectedPackage(null)}><section className="auto-apply-review" role="dialog" aria-modal="true" aria-label="مراجعة طلب التقديم" onClick={(event) => event.stopPropagation()}>
      <button className="secondary" onClick={() => setSelectedPackage(null)}>إغلاق</button><h2>راجعي رسالة التقديم</h2>
      {testMode.enabled && <div className="auto-apply-test-warning"><strong>وضع اختبار</strong>
        <p>لن تُرسل الرسالة إلى الجهة.</p><span>الوجهة الفعلية للاختبار:</span>
        <b dir="ltr">{testMode.recipient}</b></div>}
      <dl className="auto-apply-review-details">
        <div><dt>الجهة</dt><dd>{selectedPackage.company || "جهة تدريب"}</dd></div>
        <div><dt>سبب المطابقة</dt><dd>{selectedPackage.matchReasons?.slice(0, 3).join(" · ") || "مناسب لاختياراتك"}</dd></div>
        <div><dt>البريد الأصلي للجهة</dt><dd dir="ltr">{selectedPackage.originalTargetEmail || "غير متاح"}</dd></div>
        <div><dt>السيرة المستخدمة</dt><dd>{selectedPackage.resumeFilename || "resume.pdf"}</dd></div>
        <div><dt>المرفقات</dt><dd>السيرة الذاتية فقط</dd></div>
      </dl>
      <label>عنوان الرسالة<input value={editor.subject} onChange={(event) => setEditor({ ...editor, subject: event.target.value })} /></label>
      <label>رسالة التقديم<textarea rows="9" value={editor.body} onChange={(event) => setEditor({ ...editor, body: event.target.value })} /></label>
      {testSendResult && <div className="auto-apply-test-success" role="status"><strong>تم إرسال النسخة التجريبية بنجاح ✓</strong>
        <p>لم يتم التواصل مع الجهة.</p><span dir="ltr">{testSendResult.senderEmail} → {testSendResult.testRecipient}</span>
        <time>{new Date(testSendResult.sentAt).toLocaleString("ar-SA")}</time></div>}
      <div className="auto-apply-actions"><button disabled={busy} onClick={() => act(selectedPackage, "edit", editor)}>حفظ التعديل</button>
        {testMode.enabled && <button disabled={busy || selectedPackage.eligibility !== "eligible" || Boolean(testSendResult)}
          onClick={sendPackageTest}>إرسال اختبار</button>}
        {!testMode.enabled && <button disabled={busy || selectedPackage.eligibility !== "eligible"}
          onClick={() => act(selectedPackage, "approve", editor)}>موافقة تجريبية</button>}
        <button className="secondary" disabled={busy} onClick={() => act(selectedPackage, "skip")}>تخطي</button></div>
    </section></div>}
  </main>;
}
