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

export const isSavedItem = (id) => getSavedItemIds().has(id);

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
        },
        ...savedItems,
      ].slice(0, 120);

  window.localStorage.setItem(SAVED_ITEMS_KEY, JSON.stringify(nextItems));
  window.dispatchEvent(new CustomEvent("darbak:saved-items-updated"));
  return !exists;
};
