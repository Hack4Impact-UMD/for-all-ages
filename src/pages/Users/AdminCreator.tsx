import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { FaPen, FaTrash } from "react-icons/fa";
import layoutStyles from "../Dashboard/Dashboard.module.css";
import styles from "./AdminCreator.module.css";
import {
  assignUserType,
  changeUserRole,
  db,
  deleteUser,
  setSubadminParticipantOptIn,
} from "../../firebase";
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
import { toAssignableRole, type AssignableRole } from "../../utils/roles";
import { roleChangeError } from "../../utils/firebaseErrors";
import { FirebaseError } from "firebase/app";
import { signupsClosed } from "../../utils/programState";
import { normalizeUniversityName } from "../../utils/university";

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

const ROLE_LABELS: Record<AssignableRole, string> = {
  Admin: "Admin",
  Subadmin: "Sub-admin",
  Participant: "Participant",
};

const isInvalidArgument = (err: unknown) =>
  err instanceof FirebaseError && err.code === "functions/invalid-argument";

// The roles this user can be moved to: not the one they have, and no admin
// roles for manual-entry users, who have no login.
function assignableRoleOptions(admin: AdminRecord): AssignableRole[] {
  return (["Admin", "Subadmin", "Participant"] as const).filter(
    (role) =>
      role !== admin.role &&
      !(role !== "Participant" && admin.hasAuthAccount === false),
  );
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
  const [roleTarget, setRoleTarget] = useState<AdminRecord | null>(null);
  // Roles just changed, kept disabled until the snapshot moves off `from`
  // (to our new role, or to whatever another admin set meanwhile).
  const [pendingRoles, setPendingRoles] = useState<
    Record<string, { role: AssignableRole; from: AssignableRole }>
  >({});
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
    (
      message: string,
      id: string,
      role: AssignableRole,
      from: AssignableRole,
      changed: boolean,
    ) => {
      setBanner({ type: "success", message });
      setRoleTarget(null);
      // Nothing was written when the role already matched, so no snapshot is
      // coming to confirm it.
      if (changed) setPendingRoles((prev) => ({ ...prev, [id]: { role, from } }));
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
              role: toAssignableRole(data.role),
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

  // Clear a pending role once the snapshot shows anything but the old role: our
  // new one, or another admin's change that landed first. A snapshot that
  // still shows the old role is a premature update, so it stays pending. Also
  // runs when a role becomes pending, since the snapshot may have arrived first.
  useEffect(() => {
    setPendingRoles((prev) => {
      const ids = Object.keys(prev);
      if (ids.length === 0) return prev;
      const next = { ...prev };
      for (const id of ids) {
        const current = admins.find((a) => a.id === id);
        if (!current || current.role !== prev[id].from) delete next[id];
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
        const r = toAssignableRole(user.role);
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
      const r = toAssignableRole(u.role);
      return r === "Participant" || r === "Subadmin";
    });

    window.location.href = bccMailto(
      user?.email ?? "",
      list.map((u) => u.email),
    );
  };

  // Sub-admins never change roles, and the server refuses your own role and
  // waitlisted users. Manual-entry users can't become admins, so with their
  // current role already taken there's nothing left to pick.
  const canEditRole = (admin: AdminRecord) =>
    !isSubadmin &&
    admin.id !== user?.uid &&
    !waitlistedIds.has(admin.id) &&
    assignableRoleOptions(admin).length > 0;

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
          message: roleChangeError(err, "Could not update this sub-admin. Please try again."),
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
                          {ROLE_LABELS[admin.role]}
                          {admin.id === user?.uid ? " (you)" : ""}
                          {pendingRoles[admin.id] !== undefined ? (
                            <div className={styles.roleNote}>Updating…</div>
                          ) : null}
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
                            <div className={styles.rowActions}>
                              {canEditRole(admin) ? (
                                <button
                                  type="button"
                                  className={styles.editButton}
                                  onClick={() => setRoleTarget(admin)}
                                  disabled={pendingRoles[admin.id] !== undefined}
                                  aria-label={`Change role for ${admin.name}`}
                                  title="Change role"
                                >
                                  <FaPen aria-hidden />
                                </button>
                              ) : null}
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

        {isModalOpen ? (
          <AddUserModal
            onClose={handleModalClose}
            onSuccess={handleInviteSuccess}
          />
        ) : null}

        {roleTarget ? (
          <ChangeRoleModal
            participant={roleTarget}
            signupsClosed={signupsClosed(programState)}
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
  signupsClosed: boolean;
  onClose: () => void;
  onSuccess: (
    message: string,
    id: string,
    role: AssignableRole,
    from: AssignableRole,
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
  if (newRole === "Admin" && !registered) {
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
  signupsClosed,
  onClose,
  onSuccess,
}: ChangeRoleModalProps) {
  const [newRole, setNewRole] = useState<AssignableRole | "">("");
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
    if (!newRole) return;
    if (needsUniversity && !university.trim()) {
      setError("Please select a university.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // The server checks the university against the current options.
      const result = await changeUserRole(
        participant.id,
        newRole,
        needsUniversity ? normalizeUniversityName(university) : undefined,
      );
      onSuccess(
        `${participant.name} is now ${newRole === "Admin" ? "an Admin" : `a ${ROLE_LABELS[newRole]}`}.`,
        participant.id,
        newRole,
        participant.role,
        result?.changed !== false,
      );
    } catch (err) {
      console.error("Failed to change role", err);
      setError(
        roleChangeError(err, "Could not change this role. Please try again."),
      );
      if (needsUniversity && isInvalidArgument(err)) {
        // The list may have changed since this opened. Only a successful,
        // non-empty fetch can replace the options or invalidate the selection.
        const live = await getUniversityOptions();
        if (live.length > 0) {
          setUniversityOptions(live);
          const wanted = normalizeUniversityName(university);
          if (!live.some((o) => normalizeUniversityName(o) === wanted)) {
            setUniversity("");
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const warnings = newRole
    ? roleChangeWarnings(participant, newRole, signupsClosed)
    : [];

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
            <strong>{participant.name}</strong> is currently{" "}
            {ROLE_LABELS[participant.role]}. Their participant data,
            registration and matches are kept when their role changes.
          </p>

          <select
            value={newRole}
            onChange={(event) => {
              setNewRole(event.target.value as AssignableRole | "");
              setError(null);
            }}
            aria-label="New role"
          >
            <option value="">Select a role</option>
            {assignableRoleOptions(participant).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

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
              disabled={submitting || !newRole || (needsUniversity && !university.trim())}
            >
              {submitting ? "Updating…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
