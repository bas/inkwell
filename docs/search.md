# Search & Filtering

## Full-text search

The search bar at the top of the sidebar searches across all note titles and bodies.

1. Click the search bar (or press **⌘ F** to focus it from the keyboard — if supported by your macOS version).
2. Start typing. The note list updates in real time as you type.
3. Clear the field to return to the full list.

Search uses SQLite FTS5, so it is fast even with thousands of notes. It matches whole words by default; partial-word matches at the start of a word are also returned.

## Filtering by label

The **label filter** drop-down below the search bar narrows the list to notes that carry a specific label.

1. Click the label filter drop-down.
2. Select a label. The note list immediately shows only matching notes.
3. Select the empty option (top of the list) to clear the filter.

## Combining search and label filter

Search and label filter work together. When both are active the note list shows notes that match **both** the search query and the selected label.

## No results

When no notes match the current query or filter, the note list shows:

> _No matching notes_
> Try a different search or label filter.

Clear the search field and/or the label filter to broaden the results.
