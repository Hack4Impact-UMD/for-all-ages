import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
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
    </div>
  )
}