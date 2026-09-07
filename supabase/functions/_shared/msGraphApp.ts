/**
 * Microsoft Graph app-only (client credentials) helper.
 *
 * Uses the existing ART Entra ID app registration (MS_GRAPH_* secrets).
 * Requires the following APPLICATION permissions, admin-consented, and ideally
 * scoped with an Exchange ApplicationAccessPolicy to the approved mailboxes:
 *   Mail.Read           (read mail in approved mailboxes)
 *   Mail.Send           (send/reply as approved mailboxes)
 *   User.Read.All       (resolve mailbox users) - optional
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export interface GraphRecipient {
  name?: string | null;
  address?: string | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  const tenant = Deno.env.get("MS_GRAPH_TENANT_ID");
  const clientId = Deno.env.get("MS_GRAPH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_GRAPH_CLIENT_SECRET");
  if (!tenant || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph app credentials are not configured");
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Microsoft token request failed [${res.status}]: ${text}`);
  }
  const json = JSON.parse(text);
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

/** Raw Graph call. `path` may be relative to /v1.0 or an absolute Graph URL. */
export async function graphFetch(
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getAppToken();
  const url = path.startsWith("http") ? path : `${GRAPH}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  // Throttling / transient errors: retry with backoff up to 3 times.
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const retryAfter = Number(res.headers.get("Retry-After") || 0);
    const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, waitMs));
    return graphFetch(path, init, attempt + 1);
  }

  return res;
}

export async function graphJson<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await graphFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph ${init.method || "GET"} ${path} failed [${res.status}]: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export const MESSAGE_FIELDS = [
  "id",
  "internetMessageId",
  "conversationId",
  "conversationIndex",
  "subject",
  "bodyPreview",
  "body",
  "from",
  "sender",
  "toRecipients",
  "ccRecipients",
  "bccRecipients",
  "sentDateTime",
  "receivedDateTime",
  "hasAttachments",
  "webLink",
  "isDraft",
].join(",");

export function recipients(list: any[] | undefined | null): GraphRecipient[] {
  return (list || [])
    .map((r) => ({
      name: r?.emailAddress?.name ?? null,
      address: (r?.emailAddress?.address ?? "").toLowerCase() || null,
    }))
    .filter((r) => !!r.address);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
