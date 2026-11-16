// Builds a mailto link addressed to the sender with everyone else in BCC.
// Addresses are encoded so characters like "+" or "&" survive.
export function bccMailto(to: string, bcc: string[]): string {
  const list = bcc.filter(Boolean).map(encodeURIComponent).join(",");
  return `mailto:${encodeURIComponent(to)}?bcc=${list}`;
}
