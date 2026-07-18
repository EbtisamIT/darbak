import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import {
  getSavedItems,
  markSavedItemOrganizationUpdatesSeen,
  toggleSavedItem,
} from "../utils/savedItems";
import { formatRelativeArabicTime } from "../utils/dateDisplay";

const getTypeLabel = (type = "") => {
  if (type === "experience") return "تجربة";
  if (type === "opportunity") return "فرصة";
  return "جهة";
};

export default function SavedItemsDrawer() {
  const [items, setItems] = useState(() => getSavedItems());
  const [isOpen, setIsOpen] = useState(false);
  const [dashboardUpdates, setDashboardUpdates] = useState({});

  useEffect(() => {
    const updateItems = () => setItems(getSavedItems());
    window.addEventListener("darbak:saved-items-updated", updateItems);
    return () =>
      window.removeEventListener("darbak:saved-items-updated", updateItems);
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setDashboardUpdates({});
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
        setDashboardUpdates(nextUpdates);
      })
      .catch(() => {
        if (isActive) setDashboardUpdates({});
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, items]);

  if (items.length === 0) return null;

  const getLatestDashboardTime = (item) => {
    const update = dashboardUpdates[item.id];
    const events = Array.isArray(update?.events) ? update.events : [];
    return events.reduce((latest, event) => {
      const time = new Date(event.date).getTime();
      return Number.isFinite(time) ? Math.max(latest, time) : latest;
    }, 0);
  };

  const sortedItems = [...items].sort((a, b) => {
    const updateDiff = getLatestDashboardTime(b) - getLatestDashboardTime(a);
    if (updateDiff !== 0) return updateDiff;
    return new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime();
  });

  const unreadUpdateCount = Object.values(dashboardUpdates).reduce(
    (sum, update) => sum + (Array.isArray(update?.events) ? update.events.length : 0),
    0
  );

  const removeItem = (item) => {
    toggleSavedItem(item);
    setItems(getSavedItems());
  };

  const markDashboardUpdateRead = (item, update) => {
    if (update?.latestEventAt || update?.latestAcceptedAt) {
      markSavedItemOrganizationUpdatesSeen(
        item.id,
        update.latestEventAt || update.latestAcceptedAt
      );
    }
    setIsOpen(false);
  };

  return (
    <div className="saved-items-widget" dir="rtl">
      <button
        type="button"
        className={`saved-items-trigger ${
          unreadUpdateCount > 0 ? "has-updates" : ""
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>متابعاتي</span>
        {unreadUpdateCount > 0 ? (
          <strong className="saved-items-update-count">{unreadUpdateCount}</strong>
        ) : (
          <strong>{items.length}</strong>
        )}
      </button>

      {isOpen && (
        <div className="saved-items-panel">
          <div className="saved-items-panel-head">
            <div>
              <p>لوحة متابعاتي</p>
              <span>آخر ما تغير في الجهات والفرص اللي تهمك</span>
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
            {sortedItems.map((item) => {
              const isInternal = item.url?.startsWith("/");
              const dashboardUpdate = dashboardUpdates[item.id];
              const dashboardEvents = Array.isArray(dashboardUpdate?.events)
                ? dashboardUpdate.events
                : [];
              const organizationName =
                item.organizationName || item.subtitle || item.title || "";
              const updatePath = `/experiences?company=${encodeURIComponent(
                dashboardUpdate?.organizationName || organizationName
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
                  {dashboardEvents.length > 0 && (
                    <div className="saved-item-events">
                      {dashboardEvents.slice(0, 2).map((event) => {
                        const eventUrl = event.url || updatePath;
                        const eventIsInternal = eventUrl.startsWith("/");
                        const eventContent = (
                          <>
                            <span className="saved-item-event-status">
                              <b>{event.icon || "🟢"}</b>
                              <strong>{event.label || "تحديث جديد"}</strong>
                            </span>
                            <span>{event.message}</span>
                            {event.date && (
                              <em>{formatRelativeArabicTime(event.date)}</em>
                            )}
                          </>
                        );

                        return eventIsInternal ? (
                          <Link
                            key={`${item.id}-${event.type}-${event.date}`}
                            to={eventUrl}
                            className={`saved-item-event ${event.tone || "success"}`}
                            onClick={() =>
                              markDashboardUpdateRead(item, dashboardUpdate)
                            }
                          >
                            {eventContent}
                          </Link>
                        ) : (
                          <a
                            key={`${item.id}-${event.type}-${event.date}`}
                            href={eventUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`saved-item-event ${event.tone || "success"}`}
                            onClick={() =>
                              markDashboardUpdateRead(item, dashboardUpdate)
                            }
                          >
                            {eventContent}
                          </a>
                        );
                      })}
                    </div>
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
