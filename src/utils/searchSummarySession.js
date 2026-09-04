const SEARCH_SUMMARY_PREFIX = "darbak:where-to-train:search-summary:";

const normalizePart = (value = "") =>
  value.toString().trim().toLocaleLowerCase("ar-SA");

export const getSearchSummaryKey = ({ major = "", city = "", organization = "" } = {}) =>
  [major, city, organization].map(normalizePart).join(":");

export const hasSeenSearchSummary = (searchKey = "") => {
  if (!searchKey || typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(`${SEARCH_SUMMARY_PREFIX}${searchKey}`) === "true";
  } catch {
    return false;
  }
};

export const markSearchSummarySeen = (searchKey = "") => {
  if (!searchKey || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(`${SEARCH_SUMMARY_PREFIX}${searchKey}`, "true");
  } catch {
    // The summary is optional; blocked session storage must not affect search.
  }
};
