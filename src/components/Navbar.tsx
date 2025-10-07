import { Link, useLocation } from "react-router-dom";
import styles from "./Navbar.module.css";

interface NavItem {
  label: string;
  path: string;
}

interface NavbarProps {
  navItems?: NavItem[];
}

export default function Navbar({ navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Calendar", path: "/calendar" },
    { label: "Settings", path: "/settings" },
  ] }: NavbarProps) {
  const location = useLocation();

  return (
    <div className={styles.bar}>
      <div>
        
      </div>
      <div className={styles.container}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

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
    </div>
  );
}
