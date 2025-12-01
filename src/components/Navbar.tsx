import { Link, useLocation } from "react-router-dom";
import styles from "./Navbar.module.css";
import Logo from "../assets/For all Ages high res logo 2022 (1).svg";
import { useAuth } from "../auth/AuthProvider";
import { useMemo } from "react";

interface NavItem {
  label: string;
  path: string;
}

interface NavbarProps {
  navItems?: NavItem[];
}

function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalised = role.toLowerCase();
  return (
    normalised === "admin" ||
    normalised === "subadmin" ||
    normalised === "sub-admin"
  );
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Roadmap", path: "/admin/dashboard" },
  { label: "Matching", path: "/admin/main" },
  { label: "Users", path: "/admin/creator" },
  { label: "Stats", path: "/admin/recap" },
  { label: "Profile", path: "/profile" },
];

const PARTICIPANT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/user/dashboard" },
  { label: "Profile", path: "/profile" },
];

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Login", path: "/" },
];

export default function Navbar({ navItems }: NavbarProps) {
  const location = useLocation();
  const { participant, participantLoading } = useAuth();

  // Automatically determine navItems based on user type if not provided
  const determinedNavItems = useMemo(() => {
    if (navItems) {
      return navItems;
    }
    if (participantLoading) {
      return DEFAULT_NAV_ITEMS;
    }

    const role = (participant as { role?: string | null } | null)?.role ?? null;
    const isAdmin = participant && isAdminRole(role);

    // Return appropriate navItems based on user type
    if (isAdmin) {
      return ADMIN_NAV_ITEMS;
    }

    return PARTICIPANT_NAV_ITEMS;
  }, [navItems, participant, participantLoading]);

  return (
    <div className={styles.bar}>
      <div className={styles.logoContainer}>
        <Link to="/" className={styles.logoLink}>
          <img src={Logo} alt="For All Ages Logo" className={styles.logo} />
        </Link>
      </div>
      <div className={styles.container}>
        {determinedNavItems.map((item) => {
          // Special case: Matching tab should be active on both /admin/main and /admin/rematching
          let isActive = location.pathname === item.path;
          if (item.label === "Matching" && item.path === "/admin/main") {
            isActive =
              location.pathname === "/admin/main" ||
              location.pathname === "/admin/rematching";
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`${styles.link} ${isActive ? styles.active : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className={styles.right}></div>
    </div>
  );
}
