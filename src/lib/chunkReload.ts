/**
 * When the app is republished, the browser tabs that are still open reference
 * the old JavaScript file names. Navigating to a page that had not been loaded
 * yet then fails with "Failed to fetch dynamically imported module", which the
 * error boundary shows as "Something went wrong".
 *
 * The fix is to reload the page once so the tab picks up the new files. The
 * once-per-10-minutes guard prevents an endless reload loop if the failure is
 * caused by something else (e.g. the user being offline).
 */
const GUARD_KEY = "art-chunk-reload-at";
const GUARD_WINDOW_MS = 10 * 60 * 1000;

export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : "";
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed|error loading dynamically imported module/i.test(
    message,
  );
};

export const reloadForNewVersion = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0);
    if (Date.now() - last < GUARD_WINDOW_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // Private browsing without sessionStorage: still worth one reload attempt.
  }
  window.location.reload();
  return true;
};

export const installChunkReloadHandler = () => {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadForNewVersion();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadForNewVersion();
  });
};
