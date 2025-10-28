import "./App.css";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import UserDashboard from "./pages/Dashboard/UserDashboard";
import AdminDashboard from "./pages/Dashboard/AdminDashboard";
import LoginSignup from "./pages/Login/Login-Signup";
import Registration from "./pages/Registration/Registration";
import { useAuth } from "./auth/AuthProvider";

function RouteLoader() {
  return <div className="route-loading">Loading...</div>;
}

function RegistrationGate() {
  const { user, loading, emailVerified, participant, participantLoading } = useAuth();
  const location = useLocation();

  if (loading || participantLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!emailVerified) {
    return <Navigate to="/" replace />;
  }

  if (participant && (participant as { type?: string }).type === "Participant") {
    return <Navigate to="/user/dashboard" replace />;
  }

  return <Registration />;
}

function ParticipantGate() {
  const { user, loading, emailVerified, participant, participantLoading } = useAuth();
  const location = useLocation();

  if (loading || participantLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!emailVerified) {
    return <Navigate to="/" replace />;
  }

  if (!participant || (participant as { type?: string }).type !== "Participant") {
    return <Navigate to="/registration" replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/registration" element={<RegistrationGate />} />

        <Route path="/user/*" element={<ParticipantGate />}>
          <Route index element={<Navigate to="/user/dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard />} />
        </Route>

        <Route path="/admin/*">
          <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
