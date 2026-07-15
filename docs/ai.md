# AI Features (Copilot)

Inkwell integrates with GitHub Copilot to provide three AI-powered writing tools: **Tidy up**, **Summarise**, and **Review**. All require an active GitHub Copilot subscription and network access.

Access **Tidy up** from the ✨ (sparkle) button in the editor toolbar, or find all three tools in the **⋯** (note actions) menu.

---

## Tidy up with Copilot

One click cleans up the current note: it applies low-risk fixes automatically and surfaces the rest for review.

### Starting a tidy

1. Open the note you want to tidy.
2. Click the ✨ **Tidy up with Copilot** button in the toolbar (or select it from the **⋯** menu).
3. Inkwell saves the note, then a **Tidy up** panel opens on the right side of the editor.

### What gets applied automatically

Low-risk, high-confidence **spelling** and **capitalization** fixes are applied silently before the panel opens. A green banner at the top of the panel reports how many were applied, with an **Undo** button that restores the note to its exact pre-tidy state.

### What you review

Everything else is surfaced as a suggestion you can apply or reject individually — or in a batch:

- **Formatting** — structural improvements using Markdown headings (levels 1–3), paragraphs, lists, task lists, tables, code, and links. Existing wording is preserved.
- **Label** — a suggested topical label. Applying it adds the label to the note (creating it if needed) rather than editing the body. Label suggestions only appear when the labels feature is enabled.
- **Other** — any remaining small improvement.

Each suggestion shows a **category** badge, a **severity** badge, a rationale, and a before/after preview (or a label preview). Body suggestions apply bottom-up so earlier edits don't shift the line targets of later ones.

### Undoing

If the automatic fixes weren't what you wanted, click **Undo** in the banner. This restores the note body captured before tidying and closes the panel.

### Errors

If tidying fails (network error, Copilot unavailable, or an empty note), an error message is shown with a **Try again** button.

---

## Summarise with Copilot

Generates a concise summary of the current note.

### Starting a summary

1. Open the note you want to summarise.
2. Open the **⋯** menu and select **Summarize with Copilot**.
3. Inkwell saves the note, then a **Summary** dialog opens and the summary streams in.

### While streaming

- The summary text appears progressively as Copilot generates it.
- Click **Stop** to halt generation early. Any text generated so far is kept.

### When the summary is complete

You have two options:

| Button              | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| **Copy**            | Copies the summary text to the clipboard.                            |
| **Insert as TL;DR** | Prepends a `> **TL;DR:** …` block-quote to the top of the note body. |

Click **Close** to dismiss the dialog without making any changes.

### Errors

If the summary fails (for example due to a network error or a Copilot availability issue), an error message is shown with a **Try again** button.

---

## Review with Copilot

Analyses the note and returns a list of writing suggestions — for things like clarity, structure, grammar, and style.

### Starting a review

1. Open the **⋯** menu and select **Review with Copilot**.
2. Inkwell saves the note, then a **Review** panel opens on the right side of the editor.

### The Review panel

The panel lists each suggestion returned by Copilot. Each suggestion shows:

- A **severity badge** (High / Medium / Low) indicating how impactful the change is.
- A **category** (e.g. Clarity, Grammar, Style).
- The **suggested replacement text**.
- The **original text** that would be replaced.
- A status badge: _Pending_ · _Applied_ · _Rejected_ · _Outdated_.

### Applying suggestions

**One at a time** — Click **Apply** on a suggestion to apply it. The note body is updated in place and the suggestion status changes to _Applied_.

**All at once** — Click **Apply all** (or **Apply selected**) to apply multiple pending suggestions in a single action. Suggestions are applied bottom-up so earlier changes do not shift the line positions of later ones.

**Rejecting** — Click the **✕** button on a suggestion to mark it as _Rejected_. This keeps it visible for reference but excludes it from batch operations.

### Outdated suggestions

If you edit the note while the review panel is open, some suggestions may become _Outdated_ (the original text they targeted no longer exists). You can close the panel and start a new review at any time.

### Refining the review

The text field at the bottom of the Review panel lets you give Copilot additional instructions:

- Type a refinement instruction (e.g. _"Focus only on grammar"_ or _"Make the tone more formal"_).
- Press **↵** or click the **Send** button.
- A new review is generated with that instruction in scope.

If a suggestion is selected when you submit a refinement, Copilot scopes the new review to that suggestion's location in the note.

### Closing the review

Click **✕** at the top of the Review panel to close it. Any _Applied_ changes are already saved to the note.

---

## Token usage

A small token-usage summary is displayed at the bottom of both the Summary dialog and the Review panel after generation completes, showing the number of prompt and completion tokens used.

---

## Availability

If GitHub Copilot is not available (no subscription, or the service is unreachable), the AI actions surface a typed error with an explanation when you try to use them.
