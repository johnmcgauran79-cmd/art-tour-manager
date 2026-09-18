# Email editor: make the editor match the sent email, plus the marketing team's edits

Yes — I understand all of it. The root problem behind most of the list is that the editing screen was *imitating* how the email behaves instead of showing the email at its real width. I found the exact causes and will fix them without going back to the shrink-to-fit behaviour you rejected.

## What is actually wrong (diagnosis)

1. **Editor doesn't match the received email.** The editing screen renders the email at whatever width the panel happens to be (roughly 500–700px), not at the email's true 800px. Every proportion set as a percentage — the logo width, side padding, column widths — therefore comes out differently in Outlook and Gmail. The header is the most obvious one because the logo is sized as a percentage of the email width.
2. **Phone view was faked.** The editor injected its own phone rules with "!important", including a forced 16px text size and 1.65 line spacing. That is why your text size and line spacing changes for mobile did nothing on screen but worked in the test email — your settings were being overruled in the editor only. The same forced 16px also overrides a deliberately larger mobile text size in the real email.
3. **Font choice ignored for text blocks.** The shared brand stylesheet sets Poppins on every `div`, `p` and `span`. A text block sets its font on the surrounding cell only, so the inner paragraph is caught by the brand rule and stays Poppins. Headings work because they have no inner wrapper.

## The fixes

**Matching preview**
- Desktop view renders the email at its true width (the content width set in the design, 800px by default) and simply zooms the whole thing to fit the space, so proportions, padding and the header/logo are exactly what people receive.
- Phone view stays a genuine narrow 390px layout with no shrinking, and now uses the email's *own* phone rules rather than editor-only imitations — so what you see is what is sent.
- Remove the forced 16px/1.65 phone text rules. Instead each text block carries its own phone size and line spacing (defaulting to at least 16px for readability), so your edits show in both places.

**Editing behaviour**
- Fonts: each text block writes its font, size and line spacing onto the text itself so Larken and every other choice actually applies.
- Drag content around the email: pick a block up and drop it anywhere, including into a different column, left or right. Arrows stay as a fallback and no longer get stuck at column boundaries.
- Clicking a linked image or button selects it for editing instead of opening the web page.
- The Desktop / Mobile / Full screen buttons stay pinned at the top while you scroll.
- The temporary shaded backdrop behind hard-to-read text (e.g. white on white) is recalculated as you type and after every colour change, so it appears reliably.
- Delete just one piece of content, and separately empty or delete a single column, without losing the rest of the row.

**Mobile-specific controls**
- Images: "Full width on phones" switch, plus a manual width.
- Padding and margin set on desktop no longer have to carry to phones — mobile keeps its own values, and there's a clear indicator when a phone override is in place.
- Header/logo size and padding can be set separately for phones.
- Social icons get their own phone size (content blocks and the footer).

**Other**
- Buttons: full width now truly fills the column, including inside columns where it previously refused.
- Negative padding and margin allowed in column/row settings as well as blocks.
- Image library: a "Choose from library" browser of everything previously uploaded, so pictures can be reused instead of re-uploaded.

## Technical notes

- `EdmCanvas.tsx`: fixed-width iframe (`design.maxWidth + 24` desktop, 390 mobile) with a CSS `transform: scale()` fit for desktop only, rect maths adjusted for scale; the `html.edm-mobile` override block is removed so the email's own `@media (max-width:600px)` drives phone view; capture-phase click prevention for anchors; contrast helper re-run on input/selection/colour change; drag handles on `[data-edm-id]` with drop into `[data-edm-cell]`; column toolbar (empty / delete column) via `clearCellById` / `removeCellById`.
- `blocks.ts`: new `ctx.headCss` for per-block desktop rules (`tr.cls>td, tr.cls>td div/p/li/span`) covering font family, size and line spacing so the brand stylesheet no longer wins; blanket mobile `td.edm-body-text` rule replaced with per-block mobile rules; `mobileHeaderWidthPct` / `mobileHeaderPadding` on the design block and `m.iconSize` for social; full-width button becomes `width:100%`; `stripPastedSpacing` adds `font-family:inherit;font-size:inherit` to pasted paragraphs.
- New `moveBlockToCell` helper for cross-column drag; `EdmBuilder.tsx` sticky toolbar, mobile inspector additions, negative-allowed column spacing inputs; `EdmImageField.tsx` gains a library dialog listing the `email-assets/edm` folder.
- Verification: typecheck, build, and Playwright renders of a real saved template at 390px, 600px and 800px compared against the sent HTML, checking no horizontal overflow and that font/size/line-spacing settings survive.

## Limits

Outlook on Windows ignores some CSS (aspect-ratio crops, rounded corners); the preview will look slightly softer there. Larken falls back to a serif in clients that block web fonts — unchanged.
