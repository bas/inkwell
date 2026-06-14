import { SegmentedControl } from '@primer/react';
import { SunIcon, MoonIcon, DeviceDesktopIcon } from '@primer/octicons-react';
import type { ColorModePreference } from '@shared/types';

interface ThemeToggleProps {
  preference: ColorModePreference;
  onChange: (mode: ColorModePreference) => void;
}

const ORDER: ColorModePreference[] = ['light', 'auto', 'dark'];

/** Light / Auto / Dark override. `auto` follows the macOS system appearance. */
export function ThemeToggle({ preference, onChange }: ThemeToggleProps): JSX.Element {
  return (
    <SegmentedControl
      aria-label="Color mode"
      size="small"
      data-testid="theme-toggle"
      onChange={(index: number) => {
        const next = ORDER[index];
        if (next) onChange(next);
      }}
    >
      <SegmentedControl.IconButton
        icon={SunIcon}
        aria-label="Light"
        selected={preference === 'light'}
      />
      <SegmentedControl.IconButton
        icon={DeviceDesktopIcon}
        aria-label="Auto"
        selected={preference === 'auto'}
      />
      <SegmentedControl.IconButton
        icon={MoonIcon}
        aria-label="Dark"
        selected={preference === 'dark'}
      />
    </SegmentedControl>
  );
}
