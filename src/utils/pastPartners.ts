// Past partners: who each participant was paired with in earlier cohorts.
// End Program records them on participants/{uid}.pastPartners so matching
// never pairs the same two people again.

type MatchLike = {
  participant1_id?: unknown;
  participant2_id?: unknown;
  status?: unknown;
};

/**
 * Maps each participant to the partners they were paired with in the given
 * matches. Only approved matches count: a pending suggestion never happened.
 */
export function collectPastPartners(
  matches: readonly MatchLike[],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const add = (uid: string, partner: string) => {
    let set = result.get(uid);
    if (!set) {
      set = new Set();
      result.set(uid, set);
    }
    set.add(partner);
  };

  for (const m of matches) {
    if (m.status !== "approved") continue;
    const a = m.participant1_id;
    const b = m.participant2_id;
    if (typeof a !== "string" || typeof b !== "string" || !a || !b || a === b) {
      continue;
    }
    add(a, b);
    add(b, a);
  }
  return result;
}

/** Reads a doc's pastPartners field, ignoring anything that isn't a uid list. */
export function readPastPartners(data: { pastPartners?: unknown } | undefined) {
  const raw = data?.pastPartners;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v !== "");
}

/** True if either participant lists the other as a past partner. */
export function isPastPair(
  a: string,
  b: string,
  pastPartnersById: ReadonlyMap<string, readonly string[]>,
): boolean {
  return (
    (pastPartnersById.get(a)?.includes(b) ?? false) ||
    (pastPartnersById.get(b)?.includes(a) ?? false)
  );
}
