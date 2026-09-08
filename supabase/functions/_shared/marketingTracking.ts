/**
 * Campaign tracking helpers.
 *
 * Adds an open pixel and rewrites outbound links so opens and clicks are
 * recorded against the individual recipient. Unsubscribe / preference links are
 * never rewritten so they always work, even if tracking is unavailable.
 */

export interface TrackingOptions {
  /** Full URL of the marketing-track function. */
  trackBase: string;
  campaignId: string;
  recipientId: string;
  /** Campaign name used for utm_campaign on ART links. */
  campaignName?: string | null;
}

const SKIP_PATTERNS = [
  /^mailto:/i,
  /^tel:/i,
  /^#/,
  /email-preferences/i,
  /unsubscribe/i,
];

const OWN_DOMAINS = [
  "australianracingtours.com.au",
  "racingbreaks.com",
  "art-tour-manager.lovable.app",
];

/** True only when the link's hostname really is one of ours. */
const isOwnDomain = (url: string) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return OWN_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

/** Append campaign attribution parameters to links we own. */
const withAttribution = (
  url: string,
  campaignId: string,
  campaignName?: string | null,
): string => {
  if (!isOwnDomain(url)) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "art_email");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "email");
    if (!u.searchParams.has("utm_campaign")) {
      u.searchParams.set("utm_campaign", (campaignName || campaignId).slice(0, 120));
    }
    u.searchParams.set("art_campaign_id", campaignId);
    return u.toString();
  } catch {
    return url;
  }
};

export const instrumentHtml = (html: string, opts: TrackingOptions): string => {
  const { trackBase, campaignId, recipientId, campaignName } = opts;
  if (!html || !recipientId) return html;

  let out = html.replace(
    /href\s*=\s*"([^"]+)"/gi,
    (match, rawUrl: string) => {
      const url = rawUrl.trim();
      if (!/^https?:\/\//i.test(url)) return match;
      if (SKIP_PATTERNS.some((p) => p.test(url))) return match;
      const target = withAttribution(url, campaignId, campaignName);
      const tracked = `${trackBase}?e=c&r=${encodeURIComponent(recipientId)}&u=${encodeURIComponent(target)}`;
      return `href="${tracked}"`;
    },
  );

  const pixel =
    `<img src="${trackBase}?e=o&r=${encodeURIComponent(recipientId)}" width="1" height="1" ` +
    `alt="" style="display:block;border:0;width:1px;height:1px;max-height:1px;max-width:1px;overflow:hidden" />`;

  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    out = `${out}${pixel}`;
  }
  return out;
};
