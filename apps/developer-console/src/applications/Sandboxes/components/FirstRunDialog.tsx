import { ReactNode, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@cluster-apps/ui';
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

import { useComputeClient } from '~/compute/ComputeProvider';
import { errorMessage } from '~/compute/client';
import type { ExecExit, Sandbox } from '~/compute/types';
import { fmtCpu, fmtMib, fmtQty, shortNode } from '~/compute/format';
import { color, text } from '~/theme/tokens';
import { FIRST_RUN } from './quickstart';
import { Mono, Terminal, sbColor } from './ui';

type Phase = 'create' | 'start' | 'exec' | 'ready' | 'terminated' | 'error';

const ORDER: Phase[] = ['create', 'start', 'exec', 'ready'];
const after = (p: Phase, q: Phase) => ORDER.indexOf(p) > ORDER.indexOf(q) || p === 'terminated';

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function Step({ title, state, children }: { title: string; state: 'wait' | 'busy' | 'done' | 'yours'; children?: ReactNode }) {
  return (
    <Stack direction="row" gap="14px" sx={{ paddingBottom: '18px', '&:last-of-type': { paddingBottom: 0 } }}>
      <Box sx={{ width: 22, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: state === 'done' ? color.success : state === 'wait' ? color.textTertiary : color.primaryDark,
            backgroundColor: state === 'done' ? color.successTint : state === 'wait' ? color.neutralFill : color.primaryTint,
          }}
        >
          {state === 'done' ? '✓' : state === 'busy' ? <CircularProgress size={12} thickness={6} /> : state === 'yours' ? '?' : '·'}
        </Box>
        <Box sx={{ flex: 1, width: '2px', backgroundColor: color.grid, marginTop: '4px' }} />
      </Box>
      <Box flex={1} minWidth={0} sx={{ opacity: state === 'wait' ? 0.5 : 1, transition: 'opacity 200ms' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: '22px' }}>{title}</Typography>
        {children && <Box sx={{ marginTop: '4px' }}>{children}</Box>}
      </Box>
    </Stack>
  );
}

/**
 * "Try it here": the quickstart's Python example, run for real against the
 * compute gateway, one step at a time (create, wait for it to run, exec), then
 * the user opens it or terminates it.
 */
const FirstRunBody = ({ onClose }: { onClose: () => void }) => {
  const client = useComputeClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('create');
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [out, setOut] = useState('');
  const [exit, setExit] = useState<ExecExit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return undefined;
    started.current = true;
    let alive = true;
    (async () => {
      try {
        let sb = await client.createSandbox({
          image: FIRST_RUN.image,
          runtime: 'gvisor',
          resources: { cpu: 1, memory_mib: 1024 },
          timeout_s: FIRST_RUN.timeout_s,
          labels: { app: 'console-quickstart' },
        });
        if (!alive) return;
        setSandbox(sb);
        setPhase('start');
        while (sb.status === 'starting') {
          await sleep(1000);
          sb = await client.getSandbox(sb.id);
          if (!alive) return;
          setSandbox(sb);
        }
        if (sb.status !== 'running') {
          throw new Error(`The sandbox ${sb.status === 'failed' ? 'failed' : 'stopped'} before it ran: ${sb.exit_reason ?? sb.status}.`);
        }
        setPhase('exec');
        const x = await client.execStream(sb.id, { command: [...FIRST_RUN.command], timeout_s: 60 }, (e) => {
          if (alive && (e.type === 'stdout' || e.type === 'stderr')) setOut((o) => o + e.data);
        });
        if (!alive) return;
        setExit(x);
        setPhase('ready');
      } catch (e) {
        if (!alive) return;
        setError(errorMessage(e));
        setPhase('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  const terminate = async () => {
    if (!sandbox) return;
    setBusy(true);
    try {
      setSandbox(await client.terminate(sandbox.id, { reason: 'console quickstart' }));
      setPhase('terminated');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stepState = (p: Phase): 'wait' | 'busy' | 'done' => (phase === p ? 'busy' : after(phase, p) ? 'done' : 'wait');

  return (
    <>
      <DialogContent dividers sx={{ backgroundColor: color.surface, padding: '22px 24px' }}>
        <Step title="Create the sandbox" state={stepState('create')}>
          {sandbox ? (
            <Typography sx={text.secondary}>
              <Mono>{sandbox.id}</Mono> · {fmtCpu(sandbox.resources.cpu)}, {fmtMib(sandbox.resources.memory_mib)}
              {sandbox.node ? (
                <>
                  , placed on node <Mono title={sandbox.node}>{shortNode(sandbox.node)}</Mono>
                </>
              ) : null}
              .
            </Typography>
          ) : (
            <Typography sx={text.secondary}>
              <Mono>POST /v1/sandboxes</Mono> with image <Mono>{FIRST_RUN.image}</Mono>
            </Typography>
          )}
        </Step>
        <Step title="Start it" state={stepState('start')}>
          <Typography sx={text.secondary}>
            {sandbox?.startup_ms != null
              ? `The node pulled the image and started it in gVisor in ${(sandbox.startup_ms / 1000).toFixed(1)} s.`
              : 'The node pulls the image and starts it in gVisor.'}
          </Typography>
        </Step>
        <Step title="Run a command in it" state={stepState('exec')}>
          {after(phase, 'start') && (
            <Terminal sx={{ marginTop: '6px', minHeight: 64 }}>
              <Box component="span" sx={{ color: sbColor.termDim }}>
                ${' '}
              </Box>
              {FIRST_RUN.command.map((a) => (/\s|'/.test(a) ? `"${a}"` : a)).join(' ')}
              {'\n'}
              {out}
              {exit && (
                <Box component="span" sx={{ color: exit.exit_code === 0 ? sbColor.termOk : sbColor.termErr }}>
                  {`exit ${exit.exit_code} · ${exit.duration_ms} ms`}
                </Box>
              )}
            </Terminal>
          )}
        </Step>
        <Step
          title={phase === 'terminated' ? 'Terminated' : 'Keep it or stop it'}
          state={phase === 'terminated' ? 'done' : phase === 'ready' ? 'yours' : 'wait'}
        >
          {phase === 'terminated' && sandbox ? (
            <Typography sx={text.secondary}>
              Final usage, as the node measured it: {fmtQty(sandbox.usage.cpu_s)} CPU-seconds and{' '}
              {fmtQty(sandbox.usage.ram_gib_s)} GiB-seconds of memory over {fmtQty(sandbox.usage.wall_s)} s.
            </Typography>
          ) : (
            <Typography sx={text.secondary}>
              It runs until you stop it or for {FIRST_RUN.timeout_s / 60} minutes. Open it to run commands, read files
              and watch its usage.
            </Typography>
          )}
        </Step>
        {error && (
          <Alert severity="error" sx={{ marginTop: '16px' }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ padding: '14px 24px' }}>
        {phase === 'terminated' ? (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              color="secondary"
              disabled={!sandbox || busy || phase === 'create'}
              onClick={terminate}
            >
              Terminate
            </Button>
            <Button
              variant="contained"
              disabled={!sandbox}
              onClick={() => {
                onClose();
                navigate(`/sandboxes/list/${sandbox!.id}`);
              }}
            >
              Open sandbox
            </Button>
          </>
        )}
      </DialogActions>
    </>
  );
};

export const FirstRunDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography component="span" display="block" sx={text.title}>
          The quickstart, run here
        </Typography>
        <Typography component="span" display="block" sx={{ ...text.secondary, fontWeight: 400 }}>
          The Python example, through the compute gateway.
        </Typography>
      </Box>
      <IconButton aria-label="Close" onClick={onClose} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </DialogTitle>
    {open && <FirstRunBody onClose={onClose} />}
  </Dialog>
);
