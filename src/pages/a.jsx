import React, { useState } from 'react';
import majorsList from '../majors';  // القائمة الجاهزة من عندك
import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001";

const AddExperienceForm = ({ onAddExperience }) => {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [major, setMajor] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');


const handleSubmit = async (e) => {
  e.preventDefault();

  const newExperience = { fullName, companyName, city, major, duration, description };

  try {
    const { data } = await axios.post(`${API_BASE_URL}/api/experiences`, newExperience);
    console.log("✅ تمت الإضافة:", data);

    if (onAddExperience) onAddExperience(data);

    // تصفير الحقول
    setFullName('');
    setCompanyName('');
    setCity('');
    setMajor('');
    setDuration('');
    setDescription('');
  } catch (err) {
    console.error("❌ خطأ أثناء الإرسال:", err.response ? err.response.data : err.message);
  }
};


  return (
    <form 
      onSubmit={handleSubmit} 
      style={{ 
        maxWidth: '600px', 
        margin: '30px auto', 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '10px', 
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)', 
        backgroundColor: '#fff' 
      }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>إضافة تجربة جديدة</h2>

      <div style={{ marginBottom: '15px' }}>
        <label>الاسم الكامل</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>اسم الشركة</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>المدينة</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>التخصص</label>
        <select
          value={major}
          onChange={(e) => setMajor(e.target.value)}
          required
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        >
          <option value="">اختر التخصص</option>
          {majorsList.map((m, idx) => (
            <option key={idx} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>مدة التدريب</label>
        <input
          type="text"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          required
          placeholder="مثال: 6 أشهر"
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>الوصف</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows="4"
          style={{ width: '100%', padding: '10px', marginTop: '5px', resize: 'none' }}
        />
      </div>

      <button 
        type="submit" 
        style={{ 
          width: '100%', 
          padding: '12px', 
          backgroundColor: '#1976d2', 
          color: '#fff', 
          fontSize: '16px', 
          border: 'none', 
          borderRadius: '5px', 
          cursor: 'pointer' 
        }}
      >
        إضافة التجربة
      </button>
    </form>
  );
};

export default AddExperienceForm;
