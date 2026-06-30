import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "../contexts/AuthContext";

const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { firebaseUser, loading } = useAuth();

  if (loading) return null;
  return firebaseUser ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
