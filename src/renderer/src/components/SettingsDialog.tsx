import { useId } from 'react';
import { Dialog, Box, Text, ToggleSwitch } from '@primer/react';
import type { AppFeatures } from '@shared/types';

interface SettingsDialogProps {
  features: AppFeatures;
  onClose: () => void;
  onSetFeatures: (features: Partial<AppFeatures>) => void;
}

export function SettingsDialog({
  features,
  onClose,
  onSetFeatures,
}: SettingsDialogProps): JSX.Element {
  const labelsLabelId = useId();

  return (
    <Dialog title="Settings" onClose={onClose} data-testid="settings-dialog">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
          }}
        >
          <Box>
            <Text id={labelsLabelId} sx={{ fontWeight: 'semibold', fontSize: 1 }}>
              Labels
            </Text>
            <Text as="p" sx={{ color: 'fg.muted', fontSize: 0, m: 0 }}>
              Group and filter notes with colour-coded labels.
            </Text>
          </Box>
          <ToggleSwitch
            aria-labelledby={labelsLabelId}
            checked={features.labels}
            onChange={(checked) => onSetFeatures({ labels: checked })}
            size="small"
            data-testid="settings-labels-toggle"
          />
        </Box>
      </Box>
    </Dialog>
  );
}
