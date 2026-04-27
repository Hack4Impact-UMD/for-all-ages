import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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

function isParticipantRegistrationClosed(
  programState: { matches_final: boolean; started: boolean; currentParticipants: number; maxParticipants: number } | null,
): boolean {
  if (!programState) return false;
  if (programState.matches_final && !programState.started) {
    return true;
  }
  return programState.currentParticipants >= programState.maxParticipants;
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
      <div className={layoutStyles.surface}>
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
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleContactAll}
              >
                Contact All
              </button>

              <button
                type="button"
                className={styles.addButton}
                onClick={() => setIsModalOpen(true)}
              >
                Add New User
              </button>
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
                              className={styles.smallActionButton}
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

type AddAdminModalProps = {
  onClose: () => void;
  onSuccess: (message: string) => void;
};

type AddUserRole = Role | "Participant";

// State for the AddAdminModal form
type AddAdminFormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: AddUserRole;
  university: string;
  participantName: string;
};

function AddAdminModal({ onClose, onSuccess }: AddAdminModalProps) {
  const navigate = useNavigate();
  const { programState, programStateLoading } = useAuth();
  const [form, setForm] = useState<AddAdminFormState>({
    firstName: "",
    lastName: "",
    email: "",
    role: "Admin",
    university: "",
    participantName: "",
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

  const dismissExistingPrompt = useCallback(() => {
    setExistingAccountPrompt(null);
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "role") {
        const roleValue = (value as AddUserRole) ?? "Admin";
        return {
          ...prev,
          role: roleValue,
          university:
            roleValue === "Admin" || roleValue === "Participant"
              ? ""
              : prev.university,
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
  const isParticipantRole = form.role === "Participant";
  const participantCreationDisabled =
    isParticipantRole &&
    (programStateLoading || isParticipantRegistrationClosed(programState));
  const allRequiredFilled = isParticipantRole
    ? form.participantName.trim().length > 0
    : form.firstName.trim().length > 0 &&
      form.lastName.trim().length > 0 &&
      trimmedEmail.length > 0 &&
      (form.role !== "Subadmin" || form.university.trim().length > 0);
  const canSubmit =
    allRequiredFilled &&
    (isParticipantRole || emailValid) &&
    !participantCreationDisabled &&
    !submitting;

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

    if (form.role === "Participant") {
      if (participantCreationDisabled) {
        setError(programStateLoading ? "Checking program capacity…" : "Program is full.");
        return;
      }

      const name = form.participantName.trim();
      if (!name) {
        setError("Please enter the participant's name.");
        return;
      }
      navigate("/admin/add-participant", { state: { name } });
      onSuccess("Opening the registration form for this participant.");
      return;
    }

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
        role: form.role as Role,
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
        role: form.role as Role,
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

              <label className={styles.radioOption}>
                <input
                  className={styles.radioInput}
                  type="radio"
                  name="role"
                  value="Participant"
                  checked={form.role === "Participant"}
                  onChange={handleInputChange}
                />
                <span className={styles.radioContent}>
                  <span className={styles.radioVisual} aria-hidden="true" />
                  <span className={styles.radioText}>Participant</span>
                </span>
              </label>
            </div>
            {form.role === "Participant" ? (
              <p className={styles.fieldHint} style={{ color: "#475569", marginTop: "0.35rem" }}>
                Manual entry (no login). You will complete their registration form next.
              </p>
            ) : null}
          </div>

          {isParticipantRole ? (
            <div className={styles.field}>
              <label htmlFor="manual-participant-full-name">Participant name</label>
              <input
                ref={firstInputRef}
                id="manual-participant-full-name"
                name="participantName"
                type="text"
                className={styles.textInput}
                value={form.participantName}
                onChange={handleInputChange}
                placeholder="First and last name"
                required
                disabled={participantCreationDisabled}
              />
              {participantCreationDisabled ? (
                <p className={styles.fieldHint}>
                  {programStateLoading ? "Checking program capacity…" : "Program is full."}
                </p>
              ) : null}
            </div>
          ) : (
            <>
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

              {form.role === "Subadmin" ? (
                <div className={styles.field}>
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
            </>
          )}

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
