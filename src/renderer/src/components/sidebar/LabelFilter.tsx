import { ActionMenu, ActionList } from '@primer/react';
import { TriangleDownIcon, TagIcon, CheckIcon } from '@primer/octicons-react';
import type { Label } from '@shared/note-labels';
import { toLabelVariant } from '../../utils/labelColor';

interface LabelFilterProps {
  labels: Label[];
  selected: string | undefined;
  onSelect: (label: string | undefined) => void;
}

/** A dropdown that filters the notes list by a single label. */
export function LabelFilter({ labels, selected, onSelect }: LabelFilterProps): JSX.Element {
  return (
    <ActionMenu>
      <ActionMenu.Button
        leadingVisual={TagIcon}
        trailingVisual={TriangleDownIcon}
        data-testid="label-filter"
        sx={{ width: '100%' }}
      >
        {selected ?? 'All notes'}
      </ActionMenu.Button>
      <ActionMenu.Overlay width="medium">
        <ActionList selectionVariant="single">
          <ActionList.Item selected={selected === undefined} onSelect={() => onSelect(undefined)}>
            All notes
            {selected === undefined && (
              <ActionList.TrailingVisual>
                <CheckIcon />
              </ActionList.TrailingVisual>
            )}
          </ActionList.Item>
          {labels.length > 0 && <ActionList.Divider />}
          {labels.map((label) => (
            <ActionList.Item
              key={label.id}
              selected={selected === label.name}
              onSelect={() => onSelect(label.name)}
              data-testid={`label-filter-option-${label.name}`}
            >
              <ActionList.LeadingVisual>
                <TagIcon />
              </ActionList.LeadingVisual>
              {label.name}
              <ActionList.TrailingVisual sx={{ color: `${toLabelVariant(label.color)}.fg` }}>
                {selected === label.name ? <CheckIcon /> : null}
              </ActionList.TrailingVisual>
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}
