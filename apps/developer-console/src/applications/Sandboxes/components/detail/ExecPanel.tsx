import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@cluster-apps/ui';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import type { EgressPolicy, ExecExit, SandboxStatus } from '~/compute/types';
import { color, mono, text } from '~/theme/tokens';
import { Terminal, sbColor } from '../ui';

type Run = {
  cmd: string;
  out: { stream: 'stdout' | 'stderr'; text: string }[];
  exit?: ExecExit;
  error?: string;
};

const EXEC_TIMEOUT_S = 60;

/** Python fetches a URL through the proxy (python:3.12-slim has no curl) and prints the status. */
const fetchCmd = (url: string) =>
  `python3 -c "import urllib.request as u; print(u.urlopen('${url}', timeout=15).status)"`;

/** One-click commands, each showing one property of the sandbox. Every one runs for real. */
function suggestions(egress: EgressPolicy): { cmd: string; why: string }[] {
  const get = egress.allow.find((r) => r.methods.includes('GET') && !r.host.startsWith('*.'));
  return [
    { cmd: `python3 -c "print('hello from a DDC sandbox')"`, why: 'Run code' },
    { cmd: 'dmesg | head -3', why: 'The gVisor kernel' },
    { cmd: 'env | sort', why: 'No secrets inside' },
    ...(get ? [{ cmd: fetchCmd(`https://${get.host}${get.path_prefix ?? '/'}`), why: `Allowed: ${get.host}` }] : []),
    { cmd: `${fetchCmd('https://example.com/')} 2>&1 | tail -1`, why: 'Refused by the egress proxy' },
    { cmd: 'ls -la /workspace', why: 'Files' },
  ];
}

/**
 * Run a command (`POST /v1/sandboxes/{id}/exec?stream=1`) and watch its output
 * stream. The line goes to `sh -c`, so pipes and redirects work.
 */
const ExecPanel = ({
  id,
  status,
  workdir,
  egress,
  onRan,
}: {
  id: string;
  status: SandboxStatus;
  workdir: string;
  egress: EgressPolicy;
  onRan?: () => void;
}) => {
  const client = useComputeClient();
  const [cmd, setCmd] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);
  const live = status === 'running';

  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [runs]);

  const run = (line: string) => {
    const c = line.trim();
    if (!c || busy || !live) return;
    setBusy(true);
    setCmd('');
    setRuns((r) => [...r, { cmd: c, out: [] }]);
    const patch = (f: (r: Run) => Run) => setRuns((rs) => rs.map((r, i) => (i === rs.length - 1 ? f(r) : r)));
    const abort = new AbortController();
    ctl.current = abort;
    client
      .execStream(
        id,
        { command: ['sh', '-c', c], timeout_s: EXEC_TIMEOUT_S, workdir },
        (e) => {
          if (e.type === 'stdout' || e.type === 'stderr') {
            const t = e.type;
            patch((r) => ({ ...r, out: [...r.out, { stream: t, text: e.data }] }));
          }
        },
        abort.signal,
      )
      .then((exit) => patch((r) => ({ ...r, exit })))
      .catch((e: unknown) => patch((r) => ({ ...r, error: abort.signal.aborted ? 'Stopped.' : errorMessage(e) })))
      .finally(() => {
        setBusy(false);
        onRan?.();
        window.setTimeout(() => input.current?.focus(), 0);
      });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(cmd);
  };

  return (
    <Box>
      <Stack direction="row" gap="6px" flexWrap="wrap" marginBottom="10px">
        {suggestions(egress).map((s) => (
          <Box
            key={s.cmd}
            component="button"
            disabled={!live || busy}
            onClick={() => run(s.cmd)}
            title={s.cmd}
            sx={{
              appearance: 'none',
              cursor: live && !busy ? 'pointer' : 'default',
              border: `1px solid ${color.border}`,
              backgroundColor: color.surface,
              borderRadius: '8px',
              padding: '5px 10px',
              fontFamily: 'inherit',
              fontSize: 12.5,
              color: color.textSecondary,
              textAlign: 'left',
              '&:hover:not(:disabled)': { borderColor: color.primary, color: color.primaryDark },
              '&:disabled': { opacity: 0.5 },
            }}
          >
            {s.why}
          </Box>
        ))}
      </Stack>
      <Terminal ref={box} sx={{ height: 340, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} onClick={() => input.current?.focus()}>
        {runs.length === 0 && (
          <Box component="span" sx={{ color: sbColor.termDim }}>
            {live ? 'Type a command below, or pick one above.' : 'This sandbox is not running, so it can’t run commands.'}
          </Box>
        )}
        {runs.map((r, i) => (
          <Box key={i} sx={{ marginBottom: '10px' }}>
            <Box>
              <Box component="span" sx={{ color: sbColor.termAccent }}>
                ${' '}
              </Box>
              {r.cmd}
            </Box>
            {r.out.map((o, j) => (
              <Box key={j} component="span" sx={{ color: o.stream === 'stderr' ? sbColor.termErr : undefined }}>
                {o.text}
              </Box>
            ))}
            {r.exit ? (
              <Box sx={{ color: r.exit.exit_code === 0 ? sbColor.termDim : sbColor.termWarn, fontSize: 11.5 }}>
                exit {r.exit.exit_code} · {r.exit.duration_ms} ms{r.exit.timed_out ? ' · timed out' : ''}
              </Box>
            ) : r.error ? (
              <Box sx={{ color: sbColor.termWarn, fontSize: 11.5 }}>{r.error}</Box>
            ) : (
              <Box sx={{ color: sbColor.termDim }}>…</Box>
            )}
          </Box>
        ))}
      </Terminal>
      <Box
        component="form"
        onSubmit={submit}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#18223A',
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          padding: '8px 8px 8px 14px',
        }}
      >
        <Box component="span" sx={{ color: sbColor.termAccent, fontFamily: mono, fontSize: 13 }}>
          $
        </Box>
        <Box
          component="input"
          ref={input}
          value={cmd}
          disabled={!live}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCmd(e.target.value)}
          placeholder={live ? 'python3 -c "print(2 + 2)"' : 'Not running'}
          aria-label="Command"
          spellCheck={false}
          autoComplete="off"
          sx={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: sbColor.termText,
            fontFamily: mono,
            fontSize: 13,
            '&::placeholder': { color: sbColor.termDim },
          }}
        />
        {busy ? (
          <Button size="small" variant="outlined" color="secondary" onClick={() => ctl.current?.abort()} sx={{ color: sbColor.termText }}>
            Stop
          </Button>
        ) : (
          <Button type="submit" size="small" variant="contained" disabled={!live || !cmd.trim()} sx={{ '&.Mui-disabled': { backgroundColor: '#2A3550', color: sbColor.termDim } }}>
            Run
          </Button>
        )}
      </Box>
      <Typography sx={{ ...text.caption, marginTop: '8px' }}>
        Runs as{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          sh -c "…"
        </Box>{' '}
        in{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          {workdir}
        </Box>
        , {EXEC_TIMEOUT_S} s limit.
      </Typography>
    </Box>
  );
};

export default ExecPanel;
