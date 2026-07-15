import { Box, Checkbox, Dialog, Flash, FormControl, Heading, Text } from '@primer/react';
import type { AppSettings, FeatureKey } from '@shared/types';
import type { Label } from '@shared/note-labels';
import { LabelManagerPanel } from '../labels/LabelManagerPanel';

interface SettingsDialogProps {
  settings: AppSettings;
  labels: Label[];
  error?: string;
  onClose: () => void;
  onFeatureChange: (feature: FeatureKey, enabled: boolean) => void;
  onLabelsChanged: () => void;
}

export function SettingsDialog({
  settings,
  labels,
  error,
  onClose,
  onFeatureChange,
  onLabelsChanged,
}: SettingsDialogProps): JSX.Element {
  return (
    <Dialog title="Settings" onClose={onClose}>
      <Box data-testid="settings-dialog" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {error && (
          <Flash variant="danger" data-testid="settings-error">
            {error}
          </Flash>
        )}

        <Box as="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Heading as="h2" sx={{ fontSize: 2 }}>
              Features
            </Heading>
            <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 1, mt: 1 }}>
              Choose which organization and writing-assistant tools are visible in Inkwell.
            </Text>
          </Box>

          <FormControl>
            <Checkbox
              checked={settings.features.labels}
              onChange={(event) => onFeatureChange('labels', event.currentTarget.checked)}
              data-testid="feature-labels-toggle"
            />
            <FormControl.Label>Labels</FormControl.Label>
            <FormControl.Caption>
              Show label grouping, label chips, and per-note label controls. Turning this off keeps
              existing label data intact.
            </FormControl.Caption>
          </FormControl>

          <FormControl>
            <Checkbox
              checked={settings.features.copilot}
              onChange={(event) => onFeatureChange('copilot', event.currentTarget.checked)}
              data-testid="feature-copilot-toggle"
            />
            <FormControl.Label>Copilot writing tools</FormControl.Label>
            <FormControl.Caption>
              Preference is saved here so Copilot controls can be gated consistently as the feature
              settings surface grows.
            </FormControl.Caption>
          </FormControl>
        </Box>

        <Box as="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Heading as="h2" sx={{ fontSize: 2 }}>
              Labels
            </Heading>
            <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 1, mt: 1 }}>
              Manage the global label list used by note chips and label grouping.
            </Text>
          </Box>
          <LabelManagerPanel
            labels={labels}
            enabled={settings.features.labels}
            onChanged={onLabelsChanged}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
