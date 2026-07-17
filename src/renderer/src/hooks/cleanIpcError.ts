/**
 * Strip Electron's IPC wrapper from an error message so the UI shows the friendly
 * message thrown in main, not the raw plumbing.
 *
 * When an `ipcMain.handle` callback throws, Electron rejects the renderer's
 * invoke with a message shaped like:
 *
 *   Error invoking remote method 'git:setEnabled': Error: <real message>
 *   Error invoking remote method 'git:setEnabled': GitCommandError: <real message>
 *
 * This removes the `Error invoking remote method '<channel>': ` prefix and the
 * following error-class token, leaving just the human-readable message.
 */
export function cleanIpcError(message: string): string {
  let text = message.replace(/^Error invoking remote method '[^']*':\s*/, '');
  text = text.replace(/^(?:[A-Za-z]*Error):\s*/, '');
  return text.trim();
}
