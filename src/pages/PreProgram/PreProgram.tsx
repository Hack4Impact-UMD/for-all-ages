import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import styles from "./PreProgram.module.css";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { db, getUser, matchAll } from "../../firebase";
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

interface BackendMatch {
  studentId: string;
  seniorId: string;
  scores: {
    frqScore: number;
    quantScore: number;
    finalScore: number;
  };
  confidence: string;
  rank: number;
}

interface UI_Match {
  name1: string;
  name2: string;
  participant1_id: string
  participant2_id: string
  confidence?: number;
  status?: string;
  score: number;
}

const PreProgram = () => {
  const [matches, setMatches] = useState<UI_Match[]>([]);
  const [search, setSearch] = useState("");
  const [buttonLabel, setButtonLabel] = useState<"Create match" | "Rematch">(
    "Create match"
  );

  const navigate = useNavigate();

  //load matches
  useEffect(() => {
    loadMatches();
  }, []);


  const convertMatches = async (raw: BackendMatch[]): Promise<UI_Match[]> => {
    const matches = await Promise.all(
      raw.map(async (m) => {
        const u1 = await getUser(m.studentId);
        const u2 = await getUser(m.seniorId);

        return {
          name1: u1.displayName,
          name2: u2.displayName,
          participant1_id: u1.userUid,
          participant2_id: u2.userUid,
          confidence: Math.round(m.scores.finalScore * 100),
          status:
            m.seniorId === "N/A"
              ? "No Match"
              : m.scores.finalScore >= 0.8
              ? "Approved"
              : "Pending",
          score: m.scores.finalScore,
        };
      })
    );

    return matches;
  };

  const loadMatches = async () => {
    const colRef = collection(db, "matches-test");
    const snap = await getDocs(colRef);

    if (snap.empty) {
      setMatches([]);
      return;
    }

    const loaded: UI_Match[] = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data();

        const u1 = await getUser(data.participant1_id);
        const u2 = await getUser(data.participant2_id);

        return {
          name1: u1.displayName,
          name2: u2.displayName,
          participant1_id: data.participant1_id,
          participant2_id: data.participant2_id,
          confidence: data.similarity,
          status:
            data.similarity >= 80
              ? "Approved"
              : data.similarity > 0
              ? "Pending"
              : "No Match",
          score: data.similarity / 100,
        };
      })
    );

    // sort like your other logic
    const sorted = loaded.sort((a, b) => {
      const order = { Pending: 1, "No Match": 2, Approved: 3 };
      return order[a.status!] - order[b.status!];
    });

    setMatches(sorted);
  };


  const storeMatches = async (matches: UI_Match[]) => {
    const colRef = collection(db, "matches-test");

    //delete all matches
    const existingDocs = await getDocs(colRef);
    const deleteBatch = writeBatch(db);

    existingDocs.forEach((d) => {
      deleteBatch.delete(d.ref);
    });

    await deleteBatch.commit();

    const writeBatchRef = writeBatch(db);

    matches.forEach((m) => {
      const newDoc = doc(colRef); 
      writeBatchRef.set(newDoc, {
        day_of_call: 0,
        participant1_id: m.participant1_id,
        participant2_id: m.participant2_id,
        similarity: m.confidence
      });
    });

    await writeBatchRef.commit();

    console.log("Matches stored successfully.");
  };


  const handleMatch = async () => {
    if (buttonLabel === "Create match") {
      const res = await matchAll(); 
      const converted = await convertMatches(res.result.matches);
      storeMatches(converted)
      //sort
      const sorted = converted.sort((a, b) => {
        const order = { Pending: 1, "No Match": 2, Approved: 3 };
        return order[a.status!] - order[b.status!];
      });

      setMatches(sorted);
      setButtonLabel("Rematch");
    } else {
      navigate("/admin/rematching");
    }
  };

  const handleStatusChange = (index: number, newStatus: UI_Match["status"]) => {
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
          { label: "Admins", path: "/admin/creator" },
          { label: "Dashboard", path: "/admin/dashboard" },
          { label: "Matching", path: "/admin/rematching" },
          { label: "Recap", path: "/admin/recap" },
          { label: "Profile", path: "/profile" },
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
              <th>Student</th>
              <th>Senior</th>
              <th>Final Score %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatches.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No matches yet.
                </td>
              </tr>
            ) : (
              filteredMatches.map((m, i) => (
                <tr key={i}>
                  <td>{m.name1}</td>
                  <td>{m.name2}</td>
                  <td>{`${m.confidence}%`}</td>
                  <td>
                    <select
                      value={m.status}
                      onChange={(e) =>
                        handleStatusChange(
                          i,
                          e.target.value as UI_Match["status"]
                        )
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
