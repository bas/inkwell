import { Box, Text } from '@primer/react';
import type { AiUsage } from '@shared/ai';

interface AiUsageSummaryProps {
  usage?: AiUsage;
  pending: boolean;
}

function formatTokens(usage: AiUsage): string | undefined {
  const parts: string[] = [];
  if (typeof usage.inputTokens === 'number') parts.push(`in ${usage.inputTokens.toLocaleString()}`);
  if (typeof usage.outputTokens === 'number')
    parts.push(`out ${usage.outputTokens.toLocaleString()}`);
  if (typeof usage.cacheReadTokens === 'number') {
    parts.push(`cache read ${usage.cacheReadTokens.toLocaleString()}`);
  }
  if (typeof usage.cacheWriteTokens === 'number') {
    parts.push(`cache write ${usage.cacheWriteTokens.toLocaleString()}`);
  }
  if (typeof usage.reasoningTokens === 'number') {
    parts.push(`reasoning ${usage.reasoningTokens.toLocaleString()}`);
  }
  return parts.length ? parts.join(' • ') : undefined;
}

/** Request-scoped AI usage display, shared by summarize/review style dialogs. */
export function AiUsageSummary({ usage, pending }: AiUsageSummaryProps): JSX.Element {
  const tokenLine = usage ? formatTokens(usage) : undefined;

  return (
    <Box
      data-testid="ai-usage-panel"
      sx={{
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        p: 3,
        bg: 'canvas.subtle',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Usage for this request</Text>
      {pending && (
        <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="ai-usage-pending">
          Collecting model and token usage…
        </Text>
      )}
      {usage?.model && (
        <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="ai-usage-model">
          Model: {usage.model}
        </Text>
      )}
      {tokenLine && (
        <Text sx={{ fontSize: 0, color: 'fg.muted' }} data-testid="ai-usage-tokens">
          Tokens: {tokenLine}
        </Text>
      )}
    </Box>
  );
}
