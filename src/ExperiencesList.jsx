import React, { useState, useEffect } from "react";
import axios from "axios";
import majorsList from "../majors";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001";

const ExperiencesPage = () => {
  const [experiences, setExperiences] = useState([]);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [selectedMajor, setSelectedMajor] = useState("الكل");
  const [loading, setLoading] = useState(true);

  // ✅ جلب البيانات من الباك إند
  const fetchExperiences = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/experiences`);
      setExperiences(res.data);
      setLoading(false);
    } catch (err) {
      console.error("❌ خطأ في جلب البيانات:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences();
  }, []);

  // ✅ استخراج التخصصات الفعلية الموجودة بالتجارب فقط
  const majors = [
    "الكل",
    ...Array.from(new Set(experiences.map((exp) => exp.major))).filter(Boolean),
  ];

  // ✅ تصفية التجارب حسب التخصص
  const filteredExperiences =
    selectedMajor === "الكل"
      ? experiences
      : experiences.filter((exp) => exp.major === selectedMajor);

  if (loading) {
    return <p style={{ textAlign: "center", marginTop: "50px" }}>جارِ التحميل...</p>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ✅ الشريط الجانبي */}
      <div
        style={{
          width: "220px",
          backgroundColor: "#f9f9f9",
          borderLeft: "1px solid #ddd",
          padding: "20px",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <h3 style={{ marginBottom: "15px", textAlign: "center" }}>🎓 التخصصات</h3>
        {majors.length === 1 && <p style={{ textAlign: "center" }}>لا توجد تخصصات بعد</p>}
        {majors.map((major, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedMajor(major)}
            style={{
              padding: "10px",
              marginBottom: "8px",
              cursor: "pointer",
              borderRadius: "8px",
              backgroundColor: selectedMajor === major ? "#1976d2" : "transparent",
              color: selectedMajor === major ? "#fff" : "#333",
              fontWeight: selectedMajor === major ? "bold" : "normal",
              transition: "0.2s",
            }}
          >
            {major}
          </div>
        ))}
      </div>

      {/* ✅ قائمة التجارب */}
      <div style={{ flex: 1, padding: "40px" }}>
        <h2 style={{ textAlign: "center" }}>
          {selectedMajor === "الكل"
            ? "كل التجارب"
            : `تجارب تخصص ${selectedMajor}`}
        </h2>

        {filteredExperiences.length === 0 ? (
          <p style={{ textAlign: "center", marginTop: "30px", color: "#777" }}>
            لا توجد تجارب في هذا التخصص بعد.
          </p>
        ) : (
          <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "25px",
            marginTop: "30px",
          }}
        >
          {filteredExperiences.map((exp) => (
            <div
              key={exp._id}
              onClick={() => setSelectedExperience(exp)}
              style={{
                width: "100%",
                minHeight: "180px",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "15px",
                backgroundColor: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                cursor: "pointer",
                textAlign: "right",
              }}
            >
              <h4>{exp.fullName}</h4>
              <p>{exp.companyName}</p>
              <p style={{ color: "#777" }}>{exp.major}</p>
            </div>
          ))}
        </div>
        
        )}
      </div>

      {/* ✅ النافذة المنبثقة لتفاصيل التجربة */}
      {selectedExperience && (
        <div
          onClick={() => setSelectedExperience(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "10px",
              padding: "30px",
              width: "90%",
              maxWidth: "600px",
              textAlign: "right",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3>{selectedExperience.fullName}</h3>
            <h5 style={{ color: "#888" }}>{selectedExperience.companyName}</h5>
            <p style={{ marginTop: "10px", color: "#555" }}>
              📍 المدينة: {selectedExperience.city}
            </p>
            <p style={{ color: "#555" }}>
              ⏱️ المدة: {selectedExperience.duration}
            </p>
            <hr style={{ margin: "15px 0" }} />
            <p style={{ lineHeight: "1.8" }}>{selectedExperience.description}</p>

            <div style={{ textAlign: "center" }}>
              <button
                onClick={() => setSelectedExperience(null)}
                style={{
                  marginTop: "20px",
                  padding: "10px 25px",
                  backgroundColor: "#f44336",
                  color: "#fff",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperiencesPage;
