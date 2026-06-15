# Editor

Inkwell includes a rich WYSIWYG Markdown editor. You can also switch to a raw-text **Source** view at any time.

## Editor vs Source view

The segmented control at the left of the toolbar switches between the two views:

| View | Description |
|---|---|
| **Editor** | WYSIWYG. Text renders with live formatting. Use the toolbar buttons to apply styles. |
| **Source** | Raw Markdown text. Edit the underlying `.md` syntax directly. |

Switching views flushes any unsaved changes and keeps the content in sync.

## Formatting toolbar

When the **Editor** view is active, the formatting toolbar provides one-click controls for all supported styles.

### Block type

The leftmost control in the toolbar is a drop-down labelled with the current block type (**Text**, **H1**, **H2**, or **H3**). Click it to change the paragraph style of the current block.

| Option | Markdown equivalent |
|---|---|
| Body text | Normal paragraph |
| Heading 1 | `# …` |
| Heading 2 | `## …` |
| Heading 3 | `### …` |

### Inline styles

| Button | Shortcut | Markdown |
|---|---|---|
| **Bold** | ⌘ B | `**text**` |
| *Italic* | ⌘ I | `*text*` |
| `Inline code` | — | `` `text` `` |
| Link | — | `[text](url)` |

Selecting text first, then clicking a button, wraps the selection. Clicking again removes the style.

#### Adding a link

1. Select the text you want to make into a link.
2. Click the **Link** button in the toolbar (chain-link icon).
3. Enter the URL in the dialog and click **Apply** (or press **↵**).
4. To remove a link, place the cursor inside it, open the link dialog, clear the URL field, and click **Apply**.

### Lists

| Button | Description | Markdown |
|---|---|---|
| Bulleted list | Unordered list | `- item` |
| Numbered list | Ordered list | `1. item` |
| Task list | Checkboxes | `- [ ] item` |

Task-list checkboxes are interactive in the editor — click one to mark it done.

#### Indenting list items

With the cursor inside a list item:

- Click **Increase indent** (chevron-right icon) to nest the item one level deeper.
- Click **Decrease indent** (chevron-left icon) to move it one level up.

### Block elements

| Button | Description | Markdown |
|---|---|---|
| Quote | Block quote | `> text` |
| Code block | Fenced code block | ` ``` ` |
| Table | 3 × 3 table (with header row) | GFM table syntax |

After inserting a table you can click in any cell to edit it. Use **Tab** to move between cells and add new rows.

## Spellcheck

English spellcheck is active in the editor. Misspelled words are underlined. Right-click a word to see suggestions or add it to the dictionary.

## Source view

The Source view shows the raw Markdown text of the note body (without frontmatter). Any edits made here are saved with the same autosave debounce as the WYSIWYG editor.

Switching back to the Editor view re-parses the Markdown and updates the rendered content.
