import { useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "./PreProgram.module.css";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AutorenewIcon from "@mui/icons-material/Autorenew";

interface Match {
  name1: string;
  name2: string;
  interests: string;
  confidence?: number;
  status?: "Pending" | "Approved" | "No Match";
}

const dummyMatches: Match[] = [
  {
    name1: "Jane Doe",
    name2: "Marcus Allen",
    interests: "Knitting, Tea, Painting, Spending time with Family",
    confidence: 40,
  },
  {
    name1: "Jennifer White",
    name2: "N/A",
    interests: "Reading, Running, Painting, Watching TV shows",
  },
  {
    name1: "Holly Jackson",
    name2: "John Smith",
    interests: "Writing, Crocheting, Painting, Watching TV shows",
    confidence: 80,
  },
];

const PreProgram = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [search, setSearch] = useState("");
  const [buttonLabel, setButtonLabel] = useState<"Create match" | "Rematch">(
    "Create match"
  );

  const navigate = useNavigate();

const handleMatch = () => {
  if (buttonLabel === "Create match") {
    const order: Record<NonNullable<Match["status"]>, number> = {
      Pending: 1,
      "No Match": 2,
      Approved: 3,
    };

    const sortedMatches: Match[] = dummyMatches
      .map((m): Match => {
        let status: Match["status"] = "Pending";

        if (m.name2 === "N/A") status = "No Match";
        else if (m.confidence && m.confidence >= 80) status = "Approved";

        return { ...m, status };
      })
      .sort((a, b) => order[a.status ?? "Pending"] - order[b.status ?? "Pending"]);

    setMatches(sortedMatches);
    setButtonLabel("Rematch");
  } else {
    navigate("/admin/rematching");
  }
};


  const handleStatusChange = (index: number, newStatus: Match["status"]) => {
    const updated = [...matches];
    updated[index].status = newStatus;
    setMatches(updated);
  };

  const filteredMatches = matches.filter(
    (m) =>
      m.name1.toLowerCase().includes(search.toLowerCase()) ||
      m.name2.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.page}>
      <Navbar
        navItems={[
          { label: "Main", path: "/admin/main" },
          { label: "Dashboard", path: "/admin/dashboard" },
          { label: "Profile", path: "/admin/profile" },
        ]}
      />

      <div className={styles.header}>
        <div className={styles.searchContainer}>
          <SearchIcon className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button className={styles.adminBtn}>
            <AdminPanelSettingsIcon className={styles.icon} />
            Admin Panel
          </button>
          <button
            onClick={handleMatch}
            className={`${styles.rematchBtn} ${
              buttonLabel === "Rematch" ? styles.rematchActive : ""
            }`}
          >
            <AutorenewIcon className={styles.icon} />
            {buttonLabel}
          </button>
        </div>
      </div>

      {/* --- Match Table --- */}
      <div className={styles.container}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name 1</th>
              <th>Name 2</th>
              <th>Interests</th>
              <th>Confidence %</th>
              <th>Pair Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No matches yet.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, i) => (
                <tr key={i}>
                  <td>{m.name1}</td>
                  <td>{m.name2}</td>
                  <td>{m.interests}</td>
                  <td>{m.confidence ?? "-"}</td>
                  <td>
                    <select
                      value={m.status}
                      onChange={(e) =>
                        handleStatusChange(i, e.target.value as Match["status"])
                      }
                      className={`${styles.status} ${
                        m.status === "Approved"
                          ? styles.approved
                          : m.status === "No Match"
                          ? styles.noMatch
                          : styles.pending
                      }`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="No Match">No Match</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PreProgram;
