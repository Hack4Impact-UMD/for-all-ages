import { Link, useLocation } from "react-router-dom";
import styles from "./Components.module.css";
import Logo from "../assets/For all Ages high res logo 2022 (1).svg";
import { useAuth } from "../auth/AuthProvider";
import { useMemo } from "react";
import { SUBADMIN_CAN_MANAGE_PARTICIPANTS } from "../utils/roles";

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
  const {
    participant,
    participantLoading,
    isAdmin,
    programState,
    programStateLoading,
    isSubadmin,
  } = useAuth();
  const registered = participant?.type === "Participant";
  const participantOptIn = participant?.participantOptIn === true;

  // Automatically determine navItems based on user type if not provided
  const determinedNavItems = useMemo(() => {
    if (navItems) {
      return navItems;
    }
    if (participantLoading) {
      return DEFAULT_NAV_ITEMS;
    }

    // Return appropriate navItems based on user type
    // Sub-admins can also be participants, so their links depend on whether
    // they've registered.
    if (isSubadmin) {
      const items: NavItem[] = [];
      if (registered) {
        items.push({ label: "Dashboard", path: "/user/dashboard" });
      } else if (participantOptIn) {
        items.push({ label: "Register", path: "/registration" });
      }
      items.push({
        label: SUBADMIN_CAN_MANAGE_PARTICIPANTS ? "Users" : "Roster",
        path: "/admin/creator",
      });
      items.push({ label: "Profile", path: "/profile" });
      return items;
    }

    if (isAdmin) {
      return ADMIN_NAV_ITEMS;
    }

    return PARTICIPANT_NAV_ITEMS;
  }, [navItems, participantLoading, isAdmin, isSubadmin, registered, participantOptIn]);

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

  // The registration form is only editable during the "edit period" —
  // after End Program and before End Registration.
  const registrationFormEditable = Boolean(
    programState && !programState.started && !programState.accepting_registrations,
  );

  const logoPath = isSubadmin
    ? registered
      ? "/user/dashboard"
      : "/admin/creator"
    : `/${isAdmin ? "admin" : "user"}/dashboard`;

  return (
    <div className={styles.bar}>
      <div className={styles.logoContainer}>
        <Link to={logoPath} className={styles.logoLink}>
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

          const isRegistrationForm = item.path === "/admin/form-builder";
          const locked =
            isRegistrationForm && isAdmin && !registrationFormEditable;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`${styles.link} ${isActive ? styles.active : ""} ${locked ? styles.linkLocked : ""}`}
              title={locked ? "Locked outside the registration edit period" : undefined}
            >
              {item.label}
              {locked && (
                <span aria-hidden="true" className={styles.linkLockIcon}>
                  {" "}
                  🔒
                </span>
              )}
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
