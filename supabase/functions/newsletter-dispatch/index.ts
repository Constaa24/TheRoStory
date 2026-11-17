import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";
import { createRateLimiter, getClientIp } from "../_shared/rate-limit.ts";
import { jsonResponse } from "../_shared/http.ts";
import { fillNewsletterSegment, newsletterSegmentId } from "../_shared/resend-segment.ts";

// The desk's dispatch (the redesign's AdminApp, Newsletter): a letter with
// the stories it points to, sent to every confirmed subscriber.
//
//   action "test" — the letter to the admin who asked, and to no one else.
//   action "send" — first puts every confirmed subscriber who is missing
//     into the newsletter segment, then a Resend broadcast to it (see
//     _shared/resend-segment.ts), recorded in newsletter_dispatches.
//
// Admins only. Unsubscribing is Resend's own link in the footer
// ({{{RESEND_UNSUBSCRIBE_URL}}}); the newsletter-webhook function mirrors
// it back into newsletter_subscribers.

const SITE_URL = "https://therostory.com";
const SUBJECT_MAX = 200;
const BODY_MAX = 20000;
const STORIES_MAX = 12;
/** A second "send" this soon after one is almost certainly a double click. */
const RESEND_GUARD_MS = 10 * 60 * 1000;

const rateLimiter = createRateLimiter({ globalKey: "__rostoryDispatchRateLimit", windowMs: 60_000, max: 6 });

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Story = {
  id: string; title_en: string | null; title_ro: string | null; type: string | null;
  media_url: string | null; poster_url: string | null; media_urls: string[] | null;
  place_name_en: string | null; place_name_ro: string | null; location: string | null;
};

/** The thumbnail's box in the letter, in CSS pixels. */
const THUMB_W = 72;
const THUMB_H = 86;

const coverOf = (s: Story): string | null => {
  const raw = s.type === "video" ? s.poster_url
    : s.type === "carousel" ? (s.poster_url || s.media_urls?.[0] || s.media_url)
    : (s.media_url || s.poster_url);
  if (!raw) return null;
  // A small JPEG/PNG from Supabase's resizer (email clients don't all read
  // WebP), cropped by the server to the thumbnail's own shape at twice its
  // size. Outlook and Gmail ignore CSS object-fit, so an image of any other
  // shape came out squashed into the 72x86 box.
  return raw.includes("/storage/v1/object/public/")
    ? raw.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      `?width=${THUMB_W * 2}&height=${THUMB_H * 2}&resize=cover&quality=72`
    : raw;
};

