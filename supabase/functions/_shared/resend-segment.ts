// The Resend segment the dispatch is sent to.
//
// Resend broadcasts go to a segment, never to "all contacts", and a contact
// created with POST /contacts belongs to no segment. Until 2026-11-10 the
// confirm flow only created the contact, so the subscribers who confirmed
// before then are contacts outside the segment, and a broadcast to it would
// miss them.
//
// Two places keep the segment whole:
//   - newsletter-confirm adds each new subscriber, best effort: a failure
//     there never blocks a confirmation.
//   - newsletter-dispatch, just before a send, adds every confirmed
//     subscriber who is missing (fillNewsletterSegment). That is the
//     guarantee: whoever is confirmed in newsletter_subscribers at send time
//     is in the segment, the early subscribers included.
// Neither ever creates a contact or touches its "unsubscribed" flag, so
// nobody who unsubscribed on Resend's side is signed up again.
//
// NEWSLETTER_SEGMENT_ID pins the segment. Without it: the account's only
// segment, or the one whose name says newsletter. Several segments and none
// of them named for it is an error, not a guess.

const API = "https://api.resend.com";
const NAMED = /newsletter|dispatch|buletin/i;

/** Looked up once per function instance (per API key). */
const cached = new Map<string, string>();

const auth = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` });

export async function newsletterSegmentId(apiKey: string): Promise<string | null> {
  const pinned = Deno.env.get("NEWSLETTER_SEGMENT_ID");
  if (pinned) return pinned;
  const known = cached.get(apiKey);
  if (known) return known;
  const res = await fetch(`${API}/segments`, { headers: auth(apiKey) });
  if (!res.ok) {
    console.error("resend-segment: listing segments failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const body = await res.json().catch(() => null) as { data?: { id: string; name?: string }[] } | null;
  const segments = body?.data ?? [];
  const pick = segments.length === 1 ? segments[0] : segments.find((s) => NAMED.test(s.name ?? ""));
  if (!pick) {
    console.error(
      segments.length
        ? "resend-segment: several segments and none is named for the newsletter; set NEWSLETTER_SEGMENT_ID"
        : "resend-segment: the Resend account has no segment",
    );
    return null;
  }
  cached.set(apiKey, pick.id);
  return pick.id;
}

/** Whether a contact (by email) is in the segment. False when Resend can't say. */
async function isInSegment(apiKey: string, email: string, segmentId: string): Promise<boolean> {
  const res = await fetch(`${API}/contacts/${encodeURIComponent(email)}/segments?limit=100`, { headers: auth(apiKey) });
  if (!res.ok) return false;
  const body = await res.json().catch(() => null) as { data?: { id: string }[] } | null;
  return !!body?.data?.some((s) => s.id === segmentId);
}

/**
 * Adds an existing contact (by email) to the newsletter segment. True on
 * success, or if it was already there: Resend doesn't document what adding
 * a member twice returns, so a refusal is checked against the contact's
 * segments rather than read from its status code.
 */
export async function addToNewsletterSegment(apiKey: string, email: string, segmentId?: string): Promise<boolean> {
  const id = segmentId ?? await newsletterSegmentId(apiKey);
  if (!id) return false;
  const res = await fetch(`${API}/contacts/${encodeURIComponent(email)}/segments/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: auth(apiKey),
  });
  if (res.ok) return true;
  const detail = await res.text().catch(() => "");
  if (await isInSegment(apiKey, email, id)) return true;
  console.error("resend-segment: adding a contact failed", res.status, detail);
  return false;
}

/** Every email in the segment, lowercased; null if Resend couldn't list them. */
async function segmentEmails(apiKey: string, segmentId: string): Promise<Set<string> | null> {
  const emails = new Set<string>();
  let after = "";
  // 100 a page; the cap only stops a runaway loop (100,000 contacts).
  for (let page = 0; page < 1000; page++) {
    const q = new URLSearchParams({ segment_id: segmentId, limit: "100" });
    if (after) q.set("after", after);
    const res = await fetch(`${API}/contacts?${q}`, { headers: auth(apiKey) });
    if (!res.ok) {
      console.error("resend-segment: listing the segment failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const body = await res.json().catch(() => null) as { data?: { id: string; email: string }[]; has_more?: boolean } | null;
    const rows = body?.data ?? [];
    for (const c of rows) emails.add(c.email.trim().toLowerCase());
    if (!body?.has_more || rows.length === 0) return emails;
    after = rows[rows.length - 1].id;
  }
  return emails;
}

/**
 * Before a dispatch: adds every confirmed subscriber who isn't in the
 * segment yet. `missing` counts those who couldn't be added (no contact on
 * Resend's side, say); null means the segment couldn't be read at all.
 */
export async function fillNewsletterSegment(
  apiKey: string,
  segmentId: string,
  confirmed: string[],
): Promise<{ added: number; missing: number } | null> {
  const present = await segmentEmails(apiKey, segmentId);
  if (!present) return null;
  let added = 0;
  let missing = 0;
  for (const email of confirmed) {
    if (present.has(email.trim().toLowerCase())) continue;
    if (await addToNewsletterSegment(apiKey, email, segmentId)) added++;
    else missing++;
  }
  return { added, missing };
}
