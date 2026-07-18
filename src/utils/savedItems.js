const SAVED_ITEMS_KEY = "darbak_saved_items_v1";

export const getSavedItems = () => {
  if (typeof window === "undefined") return [];

  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_ITEMS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export const getSavedItemIds = () =>
  new Set(getSavedItems().map((item) => item.id).filter(Boolean));

export const getSavedItemById = (id) =>
  getSavedItems().find((item) => item.id === id) || null;

export const isSavedItem = (id) => getSavedItemIds().has(id);

const getDateTime = (value) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

export const getSavedItemUpdateState = (id, currentUpdatedAt) => {
  const savedItem = getSavedItemById(id);
  if (!savedItem) {
    return { isSaved: false, hasUpdate: false, savedItem: null };
  }

  const savedSnapshot = getDateTime(
    savedItem.lastSeenAt ||
      savedItem.lastKnownUpdatedAt ||
      savedItem.updatedAt ||
      savedItem.savedAt
  );
  const currentSnapshot = getDateTime(currentUpdatedAt);

  return {
    isSaved: true,
    hasUpdate: Boolean(
      currentSnapshot && savedSnapshot && currentSnapshot > savedSnapshot + 60000
    ),
    savedItem,
  };
};

export const markSavedItemSeen = (id, currentUpdatedAt) => {
  if (typeof window === "undefined" || !id) return;

  const savedItems = getSavedItems();
  if (!savedItems.some((item) => item.id === id)) return;

  const nextItems = savedItems.map((item) =>
    item.id === id
      ? {
          ...item,
          lastSeenAt: currentUpdatedAt || new Date().toISOString(),
          lastKnownUpdatedAt: currentUpdatedAt || item.lastKnownUpdatedAt,
        }
      : item
  );

  window.localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(nextItems));
  window.dispatchEvent(new CustomEvent("darbak:saved-items-updated"));
};

export const toggleSavedItem = (item) => {
  if (typeof window === "undefined" || !item?.id) return false;

  const savedItems = getSavedItems();
  const exists = savedItems.some((savedItem) => savedItem.id === item.id);
  const nextItems = exists
    ? savedItems.filter((savedItem) => savedItem.id !== item.id)
    : [
        {
          ...item,
          savedAt: new Date().toISOString(),
          lastKnownUpdatedAt:
            item.updatedAt || item.lastKnownUpdatedAt || new Date().toISOString(),
          lastSeenAt:
            item.updatedAt || item.lastKnownUpdatedAt || new Date().toISOString(),
        },
        ...savedItems,
      ].slice(0, 120);

  window.localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(nextItems));
  window.dispatchEvent(new CustomEvent("darbak:saved-items-updated"));
  return !exists;
};
