const localApiUrl = "http://localhost:3001";
const productionApiUrl = "https://darbak-api.onrender.com";

const isLocalHost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

const API_BASE_URL =
  process.env.REACT_APP_API_URL || (isLocalHost ? localApiUrl : productionApiUrl);

export default API_BASE_URL;
