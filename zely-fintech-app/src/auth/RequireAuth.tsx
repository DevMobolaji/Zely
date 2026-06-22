import React from "react";
import { useLocation, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Loader2 } from "lucide-react";

const RequireAuth = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { auth, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!auth?.accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    allowedRoles &&
    auth?.user?.role &&
    !allowedRoles.includes(auth.user.role)
  ) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default RequireAuth;
