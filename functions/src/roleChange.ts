import { normalizeRole } from "./roles";

export type AssignableRole = "Admin" | "Subadmin" | "Participant";

export const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "Admin",
  "Subadmin",
  "Participant",
];

/** The role a stored `role` value stands for ("" or anything unknown is a Participant). */
export function currentAssignableRole(role: unknown): AssignableRole {
  const normalized = normalizeRole(role);
  if (normalized === "admin") return "Admin";
  if (normalized === "subadmin" || normalized === "sub-admin") return "Subadmin";
  return "Participant";
}

export type RoleChangePlan = {
  role: AssignableRole;
  /** null means delete the field. */
  university: string | null;
  /** null means delete the field. */
  participantOptIn: boolean | null;
  /** Delete the stale capacityDecision left by a registration that never finished. */
  clearCapacityDecision: boolean;
  /** That decision had counted them, so give the slot back to currentParticipants. */
  releaseCountedSlot: boolean;
};

// Role changes write only `role`, `university` and `participantOptIn`, plus the
// capacity clean-up below. Never `type`, `user_type`, `school` or `status`:
// those record whether and how someone registered, independent of their role.
export function planRoleChange(params: {
  to: AssignableRole;
  university?: string;
  target: Record<string, unknown>;
}): RoleChangePlan {
  const { to, target } = params;
  const from = currentAssignableRole(target.role);
  const registered = target.type === "Participant";

  if (to === "Subadmin") {
    return {
      role: to,
      university: params.university ?? null,
      // A participant keeps taking part when promoted; an admin only does once
      // they've registered.
      participantOptIn: from === "Participant" || registered,
      clearCapacityDecision: false,
      releaseCountedSlot: false,
    };
  }

  // A sub-admin who started registering and never finished may still hold a
  // spot (or a waitlist decision). As an Admin they won't finish, so release it,
  // as opting them out of participating does. As a Participant they will, and
  // registration reuses the existing decision.
  const unfinished = from === "Subadmin" && to === "Admin" && !registered;
  const decision = target.capacityDecision;
  return {
    role: to,
    university: null,
    participantOptIn: null,
    clearCapacityDecision:
      unfinished && (decision === "counted" || decision === "waitlisted"),
    releaseCountedSlot: unfinished && decision === "counted",
  };
}
