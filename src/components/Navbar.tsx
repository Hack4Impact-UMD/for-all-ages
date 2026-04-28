import { Link, useLocation } from "react-router-dom";
import styles from "./Components.module.css";
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

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Roadmap", path: "/admin/dashboard" },
  { label: "Matching", path: "/admin/main" },
  { label: "Users", path: "/admin/creator" },
  { label: "Stats", path: "/admin/recap" },
  { label: "Registration Form", path: "/admin/form-builder" },
  { label: "Profile", path: "/profile" },
];

const PARTICIPANT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/user/dashboard" },
  { label: "Profile", path: "/profile" },
];

const DEFAULT_NAV_ITEMS: NavItem[] = [{ label: "Login", path: "/" }];

export default function Navbar({ navItems }: NavbarProps) {
  const location = useLocation();
  const { participantLoading, isAdmin, programState, programStateLoading } =
    useAuth();

  // Automatically determine navItems based on user type if not provided
  const determinedNavItems = useMemo(() => {
    if (navItems) {
      return navItems;
    }
    if (participantLoading) {
      return DEFAULT_NAV_ITEMS;
    }

    // Return appropriate navItems based on user type
    if (isAdmin) {
      return ADMIN_NAV_ITEMS;
    }

    return PARTICIPANT_NAV_ITEMS;
  }, [navItems, participantLoading, isAdmin]);

  const adminProgramStatusText = useMemo(() => {
    if (programStateLoading) {
      return "Loading program status...";
    }
    if (!programState) {
      return "Program status unavailable";
    }

    const registrationText = programState.matches_final
      ? "Registrations Closed"
      : "Registrations Open";
    const programText = programState.started
      ? "Program Started"
      : "Program Not Started";

    return `${registrationText}, ${programText}`;
  }, [programState, programStateLoading]);

  const registrationClosed = Boolean(programState?.matches_final);
  const programStarted = Boolean(programState?.started);

  return (
    <div className={styles.bar}>
      <div className={styles.logoContainer}>
        <Link to={`/${isAdmin ? "admin":"user"}/dashboard`} className={styles.logoLink}>
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
      <div className={styles.right}>
        {isAdmin && (
          <div className={styles.adminStatusIndicator}>
            {programStateLoading || !programState ? (
              <span>{adminProgramStatusText}</span>
            ) : (
              <div className={styles.adminStatusList}>
                <div className={styles.adminStatusRow}>
                  <span
                    className={`${styles.adminStatusDot} ${registrationClosed ? styles.statusNegative : styles.statusPositive}`}
                    aria-hidden="true"
                  />
                  <span>
                    {registrationClosed
                      ? "Registration closed"
                      : "Registration open"}
                  </span>
                </div>
                <div className={styles.adminStatusRow}>
                  <span
                    className={`${styles.adminStatusDot} ${programStarted ? styles.statusPositive : styles.statusNegative}`}
                    aria-hidden="true"
                  />
                  <span>
                    {programStarted ? "Program started" : "Program not started"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
