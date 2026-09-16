# Keap-style email editor: the preview becomes the editor

Rebuild the campaign and template editing experience so the branded email itself is the editing surface. The block model, saved campaigns, templates, sending and tracking stay exactly as they are — only the editing screen changes.

## How it will work

**Three areas, like Keap:**

```text
+-----------------------------------------------------------+
|  Template | Create        Preview  Save and exit          |
+-----------------------------------------------------------+
| undo redo | eye | desktop / mobile                        |
+---------------------------+-------------------------------+
|                           |  CONTENT palette              |
|   The email itself        |  (drag blocks in)             |
|   - click text and type   |                               |
|   - hover shows outline   |  ...or, when a block is       |
|   - toolbar on selection  |  selected: all its style      |
|                           |  settings, Desktop / Mobile   |
+---------------------------+-------------------------------+
```

- **Editing text**: click any heading or paragraph on the email and type straight into it. A small floating toolbar appears above the selection with bold, italic, underline, strikethrough, text colour, highlight, link, lists, and the existing Merge fields inserter.
- **Adding blocks**: drag Text, Heading, Image, Button, Columns, Table, Tour card, Social, Divider or Spacer from the right-hand palette onto the email. A blue line shows exactly where it will land, including inside a column or table cell. Clicking a palette block then clicking a spot on the email still works, as it does today.
- **Selecting**: hovering shows a light outline and a label; clicking selects. A selected block gets a small toolbar of its own (move handle, duplicate, delete). Empty columns show "No content here. Drag content from right."
- **Styling**: selecting a block swaps the palette for that block's settings — font family, weight, size, colour, alignment, line height, letter spacing, per-side padding and margin, plus the Desktop / Mobile switch already in the model. A dot marks the Mobile tab when overrides exist. Clicking the email background selects the whole email for global design settings (background, brand colours, container width).
- **Devices and preview**: desktop and mobile toggles in the top toolbar, plus the existing full-screen preview and "send test to me".

## What is replaced

The current three-pane builder (block list on the left, read-only preview, inspector on the right) goes. Existing campaigns, drafts and saved templates open in the new editor unchanged — same blocks, same rendered HTML, same send path. HTML mode stays as-is for pasted designs.

The block set stays as it is today; no countdown timer for now.

## Technical notes

- `src/lib/edm/blocks.ts` (block model, renderer, mobile overrides) is unchanged. All existing per-block settings already exist in the model, so the new panel is a re-presentation, not new data.
- `EdmBuilder.tsx` is restructured into: `EdmCanvas` (editable iframe document with hover/select/insert affordances), `EdmFloatingToolbar` (inline text formatting + merge fields), `EdmPalette` (draggable block list), and the existing `EdmStyleControls` / block inspector reused as the right-hand settings panel.
- Editing happens inside the preview iframe: block wrappers are rendered with `data-block-id` (already emitted for click-to-select), text blocks get `contenteditable` on their inner container, and edits are written back through the existing `update(id, patch)` so undo/redo, autosave and dirty state keep working.
- Text is sanitised on write-back to the same set of tags the renderer already produces, so pasted styling from Word or a browser cannot break email HTML.
- Drag and drop uses pointer events with a drop-target calculation across the iframe boundary, reusing `addAtTarget`, `addToCell`, `dropBlock` and the existing copy/paste helpers.
- Keyboard: Escape deselects, Delete removes the selected block when not editing text, Cmd/Ctrl+Z hooks the existing undo stack.

## Limitations to accept

- Editing inside an iframe means very unusual paste content may be flattened to plain text.
- Merge fields show as their token (e.g. `{{first_name}}`) while editing, and resolve in preview and test sends — same as now.
- This is a sizeable rewrite of one large file; I will verify against a real campaign and a saved template before reporting done.

## Delivery

1. Canvas with hover, select, block toolbar and global-design selection.
2. In-place text editing with the floating toolbar and merge fields.
3. Palette with drag-and-drop insertion (plus click-to-place) into blocks, columns and table cells.
4. Right-hand settings panel with Desktop / Mobile, replacing the old inspector layout.
5. Remove the old three-pane layout; verify campaigns, templates, test send and mobile overrides.
