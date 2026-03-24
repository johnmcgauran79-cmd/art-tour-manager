import { useEffect } from "react";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";

/**
 * Converts a hex color (#RRGGBB) to HSL string "H S% L%" for CSS variables.
 */
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Determines if a color is light or dark, returns appropriate foreground HSL.
 */
function getForegroundForBg(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 100%";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "210 100% 12%" : "0 0% 100%";
}

/**
 * Creates a lighter tint of a hex color for accent/hover backgrounds.
 */
function getLightTint(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = d / (2 - max - min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% 95%`;
}

export const useThemeProvider = () => {
  const { data: settings } = useGeneralSettings();

  useEffect(() => {
    if (!settings) return;

    const getSetting = (key: string): string | null => {
      const s = settings.find(s => s.setting_key === key);
      if (!s) return null;
      const val = s.setting_value;
      return typeof val === 'string' ? val : null;
    };

    const primary = getSetting('theme_primary_color');
    const secondary = getSetting('theme_secondary_color');
    const sidebarBg = getSetting('theme_sidebar_bg');
    const sidebarText = getSetting('theme_sidebar_text');

    const root = document.documentElement;

    if (primary) {
      const hsl = hexToHsl(primary);
      if (hsl) {
        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--card-foreground', hsl);
        root.style.setProperty('--foreground', hsl);
        root.style.setProperty('--popover-foreground', hsl);
        root.style.setProperty('--brand-navy', hsl);
      }
    }

    if (secondary) {
      const hsl = hexToHsl(secondary);
      if (hsl) {
        root.style.setProperty('--secondary', hsl);
        root.style.setProperty('--accent', hsl);
        root.style.setProperty('--ring', hsl);
        root.style.setProperty('--brand-yellow', hsl);
        root.style.setProperty('--brand-gold', hsl);
        // Primary foreground should be the secondary color (gold on navy buttons)
        root.style.setProperty('--primary-foreground', hsl);
        root.style.setProperty('--sidebar-primary-foreground', hsl);
        root.style.setProperty('--sidebar-ring', hsl);

        // Secondary foreground should contrast with secondary
        const secFg = getForegroundForBg(secondary);
        root.style.setProperty('--secondary-foreground', secFg);
        root.style.setProperty('--accent-foreground', secFg);
        root.style.setProperty('--sidebar-accent-foreground', secFg);

        // Light tint for accent backgrounds
        const tint = getLightTint(secondary);
        if (tint) {
          root.style.setProperty('--sidebar-accent', tint);
        }
      }
    }

    if (sidebarBg) {
      const hsl = hexToHsl(sidebarBg);
      if (hsl) {
        root.style.setProperty('--sidebar-background', hsl);
      }
    }

    if (sidebarText) {
      const hsl = hexToHsl(sidebarText);
      if (hsl) {
        root.style.setProperty('--sidebar-foreground', hsl);
        root.style.setProperty('--sidebar-primary', hsl);
      }
    }

    // Cleanup: remove inline styles when component unmounts
    return () => {
      const props = [
        '--primary', '--card-foreground', '--foreground', '--popover-foreground',
        '--brand-navy', '--secondary', '--accent', '--ring', '--brand-yellow',
        '--brand-gold', '--primary-foreground', '--sidebar-primary-foreground',
        '--sidebar-ring', '--secondary-foreground', '--accent-foreground',
        '--sidebar-accent-foreground', '--sidebar-accent', '--sidebar-background',
        '--sidebar-foreground', '--sidebar-primary'
      ];
      props.forEach(p => root.style.removeProperty(p));
    };
  }, [settings]);
};
