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
import { assignUserType, changeUserRole, db, deleteUser } from "../../firebase";
import { FirebaseError } from "firebase/app";
import { setSubadminParticipantOptIn } from "../../services/adminAccounts";
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
import { bccMailto } from "../../utils/mailto";
import AddUserModal from "./AddUserModal";
import Button from "../../components/Button";
import { getUniversityOptions } from "../Registration/helpers";

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

type AssignableRole = Role | "Participant";

const ROLE_LABELS: Record<AssignableRole, string> = {
  Admin: "Admin",
  Subadmin: "Sub-admin",
  Participant: "Participant",
};

// The function's own messages are written for admins; show them as they are.
const SHOWN_FUNCTION_ERRORS = new Set([
  "functions/invalid-argument",
  "functions/failed-precondition",
  "functions/permission-denied",
  "functions/not-found",
]);

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
  const { user, isSubadmin, programState } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [optInId, setOptInId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<{
    admin: AdminRecord;
    newRole: AssignableRole;
  } | null>(null);
  // Roles just changed, kept disabled until the snapshot shows the new value.
  const [pendingRoles, setPendingRoles] = useState<Record<string, AssignableRole>>({});
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

  const handleRoleChangeSuccess = useCallback(
    (message: string, id: string, role: AssignableRole, changed: boolean) => {
      setBanner({ type: "success", message });
      setRoleTarget(null);
      // Nothing was written when the role already matched, so no snapshot is
      // coming to confirm it.
      if (changed) setPendingRoles((prev) => ({ ...prev, [id]: role }));
    },
    [],
  );

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
              registered: data.type === "Participant",
              participantOptIn: data.participantOptIn === true,
              userUid: data.userUid ?? null,
              hasAuthAccount: data.hasAuthAccount,
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

  // Clear a pending role once the snapshot has caught up with it. Also runs
  // when a role becomes pending, since the snapshot may have arrived first.
  useEffect(() => {
    setPendingRoles((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const next = { ...prev };
      for (const id of ids) {
        const current = admins.find((a) => a.id === id);
        if (!current || current.role === prev[id]) delete next[id];
      }
      return Object.keys(next).length === ids.length ? prev : next;
    });
  }, [admins, pendingRoles]);

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

    // Sub-admins can be registered participants too, so match on group alone.
    if (roleFilter !== "Admin" && groupFilter !== "All") {
      list = list.filter(
        (user) => normaliseUserType(user.user_type) === groupFilter,
      );
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
    if (roleFilter === "Admin") {
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

    window.location.href = bccMailto(
      user?.email ?? "",
      list.map((u) => u.email),
    );
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

  // Participants aged 36-54 (or with no date of birth) register without a
  // group; an admin places them so they can be matched.
  const handlePlaceUser = useCallback(
    async (admin: AdminRecord, userType: "student" | "adult") => {
      const label = userType === "student" ? "a student" : "an older adult";
      if (!window.confirm(`Place ${admin.name} in matching as ${label}?`)) {
        return;
      }
      setPlacingId(admin.id);
      setBanner(null);

      try {
        await assignUserType(admin.id, userType);
        setBanner({ type: "success", message: `${admin.name} placed as ${label}.` });
      } catch (err) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Could not place user.";
        setBanner({ type: "error", message });
      } finally {
        setPlacingId(null);
      }
    },
    [],
  );

  const handleSetOptIn = useCallback(
    async (admin: AdminRecord, enabled: boolean) => {
      setOptInId(admin.id);
      setBanner(null);

      try {
        await setSubadminParticipantOptIn(admin.id, enabled);
        setBanner({
          type: "success",
          message: enabled
            ? `${admin.name} can now register as a participant.`
            : `${admin.name} will no longer be asked to register.`,
        });
      } catch (err) {
        console.error("Failed to update participant opt-in", err);
        setBanner({
          type: "error",
          message: "Could not update this sub-admin. Please try again.",
        });
      } finally {
        setOptInId(null);
      }
    },
    [],
  );

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
                fontSize={15}
              ></Button>

              {/* Sub-admins must never invite admins or change roles. */}
              {!isSubadmin ? (
                <Button
                  type="Primary"
                  onClick={() => setIsModalOpen(true)}
                  text={"Add New User"}
                  height={40}
                  width={150}
                  fontSize={15}
                ></Button>
              ) : null}
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

            {roleFilter !== "Admin" && (
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
                      className={styles.colDelete}
                      aria-label="Delete user"
                    />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={7} className={styles.stateCell}>
                        Loading admin accounts…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={7} className={styles.stateCell}>
                        {error}
                      </td>
                    </tr>
                  ) : filteredAdmins.length === 0 ? (
                    <tr className={styles.stateRow}>
                      <td colSpan={7} className={styles.stateCell}>
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
                        <td data-label="Role" className={styles.colRole}>
                          {!isSubadmin &&
                          admin.id !== user?.uid &&
                          !waitlistedIds.has(admin.id) ? (
                            <>
                              <select
                                className={`${styles.selectInput} ${styles.roleSelect}`}
                                value={admin.role}
                                disabled={pendingRoles[admin.id] !== undefined}
                                onChange={(e) =>
                                  setRoleTarget({
                                    admin,
                                    newRole: e.target.value as AssignableRole,
                                  })
                                }
                                aria-label={`Change role for ${admin.name}`}
                              >
                                <option
                                  value="Admin"
                                  disabled={
                                    admin.role === "Admin" ||
                                    admin.hasAuthAccount === false
                                  }
                                >
                                  Admin
                                </option>
                                <option
                                  value="Subadmin"
                                  disabled={
                                    admin.role === "Subadmin" ||
                                    admin.hasAuthAccount === false
                                  }
                                >
                                  Sub-admin
                                </option>
                                <option
                                  value="Participant"
                                  disabled={admin.role === "Participant"}
                                >
                                  Participant
                                </option>
                              </select>
                              {pendingRoles[admin.id] !== undefined ? (
                                <div className={styles.roleNote}>Updating…</div>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {ROLE_LABELS[admin.role]}
                              {admin.id === user?.uid ? " (you)" : ""}
                            </>
                          )}
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
                          {admin.phoneNumber
                            ? formatPhone(admin.phoneNumber)
                            : "—"}
                        </td>
                        <td data-label="Address" className={styles.colAddress}>
                          {admin.address || "—"}
                        </td>
                        <td data-label="Group" className={styles.colGroup}>
                          {admin.registered && admin.user_type ? (
                            <span>{admin.user_type}</span>
                          ) : admin.registered ? (
                            <select
                              value=""
                              disabled={placingId === admin.id}
                              onChange={(e) =>
                                handlePlaceUser(
                                  admin,
                                  e.target.value as "student" | "adult",
                                )
                              }
                              aria-label={`Place ${admin.name} in a group`}
                            >
                              <option value="" disabled>
                                Place as…
                              </option>
                              <option value="student">Student</option>
                              <option value="adult">Older Adult</option>
                            </select>
                          ) : admin.role === "Participant" ? (
                            // Placement needs a finished registration.
                            <span>Registration incomplete</span>
                          ) : admin.role === "Subadmin" ? (
                            <div>
                              <span>
                                {admin.participantOptIn
                                  ? "Invited to register"
                                  : "Not participating"}
                              </span>
                              {!isSubadmin ? (
                                <div style={{ marginTop: "0.25rem" }}>
                                  <Button
                                    type="Outline"
                                    disabled={optInId === admin.id}
                                    onClick={() =>
                                      handleSetOptIn(admin, !admin.participantOptIn)
                                    }
                                    text={admin.participantOptIn ? "Undo" : "Allow"}
                                    height={26}
                                    width={64}
                                    fontSize={11}
                                  ></Button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td
                          data-label="Delete"
                          className={`${styles.deleteCell} ${styles.colDelete}`}
                        >
                          {/* Sub-admins can't delete admin or sub-admin accounts */}
                          {isSubadmin && admin.role !== "Participant" ? (
                            <span>—</span>
                          ) : (
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

        {isModalOpen ? (
          <AddUserModal
            onClose={handleModalClose}
            onSuccess={handleInviteSuccess}
          />
        ) : null}

        {roleTarget ? (
          <ChangeRoleModal
            participant={roleTarget.admin}
            newRole={roleTarget.newRole}
            signupsClosed={programState?.matches_final === true}
            onClose={() => setRoleTarget(null)}
            onSuccess={handleRoleChangeSuccess}
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

type ChangeRoleModalProps = {
  participant: AdminRecord;
  newRole: AssignableRole;
  signupsClosed: boolean;
  onClose: () => void;
  onSuccess: (
    message: string,
    id: string,
    role: AssignableRole,
    changed: boolean,
  ) => void;
};

// Warnings that apply to this particular change; the server does the real
// enforcement (see changeUserRole in functions/src/index.ts).
function roleChangeWarnings(
  participant: AdminRecord,
  newRole: AssignableRole,
  signupsClosed: boolean,
): string[] {
  const warnings: string[] = [];
  const registered = participant.registered === true;
  if (newRole === "Admin" && registered) {
    warnings.push(
      "They remain eligible for matching, but will no longer have access to the participant dashboard.",
    );
  }
  if (newRole === "Admin" && participant.role === "Subadmin" && !registered) {
    warnings.push(
      "If they started registering, their unused participant spot will be released.",
    );
  }
  if (newRole === "Participant") {
    warnings.push("They will lose admin access.");
    if (!registered) {
      warnings.push(
        signupsClosed
          ? "They will need to register to participate, and cannot complete registration until signups reopen."
          : "They will need to register to participate.",
      );
    }
  }
  return warnings;
}

function ChangeRoleModal({
  participant,
  newRole,
  signupsClosed,
  onClose,
  onSuccess,
}: ChangeRoleModalProps) {
  const needsUniversity = newRole === "Subadmin";
  const [universityOptions, setUniversityOptions] = useState<string[]>([]);
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

  useEffect(() => {
    if (!needsUniversity) return;
    let cancelled = false;
    getUniversityOptions().then((options) => {
      if (cancelled) return;
      setUniversityOptions(options);
      if (options.length === 0) {
        setError(
          "Must have at least one college option before adding a Sub-admin.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [needsUniversity]);

  const handleConfirm = async () => {
    if (needsUniversity && !university.trim()) {
      setError("Please select a university.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (needsUniversity) {
        // The list may have changed since this opened; the server checks too.
        const live = await getUniversityOptions();
        if (!live.includes(university)) {
          setUniversityOptions(live);
          setUniversity("");
          setError(
            live.length > 0
              ? "The college you selected is no longer supported. Please select a new option."
              : "The college you selected is no longer supported.\nMust have at least one college option before adding a Sub-admin.",
          );
          return;
        }
      }
      const result = (await changeUserRole(
        participant.id,
        newRole,
        needsUniversity ? university.trim() : undefined,
      )) as { changed?: boolean } | undefined;
      onSuccess(
        `${participant.name} is now ${ROLE_LABELS[newRole] === "Admin" ? "an Admin" : `a ${ROLE_LABELS[newRole]}`}.`,
        participant.id,
        newRole,
        result?.changed !== false,
      );
    } catch (err) {
      console.error("Failed to change role", err);
      setError(
        err instanceof FirebaseError && SHOWN_FUNCTION_ERRORS.has(err.code)
          ? err.message
          : "Could not change this role. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const warnings = roleChangeWarnings(participant, newRole, signupsClosed);

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
        aria-labelledby="change-role-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.modalHeader}>
          <h2 id="change-role-modal-title" className={styles.modalTitle}>
            Change role
          </h2>
        </header>

        <div className={styles.modalForm}>
          <p style={{ marginBottom: "1rem" }}>
            <strong>{participant.name}</strong> will change from{" "}
            {ROLE_LABELS[participant.role]} to {ROLE_LABELS[newRole]}. Their
            participant data, registration and matches are kept.
          </p>

          {warnings.length > 0 ? (
            <ul className={styles.warningList}>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {needsUniversity ? (
            <select
              name="Uni"
              value={university}
              onChange={(event) => {
                setUniversity(event.target.value);
                setError(null);
              }}
              aria-label="University"
            >
              <option value="">Select an option</option>
              {universityOptions.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          ) : null}

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
              disabled={submitting || (needsUniversity && !university.trim())}
            >
              {submitting ? "Updating…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
