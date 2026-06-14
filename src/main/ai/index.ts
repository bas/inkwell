import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc';
import { getAiAvailability } from './availability';
import { disposeCopilotClient } from './copilotClient';

/** Register all AI-related IPC handlers. */
export function registerAiHandlers(): void {
  ipcMain.handle(IpcChannels.aiGetAvailability, () => getAiAvailability());
}

/** Release the Copilot runtime on shutdown. Safe to call when never started. */
export async function disposeAi(): Promise<void> {
  await disposeCopilotClient();
}
