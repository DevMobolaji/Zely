
// In-memory storage for the access token (Security Best Practice: Short-lived)
let _accessToken: string | null = null;


const API_URL = 'http://localhost:5000/api/v1';
import axios from 'axios';

export default axios.create({
  baseURL: API_URL,
})

export const axiosPrivate = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});


// export const setAccessToken = (token: string | null) => {
//   _accessToken = token;
// };


// export const getAccessToken = () => _accessToken;
// // Local Storage for Refresh Token (Long-lived, used to restore session on reload)
// export const getRefreshToken = () => localStorage.getItem('refreshToken');

// export const setRefreshToken = (token: string | null) => {
//   if (token) {
//     localStorage.setItem('refreshToken', token);
//   } else {
//     localStorage.removeItem('refreshToken');
//   }
// };

export const clearTokens = () => {
  //setAccessToken(null);
  //setRefreshToken(null);
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
};

// export const handleLogout = () => {
//   clearTokens();
//   window.location.href = '/login';
// };
