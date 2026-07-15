import { ipcMain } from 'electron';
import { IpcChannels } from '../shared/ipc';
import type { CreateNoteInput, UpdateNoteInput } from '../shared/note';
import type { NotesService } from './storage/notesService';
import { readSettings } from './settings';

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
    body: typeof v['body'] === 'string' ? v['body'] : undefined,
    labels: Array.isArray(v['labels'])
      ? v['labels'].filter((l): l is string => typeof l === 'string')
      : undefined,
    pinned: typeof v['pinned'] === 'boolean' ? v['pinned'] : undefined,
  };
}

function assertLabelsEnabled(): void {
  if (!readSettings().features.labels) {
    throw new Error('Labels are disabled in Settings');
  }
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
  ipcMain.handle(IpcChannels.createNote, (_e, input: unknown) => {
    const value = validateCreateInput(input);
    if (value.labels !== undefined) assertLabelsEnabled();
    return service.createNote(value);
  });
  ipcMain.handle(IpcChannels.updateNote, (_e, input: unknown) => {
    const value = validateUpdateInput(input);
    if (value.labels !== undefined) assertLabelsEnabled();
    return service.updateNote(value);
  });
  ipcMain.handle(IpcChannels.deleteNote, (_e, id: unknown) =>
    service.deleteNote(assertString(id, 'id')),
  );

  ipcMain.handle(IpcChannels.listLabels, () => service.listLabels());
  ipcMain.handle(IpcChannels.createLabel, (_e, name: unknown, color: unknown) => {
    assertLabelsEnabled();
    return service.createLabel(
      assertString(name, 'name'),
      typeof color === 'string' ? color : undefined,
    );
  });
  ipcMain.handle(IpcChannels.setLabelColor, (_e, id: unknown, color: unknown) => {
    assertLabelsEnabled();
    return service.setLabelColor(assertNumber(id, 'id'), assertString(color, 'color'));
  });
  ipcMain.handle(IpcChannels.deleteLabel, (_e, id: unknown) => {
    assertLabelsEnabled();
    return service.deleteLabel(assertNumber(id, 'id'));
  });
}
