import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import type { NotesService } from '../storage/notesService';
import { getAiAvailability } from './availability';
import { disposeCopilotClient } from './copilotClient';
import { registerSummarizeHandler } from './summarize';

/** Register all AI-related IPC handlers. */
export function registerAiHandlers(service: NotesService): void {
  ipcMain.handle(IpcChannels.aiGetAvailability, () => getAiAvailability());
  registerSummarizeHandler(service);
}

/** Release the Copilot runtime on shutdown. Safe to call when never started. */
export async function disposeAi(): Promise<void> {
  await disposeCopilotClient();
}
