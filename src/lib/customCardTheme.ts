// Recolours custom email cards so their theme-derived accents (gold / navy)
// reflect the tour's brand rather than the baked-in global/default theme.
//
// Custom cards embed `data-card-type="custom"` and a `data-card-meta` payload
// containing the chosen accentColor keyword. Only the two theme-derived accents
// ('gold' and 'navy') are re-coloured; fixed palette accents (grey/blue/green/
// amber) are intentional and left untouched.

export interface CardThemeColors {
  /** Brand primary / header background (navy equivalent). */
  primary: string;
  /** Brand accent / gold text used for the "gold" accent. */
  accent: string;
}

const decode = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

export function recolorCustomCards(html: string, colors: CardThemeColors): string {
  if (!html || !colors?.primary) {
    return html;
  }

  let out = html.replace(
    /<table\b[^>]*\bdata-card-type="custom"[^>]*\bdata-card-meta="([^"]*)"[\s\S]*?letter-spacing:0\.5px;">/g,
    (segment: string, meta: string) => {
      let accentColor = "";
      try {
        accentColor = JSON.parse(decode(meta)).accentColor;
      } catch {
        return segment;
      }

      let bg: string;
      let text: string;
      const border = colors.primary;

      if (accentColor === "gold") {
        bg = colors.primary;
        text = colors.accent;
      } else if (accentColor === "navy") {
        bg = colors.primary;
        text = "#ffffff";
      } else {
        return segment; // leave fixed-palette accents untouched
      }

      return segment
        .replace(/border:1px solid [^;]+;border-radius:8px/, `border:1px solid ${border};border-radius:8px`)
        .replace(
          /background-color:[^;]+;padding:12px 16px;border-bottom:1px solid [^;]+;/,
          `background-color:${bg};padding:12px 16px;border-bottom:1px solid ${border};`,
        )
        .replace(/color:[^;]+;letter-spacing:0\.5px;/, `color:${text};letter-spacing:0.5px;`);
    },
  );

  // Retheme "plain" branded cards that were inserted as static HTML WITHOUT
  // the data-card-type/data-card-meta markers (e.g. older TOUR DETAILS cards).
  // These use the baked-in default navy (#0a1929) header + gold (#d4a017) title,
  // so target those exact defaults to avoid touching intentional palettes.
  out = out
    .replace(
      /border:1px solid #0a1929;border-radius:8px/gi,
      `border:1px solid ${colors.primary};border-radius:8px`,
    )
    .replace(
      /background-color:#0a1929;padding:12px 16px;border-bottom:1px solid #0a1929;/gi,
      `background-color:${colors.primary};padding:12px 16px;border-bottom:1px solid ${colors.primary};`,
    )
    .replace(
      /color:#d4a017;letter-spacing:0\.5px;/gi,
      `color:${colors.accent};letter-spacing:0.5px;`,
    );

  return out;
}
