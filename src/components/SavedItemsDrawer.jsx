import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  getSavedItems,
  markSavedItemOrganizationUpdatesSeen,
  toggleSavedItem,
} from "../utils/savedItems";

const getTypeLabel = (type = "") => {
  if (type === "experience") return "تجربة";
  if (type === "opportunity") return "فرصة";
  return "جهة";
};

export default function SavedItemsDrawer() {
  const [items, setItems] = useState(() => getSavedItems());
  const [isOpen, setIsOpen] = useState(false);
  const [organizationUpdates, setOrganizationUpdates] = useState({});

  useEffect(() => {
    const updateItems = () => setItems(getSavedItems());
    window.addEventListener("darbak:saved-items-updated", updateItems);
    return () =>
      window.removeEventListener("darbak:saved-items-updated", updateItems);
  }, []);

  useEffect(() => {
    if (!isOpen || items.length === 0) {
      setOrganizationUpdates({});
      return undefined;
    }

    let isActive = true;
    const payloadItems = items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle,
      organizationName: item.organizationName,
      savedAt: item.savedAt,
      lastSeenAt: item.lastSeenAt,
      lastOrganizationUpdateSeenAt: item.lastOrganizationUpdateSeenAt,
    }));

    axios
      .post(`${API_BASE_URL}/api/saved-items/experience-updates`, {
        items: payloadItems,
      })
      .then(({ data }) => {
        if (!isActive) return;
        const nextUpdates = (data?.updates || []).reduce((updatesMap, update) => {
          if (update?.id) updatesMap[update.id] = update;
          return updatesMap;
        }, {});
        setOrganizationUpdates(nextUpdates);
      })
      .catch(() => {
        if (isActive) setOrganizationUpdates({});
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, items]);

  if (items.length === 0) return null;

  const removeItem = (item) => {
    toggleSavedItem(item);
    setItems(getSavedItems());
  };

  const markOrganizationUpdateRead = (item, update) => {
    if (update?.latestAcceptedAt) {
      markSavedItemOrganizationUpdatesSeen(item.id, update.latestAcceptedAt);
    }
    setIsOpen(false);
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
              const organizationUpdate = organizationUpdates[item.id];
              const organizationName =
                item.organizationName || item.subtitle || item.title || "";
              const updatePath = `/experiences?company=${encodeURIComponent(
                organizationUpdate?.organizationName || organizationName
              )}`;
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
                  {organizationUpdate && (
                    <Link
                      to={updatePath}
                      className="saved-item-update-link"
                      onClick={() =>
                        markOrganizationUpdateRead(item, organizationUpdate)
                      }
                    >
                      📖 تجربة جديدة وصلت لجهة محفوظة عندك
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
