import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@cluster-apps/ui';

import { useComputeClient } from '~/compute/ComputeProvider';
import { LineSplitter } from '~/compute/agentRun';
import { errorMessage } from '~/compute/client';
import { isLive, type SandboxStatus } from '~/compute/types';
import { text } from '~/theme/tokens';
import { Terminal, sbColor } from '../ui';

const MAX_LINES = 2000;

type Line = { stream: 'stdout' | 'stderr'; text: string };

/**
 * The main process's output (`GET /v1/sandboxes/{id}/logs`, SSE from the
 * start), following the tail. The node keeps it for a while after the sandbox
 * exits; after that the stream is refused and the panel says so.
 */
const LogsPanel = ({ id, status }: { id: string; status: SandboxStatus }) => {
  const client = useComputeClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<'open' | 'ended' | 'error'>('open');
  const [error, setError] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const split = { stdout: new LineSplitter(), stderr: new LineSplitter() };
    const add = (stream: Line['stream'], ls: string[]) => {
      if (ls.length) setLines((cur) => [...cur, ...ls.map((t) => ({ stream, text: t }))].slice(-MAX_LINES));
    };
    setLines([]);
    setState('open');
    setError(null);
    client
      .logs(
        id,
        (e) => {
          if (e.type === 'end') return;
          add(e.type, split[e.type].push(e.data));
        },
        ctl.signal,
      )
      .then(() => {
        add('stdout', split.stdout.flush());
        add('stderr', split.stderr.flush());
        if (!ctl.signal.aborted) setState('ended');
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return;
        setError(errorMessage(e));
        setState('error');
      });
    return () => ctl.abort();
  }, [client, id, attempt]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, follow]);

  const live = isLive(status);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" marginBottom="10px" gap="12px">
        <Typography sx={text.secondary}>
          Output of the sandbox’s main process{state === 'open' && live ? ', live' : ''}. {lines.length} lines.
        </Typography>
        <Stack direction="row" alignItems="center" gap="12px">
          {state !== 'open' && (
            <Button size="small" variant="text" onClick={() => setAttempt((n) => n + 1)}>
              Read again
            </Button>
          )}
          <Box
            component="label"
            sx={{ ...text.secondary, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            Follow
          </Box>
        </Stack>
      </Stack>
      <Terminal
        ref={box}
        role="log"
        aria-live="off"
        sx={{ height: 420 }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight > 24 && follow) setFollow(false);
        }}
      >
        {lines.map((l, i) => (
          <Box key={i} component="div" sx={{ color: l.stream === 'stderr' ? sbColor.termErr : undefined }}>
            {l.text || ' '}
          </Box>
        ))}
        {lines.length === 0 && state === 'open' && (
          <Box component="span" sx={{ color: sbColor.termDim }}>
            {live ? 'Waiting for output…' : 'Reading…'}
          </Box>
        )}
        {state === 'ended' && (
          <Box component="div" sx={{ color: sbColor.termDim, marginTop: lines.length ? '6px' : 0 }}>
            {lines.length ? '— end of output —' : 'No output.'}
          </Box>
        )}
        {state === 'error' && (
          <Box component="div" sx={{ color: sbColor.termWarn }}>
            The log stream isn’t available: {error}
          </Box>
        )}
      </Terminal>
    </Box>
  );
};

export default LogsPanel;
