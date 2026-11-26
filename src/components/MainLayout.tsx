import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AdminContact from "./AdminContact";

export default function MainLayout() {
  const { user, isAdmin, isSubadmin, loading, participantLoading } = useAuth();
  const showAdminContact =
    !loading &&
    !participantLoading &&
    Boolean(user) &&
    !isAdmin &&
    !isSubadmin;

  return (
    <div>
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        zIndex: 1000,
      }}>
        <Navbar />
      </div>
      <div style={{ paddingTop: "80px"}}>
        <Outlet />
      </div>
      {showAdminContact && <AdminContact userEmail={user?.email} />}
    </div>
  )
}