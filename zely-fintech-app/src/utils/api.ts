let _accessToken: string | null = null;

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

export const getAccessToken = () => _accessToken;

export const clearTokens = () => {
  setAccessToken(null);
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
};

export const handleLogout = () => {
  clearTokens();
  window.location.href = "/login";
};
