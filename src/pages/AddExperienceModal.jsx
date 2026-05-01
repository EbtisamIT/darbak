import React, { useState } from "react";
import axios from "axios";
import majors from "../majors"; // قائمة التخصصات

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001";

export default function AddExperienceModal({ onClose, onSaved }) {
  const [step, setStep] = useState(0);
  const totalSteps = 5; // خطوات الإدخال: 0..4 ، بعد الحفظ step === totalSteps => شاشة النجاح

  // form state
  const [organizationName, setOrganizationName] = useState("");
  const [city, setCity] = useState("");
  const [duration, setDuration] = useState("");
  const [howApplied, setHowApplied] = useState("");
  const [ratings, setRatings] = useState([]); // up to 2
  const [description, setDescription] = useState("");
  const [major, setMajor] = useState("");
  

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [starRating, setStarRating] = useState(0); // من 1 إلى 5

  const howAppliedOptions = [
    "موقع الجهة الرسمي",
    "ترشيح من الجامعة",
    "توصية من أصدقاء/معارف",
    "LinkedIn",
    "منصة توظيف / تمهير",
    "بحث شخصي / مراسلة مباشرة",
    "أخرى",
  ];

  const ratingOptions = [
    { id: "excellent", label: "😍 ممتازة ومثرية جدًا" },
    { id: "nice", label: "😊 لطيفة وخفيفة" },
    { id: "enriching", label: "💡 مثرية وتعلمت منها كثير" },
    { id: "challenging", label: "🤔 متوسطة وفيها تحديات" },
    { id: "notgood", label: "😕 غير مرضية" },
  ];

  const cityOptions = [
    "الرياض",
    "جدة",
    "الدمام",
    "أبها",
    "مكة المكرمة",
    "المدينة المنورة",
    "الطائف",
    "تبوك",
    "ينبع",
    "جازان",
    "أخرى",
  ];


  const durationOptions = Array.from({ length: 12 }, (_, i) =>
    i + 1 === 1 ? "شهر" : `${i + 1} أشهر`
  );

  const handleClose = () => {
    if (onClose) onClose();
  };

  const toggleRating = (id) => {
    setRatings((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  // تصحيح منطق canNext
  const canNext = () => {
    switch (step) {
      case 0:
        return organizationName.trim().length > 0 && city.trim().length > 0;
      case 1:
        return major.trim().length > 0;
      case 2:
        return howApplied.trim().length > 0;
      case 3:
        return duration.trim().length > 0;
        case 4:
          return starRating > 0 && description.trim().length > 0;
        
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!organizationName.trim() || !city.trim() || !major.trim() || !howApplied.trim() || !duration.trim() || !description.trim() || ratings.length === 0) {
      setError("الرجاء إكمال جميع الحقول المطلوبة.");
      return;
    }

    const payload = {
      title: `تجربتي في ${organizationName}`,
      organizationName,
      city,
      major,
      howApplied,
      duration,
      ratings,        // ممكن تخلينه أو تحذفينه لاحقًا
      starRating,     // ⭐ الجديد
      description,
      createdAt: new Date().toISOString(),
    };
    

    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE_URL}/api/experiences`, payload);
      setLoading(false);
      if (onSaved) onSaved(res.data);
      setStep(totalSteps); // شاشة النجاح
    } catch (err) {
      console.error("Error saving experience:", err);
      setLoading(false);
      setError("حدث خطأ أثناء الحفظ. الرجاء المحاولة لاحقًا.");
    }
  };

  const progressPercent = Math.min(
    100,
    Math.round(((step + 1) / (totalSteps + 1)) * 100)
  );

  // إضافة الاقتراح للنص وعلامته كمستخدمة
 

  const StarRating = ({ value, onChange }) => {
    return (
      <div style={{ display: "flex", gap: 6, fontSize: 26 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            onClick={() => onChange(star)}
            style={{
              cursor: "pointer",
              color: star <= value ? "#facc15" : "#334155",
              transition: "color 0.2s",
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };
  
  return (
    <div
      className="stepper-modal-bg"
      onClick={(e) => e.target.classList.contains("stepper-modal-bg") && handleClose()}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <div
        className="stepper-modal-card"
        style={{
          width: "100%",
          maxWidth: 720,
          borderRadius: 14,
          background: "linear-gradient(180deg, rgba(25,25,30,0.95), rgba(18,18,22,0.98))",
          color: "#fff",
          boxShadow: "0 12px 40px rgba(2,6,23,0.7)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: 18, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, background: "#0f1115", borderRadius: 8 }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg,#9fb0c7,#06b6d4)",
                    transition: "width 300ms ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 13, color: "#bfc7d3", marginTop: 8 }}>
                خطوة {Math.min(step + 1, totalSteps)}/{totalSteps}
              </div>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#cbd5e1",
                fontSize: 22,
                cursor: "pointer",
              }}
              aria-label="close"
            >
              ×
            </button>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: 24 }}>
          {/* الخطوة 0 - بيانات الجهة */}
          {step === 0 && (
            <div>
              <h3 style={{ color: "#e6eef6" }}>بيانات الجهة</h3>
              <p style={{ color: "#9fb0c7" }}>املئي اسم الجهة والمدينة.</p>

              <input
                type="text"
                placeholder="🏢 اسم الجهة (مثلاً: هيئة البيانات والذكاء الاصطناعي)"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.04)",
                  marginBottom: 12,
                }}
              />

              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <option value="">📍 اختر المدينة</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* الخطوة 1 - التخصص */}
          {step === 1 && (
            <div>
              <h3 style={{ color: "#e6eef6" }}>ما هو تخصصك؟</h3>
              <p style={{ color: "#9fb0c7" }}>اختار/ي التخصص الذي ينتمي له التدريب.</p>

              <select
  value={major}
  onChange={(e) => setMajor(e.target.value)}
  style={{
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "rgba(255,255,255,0.02)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.04)",
    marginTop: 10,
  }}
>
  <option value="">🎓 اختار/ي التخصص</option>

  {majors.map((m, i) => (
    <option key={i} value={m.name}>
      {m.name}
    </option>
  ))}
</select>
</div>
          )}
          {/* الخطوة 2 - طريقة التقديم */}
          {step === 2 && (
            <div>
              <h3 style={{ color: "#e6eef6" }}>كيف حصلت على فرصة التدريب؟</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {howAppliedOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setHowApplied(opt)}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      background:
                        howApplied === opt
                          ? "linear-gradient(90deg,#9fb0c7,#06b6d4)"
                          : "rgba(255,255,255,0.03)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.03)",
                      cursor: "pointer",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الخطوة 3 - مدة التدريب */}
          {step === 3 && (
            <div>
              <h3 style={{ color: "#e6eef6" }}>كم كانت مدة التدريب؟</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                {durationOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background:
                        duration === d
                          ? "linear-gradient(90deg,#9fb0c7,#06b6d4)"
                          : "rgba(255,255,255,0.02)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.03)",
                      cursor: "pointer",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* الخطوة 4 - التقييم والوصف */}
          {step === 4 && (
            <div>
              <h3 style={{ color: "#e6eef6" }}>قيّمي تجربتك</h3>
              <p style={{ color: "#9fb0c7" }}>يمكنك اختيار تقييمين كحد أقصى.</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
                {ratingOptions.map((r) => {
                  const selected = ratings.includes(r.id);
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleRating(r.id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: selected
                          ? "linear-gradient(90deg,#9fb0c7,#06b6d4)"
                          : "rgba(255,255,255,0.02)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        minWidth: 200,
                      }}
                    >
                      {r.label}
                    </div>
                  );
                })}
              </div>
              <h4 style={{ marginTop: 20, color: "#e6eef6" }}>
  التقييم العام للتجربة
</h4>
<p style={{ color: "#9fb0c7", fontSize: 14 }}>
  قيّمي التجربة من 1 إلى 5 نجوم
</p>

<StarRating value={starRating} onChange={setStarRating} />
<div
  style={{
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    background: "rgba(124,58,237,0.08)",
    border: "1px solid rgba(124,58,237,0.2)",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.7,
  }}
>
  💡 لمساعدتنا ومساعدة غيرك:
  <ul style={{ marginTop: 6, paddingInlineStart: 18 }}>
    <li>وش أكثر شيء تعلمته خلال التدريب؟</li>
    <li>هل كانت المهام واضحة ومفيدة؟</li>
    <li>هل تنصح غيرك بالتقديم؟ وليه؟</li>
  </ul>
</div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=" 👋اكتب تجربتك بأسلوبك الشخصي، كلامك راح يساعد طلاب كثير "
                style={{
                  width: "100%",
                  minHeight: 120,
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              />

             
              
         
         
            </div>
          )}

          {/* بعد الحفظ */}
          {step >= totalSteps && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <h3 style={{ color: "#e6eef6" }}>تمت الإضافة بنجاح 🎉</h3>
              <p style={{ color: "#a9c0d6" }}>
                شكراً لمشاركتك! ستظهر تجربتك في صفحة التجارب قريبًا.
              </p>
              <button
                onClick={handleClose}
                style={{
                  marginTop: 10,
                  padding: "10px 16px",
                  borderRadius: 10,
                  background: "linear-gradient(90deg,#9fb0c7,#06b6d4)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                العودة للتجارب
              </button>
            </div>
          )}

          {error && <div style={{ marginTop: 14, color: "#ffb4b4" }}>{error}</div>}
        </div>

        {/* footer - الرجوع موجود في كل خطوات */}
        <div
          style={{
            padding: 18,
            borderTop: "1px solid rgba(255,255,255,0.03)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleClose}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: "transparent",
                color: "#bfc7d3",
                border: "1px solid rgba(255,255,255,0.03)",
                cursor: "pointer",
              }}
            >
              إلغاء
            </button>

            {/* زر الرجوع (يعمل في كل خطوة) */}
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: step === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.03)",
                cursor: step === 0 ? "not-allowed" : "pointer",
              }}
            >
              رجوع
            </button>
          </div>

          <div>
            {/* إذا نحن في آخر خطوة (قبل الحفظ) نعرض حفظ + رجوع */}
            {step === totalSteps - 1 ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.08)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                  }}
                >
                  تعديل المعلومات
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: loading
                      ? "rgba(125,125,125,0.5)"
                      : "linear-gradient(90deg,#9fb0c7,#06b6d4)",
                    color: "#fff",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "جاري الحفظ..." : "حفظ التجربة"}
                </button>
              </div>
            ) : (
              // أزرار التنقل في بقية الخطوات
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    if (canNext()) setStep((s) => s + 1);
                    else setError("الرجاء إكمال الحقول المطلوبة أولاً.");
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    background: "linear-gradient(90deg,#9fb0c7,#06b6d4)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  التالي
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
