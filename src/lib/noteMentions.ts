export interface MentionableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const displayNameFor = (u: MentionableUser) =>
  `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || "Unknown user";

/** Strip HTML down to plain text (browser-safe, used for mention scanning). */
export const htmlToText = (html: string) => {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || "").replace(/\u00a0/g, " ");
};

/**
 * Resolve `@Name` tags written in note content back to user ids.
 * Longest names are matched first so "@Jane Smith" never resolves to "@Jane".
 */
export const extractMentionedUserIds = (html: string, users: MentionableUser[]): string[] => {
  const text = htmlToText(html).toLowerCase();
  const ids = new Set<string>();
  [...users]
    .sort((a, b) => displayNameFor(b).length - displayNameFor(a).length)
    .forEach((u) => {
      const name = displayNameFor(u).toLowerCase();
      if (!name || name === "unknown user") return;
      if (text.includes(`@${name}`)) ids.add(u.id);
    });
  return Array.from(ids);
};
