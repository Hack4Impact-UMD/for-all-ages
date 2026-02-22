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
import layoutStyles from "./Dashboard.module.css";
import styles from "./AdminCreator.module.css";
import Navbar from "../../components/Navbar";
import { db } from "../../firebase";
import {
  assignAdminRoleToExistingUser,
  inviteAdminAccount,
} from "../../services/adminAccounts";
import { friendlyAuthError } from "../../services/auth";
import type { Role, ParticipantDoc, RawAddress, AdminRecord, BannerState } from "../../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | Role | "Participant">(
    "All"
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleInviteSuccess = useCallback((message: string) => {
    setBanner({ type: "success", message });
    setIsModalOpen(false);
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
              status: data.status ?? null,
              university: data.university ?? null,
            };
          });

          // sort alphabetically by name
          records.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
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
        }
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
  }, [admins, searchTerm, roleFilter]);

  return (
    <div className={layoutStyles.page}>
      <Navbar />
      <div className={layoutStyles.surface}>
        <section className={styles.controlsRow}>
          <label className={styles.searchLabel} htmlFor="admin-search">
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

          <div className={styles.searchGroup}>
            <label className={styles.searchLabel} htmlFor="role-filter">
              Role
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className={styles.searchInput}
            >
              <option value="All">All</option>
              <option value="Admin">Admin</option>
              <option value="Subadmin">Subadmin</option>
              <option value="Participant">Participant</option>
            </select>
          </div>

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
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone Number</th>
                  <th scope="col">Address</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className={styles.stateRow}>
                    <td colSpan={6} className={styles.stateCell}>
                      Loading admin accounts…
                    </td>
                  </tr>
                ) : error ? (
                  <tr className={styles.stateRow}>
                    <td colSpan={6} className={styles.stateCell}>
                      {error}
                    </td>
                  </tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr className={styles.stateRow}>
                    <td colSpan={6} className={styles.stateCell}>
                      No admins match your search.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td data-label="Name">{admin.name}</td>
                      <td data-label="Role">
                        {admin.role === "Admin"
                          ? "Admin"
                          : admin.role === "Subadmin"
                          ? "Sub-admin"
                          : "Participant"}
                      </td>
                      <td data-label="Email">
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
                      <td data-label="Phone Number">
                        {admin.phoneNumber || "—"}
                      </td>
                      <td data-label="Address">{admin.address || "—"}</td>
                      <td data-label="Status">
                        {admin.status ? (
                          <span
                            className={
                              admin.status.toLowerCase() === "active"
                                ? styles.statusActive
                                : styles.statusDefault
                            }
                          >
                            {admin.status}
                          </span>
                        ) : (
                          <span className={styles.statusDefault}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {isModalOpen ? (
          <AddAdminModal
            onClose={handleModalClose}
            onSuccess={handleInviteSuccess}
          />
        ) : null}
      </div>
    </div>
  );
}

// ==================== AddAdminModal Component =====================

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
        query(collection(db, "participants"), where("email", "==", email))
      );

      if (snapshot.empty) {
        setExistingAccountPrompt(null);
        setError(
          "That email already has an account, but no profile was found. Ask them to sign in before assigning roles."
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
        "An account with this email already exists. Promote them to the selected role?"
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
          : "Please enter a valid email address."
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
