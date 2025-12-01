import "./App.css";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import UserDashboard from "./pages/Dashboard/UserDashboard";
import AdminDashboard from "./pages/Dashboard/AdminDashboard";
import AdminCreator from "./pages/Dashboard/AdminCreator";
import MatchedDashboard from "./pages/Dashboard/MatchedDashboard";
import LoginSignup from "./pages/Login/Login-Signup";
import Registration from "./pages/Registration/Registration";
import Profile from "./pages/Profile/Profile";
import RecapPage from "./pages/Recap/RecapPage";
import Rematching from "./pages/Rematching/Rematching";
import PreProgram from "./pages/PreProgram/PreProgram";
import Waiting from "./pages/Waiting/Waiting";

function RouteLoader() {
  return <div className="route-loading">Loading...</div>;
}

function RegistrationGate() {
  const { user, loading, emailVerified, participant, participantLoading, programState, programStateLoading } =
    useAuth();
  const location = useLocation();
  const role = (participant as { role?: string | null } | null)?.role ?? null;

  if (loading || participantLoading || programStateLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!emailVerified) {
    return <Navigate to="/" replace />;
  }

  if (role && isAdminRole(role)) {
    return <Navigate to="/admin/" replace />;
  }

  if (participant && (participant as { type?: string }).type === "Participant") {
    const started = !!programState?.started;
    const matchesFinal = !!programState?.matches_final;

    if (!matchesFinal && !started) {
      return <Navigate to="/waiting" replace />;
    }

    if (matchesFinal && !started) {
      return <Navigate to="/user/matched" replace />;
    }

    return <Navigate to="/user/dashboard" replace />;
  }

  return <Registration />;
}

function ParticipantGate() {
  const { user, loading, emailVerified, participant, participantLoading, programState, programStateLoading } =
    useAuth();
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

  if (
    !participant ||
    (participant as { type?: string }).type !== "Participant"
  ) {
    return <Navigate to="/registration" replace />;
  }

  // derive program flags (safe defaults)
  const started = !!programState?.started;
  const matchesFinal = !!programState?.matches_final;

  if (programStateLoading) return <RouteLoader />;

  // matches not final && program not started -> participants only see waiting
  if (!matchesFinal && !started) {
    if (location.pathname !== "/waiting") return <Navigate to="/waiting" replace />;
    return <Outlet />;
  }

  // matches finalized && program not started -> participants only see matched
  if (matchesFinal && !started) {
    if (!location.pathname.startsWith("/user/matched")) return <Navigate to="/user/matched" replace />;
    return <Outlet />;
  }

  // program started && matches finalized -> normal access, but disallow waiting/matched pages
  if (matchesFinal && started) {
    if (location.pathname === "/waiting" || location.pathname.startsWith("/user/matched")) {
      return <Navigate to="/user/dashboard" replace />;
    }
    return <Outlet />;
  }

  // Default: allow through
  return <Outlet />;
}

function WaitingGuard() {
  const { user, participant, loading, participantLoading, programState, programStateLoading } = useAuth();
  if (loading || participantLoading || programStateLoading) return <RouteLoader />;

  if (!user) return <Navigate to="/" replace />;

  const started = !!programState?.started;
  const matchesFinal = !!programState?.matches_final;

  // Only participants should generally land here; redirect others to registration
  if (!participant || (participant as { type?: string }).type !== "Participant") {
    return <Navigate to="/registration" replace />;
  }

  // If matches not final and program not started -> stay on waiting
  if (!matchesFinal && !started) return <Waiting />;

  // If matches finalized and program not started -> go to matched
  if (matchesFinal && !started) return <Navigate to="/user/matched" replace />;

  // If program started and matches finalized -> go to dashboard
  if (matchesFinal && started) return <Navigate to="/user/dashboard" replace />;

  return <Waiting />;
}

function isAdminRole(role?: string | null) {
  if (!role) return false;
  const normalised = role.toLowerCase();
  return normalised === "admin" || normalised === "subadmin" || normalised === "sub-admin";
}

function AdminGate() {
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

  const role = (participant as { role?: string | null } | null)?.role ?? null;

  if (!participant || !isAdminRole(role)) {
    const destination =
      (participant as { type?: string } | null)?.type === "Participant"
        ? "/user/dashboard"
        : "/";
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        <Route path="/registration" element={<RegistrationGate />} />
        <Route path="/waiting" element={<WaitingGuard />} />


          <Route path={"/"} element={<LoginSignup></LoginSignup>}></Route>
          <Route path={"/registration"} element={<Registration></Registration>}></Route>
          <Route path={"/profile"} element={<Profile></Profile>}></Route>

          <Route path="/user/*" element={<ParticipantGate />}>
            <Route path="" element={<Navigate to="/user/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
            <Route path="matched" element={<MatchedDashboard />} />
            <Route path="waiting" element={<Waiting />} />
          </Route>

          <Route path="/admin/*" element={<AdminGate />}>
            <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="recap" element={<RecapPage />} />
            <Route path="creator" element={<AdminCreator />} />
            <Route path="main" element={<PreProgram />} />
            <Route path="rematching" element={<Rematching />} />
          </Route>

          {/* <Route path={"/user/dashboard"} element={<Dashboard></Dashboard>}></Route>
          <Route path={"/admin/dashboard"} element={<Dashboard></Dashboard>}></Route> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
