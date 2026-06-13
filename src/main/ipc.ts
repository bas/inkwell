import { ipcMain } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { CreateNoteInput, UpdateNoteInput } from '../shared/note';
import type { NotesService } from './storage/notesService';

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new Error(`Expected ${name} to be a string`);
  return value;
}

function assertNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected ${name} to be a number`);
  }
  return value;
}

function validateCreateInput(value: unknown): CreateNoteInput {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid note input');
  const v = value as Record<string, unknown>;
  return {
    title: typeof v['title'] === 'string' ? v['title'] : undefined,
    body: typeof v['body'] === 'string' ? v['body'] : undefined,
    labels: Array.isArray(v['labels'])
      ? v['labels'].filter((l): l is string => typeof l === 'string')
      : undefined,
  };
}

function validateUpdateInput(value: unknown): UpdateNoteInput {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid note input');
  const v = value as Record<string, unknown>;
  return {
    id: assertString(v['id'], 'id'),
    title: typeof v['title'] === 'string' ? v['title'] : undefined,
    body: typeof v['body'] === 'string' ? v['body'] : undefined,
    labels: Array.isArray(v['labels'])
      ? v['labels'].filter((l): l is string => typeof l === 'string')
      : undefined,
    pinned: typeof v['pinned'] === 'boolean' ? v['pinned'] : undefined,
  };
}

/** Register all note and label IPC handlers. */
export function registerNoteHandlers(service: NotesService): void {
  ipcMain.handle(IpcChannels.listNotes, (_e, labelName: unknown) =>
    service.listNotes(typeof labelName === 'string' ? labelName : undefined),
  );
  ipcMain.handle(IpcChannels.searchNotes, (_e, query: unknown) =>
    service.searchNotes(assertString(query, 'query')),
  );
  ipcMain.handle(IpcChannels.getNote, (_e, id: unknown) => service.getNote(assertString(id, 'id')));
  ipcMain.handle(IpcChannels.createNote, (_e, input: unknown) =>
    service.createNote(validateCreateInput(input)),
  );
  ipcMain.handle(IpcChannels.updateNote, (_e, input: unknown) =>
    service.updateNote(validateUpdateInput(input)),
  );
  ipcMain.handle(IpcChannels.deleteNote, (_e, id: unknown) =>
    service.deleteNote(assertString(id, 'id')),
  );

  ipcMain.handle(IpcChannels.listLabels, () => service.listLabels());
  ipcMain.handle(IpcChannels.createLabel, (_e, name: unknown, color: unknown) =>
    service.createLabel(assertString(name, 'name'), typeof color === 'string' ? color : undefined),
  );
  ipcMain.handle(IpcChannels.setLabelColor, (_e, id: unknown, color: unknown) =>
    service.setLabelColor(assertNumber(id, 'id'), assertString(color, 'color')),
  );
  ipcMain.handle(IpcChannels.deleteLabel, (_e, id: unknown) =>
    service.deleteLabel(assertNumber(id, 'id')),
  );
}