/** The letter as email-safe HTML: tables, inline styles, absolute links. */
const letterHtml = (subject: string, body: string, stories: Story[], unsubscribe: string) => {
  const paragraphs = body.trim().split(/\n\s*\n/).map((p) =>
    `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.65;color:#2a241b;">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`
  ).join("");
  const storyRows = stories.map((s) => {
    // The letter goes to readers of both languages, so each title links to
    // the story in its own language: the English one to the English page,
    // the Romanian one (under it) to /ro.
    const enUrl = `${SITE_URL}/article/${encodeURIComponent(s.id)}`;
    const roUrl = `${SITE_URL}/ro/article/${encodeURIComponent(s.id)}`;
    const cover = coverOf(s);
    const placeEn = s.place_name_en || s.location || "";
    const placeRo = s.place_name_ro || s.location || "";
    const where = placeEn && placeRo && placeEn !== placeRo ? `${placeEn} · ${placeRo}` : placeEn || placeRo;
    const leadUrl = s.title_en ? enUrl : roUrl;
    return `<tr><td style="padding-top:14px;padding-bottom:14px;border-top:1px solid #e6dcc8;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        ${cover ? `<td width="${THUMB_W}" valign="top" style="padding-right:16px;"><a href="${leadUrl}"><img src="${escapeHtml(cover)}" width="${THUMB_W}" height="${THUMB_H}" alt="" border="0" style="display:block;width:${THUMB_W}px;height:${THUMB_H}px;border-radius:36px 36px 6px 6px;"></a></td>` : ""}
        <td valign="top">
          ${where ? `<p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#8a6d3b;font-weight:bold;">${escapeHtml(where)}</p>` : ""}
          <a href="${leadUrl}" style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.25;color:#1a1611;text-decoration:none;">${escapeHtml(s.title_en || s.title_ro || "")}</a>
          ${s.title_en && s.title_ro && s.title_ro !== s.title_en ? `<p style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;line-height:1.4;"><a href="${roUrl}" lang="ro" style="color:#6b5f4c;text-decoration:none;">${escapeHtml(s.title_ro)}</a></p>` : ""}
        </td>
      </tr></table>
    </td></tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#f6f1e6;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#f6f1e6" style="background-color:#f6f1e6;"><tr><td align="center" style="padding-top:32px;padding-bottom:32px;padding-left:16px;padding-right:16px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
    <tr><td style="padding-bottom:20px;border-bottom:2px dashed #c9a96e;">
      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;line-height:1.2;color:#8a6d3b;">The RoStory</p>
      <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:#8a6d3b;font-weight:bold;">The dispatch · Buletinul</p>
    </td></tr>
    <tr><td style="padding-top:28px;">
      <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px;line-height:1.15;color:#1a1611;">${escapeHtml(subject)}</h1>
      ${paragraphs}
    </td></tr>
    ${stories.length ? `<tr><td style="padding-top:12px;"><table cellpadding="0" cellspacing="0" border="0" width="100%">${storyRows}</table></td></tr>` : ""}
    <tr><td style="padding-top:28px;border-top:1px solid #e6dcc8;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8b7f6c;">
        You're receiving this because you confirmed a subscription at <a href="${SITE_URL}" style="color:#8a6d3b;">therostory.com</a>.
        Primești acest email pentru că ți-ai confirmat abonarea pe therostory.com.<br>
        <a href="${unsubscribe}" style="color:#8a6d3b;">Unsubscribe · Dezabonează-te</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
};

const letterText = (subject: string, body: string, stories: Story[], unsubscribe: string) =>
  [
    "THE ROSTORY — THE DISPATCH", "", subject, "", body.trim(), "",
    ...stories.flatMap((s) => [
      `- ${s.title_en || s.title_ro}: ${SITE_URL}/article/${encodeURIComponent(s.id)}`,
      ...(s.title_en && s.title_ro && s.title_ro !== s.title_en
        ? [`  ${s.title_ro}: ${SITE_URL}/ro/article/${encodeURIComponent(s.id)}`]
        : []),
    ]),
    "", `Unsubscribe / Dezabonează-te: ${unsubscribe}`,
  ].join("\n");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" }, corsHeaders);

  const origin = req.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) return jsonResponse(403, { error: "Origin not allowed" }, corsHeaders);
  if (rateLimiter.isRateLimited(`ip:${getClientIp(req)}`)) {
    return jsonResponse(429, { error: "Too many requests. Please try again in a minute." }, corsHeaders, { "Retry-After": "60" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const FROM = Deno.env.get("NEWSLETTER_FROM_EMAIL") || Deno.env.get("CONTACT_FROM_EMAIL") || "";
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY || !RESEND_API_KEY || !FROM) {
      return jsonResponse(500, { error: "Server not configured" }, corsHeaders);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse(401, { error: "Missing authorization" }, corsHeaders);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse(401, { error: "Invalid or expired token" }, corsHeaders);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: role, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (roleError) throw roleError;
    if (role?.role !== "admin") return jsonResponse(403, { error: "Admin access required" }, corsHeaders);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = body.action;
    const subject = String(body.subject ?? "").trim();
    const letter = String(body.body ?? "");
    const storyIds = Array.isArray(body.storyIds) ? (body.storyIds as unknown[]).map(String).slice(0, STORIES_MAX) : [];
    if (action !== "test" && action !== "send") return jsonResponse(400, { error: "Unknown action" }, corsHeaders);
    if (!subject || subject.length > SUBJECT_MAX) return jsonResponse(400, { error: `The subject needs 1 to ${SUBJECT_MAX} characters.` }, corsHeaders);
    if (!letter.trim() || letter.length > BODY_MAX) return jsonResponse(400, { error: `The letter needs 1 to ${BODY_MAX} characters.` }, corsHeaders);

    // Only published stories, in the order they were picked.
    let stories: Story[] = [];
    if (storyIds.length) {
      const { data, error } = await admin
        .from("articles")
        .select("id, title_en, title_ro, type, media_url, poster_url, media_urls, place_name_en, place_name_ro, location")
        .in("id", storyIds)
        .eq("is_published", true);
      if (error) throw error;
      const byId = new Map((data as Story[]).map((s) => [s.id, s]));
      stories = storyIds.map((id) => byId.get(id)).filter((s): s is Story => !!s);
    }

    if (action === "test") {
      if (!user.email) return jsonResponse(400, { error: "Your account has no email address." }, corsHeaders);
      // The real footer link exists only inside a broadcast.
      const unsubscribe = SITE_URL;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [user.email],
          subject: `[Test] ${subject}`,
          html: letterHtml(subject, letter, stories, unsubscribe),
          text: letterText(subject, letter, stories, unsubscribe),
        }),
      });
      if (!res.ok) {
        console.error("newsletter-dispatch test failed", res.status, await res.text().catch(() => ""));
        return jsonResponse(502, { error: "The test could not be sent." }, corsHeaders);
      }
      return jsonResponse(200, { ok: true, to: user.email }, corsHeaders);
    }

    // action === "send"
    //
    // The guard against a second send claims first and looks second: this
    // send's row goes in, then any other within the window means someone
    // else is sending (or has just sent), and this one stands down. Looking
    // first and recording after the send let two clicks a moment apart both
    // find nothing and both go out. Two claims at the same instant each see
    // the other and both stand down, the safe way to lose that race.
    const { data: claim, error: claimError } = await admin
      .from("newsletter_dispatches")
      .insert({ subject, body: letter, story_ids: stories.map((s) => s.id), recipients: 0, sent_by: user.id })
      .select("id")
      .single();
    if (claimError || !claim) throw claimError ?? new Error("could not record the dispatch");

    let sentOut = false;
    try {
      const { count: others, error: othersError } = await admin
        .from("newsletter_dispatches")
        .select("id", { count: "exact", head: true })
        .gt("sent_at", new Date(Date.now() - RESEND_GUARD_MS).toISOString())
        .neq("id", claim.id);
      if (othersError) throw othersError;
      if (others) return jsonResponse(409, { error: "A dispatch went out in the last ten minutes. Wait before sending another." }, corsHeaders);

      const segmentId = await newsletterSegmentId(RESEND_API_KEY);
      if (!segmentId) return jsonResponse(500, { error: "The newsletter list could not be found in Resend." }, corsHeaders);

      // Everyone confirmed, a page at a time (the API returns at most 1,000 rows).
      const confirmed: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await admin
          .from("newsletter_subscribers")
          .select("email")
          .eq("status", "confirmed")
          .order("email")
          .range(from, from + 999);
        if (error) throw error;
        confirmed.push(...(data as { email: string }[]).map((r) => r.email));
        if (!data || data.length < 1000) break;
      }
      if (!confirmed.length) return jsonResponse(400, { error: "There are no confirmed subscribers yet." }, corsHeaders);

      // The broadcast reaches only the segment, so first make sure every
      // confirmed subscriber is in it (see _shared/resend-segment.ts).
      const filled = await fillNewsletterSegment(RESEND_API_KEY, segmentId, confirmed);
      if (!filled) return jsonResponse(502, { error: "The newsletter list could not be checked. Nothing was sent; try again in a minute." }, corsHeaders);
      if (filled.added) console.log(`newsletter-dispatch: added ${filled.added} confirmed subscriber(s) to the segment`);
      const recipients = confirmed.length - filled.missing;
      if (!recipients) return jsonResponse(502, { error: "None of the confirmed subscribers could be put on the newsletter list. Nothing was sent." }, corsHeaders);

      const unsubscribe = "{{{RESEND_UNSUBSCRIBE_URL}}}";
      const headers = { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" };
      const created = await fetch("https://api.resend.com/broadcasts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          segment_id: segmentId,
          from: FROM,
          subject,
          name: `Dispatch · ${subject}`.slice(0, 120),
          html: letterHtml(subject, letter, stories, unsubscribe),
          text: letterText(subject, letter, stories, unsubscribe),
        }),
      });
      if (!created.ok) {
        console.error("newsletter-dispatch create failed", created.status, await created.text().catch(() => ""));
        return jsonResponse(502, { error: "The dispatch could not be prepared." }, corsHeaders);
      }
      const { id: broadcastId } = await created.json() as { id: string };
      const sent = await fetch(`https://api.resend.com/broadcasts/${encodeURIComponent(broadcastId)}/send`, { method: "POST", headers, body: "{}" });
      if (!sent.ok) {
        console.error("newsletter-dispatch send failed", sent.status, await sent.text().catch(() => ""));
        return jsonResponse(502, { error: "The dispatch was prepared but not sent. It is waiting in Resend as a draft." }, corsHeaders);
      }
      sentOut = true;

      // The claim becomes the record of what went out.
      const { error: logError } = await admin
        .from("newsletter_dispatches")
        .update({ recipients, resend_broadcast_id: broadcastId, sent_at: new Date().toISOString() })
        .eq("id", claim.id);
      if (logError) console.error("newsletter-dispatch: sent, but the record was not completed", logError.message);

      // `missing`: confirmed here but not reachable on Resend's side (no
      // contact there, say). The desk says so rather than counting them in.
      return jsonResponse(200, { ok: true, recipients, missing: filled.missing }, corsHeaders);
    } finally {
      // Nothing went out: the claim goes, so it neither blocks the next
      // attempt nor shows on the desk as a letter that was sent.
      if (!sentOut) {
        const { error } = await admin.from("newsletter_dispatches").delete().eq("id", claim.id);
        if (error) console.error("newsletter-dispatch: could not release the claim", error.message);
      }
    }
  } catch (error) {
    console.error("newsletter-dispatch error:", error instanceof Error ? error.message : String(error));
    return jsonResponse(500, { error: "Something went wrong." }, corsHeaders);
  }
});
