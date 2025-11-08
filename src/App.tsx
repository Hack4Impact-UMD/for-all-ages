import "./App.css";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import UserDashboard from "./pages/Dashboard/UserDashboard";
import AdminDashboard from "./pages/Dashboard/AdminDashboard";
import AdminCreator from "./pages/Dashboard/AdminCreator";
import LoginSignup from "./pages/Login/Login-Signup";
import Registration from "./pages/Registration/Registration";
import Profile from './pages/Profile/Profile'
import RecapPage from './pages/Recap/RecapPage'

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

          <Route path={"/"} element={<LoginSignup></LoginSignup>}></Route>
          <Route path={"/registration"} element={<Registration></Registration>}></Route>
          <Route path={"/profile"} element={<Profile></Profile>}></Route>

          <Route path="/user/*" element={<ParticipantGate />}>
            <Route path="" element={<Navigate to="/user/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboard />} />
          </Route>

          <Route path="/admin/*">
            <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="recap" element={<RecapPage />} />
            <Route path="creator" element={<AdminCreator />} />
          </Route>

          {/* <Route path={"/user/dashboard"} element={<Dashboard></Dashboard>}></Route>
          <Route path={"/admin/dashboard"} element={<Dashboard></Dashboard>}></Route> */}
        </Routes>
      </BrowserRouter>
  )
}

export default App;
