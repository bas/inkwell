# Notes

## Creating a note

- Click the **New note** button at the top of the sidebar.
- Press **⌘ N** from anywhere in the app.
- On the empty-state screen (no note selected), click the **New note** button in the centre panel.

A new untitled note opens immediately and the title field is ready to type in.

## Editing the title

Click the large bold title field at the top of the editor pane and type. The title is saved automatically along with the note body.

If you leave the title blank, the note is saved as **Untitled**.

## Autosave

Inkwell saves changes automatically. There is no manual save step. The save state indicator beneath the title shows:

| Indicator         | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| _Updated X ago_   | The note is saved. Time is relative to the last save.              |
| _Unsaved changes_ | A save is pending (starts within a second of your last keystroke). |
| _Saving…_         | The save is in progress.                                           |
| _Saved_           | The most recent save succeeded.                                    |
| _Save failed_     | An error occurred. A red banner appears with the error message.    |

## Pinning a note

Pinned notes appear at the top of the note list regardless of sort order.

1. Open the note you want to pin.
2. Click the **⋯** (note actions) menu in the toolbar.
3. Select **Pin note**.

To unpin, open the same menu and select **Unpin note**.

## Copying a note as Markdown

1. Open the **⋯** menu in the toolbar.
2. Select **Copy as Markdown**.

The full note (heading + body) is copied to the clipboard as plain Markdown text. The indicator beneath the title briefly shows _Copied to clipboard_.

## Deleting a note

1. Open the **⋯** menu in the toolbar.
2. Select **Delete note**.
3. Confirm in the dialog that appears.

Deletion is permanent — the `.md` file is removed from the vault. There is no trash or undo.

## Note list

The sidebar lists all notes in the vault. Each entry shows:

- **Title** (or _Untitled_ if the title is blank)
- **Snippet** — the first line or two of the body
- **Labels** attached to the note
- A **pin icon** if the note is pinned

Pinned notes appear above unpinned ones. Within each group notes are sorted by last-updated time (newest first).
