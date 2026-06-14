import { ipcMain, type WebContents } from 'electron';
import type { AiError, AiErrorCode, AiResult } from '../../shared/ai';
import { IpcChannels } from '../../shared/ipc';
import type { NotesService } from '../storage/notesService';
import { getAiAvailability } from './availability';
import { buildSummarizePrompt } from './prompts';
import { runGeneration } from './runner';
import { upsertTldrBlock } from './tldr';

/** Map a runtime `errorType` category to Inkwell's typed AI error code. */
function classifyErrorType(errorType: string | undefined): AiErrorCode {
  switch (errorType) {
    case 'quota':
    case 'authorization':
      return 'no-entitlement';
    case 'authentication':
      return 'not-authenticated';
    default:
      return 'generation-failed';
  }
}

/**
 * Summarize a note's body with Copilot, streaming deltas back to the calling
 * renderer over {@link IpcChannels.aiStreamDelta}. Always resolves with a typed
 * {@link AiResult}; runtime/auth/model failures become `ok: false` error states
 * rather than thrown IPC errors.
 */
async function summarizeNote(
  service: NotesService,
  sender: WebContents,
  noteId: string,
  requestId: string,
): Promise<AiResult> {
  const availability = await getAiAvailability();
  if (!availability.ready) {
    const error: AiError = {
      code: availability.reason,
      message: availability.message ?? 'Copilot is unavailable.',
    };
    return { ok: false, requestId, error };
  }

  const note = await service.getNote(noteId);
  if (!note.body.trim()) {
    return {
      ok: false,
      requestId,
      error: { code: 'empty-note', message: 'This note has no content to summarize.' },
    };
  }

  const outcome = await runGeneration({
    prompt: buildSummarizePrompt(note.body),
    onDelta: (delta) => {
      if (!sender.isDestroyed()) {
        sender.send(IpcChannels.aiStreamDelta, { requestId, delta });
      }
    },
  });

  if (!outcome.ok) {
    return {
      ok: false,
      requestId,
      error: { code: classifyErrorType(outcome.errorType), message: outcome.message },
    };
  }
  return { ok: true, requestId, content: outcome.content };
}

/** Register the summarize and TL;DR-insert IPC handlers. */
export function registerSummarizeHandler(service: NotesService): void {
  ipcMain.handle(IpcChannels.aiSummarize, (event, noteId: unknown, requestId: unknown) => {
    if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
    if (typeof requestId !== 'string') throw new Error('Expected requestId to be a string');
    return summarizeNote(service, event.sender, noteId, requestId);
  });

  ipcMain.handle(IpcChannels.aiInsertTldr, async (_event, noteId: unknown, summary: unknown) => {
    if (typeof noteId !== 'string') throw new Error('Expected noteId to be a string');
    if (typeof summary !== 'string') throw new Error('Expected summary to be a string');
    if (!summary.trim()) throw new Error('Cannot insert an empty summary');
    const note = await service.getNote(noteId);
    return service.updateNote({ id: noteId, body: upsertTldrBlock(note.body, summary) });
  });
}
