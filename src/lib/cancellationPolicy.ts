export interface CancellationPolicyRow {
  notice: string;
  refund: string;
}

export interface CancellationPolicy {
  title: string;
  rows: CancellationPolicyRow[];
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  title: "Cancellation Policy",
  rows: [
    { notice: "180+ days prior to departure", refund: "Full refund, less 10% administration fee" },
    { notice: "90\u2013179 days prior to departure", refund: "50% refund of all payments made" },
    { notice: "Within 90 days of departure", refund: "No refund available" },
  ],
};

/**
 * Normalises an unknown value (from settings JSON or a tour override) into a
 * well-formed CancellationPolicy, falling back to defaults where needed.
 */
export function normaliseCancellationPolicy(value: unknown): CancellationPolicy {
  if (!value || typeof value !== "object") return { ...DEFAULT_CANCELLATION_POLICY };
  const v = value as Record<string, unknown>;
  const title = typeof v.title === "string" && v.title.trim() ? v.title : DEFAULT_CANCELLATION_POLICY.title;
  const rawRows = Array.isArray(v.rows) ? v.rows : [];
  const rows: CancellationPolicyRow[] = rawRows
    .map((r) => {
      const row = (r ?? {}) as Record<string, unknown>;
      return {
        notice: typeof row.notice === "string" ? row.notice : "",
        refund: typeof row.refund === "string" ? row.refund : "",
      };
    })
    .filter((r) => r.notice.trim() || r.refund.trim());
  return { title, rows: rows.length ? rows : DEFAULT_CANCELLATION_POLICY.rows };
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the standalone Cancellation Policy table HTML used in guest documents
 * and emails. Email-safe (inline styles, table-based layout).
 * @param navy brand primary colour (header background)
 */
export function buildCancellationPolicyTableHtml(
  policy: CancellationPolicy,
  navy = "#232628",
): string {
  const rowsHtml = policy.rows
    .map((row, i) => {
      const bg = i % 2 === 1 ? "#f3f4f6" : "#ffffff";
      return `<tr>
        <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#1a2332;border-bottom:1px solid #e5e7eb;width:42%;vertical-align:top;">${escapeHtml(row.notice)}</td>
        <td style="padding:10px 14px;background-color:${bg};font-size:14px;color:#55575d;border-bottom:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(row.refund)}</td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
    <tr><th colspan="2" style="padding:12px 14px;background-color:${navy};color:#ffffff;text-align:left;font-size:15px;font-weight:600;">${escapeHtml(policy.title)}</th></tr>
    <tr>
      <th style="padding:8px 14px;background-color:${navy};color:#ffffff;text-align:left;font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.15);width:42%;">Notice Period</th>
      <th style="padding:8px 14px;background-color:${navy};color:#ffffff;text-align:left;font-size:13px;font-weight:600;border-top:1px solid rgba(255,255,255,0.15);">Refund</th>
    </tr>
    ${rowsHtml}
  </table>`;
}