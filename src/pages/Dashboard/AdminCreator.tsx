import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { FaTrash } from "react-icons/fa";
import layoutStyles from "./Dashboard.module.css";
import styles from "./AdminCreator.module.css";
import { db, deleteUser } from "../../firebase";
import {
  assignAdminRoleToExistingUser,
  inviteAdminAccount,
  promoteParticipantToSubadmin,
} from "../../services/adminAccounts";
import { friendlyAuthError } from "../../services/auth";
import type {
  Role,
  ParticipantDoc,
  RawAddress,
  AdminRecord,
  BannerState,
  FormResponse,
} from "../../types";
import ParticipantInfoPopup from "./components/ParticipantInfoPopup/ParticipantInfoPopup";
import { formatPhone } from "../../utils/phone";
import { useAuth } from "../../auth/AuthProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type RoleFilter = "All" | Role | "Participant";
type GroupFilter = "All" | "Student" | "Adult";

// Formats a RawAddress into a single-line string suitable for display
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

// Normalises a role string to a Role type
// Cleans whatever is stored in Firestore and coerces to a strict Role
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

// Main component for the Admin Dashboard page
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

  // Build a query to get all participants whose role is Admin or Subadmin.
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    const startSubscription = () => {
      const adminsQuery = collection(db, "participants");

      // Set up real-time listener for admin accounts
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

          // sort alphabetically by name
          records.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
          );

          /**
           * On success: update state, clear error, end loading.
           * On error: set a friendly error.
           * Cleanup: when the component unmounts, call unsubscribe() to stop the live listener
           */
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

  // Resets the selected age value if Admin or Subadmin is selected
  useEffect(() => {
    if (roleFilter === "Admin" || roleFilter === "Subadmin") {
      setGroupFilter("All");
    }
  }, [roleFilter]);

  // Fetch form responses when selectedUser changes
  useEffect(() => {
    if (!selectedUser?.id) {
      setFormResponses(null);
      setFormLoading(false);
      setFormError(null);
      return;
    }

    setFormLoading(true);
    setFormError(null);

    const q = query(collection(db, "FormResponse"), where("uid", "==", selectedUser.id));
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

  // Handles the Contact All button and allows admins to contact all participants and subadmins
  const handleContactAll = () => {
    if (typeof window === "undefined") return;

    // Filters only participants and subadmins
    const list = admins.filter((u) => {
      const r = normaliseRole(u.role);
      return r === "Participant" || r === "Subadmin";
    });

    // Holds all of the emails of the new list, filtering falsy emails
    const emailList = list.map((u) => u.email).filter(Boolean);

    // Admin's email goes in "to:", participant/subadmin emails go in "bcc:"
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
      <div className={layoutStyles.surface}>
        <section className={styles.controlsRow}>
          <label className={styles.searchLabel} htmlFor="admin-search">
            Search
          </label>
          <button
            type="button"
            className={styles.contactButton}
            onClick={() => {
              handleContactAll();
            }}
          >
            Contact All
          </button>
          <input
            id="admin-search"
            type="search"
            placeholder="Search by name, email, or university…"
            className={styles.searchInput}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <div className={styles.searchGroup}>
            <label className={styles.searchLabel} htmlFor="role-filter">
              Role
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className={styles.searchInput}
            >
              <option value="All">All</option>
              <option value="Admin">Admin</option>
              <option value="Subadmin">Subadmin</option>
              <option value="Participant">Participant</option>
            </select>
          </div>
          {roleFilter === "All" || roleFilter === "Participant" ? (
            <div className={styles.searchGroup}>
              <label className={styles.searchLabel} htmlFor="group-filter">
                Group
              </label>
              <select
                id="group-filter"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}
                className={styles.searchInput}
              >
                <option value="All">All</option>
                <option value="Student">Student</option>
                <option value="Adult">Adult</option>
              </select>
            </div>
          ) : null}

          <button
            type="button"
            className={styles.addButton}
            onClick={() => setIsModalOpen(true)}
          >
            Add New Admin
          </button>
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
                    <th scope="col" className={styles.colName}>Name</th>
                    <th scope="col" className={styles.colRole}>Role</th>
                    <th scope="col" className={styles.colEmail}>Email</th>
                    <th scope="col" className={styles.colPhone}>Phone Number</th>
                    <th scope="col" className={styles.colAddress}>Address</th>
                    <th scope="col" className={styles.colGroup}>Group</th>
                    <th scope="col" className={styles.colPromote} aria-label="Promote user" />
                    <th scope="col" className={styles.colDelete} aria-label="Delete user" />
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
                          <button
                            type="button"
                            onClick={() => setSelectedUser(admin)}
                            aria-label={`View form response details for ${admin.name}`}
                            className={styles.nameButton}
                          >
                            {admin.name}
                          </button>
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
                          {admin.role === "Participant" ? (
                            <button
                              type="button"
                              className={styles.addButton}
                              style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem" }}
                              onClick={() => setPromoteTarget(admin)}
                              aria-label={`Promote ${admin.name} to Sub-admin`}
                              title="Promote to Sub-admin"
                            >
                              Promote
                            </button>
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
          <AddAdminModal
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

// ==================== PromoteModal Component =====================

type PromoteModalProps = {
  participant: AdminRecord;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

/**
 * Confirms and executes the promotion of a participant to Sub-admin.
 * All existing participant data (user_type, matches, etc.) is preserved —
 * only the `role` field is updated in Firestore.
 */
function PromoteModal({ participant, onClose, onSuccess }: PromoteModalProps) {
  const [university, setUniversity] = useState(participant.university ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
            They will keep their participant role and remain in the matching process.
          </p>

          <div className={styles.field}>
            <label htmlFor="promote-university">University Name</label>
            <input
              id="promote-university"
              type="text"
              className={styles.textInput}
              value={university}
              onChange={(e) => { setUniversity(e.target.value); setError(null); }}
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


// Props for the AddAdminModal component
type AddAdminModalProps = {
  onClose: () => void;
  onSuccess: (message: string) => void;
};

// State for the AddAdminModal form
type AddAdminFormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  university: string;
};

// Modal component for adding a new admin
function AddAdminModal({ onClose, onSuccess }: AddAdminModalProps) {
  const [form, setForm] = useState<AddAdminFormState>({
    firstName: "",
    lastName: "",
    email: "",
    role: "Admin",
    university: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingAccountPrompt, setExistingAccountPrompt] = useState<{
    participantId: string;
    email: string;
    currentRole?: Role | null;
  } | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Handle input changes for the form fields
  const dismissExistingPrompt = useCallback(() => {
    setExistingAccountPrompt(null);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "role") {
        const roleValue = (value as Role) ?? "Admin";
        return {
          ...prev,
          role: roleValue,
          university: roleValue === "Admin" ? "" : prev.university,
        };
      }
      const nextState = {
        ...prev,
        [name]: value,
      } as AddAdminFormState;
      return nextState;
    });

    if (name === "email" && existingAccountPrompt) {
      dismissExistingPrompt();
    }

    if (error) {
      setError(null);
    }
  };

  const trimmedEmail = form.email.trim();
  const emailValid = EMAIL_REGEX.test(trimmedEmail);
  const allRequiredFilled =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    trimmedEmail.length > 0 &&
    (form.role !== "Subadmin" || form.university.trim().length > 0);
  const canSubmit = allRequiredFilled && emailValid && !submitting;

  // =====TESTING===
  // should check for existing account and prepare prompt
  const prepareExistingAccountPrompt = useCallback(async (email: string) => {
    try {
      const snapshot = await getDocs(
        query(collection(db, "participants"), where("email", "==", email)),
      );

      if (snapshot.empty) {
        setExistingAccountPrompt(null);
        setError(
          "That email already has an account, but no profile was found. Ask them to sign in before assigning roles.",
        );
        return false;
      }

      const docSnap = snapshot.docs[0];
      setExistingAccountPrompt({
        participantId: docSnap.id,
        email,
        currentRole: (docSnap.data().role as Role | undefined) ?? null,
      });
      setError(
        "An account with this email already exists. Promote them to the selected role?",
      );
      return true;
    } catch (lookupError) {
      console.error("Failed to look up existing account", lookupError);
      setExistingAccountPrompt(null);
      setError("We couldn't check for an existing account. Please try again.");
      return false;
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Final validation before submission
    if (!canSubmit) {
      setError(
        emailValid
          ? "Please fill out all required fields."
          : "Please enter a valid email address.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await inviteAdminAccount({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: trimmedEmail,
        role: form.role,
        university:
          form.role === "Subadmin" ? form.university.trim() : undefined,
      });

      const displayName =
        `${form.firstName.trim()} ${form.lastName.trim()}`.replace(/\s+/g, " ");
      const successMessage = `Invitation sent to ${
        displayName || trimmedEmail
      }.`;
      onSuccess(successMessage);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/email-already-in-use") {
          const prepared = await prepareExistingAccountPrompt(trimmedEmail);
          if (prepared) {
            return;
          }
        }
        setError(friendlyAuthError(err));
      } else {
        setError("We couldn’t create that admin. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExistingAccountPromotion = async () => {
    if (!existingAccountPrompt) return;

    setSubmitting(true);
    setError(null);

    try {
      await assignAdminRoleToExistingUser({
        participantId: existingAccountPrompt.participantId,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        role: form.role,
        university:
          form.role === "Subadmin" ? form.university.trim() : undefined,
      });

      const roleLabel = form.role === "Subadmin" ? "Sub-admin" : "Admin";
      const displayName =
        `${form.firstName.trim()} ${form.lastName.trim()}`.replace(/\s+/g, " ");
      const successMessage = `Updated ${
        displayName || existingAccountPrompt.email
      } to ${roleLabel}.`;
      onSuccess(successMessage);
      setExistingAccountPrompt(null);
    } catch (promotionError) {
      console.error("Failed to update existing account", promotionError);
      setError("We couldn't update the existing account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-admin-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <h2 id="add-admin-title" className={styles.modalTitle}>
            Add New User
          </h2>
        </header>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="admin-first-name">First Name</label>
            <input
              ref={firstInputRef}
              id="admin-first-name"
              name="firstName"
              type="text"
              className={styles.textInput}
              value={form.firstName}
              onChange={handleInputChange}
              placeholder="First name"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-last-name">Last Name</label>
            <input
              id="admin-last-name"
              name="lastName"
              type="text"
              className={styles.textInput}
              value={form.lastName}
              onChange={handleInputChange}
              placeholder="Last name"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              className={styles.textInput}
              value={form.email}
              onChange={handleInputChange}
              placeholder="name@example.com"
              required
            />
            {!emailValid && trimmedEmail.length > 0 ? (
              <p className={styles.fieldHint}>Enter a valid email address.</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <span className={styles.radioLabel}>Role</span>
            <div className={styles.radioGroup}>
              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Admin"
                  checked={form.role === "Admin"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Admin</span>
                </span>
              </label>

              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Subadmin"
                  checked={form.role === "Subadmin"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Sub-admin</span>
                </span>
              </label>
            </div>

            {form.role === "Subadmin" ? (
              <div className={styles.subField}>
                <label htmlFor="admin-university">University Name</label>
                <input
                  id="admin-university"
                  name="university"
                  type="text"
                  className={styles.textInput}
                  value={form.university}
                  onChange={handleInputChange}
                  placeholder="University name"
                  required
                />
              </div>
            ) : null}
          </div>

          {error ? <div className={styles.errorMessage}>{error}</div> : null}

          {existingAccountPrompt ? (
            <div className={styles.existingPrompt}>
              <p className={styles.existingPromptText}>
                <strong>{existingAccountPrompt.email}</strong>{" "}
                {existingAccountPrompt.currentRole
                  ? `is currently set as ${existingAccountPrompt.currentRole}.`
                  : "already has an account."}
              </p>
              <p className={styles.existingPromptText}>
                Promote them to{" "}
                <strong>
                  {form.role === "Subadmin" ? "Sub-admin" : "Admin"}
                </strong>
                ?
              </p>
              <div className={styles.existingPromptActions}>
                <button
                  type="button"
                  className={styles.promptCancel}
                  onClick={() => {
                    dismissExistingPrompt();
                    setError(null);
                  }}
                  disabled={submitting}
                >
                  No, keep current role
                </button>
                <button
                  type="button"
                  className={styles.promptConfirm}
                  onClick={handleExistingAccountPromotion}
                  disabled={submitting}
                >
                  {submitting ? "Updating…" : "Yes, update"}
                </button>
              </div>
            </div>
          ) : null}

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
              type="submit"
              className={styles.submitButton}
              disabled={!canSubmit}
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
