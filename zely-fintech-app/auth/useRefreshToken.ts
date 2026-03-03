import axios from "axios";
import { useAuth } from "./AuthProvider";
import { axiosPrivate } from "../utils/api";

const useRefreshToken = () => {
  const { setAuth } = useAuth(); // ✅ destructure setAuth

  const refresh = async () => {
    const response = await axiosPrivate.post("/auth/refresh-token",
      { withCredentials: true } // ✅ must be in config, not in body
    );

    const { userId, name, email, role, accessToken } = response.data.user

    setAuth(prev => ({
      ...prev,
      accessToken,
      user: { userId, name, email, role }
    }));

    return accessToken;
  };

  return refresh;
};

export default useRefreshToken;
