import { supabase } from "@/integrations/supabase/client";

/**
 * Detect Microsoft Teams embedded webview. The Teams desktop/mobile clients
 * block programmatic anchor downloads (blob: + a.download click), surfacing
 * "This action is currently not supported on mobile". Opening a real URL in a
 * new tab makes Teams hand the file off to the system browser instead.
 */
export function isTeamsWebview(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Teams/i.test(ua) || /MSTeams/i.test(ua)) return true;
  try {
    // Teams loads us inside an iframe under teams.microsoft.com
    if (window.parent !== window) {
      const ref = document.referrer || "";
      if (/teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft/i.test(ref)) {
        return true;
      }
    }
  } catch {
    // cross-origin parent — likely Teams
    return true;
  }
  return false;
}

/** Open a URL in a way that works inside Teams' embedded webview. */
function openExternal(url: string) {
  // window.open in a new tab gets handed off to the system browser by Teams
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocked — fall back to top-level navigation
    window.location.href = url;
  }
}

/**
 * Download a file from a Supabase Storage bucket. Uses a signed URL +
 * window.open so it works in Teams (which blocks blob/anchor downloads).
 */
export async function downloadFromStorage(
  bucket: string,
  filePath: string,
  fileName?: string,
  expiresInSeconds = 60,
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds, {
      download: fileName || true,
    });
  if (error || !data?.signedUrl) {
    throw error || new Error("Could not create signed URL");
  }
  // In Teams' webview, blob/anchor downloads are blocked — hand off to the
  // system browser via window.open. In normal browsers, opening the signed
  // URL with window.open can cause a double download (new tab fetches the
  // attachment, then some browsers re-issue the request on close), so use a
  // hidden anchor click instead.
  if (isTeamsWebview()) {
    openExternal(data.signedUrl);
    return;
  }
  const a = document.createElement("a");
  a.href = data.signedUrl;
  if (fileName) a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Trigger a download for a client-generated Blob (CSV export, report, etc.).
 * Uses anchor-click in normal browsers; in Teams' webview, opens the blob URL
 * in a new tab so the host browser handles the download.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  if (isTeamsWebview()) {
    openExternal(url);
    // Revoke later — Teams needs time to hand off the URL
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}