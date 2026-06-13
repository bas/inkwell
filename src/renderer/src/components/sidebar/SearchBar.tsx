import { TextInput } from '@primer/react';
import { SearchIcon, XCircleFillIcon } from '@primer/octicons-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps): JSX.Element {
  return (
    <TextInput
      aria-label="Search notes"
      placeholder="Search notes"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      leadingVisual={SearchIcon}
      trailingAction={
        value ? (
          <TextInput.Action
            onClick={() => onChange('')}
            icon={XCircleFillIcon}
            aria-label="Clear search"
            sx={{ color: 'fg.subtle' }}
          />
        ) : undefined
      }
      data-testid="search-input"
      sx={{ width: '100%' }}
    />
  );
}
