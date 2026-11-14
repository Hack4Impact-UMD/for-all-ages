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
import AdminCreator from "./pages/Users/AdminCreator";
import CampusRoster from "./pages/Users/CampusRoster";
import LoginSignup from "./pages/Login/Login-Signup";
import Registration from "./pages/Registration/RegistrationNew";
import Profile from "./pages/Profile/Profile";
import RecapPage from "./pages/Recap/RecapPage";
import Rematching from "./pages/Rematching/Rematching";
import PreProgram from "./pages/PreProgram/PreProgram";
import FormBuilder from "./pages/FormBuilder/FormBuilder";
import Waiting from "./pages/Waiting/Waiting";
import MainLayout from "./components/MainLayout";
import { SUBADMIN_CAN_MANAGE_PARTICIPANTS } from "./utils/roles";

function RouteLoader() {
  return <div className="route-loading">Loading...</div>;
}

function ProgramGate({ children }: { children: React.ReactNode }) {
  const { programState, programStateLoading, isWaitlisted, waitlistLoading } = useAuth() as {
    programState: { matches_final: boolean; started: boolean } | null;
    programStateLoading: boolean;
    isWaitlisted: boolean;
    waitlistLoading: boolean;
  };
  const location = useLocation();

  if (programStateLoading || waitlistLoading) {
    return <RouteLoader />;
  }

  if (isWaitlisted) {
    return <Navigate to="/waiting" replace state={{ from: location }} />;
  }

  if (!programState) {
    return <Navigate to="/waiting" replace state={{ from: location }} />;
  }

  const { matches_final, started } = programState;

  if (!matches_final || !started) {
    return <Navigate to="/waiting" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function RegistrationGate() {
  const {
    user,
    loading,
    emailVerified,
    participant,
    participantLoading,
    isAdmin,
    isSubadmin,
  } = useAuth();
  const location = useLocation();
  const role = (participant as { role?: string | null } | null)?.role ?? null;
  const registered =
    (participant as { type?: string } | null)?.type === "Participant";

  if (loading || participantLoading) {
    return <RouteLoader />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!emailVerified) {
    return <Navigate to="/" replace />;
  }

  // Sub-admins who also participate fill out the form like anyone else.
  const subadminRegistering =
    isSubadmin && participant?.participantOptIn === true && !registered;

  if (role && isAdmin && !subadminRegistering) {
    return <Navigate to="/admin/" replace />;
  }

  if (registered) {
    return <Navigate to="/user/dashboard" replace />;
  }

  return <Registration />;
}

function ParticipantGate() {
  const { user, loading, emailVerified, participant, participantLoading } =
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

  return <Outlet />;
}

function AdminGate() {
  const {
    user,
    loading,
    emailVerified,
    participant,
    participantLoading,
    isAdmin,
  } = useAuth();
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

  if (!participant || !isAdmin) {
    const destination =
      (participant as { type?: string } | null)?.type === "Participant"
        ? "/user/dashboard"
        : "/";
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}

// Pages only full admins may use (program controls, matching, form editing).
// Sub-admins are sent to the Users page instead.
function FullAdminGate() {
  const { isSubadmin } = useAuth();

  if (isSubadmin) {
    return <Navigate to="/admin/creator" replace />;
  }

  return <Outlet />;
}

// Sub-admins see a read-only roster of their campus unless they're allowed to
// manage participants. A wrapper, so AdminCreator's subscriptions to every
// participant never mount for them.
function UsersPage() {
  const { isSubadmin } = useAuth();
  if (isSubadmin && !SUBADMIN_CAN_MANAGE_PARTICIPANTS) {
    return <CampusRoster />;
  }
  return <AdminCreator />;
}

function ManageParticipantsGate() {
  const { isSubadmin } = useAuth();
  if (isSubadmin && !SUBADMIN_CAN_MANAGE_PARTICIPANTS) {
    return <Navigate to="/admin/creator" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginSignup />} />
        {/* Routes with navbar */}
        <Route element={<MainLayout />}>
          <Route path="/registration" element={<RegistrationGate />} />
          <Route path="/waiting" element={<Waiting />} />
          <Route path={"/profile"} element={<Profile></Profile>}></Route>

          <Route path="/user/*" element={<ParticipantGate />}>
            <Route
              path=""
              element={<Navigate to="/user/dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <ProgramGate>
                  <UserDashboard />
                </ProgramGate>
              }
            />
            <Route path="waiting" element={<Waiting />} />
            {/* Unknown paths (e.g. the removed /user/matched) go to the dashboard */}
            <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
          </Route>

          <Route path="/admin/*" element={<AdminGate />}>
            <Route
              path=""
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route path="creator" element={<UsersPage />} />
            <Route element={<ManageParticipantsGate />}>
              <Route path="add-participant" element={<Registration />} />
            </Route>
            <Route element={<FullAdminGate />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="recap" element={<RecapPage />} />
              <Route path="main" element={<PreProgram />} />
              <Route path="rematching" element={<Rematching />} />
              <Route path="form-builder" element={<FormBuilder />} />
            </Route>
          </Route>
        </Route>

          {/* <Route path={"/user/dashboard"} element={<Dashboard></Dashboard>}></Route>
          <Route path={"/admin/dashboard"} element={<Dashboard></Dashboard>}></Route> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
