import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSavedItems, toggleSavedItem } from "../utils/savedItems";

const getTypeLabel = (type = "") => {
  if (type === "experience") return "تجربة";
  if (type === "opportunity") return "فرصة";
  return "جهة";
};

export default function SavedItemsDrawer() {
  const [items, setItems] = useState(() => getSavedItems());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const updateItems = () => setItems(getSavedItems());
    window.addEventListener("darbak:saved-items-updated", updateItems);
    return () =>
      window.removeEventListener("darbak:saved-items-updated", updateItems);
  }, []);

  if (items.length === 0) return null;

  const removeItem = (item) => {
    toggleSavedItem(item);
    setItems(getSavedItems());
  };

  return (
    <div className="saved-items-widget" dir="rtl">
      <button
        type="button"
        className="saved-items-trigger"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>محفوظاتي</span>
        <strong>{items.length}</strong>
      </button>

      {isOpen && (
        <div className="saved-items-panel">
          <div className="saved-items-panel-head">
            <div>
              <p>محفوظات دربك</p>
              <span>تجارب وجهات ترجع لها لاحقًا</span>
            </div>
            <button
              type="button"
              aria-label="إغلاق المحفوظات"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="saved-items-list">
            {items.map((item) => {
              const isInternal = item.url?.startsWith("/");
              const content = (
                <>
                  <span className="saved-item-type">{getTypeLabel(item.type)}</span>
                  <strong>{item.title}</strong>
                  {item.subtitle && <small>{item.subtitle}</small>}
                  {item.meta && <em>{item.meta}</em>}
                </>
              );

              return (
                <div className="saved-item-row" key={item.id}>
                  {isInternal ? (
                    <Link to={item.url} onClick={() => setIsOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <a
                      href={item.url || "#"}
                      target={item.url ? "_blank" : undefined}
                      rel={item.url ? "noopener noreferrer" : undefined}
                    >
                      {content}
                    </a>
                  )}
                  <button type="button" onClick={() => removeItem(item)}>
                    إزالة
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
