// Trimmed with internal whitespace collapsed, so a stray double space in the
// form builder doesn't make an option unmatchable. functions/src/roleChange.ts
// has the server copy; keep the two identical.
export function normalizeUniversityName(name: unknown): string {
  return typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
}
