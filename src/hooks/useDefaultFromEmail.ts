import { useGeneralSettings } from "@/hooks/useGeneralSettings";

export type DefaultFromEmailType = "client" | "operational";

const FALLBACKS: Record<DefaultFromEmailType, string> = {
  client: "bookings@australianracingtours.com.au",
  operational: "admin@australianracingtours.com.au",
};

const KEYS: Record<DefaultFromEmailType, string> = {
  client: "default_from_email_client",
  // We reuse the existing 'default_from_email_internal' key for operational
  // emails (reports, rooming lists to hotels, passport reports, etc.).
  operational: "default_from_email_internal",
};

/**
 * Returns the configured default "From" email address for a given purpose.
 *
 * - "client": user-facing emails (booking confirmations, forms, 6-month, etc.)
 * - "operational": staff/vendor emails (reports, rooming lists to hotels, etc.)
 *
 * Falls back to sensible defaults until the settings load.
 */
export const useDefaultFromEmail = (type: DefaultFromEmailType) => {
  const { data: settings, isLoading } = useGeneralSettings();
  const setting = settings?.find((s) => s.setting_key === KEYS[type]);
  const value =
    (typeof setting?.setting_value === "string" && setting.setting_value.trim()) ||
    FALLBACKS[type];
  return { defaultFromEmail: value, isLoading };
};
