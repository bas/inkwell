# Inkwell — User Guide

Inkwell is a macOS desktop app for writing and organising notes in Markdown. Notes are stored as plain `.md` files in a folder on your Mac (your *vault*), so they are always readable outside the app and easy to back up or sync.

## Contents

| Guide | What it covers |
|---|---|
| [Notes](notes.md) | Creating, opening, saving, pinning, and deleting notes |
| [Editor](editor.md) | The WYSIWYG editor, formatting toolbar, and raw-Markdown source view |
| [Labels](labels.md) | Tagging notes with coloured labels and filtering by label |
| [Search](search.md) | Full-text search and combined search + label filtering |
| [AI features](ai.md) | Summarise a note and get writing suggestions with Copilot |
| [Appearance](appearance.md) | Light, dark, and system-adaptive colour modes |

## Quick start

1. Launch Inkwell. On the first run it creates a vault folder at `~/Documents/Inkwell`.
2. Click **New note** (or press **⌘ N**) to create your first note.
3. Type a title in the title field at the top, then start writing in the editor below.
4. Changes are saved automatically — no save shortcut needed.

## Your notes on disk

Every note is a single `.md` file with a small block of YAML frontmatter followed by the note body:

```markdown
---
id: abc123
title: My first note
labels: []
pinned: false
createdAt: '2024-01-15T10:30:00.000Z'
updatedAt: '2024-01-15T11:00:00.000Z'
---

Note body goes here.
```

You can open, edit, and rename these files with any text editor. Inkwell picks up external changes automatically.

## Native menu

| Menu | Item | Shortcut | Action |
|---|---|---|---|
| File | New Note | ⌘ N | Create a new note |
| File | Reveal Vault in Finder | — | Open the vault folder in Finder |
| File | Rebuild Index | — | Rebuild the search index from the files on disk |
