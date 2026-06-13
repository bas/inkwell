import { Menu, MenuItem, type Session, type WebContents } from 'electron';

/** Enable the built-in English (US) spellchecker for a session. */
export function configureSpellcheck(session: Session): void {
  try {
    session.setSpellCheckerLanguages(['en-US']);
  } catch {
    // Spellcheck is best-effort; ignore unsupported platforms/languages.
  }
}

/**
 * Show a context menu with spelling suggestions and standard editing actions
 * when the user right-clicks inside an editable region.
 */
export function attachSpellcheckMenu(webContents: WebContents): void {
  webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({
          label: suggestion,
          click: () => webContents.replaceMisspelling(suggestion),
        }),
      );
    }

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
      menu.append(
        new MenuItem({
          label: 'Add to Dictionary',
          click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        }),
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.isEditable || params.editFlags.canCopy) {
      menu.append(new MenuItem({ role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ role: 'paste', enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'selectAll' }));
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });
}
