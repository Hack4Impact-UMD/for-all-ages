import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { FaTrash } from "react-icons/fa";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import styles from "./AdminCreator.module.css";
import { db, deleteUser } from "../../firebase";
import {
  promoteParticipantToSubadmin,
} from "../../services/adminAccounts";
import type {
  Role,
  ParticipantDoc,
  RawAddress,
  AdminRecord,
  BannerState,
  FormResponse,
} from "../../types";
import ParticipantInfoPopup from "../Dashboard/components/ParticipantInfoPopup/ParticipantInfoPopup";
import { formatPhone } from "../../utils/phone";
import { useAuth } from "../../auth/AuthProvider";
import DropdownInput from "../Registration/Question Types/DropdownInput";
import AddUserModal from "./AddUserModal";
import Button from "../../components/Button";

type RoleFilter = "All" | Role | "Participant";
type GroupFilter = "All" | "Student" | "Adult";

function formatAddress(address?: RawAddress | null): string | null {
  if (!address) return null;
  const segments: string[] = [];
  if (address.line1) segments.push(address.line1);
  if (address.line2) segments.push(address.line2);

  const cityState = [address.city, address.state].filter(Boolean).join(", ");
  if (cityState) segments.push(cityState);

  if (address.postalCode) segments.push(address.postalCode);
  if (address.country) segments.push(address.country);

  return segments.length ? segments.join(", ") : null;
}

function normaliseRole(role?: string | null): Role | "Participant" {
  if (!role) return "Participant";
  const value = role.replace(/\s+/g, "").toLowerCase();
  if (value === "admin") return "Admin";
  if (value === "subadmin" || value === "sub-admin") return "Subadmin";
  return "Participant";
}

function normaliseUserType(user_type?: string | null): string | null {
  if (!user_type) return null;
  return user_type.charAt(0).toUpperCase() + user_type.slice(1).toLowerCase();
}

