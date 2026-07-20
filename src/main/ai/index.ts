import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type { NotesService } from '../storage/notesService';
import { getAiAvailability, listAvailableAiModels } from './availability';
import { disposeCopilotClient } from './copilotClient';
import { registerFixHandlers } from './fix';
import { registerReviewHandlers } from './review';
import { registerSummarizeHandler } from './summarize';

/** Register all AI-related IPC handlers. */
export function registerAiHandlers(service: NotesService): void {
  ipcMain.handle(IpcChannels.aiGetAvailability, () => getAiAvailability());
  ipcMain.handle(IpcChannels.aiListModels, () => listAvailableAiModels());
  registerSummarizeHandler(service);
  registerReviewHandlers(service);
  registerFixHandlers(service);
}

/** Release the Copilot runtime on shutdown. Safe to call when never started. */
export async function disposeAi(): Promise<void> {
  await disposeCopilotClient();
}
