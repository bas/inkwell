import { useState } from 'react';
import { SelectPanel, Button } from '@primer/react';
import type { SelectPanelItemInput } from '@primer/react';
import { TriangleDownIcon, TagIcon, PlusIcon } from '@primer/octicons-react';
import type { Label } from '@shared/note-labels';

interface LabelPickerProps {
  noteLabels: string[];
  allLabels: Label[];
  onChange: (labels: string[]) => void;
  onCreateAndAssign: (name: string) => void;
}

/** Assign or remove labels on the current note, with inline label creation. */
export function LabelPicker({
  noteLabels,
  allLabels,
  onChange,
  onCreateAndAssign,
}: LabelPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const items: SelectPanelItemInput[] = allLabels
    .filter((label) => label.name.toLowerCase().includes(filter.toLowerCase()))
    .map((label) => ({ id: label.name, text: label.name, leadingVisual: TagIcon }));

  const selected = items.filter((item) => noteLabels.includes(String(item.id)));

  const trimmed = filter.trim();
  const exactExists = allLabels.some((label) => label.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <SelectPanel
      title="Apply labels"
      renderAnchor={({ children, ...anchorProps }) => (
        <Button
          leadingVisual={TagIcon}
          trailingAction={TriangleDownIcon}
          data-testid="label-picker"
          {...anchorProps}
        >
          {children ?? 'Labels'}
        </Button>
      )}
      open={open}
      onOpenChange={(next) => setOpen(next)}
      items={items}
      selected={selected}
      onSelectedChange={(next: SelectPanelItemInput[]) =>
        onChange(next.map((item) => String(item.id)))
      }
      onFilterChange={setFilter}
      filterValue={filter}
      showItemDividers
      width="medium"
      height="medium"
      secondaryAction={
        trimmed !== '' && !exactExists ? (
          <SelectPanel.SecondaryActionButton
            leadingVisual={PlusIcon}
            data-testid="create-label-inline"
            onClick={() => {
              onCreateAndAssign(trimmed);
              setFilter('');
            }}
          >
            Create label “{trimmed}”
          </SelectPanel.SecondaryActionButton>
        ) : undefined
      }
    />
  );
}
