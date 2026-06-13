---
applyTo: 'src/renderer/editor/**'
---

# Editor (TipTap) rules

- The editor is WYSIWYG via TipTap/ProseMirror, with a raw-markdown source toggle.
- **Markdown must round-trip.** Document → markdown → document must be stable for the v1-supported
  subset: headings, bold/italic, links, bullet/ordered/task lists, tables, code, blockquotes.
- Every serialization change ships with **golden `.md` fixture** unit tests.
- Define explicit behavior for the source toggle: parse failure, unsupported syntax, and unsaved
  WYSIWYG changes must be handled, not silently dropped.
- Preserve YAML frontmatter across edits — it is owned by the storage layer, not the body editor.
- Wire undo/redo to the native Edit menu; history must survive formatting, title edits, source
  toggling, and note switching.
- Custom CSS for the ProseMirror surface is allowed but must use Primer tokens only — no ad-hoc
  colors or spacing.
