import { Box, Typography, Stack, Button, Dialog, DialogContent, DialogActions, styled } from '@cluster-apps/ui';
import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { exampleModels, type ModelCard } from '~/inference/model';
import { SNIPPET_TABS, envSnippet, callSnippet, type SnippetLang } from '~/inference/snippets';

/**
 * "Show me how" — the quickstart modal ("Call a model from your laptop or app"),
 * opened from the Models hero. Tabs for the OpenAI SDK, Anthropic SDK, curl and
 * speech models, each with three steps: create a key, set the base URL + key in
 * the environment, call a model. Code is wired to a live model id when known.
 */
const Code = styled('pre')({
  margin: 0,
  padding: '12px 14px',
  borderRadius: 8,
  backgroundColor: 'var(--i-code-bg, #0f1729)',
  color: 'var(--i-code-tx, #e2e8f0)',
  font: '12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  overflowX: 'auto',
  whiteSpace: 'pre',
});

const TabButton = styled('button', { shouldForwardProp: (p) => p !== 'active' })<{ active: boolean }>(
  ({ theme, active }) => ({
    appearance: 'none',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: theme.spacing(0.5, 0),
    marginRight: theme.spacing(2.5),
    font: '600 14px/1 inherit',
    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
    borderBottom: `2px solid ${active ? theme.palette.primary.main : 'transparent'}`,
  }),
);

const StepNo = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  font: '600 12px/1 inherit',
  flexShrink: 0,
}));

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };
  return (
    <Box position="relative">
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        onClick={copy}
        sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#fff', '&:hover': { backgroundColor: '#fff' } }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <Code>{text}</Code>
    </Box>
  );
}

function Step({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <StepNo>{no}</StepNo>
      <Box flex={1} minWidth={0}>
        <Typography variant="subtitle2" marginBottom="8px">
          {title}
        </Typography>
        {children}
      </Box>
    </Stack>
  );
}

export type ShowMeHowDialogProps = {
  open: boolean;
  onClose: () => void;
  cards: ModelCard[];
};

const ShowMeHowDialog = ({ open, onClose, cards }: ShowMeHowDialogProps) => {
  const [lang, setLang] = useState<SnippetLang>('openai');
  const navigate = useNavigate();
  const models = useMemo(() => exampleModels(cards), [cards]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth className="inference-root">
      <Box padding="20px 24px 0" display="flex" alignItems="center" justifyContent="space-between">
        <Typography variant="h4">Call a model from your laptop or app</Typography>
        <Button variant="text" color="secondary" onClick={onClose} sx={{ minWidth: 32 }}>
          ✕
        </Button>
      </Box>

      <DialogContent>
        <Box borderBottom={(theme) => `1px solid ${theme.palette.divider}`} marginBottom="20px">
          {SNIPPET_TABS.map((t) => (
            <TabButton key={t.id} active={lang === t.id} onClick={() => setLang(t.id)}>
              {t.label}
            </TabButton>
          ))}
        </Box>

        <Stack spacing={2.5}>
          <Step no={1} title="Create an API key">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Your wallet signs it. Copy it: it’s shown once.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  onClose();
                  navigate('/inference/keys');
                }}
                sx={{ flexShrink: 0 }}
              >
                Create API key
              </Button>
            </Stack>
          </Step>

          <Step no={2} title="Put the base URL and the key in your environment">
            <CodeBlock text={envSnippet(lang)} />
          </Step>

          <Step no={3} title="Call a model">
            <CodeBlock text={callSnippet(lang, { chatModel: models.chat, speechModel: models.speech })} />
          </Step>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ padding: '0 24px 20px' }}>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShowMeHowDialog;
