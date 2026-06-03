// In-memory storage for the access token (Security Best Practice: Short-lived)
let _accessToken: string | null = null;

export const API_URL = "http://localhost:3000/api/v1";

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const getAccessToken = () => _accessToken;

// Local Storage for Refresh Token (Long-lived, used to restore session on reload)
export const getRefreshToken = () => localStorage.getItem("refreshToken");

export const setRefreshToken = (token: string | null) => {
  if (token) {
    localStorage.setItem("refreshToken", token);
  } else {
    localStorage.removeItem("refreshToken");
  }
};

export const clearTokens = () => {
  setAccessToken(null);
  setRefreshToken(null);
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
};

export const handleLogout = () => {
  clearTokens();
  window.location.href = "/login";
};
