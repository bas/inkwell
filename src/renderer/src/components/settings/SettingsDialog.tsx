import { Box, Checkbox, Dialog, Flash, FormControl, Heading, Select, Text } from '@primer/react';
import type { AiModelInfo } from '@shared/ai';
import type { AppSettings, FeatureKey } from '@shared/types';
import type { Label } from '@shared/note-labels';
import { LabelManagerPanel } from '../labels/LabelManagerPanel';
import { BackupSettingsSection } from '../backup/BackupSettingsSection';
import { VaultSettingsSection } from './VaultSettingsSection';

interface SettingsDialogProps {
  settings: AppSettings;
  aiModels: AiModelInfo[];
  aiModelsLoading: boolean;
  aiModelsError?: string;
  labels: Label[];
  error?: string;
  onClose: () => void;
  onFeatureChange: (feature: FeatureKey, enabled: boolean) => void;
  onLabelsChanged: () => void;
  onAiModelChange: (model: string) => void;
}

export function SettingsDialog({
  settings,
  aiModels,
  aiModelsLoading,
  aiModelsError,
  labels,
  error,
  onClose,
  onFeatureChange,
  onLabelsChanged,
  onAiModelChange,
}: SettingsDialogProps): JSX.Element {
  const hasSelectedModel =
    settings.aiModel === 'auto' || aiModels.some((m) => m.id === settings.aiModel);
  const modelOptions = hasSelectedModel
    ? aiModels
    : [{ id: settings.aiModel, label: `${settings.aiModel} (currently unavailable)` }, ...aiModels];

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
              Choose which organization tools are visible in Inkwell.
            </Text>
          </Box>

          <FormControl>
            <FormControl.Label>
              <Checkbox
                checked={settings.features.labels}
                onChange={(event) => onFeatureChange('labels', event.currentTarget.checked)}
                data-testid="feature-labels-toggle"
              />{' '}
              Labels
            </FormControl.Label>
            <FormControl.Caption>
              Show label grouping, label chips, and per-note label controls. Turning this off keeps
              existing label data intact.
            </FormControl.Caption>
          </FormControl>

          <FormControl>
            <FormControl.Label>
              <Checkbox
                checked={settings.features.mermaid}
                onChange={(event) => onFeatureChange('mermaid', event.currentTarget.checked)}
                data-testid="feature-mermaid-toggle"
              />{' '}
              Mermaid diagrams
            </FormControl.Label>
            <FormControl.Caption>
              Show Mermaid diagram rendering and insertion tools. Turning this off keeps existing
              diagram Markdown intact.
            </FormControl.Caption>
          </FormControl>
        </Box>

        <Box as="section" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Heading as="h2" sx={{ fontSize: 2 }}>
              AI model
            </Heading>
            <Text sx={{ display: 'block', color: 'fg.muted', fontSize: 1, mt: 1 }}>
              Choose the Copilot model for new AI requests. <strong>Auto</strong> is recommended and
              lets Copilot pick the best available model.
            </Text>
          </Box>
          <FormControl id="ai-model-select">
            <FormControl.Label>Model</FormControl.Label>
            <Select
              value={settings.aiModel}
              disabled={aiModelsLoading}
              onChange={(event) => onAiModelChange(event.currentTarget.value)}
              data-testid="ai-model-select"
            >
              <Select.Option value="auto">Auto (Recommended)</Select.Option>
              {modelOptions.map((model) => (
                <Select.Option key={model.id} value={model.id}>
                  {model.label}
                </Select.Option>
              ))}
            </Select>
            <FormControl.Caption>
              Model changes apply to new AI requests only. If the selected model is unavailable,
              Inkwell falls back to Auto.
            </FormControl.Caption>
          </FormControl>
          {aiModelsError && (
            <Text sx={{ color: 'attention.fg', fontSize: 1 }} data-testid="ai-model-error">
              Could not refresh model list. Auto remains available. ({aiModelsError})
            </Text>
          )}
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

        <VaultSettingsSection />

        <BackupSettingsSection />
      </Box>
    </Dialog>
  );
}
