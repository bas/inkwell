import { Box } from '@primer/react';

/** Thin vertical hairline used to group controls inside a toolbar. */
export function Separator(): JSX.Element {
  return (
    <Box
      aria-hidden
      sx={{ width: '1px', height: 'var(--base-size-20, 1.25rem)', bg: 'border.default', mx: 1 }}
    />
  );
}
