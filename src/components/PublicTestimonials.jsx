import React, { useEffect, useState } from "react";
import API_BASE_URL from "../config/api";
import "./PublicTestimonials.css";

export default function PublicTestimonials() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/student-feedback/testimonials`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setItems(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  return <section className="home-section public-testimonials" aria-label="آراء مختارة من طلاب دربك">
    <div className="home-section-heading"><span>من مجتمع دربك</span><h2>آراء مختارة من طلاب دربك</h2></div>
    <div className="public-testimonials-grid">{items.map((item) => <article key={item._id}>
      <p>“{item.publicDisplayText}”</p>
      <strong>{[item.studentStatus === "graduate" ? "خريج" : "طالب", item.major, item.city].filter(Boolean).join(" — ")}</strong>
      {item.subscriptionType !== "free" && <small>مشترك بدربك+</small>}
    </article>)}</div>
  </section>;
}
