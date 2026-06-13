import { useState } from 'react';
import {
  Dialog,
  Box,
  Text,
  TextInput,
  Button,
  IconButton,
  ActionMenu,
  ActionList,
  Label as PrimerLabel,
} from '@primer/react';
import { PlusIcon, TrashIcon, TriangleDownIcon } from '@primer/octicons-react';
import type { Label } from '@shared/note-labels';
import { LABEL_COLORS } from '@shared/note-labels';
import { toLabelVariant } from '../../utils/labelColor';

interface LabelManagerDialogProps {
  labels: Label[];
  onClose: () => void;
  onChanged: () => void;
}

function ColorMenu({
  color,
  onSelect,
  testid,
}: {
  color: string;
  onSelect: (color: string) => void;
  testid?: string;
}): JSX.Element {
  return (
    <ActionMenu>
      <ActionMenu.Button trailingVisual={TriangleDownIcon} data-testid={testid}>
        <PrimerLabel variant={toLabelVariant(color)}>{color}</PrimerLabel>
      </ActionMenu.Button>
      <ActionMenu.Overlay width="small">
        <ActionList selectionVariant="single">
          {LABEL_COLORS.map((option) => (
            <ActionList.Item
              key={option}
              selected={option === color}
              onSelect={() => onSelect(option)}
            >
              <PrimerLabel variant={toLabelVariant(option)}>{option}</PrimerLabel>
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

export function LabelManagerDialog({
  labels,
  onClose,
  onChanged,
}: LabelManagerDialogProps): JSX.Element {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('default');
  const [pendingDelete, setPendingDelete] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const run = async (action: () => Promise<unknown>): Promise<void> => {
    try {
      await action();
      onChanged();
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const create = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void run(async () => {
      await window.api.createLabel(trimmed, color);
      setName('');
      setColor('default');
    });
  };

  return (
    <Dialog title="Manage labels" onClose={onClose} data-testid="label-manager">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {error && (
          <Text sx={{ color: 'danger.fg', fontSize: 0 }} data-testid="label-manager-error">
            {error}
          </Text>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextInput
            aria-label="New label name"
            placeholder="New label"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create();
            }}
            data-testid="new-label-name"
            sx={{ flex: 1 }}
          />
          <ColorMenu color={color} onSelect={setColor} testid="new-label-color" />
          <Button leadingVisual={PlusIcon} onClick={create} data-testid="create-label">
            Add
          </Button>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {labels.length === 0 ? (
            <Text sx={{ color: 'fg.muted', fontSize: 0 }}>No labels yet.</Text>
          ) : (
            labels.map((label) => (
              <Box
                key={label.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                data-testid={`label-row-${label.name}`}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <PrimerLabel variant={toLabelVariant(label.color)}>{label.name}</PrimerLabel>
                </Box>
                {pendingDelete === label.id ? (
                  <>
                    <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Remove?</Text>
                    <Button
                      variant="danger"
                      size="small"
                      data-testid={`confirm-delete-${label.name}`}
                      onClick={() =>
                        void run(async () => {
                          await window.api.deleteLabel(label.id);
                          setPendingDelete(undefined);
                        })
                      }
                    >
                      Delete
                    </Button>
                    <Button size="small" onClick={() => setPendingDelete(undefined)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <ColorMenu
                      color={label.color}
                      onSelect={(next) => void run(() => window.api.setLabelColor(label.id, next))}
                      testid={`recolor-${label.name}`}
                    />
                    <IconButton
                      icon={TrashIcon}
                      aria-label={`Delete label ${label.name}`}
                      variant="invisible"
                      data-testid={`delete-label-${label.name}`}
                      onClick={() => setPendingDelete(label.id)}
                    />
                  </>
                )}
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
