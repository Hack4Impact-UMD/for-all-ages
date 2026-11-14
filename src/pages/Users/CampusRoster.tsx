import { useCallback, useEffect, useMemo, useState } from "react";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import styles from "./AdminCreator.module.css";
import { getCampusRoster, type CampusRosterEntry } from "../../firebase";
import { formatPhone } from "../../utils/phone";
import { useAuth } from "../../auth/AuthProvider";
import Button from "../../components/Button";

// Read-only list of the students at a sub-admin's own campus. The roster comes
// from a callable that returns only contact fields, so sub-admins never load
// the whole participants collection.
export default function CampusRoster() {
  const { user } = useAuth();
  const [university, setUniversity] = useState<string | null>(null);
  const [roster, setRoster] = useState<CampusRosterEntry[]>([]);
  const [matchesFinal, setMatchesFinal] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCampusRoster();
      setUniversity(result.university);
      setRoster(result.roster);
      setMatchesFinal(result.matchesFinal);
      setCurrentWeek(result.currentWeek);
    } catch (err) {
      console.error("Failed to load campus roster", err);
      setError("We couldn’t load your campus roster right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const filteredRoster = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return roster;
    return roster.filter(
      (student) =>
        student.name.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term),
    );
  }, [roster, searchTerm]);

  const handleContactAll = () => {
    if (typeof window === "undefined") return;

    const bccList = roster
      .map((student) => student.email)
      .filter(Boolean)
      .join(",");
    const ownEmail = user?.email ?? "";
    window.location.href = `mailto:${ownEmail}?bcc=${bccList}`;
  };

  const noCampus = !loading && !error && !university;

  return (
    <div className={layoutStyles.page}>
      <div className={`${layoutStyles.surface} ${styles.surfaceTight}`}>
        <h1 className={styles.pageTitle}>
          {university ? `${university} Students` : "Campus Roster"}
        </h1>

        {noCampus ? (
          <div className={`${styles.banner} ${styles.bannerError}`} role="status">
            <span>
              Your account isn’t linked to a campus yet. Ask an admin to set
              your university.
            </span>
          </div>
        ) : (
          <>
            <section className={styles.controlsPanel}>
              <div className={styles.toolbarRow}>
                <div className={styles.searchArea}>
                  <label className={styles.fieldLabel} htmlFor="roster-search">
                    Search
                  </label>
                  <input
                    id="roster-search"
                    type="search"
                    placeholder="Search by name or email…"
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>

                <div className={styles.actionGroup}>
                  <Button
                    type="Primary"
                    onClick={handleContactAll}
                    disabled={loading || roster.length === 0}
                    text={"Contact All"}
                    height={40}
                    width={150}
                    fontSize={15}
                  ></Button>
                  <Button
                    type="Primary"
                    onClick={loadRoster}
                    disabled={loading}
                    text={"Refresh"}
                    height={40}
                    width={150}
                    fontSize={15}
                  ></Button>
                </div>
              </div>
              {!loading && !error && (!matchesFinal || currentWeek === 0) ? (
                <p className={styles.fieldLabel}>
                  {!matchesFinal
                    ? "Match and call-log details appear once matches are final and the program has started."
                    : "Call-log details appear once the program has started."}
                </p>
              ) : null}
            </section>

            <section className={styles.tableSection}>
              <div className={styles.tableCard}>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col" className={styles.colName}>
                          Name
                        </th>
                        <th scope="col" className={styles.colEmail}>
                          Email
                        </th>
                        <th scope="col" className={styles.colPhone}>
                          Phone Number
                        </th>
                        <th scope="col" className={styles.colRole}>
                          Match
                        </th>
                        <th scope="col" className={styles.colGroup}>
                          Call Logs
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr className={styles.stateRow}>
                          <td colSpan={5} className={styles.stateCell}>
                            Loading campus roster…
                          </td>
                        </tr>
                      ) : error ? (
                        <tr className={styles.stateRow}>
                          <td colSpan={5} className={styles.stateCell}>
                            {error}
                          </td>
                        </tr>
                      ) : filteredRoster.length === 0 ? (
                        <tr className={styles.stateRow}>
                          <td colSpan={5} className={styles.stateCell}>
                            {roster.length === 0
                              ? "No students from your campus have registered yet."
                              : "No students match your search."}
                          </td>
                        </tr>
                      ) : (
                        filteredRoster.map((student) => (
                          <tr key={student.id}>
                            <td data-label="Name" className={styles.colName}>
                              <div>
                                <span>{student.name}</span>
                                {student.waitlisted ? (
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#d5b500",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    Waitlisted
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td data-label="Email" className={styles.colEmail}>
                              {student.email ? (
                                <a
                                  href={`mailto:${student.email}`}
                                  className={styles.emailLink}
                                >
                                  {student.email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td
                              data-label="Phone Number"
                              className={styles.colPhone}
                            >
                              {student.phoneNumber
                                ? formatPhone(student.phoneNumber)
                                : "—"}
                            </td>
                            <td data-label="Match" className={styles.colRole}>
                              {!matchesFinal
                                ? "—"
                                : student.matched
                                  ? "Matched"
                                  : "Not matched"}
                            </td>
                            <td data-label="Call Logs" className={styles.colGroup}>
                              {/* Only matched students have calls to log. */}
                              {currentWeek === 0 || !student.matched ? (
                                "—"
                              ) : (
                                <div>
                                  <span>
                                    {student.weeksLogged} of {currentWeek}{" "}
                                    {currentWeek === 1 ? "week" : "weeks"}
                                  </span>
                                  <div
                                    style={{
                                      fontSize: "0.75rem",
                                      marginTop: "0.25rem",
                                    }}
                                  >
                                    {student.lastLoggedWeek
                                      ? `Last: Week ${student.lastLoggedWeek}`
                                      : "No logs yet"}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