// Composes a display name for an admin from their ParticipantDoc
function composeDisplayName(doc: ParticipantDoc): string {
  const { displayName, firstName, lastName, email } = doc;
  const fallback = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (displayName?.trim()) return displayName.trim();
  if (fallback) return fallback;
  if (email?.trim()) return email.trim();
  return "Unnamed Admin";
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<AdminRecord | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminRecord | null>(null);
  const [formResponses, setFormResponses] = useState<FormResponse | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [waitlistedIds, setWaitlistedIds] = useState<Set<string>>(new Set());

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleInviteSuccess = useCallback((message: string) => {
    setBanner({ type: "success", message });
    setIsModalOpen(false);
  }, []);

  const handlePromoteSuccess = useCallback((message: string) => {
    setBanner({ type: "success", message });
    setPromoteTarget(null);
  }, []);

  const dismissBanner = useCallback(() => {
    setBanner(null);
  }, []);

  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const startSubscription = () => {
      const adminsQuery = collection(db, "participants");

      unsubscribe = onSnapshot(
        adminsQuery,
        (snapshot) => {
          const records: AdminRecord[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as ParticipantDoc;
            return {
              id: docSnap.id,
              name: composeDisplayName(data),
              role: normaliseRole(data.role),
              email: (data.email ?? "").trim(),
              phoneNumber: data.phoneNumber ?? null,
              address: formatAddress(data.address ?? null),
              user_type: normaliseUserType(data.user_type ?? null),
              university: data.university ?? null,
              userUid: data.userUid ?? null,
            };
          });

          records.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          );

          setAdmins(records);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Failed to load admin accounts", err);
          setLoading(false);
          setError("We couldn’t load admin accounts right now.");
        },
      );
    };

    startSubscription();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch waitlisted participant IDs
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "waitlist"),
      (snapshot) => {
        const waitlistedSet = new Set(snapshot.docs.map((doc) => doc.id));
        setWaitlistedIds(waitlistedSet);
      },
      (err) => {
        console.error("Failed to load waitlist", err);
      },
    );

    return () => unsubscribe();
  }, []);

  // Recomputes only when admins or searchTerm change
  const filteredAdmins = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let list = admins;
    if (roleFilter !== "All") {
      list = list.filter((user) => {
        const r = normaliseRole(user.role);
        return r === roleFilter;
      });
    }

    if (
      (roleFilter === "All" || roleFilter === "Participant") &&
      groupFilter !== "All"
    ) {
      list = list.filter((user) => {
        const user_type = normaliseUserType(user.user_type);
        const r = normaliseRole(user.role);
        return r === "Participant" && user_type === groupFilter;
      });
    }

    if (term) {
      list = list.filter((admin) => {
        return (
          admin.name.toLowerCase().includes(term) ||
          admin.email.toLowerCase().includes(term) ||
          (admin.university
            ? admin.university.toLowerCase().includes(term)
            : false)
        );
      });
    }
    return list;
  }, [admins, searchTerm, roleFilter, groupFilter]);

  useEffect(() => {
    if (roleFilter === "Admin" || roleFilter === "Subadmin") {
      setGroupFilter("All");
    }
  }, [roleFilter]);

  useEffect(() => {
    if (!selectedUser?.id) {
      setFormResponses(null);
      setFormLoading(false);
      setFormError(null);
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const q = query(
      collection(db, "FormResponse"),
      where("uid", "==", selectedUser.id),
    );

    getDocs(q)
      .then((snapshot) => {
        if (snapshot.empty) {
          setFormResponses(null);
        } else {
          const doc = snapshot.docs[0].data() as FormResponse;
          setFormResponses(doc);
        }
        setFormLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load form responses", err);
        setFormError("Could not load form responses.");
        setFormLoading(false);
      });
  }, [selectedUser]);

  const handleContactAll = () => {
    if (typeof window === "undefined") return;

    const list = admins.filter((u) => {
      const r = normaliseRole(u.role);
      return r === "Participant" || r === "Subadmin";
    });

    const emailList = list.map((u) => u.email).filter(Boolean);
    const bccList = emailList.join(",");
    const adminEmail = user?.email ?? "";
    const mailto = `mailto:${adminEmail}?bcc=${bccList}`;
    window.location.href = mailto;
  };

  const handleDeleteUser = useCallback(async (admin: AdminRecord) => {
    const confirmed = window.confirm(
      `Permanently delete ${admin.name}? They will no longer be able to log in.`,
    );

    if (!confirmed) return;
    setDeletingId(admin.id);
    setBanner(null);

    try {
      await deleteUser(admin.id);
      setBanner({ type: "success", message: "User deleted." });
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Could not delete user.";
      setBanner({ type: "error", message });
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div className={layoutStyles.page}>
      <div className={`${layoutStyles.surface} ${styles.surfaceTight}`}>
        <h1 className={styles.pageTitle}>Manage Users</h1>

        <section className={styles.controlsPanel}>
          <div className={styles.toolbarRow}>
            <div className={styles.searchArea}>
              <label className={styles.fieldLabel} htmlFor="admin-search">
                Search
              </label>
              <input
                id="admin-search"
                type="search"
                placeholder="Search by name, email, or university…"
                className={styles.searchInput}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className={styles.actionGroup}>
              <Button
                type="Primary"
                onClick={handleContactAll} 
                text={"Contact All"} 
                height={40} 
                width={150} 
                fontSize={15}              >
              </Button>

              <Button
                type="Primary"
                onClick={() => setIsModalOpen(true)} 
                text={"Add New User"} 
                height={40} 
                width={150} 
                fontSize={15}              
              >
              </Button>
            </div>
          </div>

          <div className={styles.filtersRow}>
            <div className={styles.filterField}>
              <label className={styles.fieldLabel} htmlFor="role-filter">
                Role
              </label>
              <select
                id="role-filter"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                className={styles.selectInput}
              >
                <option value="All">All</option>
                <option value="Admin">Admin</option>
                <option value="Subadmin">Subadmin</option>
                <option value="Participant">Participant</option>
              </select>
            </div>

            {(roleFilter === "All" || roleFilter === "Participant") && (
              <div className={styles.filterField}>
                <label className={styles.fieldLabel} htmlFor="group-filter">
                  Group
                </label>
                <select
                  id="group-filter"
                  value={groupFilter}
                  onChange={(e) =>
                    setGroupFilter(e.target.value as GroupFilter)
                  }
                  className={styles.selectInput}
                >
                  <option value="All">All</option>
                  <option value="Student">Student</option>
                  <option value="Adult">Adult</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {banner ? (
          <div
            className={`${styles.banner} ${
              banner.type === "success"
                ? styles.bannerSuccess
                : styles.bannerError
            }`}
            role="status"
          >
            <span>{banner.message}</span>
            <button
              type="button"
              className={styles.bannerDismiss}
              onClick={dismissBanner}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ) : null}

        <section className={styles.tableSection}>
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.colName}>
                      Name
                    </th>
                    <th scope="col" className={styles.colRole}>
                      Role
                    </th>
                    <th scope="col" className={styles.colEmail}>
                      Email
                    </th>
                    <th scope="col" className={styles.colPhone}>
                      Phone Number
                    </th>
                    <th scope="col" className={styles.colAddress}>
                      Address
                    </th>
                    <th scope="col" className={styles.colGroup}>
                      Group
                    </th>
                    <th
                      scope="col"
                      className={styles.colPromote}
                      aria-label="Promote user"
                    />
                    <th
                      scope="col"
                      className={styles.colDelete}
                      aria-label="Delete user"
                    />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={8} className={styles.stateCell}>
                        Loading admin accounts…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={8} className={styles.stateCell}>
                        {error}
                      </td>
                    </tr>
                  ) : filteredAdmins.length === 0 ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={8} className={styles.stateCell}>
                        No admins match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((admin) => (
                      <tr key={admin.id}>
                        <td data-label="Name" className={styles.colName}>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedUser(admin)}
                              aria-label={`View form response details for ${admin.name}`}
                              className={styles.nameButton}
                            >
                              {admin.name}
                            </button>
                            {waitlistedIds.has(admin.id) ? (
                              <div style={{ fontSize: "0.75rem", color: "#d5b500", marginTop: "0.25rem" }}>
                                Waitlisted
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td data-label="Role" className={styles.colRole}>
                          {admin.role === "Admin"
                            ? "Admin"
                            : admin.role === "Subadmin"
                              ? "Sub-admin"
                              : "Participant"}
                        </td>
                        <td data-label="Email" className={styles.colEmail}>
                          {admin.email ? (
                            <a
                              href={`mailto:${admin.email}`}
                              className={styles.emailLink}
                            >
                              {admin.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          data-label="Phone Number"
                          className={styles.colPhone}
                        >
                          {admin.phoneNumber ? formatPhone(admin.phoneNumber) : "—"}
                        </td>
                        <td data-label="Address" className={styles.colAddress}>
                          {admin.address || "—"}
                        </td>
                        <td data-label="Group" className={styles.colGroup}>
                          {admin.role === "Participant" && admin.user_type ? (
                            <span>{admin.user_type}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td
                          data-label="Promote"
                          className={`${styles.deleteCell} ${styles.colPromote}`}
                        >
                          {admin.role === "Participant" && !waitlistedIds.has(admin.id) ? (
                            <Button
                              type="Outline"
                              onClick={() => setPromoteTarget(admin)}
                              aria-label={`Promote ${admin.name} to Sub-admin`} 
                              text={"Promote"} 
                              height={30} 
                              width={80} 
                              fontSize={12}
                            >
                            </Button>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td
                          data-label="Delete"
                          className={`${styles.deleteCell} ${styles.colDelete}`}
                        >
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => handleDeleteUser(admin)}
                            disabled={deletingId === admin.id}
                            aria-label={`Delete ${admin.name}`}
                            title="Delete user"
                          >
                            <FaTrash aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {isModalOpen ? (
          <AddUserModal
            onClose={handleModalClose}
            onSuccess={handleInviteSuccess}
          />
        ) : null}

        {promoteTarget ? (
          <PromoteModal
            participant={promoteTarget}
            onClose={() => setPromoteTarget(null)}
            onSuccess={handlePromoteSuccess}
          />
        ) : null}

        {selectedUser ? (
          <ParticipantInfoPopup
            userName={selectedUser.name}
            onClose={() => setSelectedUser(null)}
            formResponses={formResponses}
            loading={formLoading}
            error={formError}
          />
        ) : null}
      </div>
    </div>
  );
}

type PromoteModalProps = {
  participant: AdminRecord;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

function PromoteModal({ participant, onClose, onSuccess }: PromoteModalProps) {
  const [university, setUniversity] = useState(participant.university ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleConfirm = async () => {
    if (!university.trim()) {
      setError("Please enter a university name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await promoteParticipantToSubadmin({
        participantId: participant.id,
        university: university.trim(),
      });
      onSuccess(`${participant.name} has been promoted to Sub-admin.`);
    } catch (err) {
      console.error("Failed to promote participant", err);
      setError("Could not promote this participant. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <h2 id="promote-modal-title" className={styles.modalTitle}>
            Promote to Sub-admin
          </h2>
        </header>

        <div className={styles.modalForm}>
          <p style={{ marginBottom: "1rem" }}>
            <strong>{participant.name}</strong> will be promoted to Sub-admin.
            They will keep their participant role and remain in the matching
            process.
          </p>

          <div className={styles.field}>
            <label htmlFor="promote-university">University Name</label>
            <input
              id="promote-university"
              type="text"
              className={styles.textInput}
              value={university}
              onChange={(e) => {
                setUniversity(e.target.value);
                setError(null);
              }}
              placeholder="University name"
              autoFocus
            />
          </div>

          {error ? <div className={styles.errorMessage}>{error}</div> : null}

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.submitButton}
              onClick={handleConfirm}
              disabled={submitting || !university.trim()}
            >
              {submitting ? "Promoting…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
