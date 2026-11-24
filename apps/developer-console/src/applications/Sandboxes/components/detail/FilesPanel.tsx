import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@cluster-apps/ui';

import { useComputeClient } from '~/compute/ComputeProvider';
import { ComputeError, errorMessage } from '~/compute/client';
import type { Sandbox } from '~/compute/types';
import { fmtAgo, fmtBytes } from '~/compute/format';
import { color, mono, text } from '~/theme/tokens';
import { Terminal, sbColor } from '../ui';

/** The gateway's per-file cap (`SANDBOX_FILE_MAX_MB`, 16). */
export const FILE_MAX_BYTES = 16 * 1024 * 1024;
/** Larger files are offered for download, not shown. */
const PREVIEW_MAX_BYTES = 512 * 1024;

export type FileEntry = { path: string; size: number; mtime: number | null };

/** The contract reads and writes a file by path but has no listing route, so a running sandbox lists with `find`. */
export const listCommand = (dir: string) => [
  'sh',
  '-c',
  `find ${shellQuote(dir)} -maxdepth 4 -type f -exec stat -c '%s\t%Y\t%n' {} + 2>/dev/null | sort -t '\t' -k3`,
];

const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** `find … stat` output: `<size>\t<mtime>\t<path>` per line. */
export function parseFileList(stdout: string): FileEntry[] {
  return stdout
    .split('\n')
    .map((l) => l.split('\t'))
    .filter((p) => p.length >= 3 && p[2])
    .map(([size, mtime, ...path]) => ({
      path: path.join('\t'),
      size: Number(size) || 0,
      mtime: Number(mtime) || null,
    }));
}

const looksBinary = (bytes: Uint8Array) => bytes.subarray(0, 4096).some((b) => b === 0);

function saveBlob(blob: Blob, path: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = path.split('/').pop() || 'file';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Files in the sandbox. While it runs: everything under its workdir, read and
 * downloaded with `GET /files`, uploaded with `PUT /files`. After it ends: the
 * paths it was terminated with `retain=`, for as long as the node keeps them.
 */
const FilesPanel = ({ sb, refreshKey }: { sb: Sandbox; refreshKey?: number }) => {
  const client = useComputeClient();
  const live = sb.status === 'running';
  const dir = sb.workdir || '/workspace';
  const [files, setFiles] = useState<FileEntry[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ path: string; text?: string; note?: string } | null>(null);
  const [uploadPath, setUploadPath] = useState(`${dir.replace(/\/$/, '')}/`);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!live) {
      setFiles(sb.retained.map((path) => ({ path, size: -1, mtime: null })));
      return;
    }
    setListError(null);
    client
      .exec(sb.id, { command: listCommand(dir), timeout_s: 20 })
      .then((r) => setFiles(parseFileList(r.stdout)))
      .catch((e) => setListError(errorMessage(e)));
  }, [client, sb.id, sb.retained, live, dir]);

  useEffect(load, [load, refreshKey]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPreview({ path: open });
    client
      .getFile(sb.id, open)
      .then(async (blob) => {
        if (!alive) return;
        if (blob.size > PREVIEW_MAX_BYTES)
          return setPreview({ path: open, note: `${fmtBytes(blob.size)}: too large to show here. Download it.` });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!alive) return;
        if (looksBinary(bytes)) return setPreview({ path: open, note: `Binary, ${fmtBytes(blob.size)}. Download it.` });
        setPreview({ path: open, text: new TextDecoder().decode(bytes) });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const gone = e instanceof ComputeError && e.status === 410;
        setPreview({
          path: open,
          note: gone ? 'Gone: the node no longer keeps this file.' : `Couldn’t read it: ${errorMessage(e)}`,
        });
      });
    return () => {
      alive = false;
    };
  }, [client, sb.id, open]);

  const download = async (path: string) => {
    try {
      saveBlob(await client.getFile(sb.id, path), path);
    } catch (e) {
      setNotice({ kind: 'error', text: `Couldn’t download ${path}: ${errorMessage(e)}` });
    }
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > FILE_MAX_BYTES) {
      setNotice({
        kind: 'error',
        text: `${file.name} is ${fmtBytes(file.size)}; a file can be at most ${fmtBytes(FILE_MAX_BYTES)}.`,
      });
      return;
    }
    const target = uploadPath.endsWith('/') ? `${uploadPath}${file.name}` : uploadPath;
    setUploading(true);
    setNotice(null);
    try {
      await client.putFile(sb.id, target, file);
      setNotice({ kind: 'success', text: `Uploaded ${file.name} to ${target} (${fmtBytes(file.size)}).` });
      load();
      setOpen(target);
    } catch (err) {
      setNotice({ kind: 'error', text: `Upload failed: ${errorMessage(err)}` });
    } finally {
      setUploading(false);
    }
  };

  if (!live && sb.retained.length === 0) {
    return (
      <Typography sx={text.secondary}>
        This sandbox has ended and kept no files. To keep files, terminate with{' '}
        <Box component="span" sx={{ fontFamily: mono }}>
          retain=
        </Box>{' '}
        paths (the Terminate button offers it).
      </Typography>
    );
  }

  return (
    <Box>
      {live && (
        <Stack direction="row" gap="8px" alignItems="center" marginBottom="12px">
          <TextField
            size="small"
            value={uploadPath}
            onChange={(e) => setUploadPath(e.target.value)}
            label="Upload to"
            helperText="A directory (ending in /) or a full path. Parent directories are created."
            sx={{ flex: 1 }}
            InputProps={{ sx: { fontFamily: mono, fontSize: 13 } }}
          />
          <input ref={picker} type="file" hidden onChange={upload} />
          <Button
            variant="outlined"
            color="secondary"
            disabled={uploading || !uploadPath.startsWith('/')}
            onClick={() => picker.current?.click()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {uploading ? 'Uploading…' : 'Upload a file'}
          </Button>
        </Stack>
      )}
      {notice && (
        <Alert severity={notice.kind} onClose={() => setNotice(null)} sx={{ marginBottom: '12px' }}>
          {notice.text}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 0.9fr) minmax(0, 1.6fr)' },
          gap: '14px',
        }}
      >
        <Box minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" marginBottom="8px">
            <Typography sx={text.secondary}>
              {live ? (
                <>
                  <Box component="span" sx={{ fontFamily: mono }}>
                    {dir}
                  </Box>{' '}
                  · {files?.length ?? 0} files
                </>
              ) : (
                `Kept after it ended · ${sb.retained.length} files`
              )}
            </Typography>
            {live && (
              <Button size="small" variant="text" onClick={load}>
                Refresh
              </Button>
            )}
          </Stack>
          {listError && <Typography sx={{ ...text.secondary, color: color.danger }}>{listError}</Typography>}
          <Box sx={{ border: `1px solid ${color.border}`, borderRadius: '10px', overflow: 'hidden' }}>
            {(files ?? []).map((f) => (
              <Box
                key={f.path}
                component="button"
                onClick={() => setOpen(f.path)}
                sx={{
                  appearance: 'none',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '8px 12px',
                  border: 'none',
                  borderBottom: `1px solid ${color.grid}`,
                  backgroundColor: open === f.path ? color.primaryTint : color.surface,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  '&:last-of-type': { borderBottom: 'none' },
                  '&:hover': { backgroundColor: open === f.path ? color.primaryTint : color.inset },
                }}
              >
                <Box
                  component="span"
                  sx={{
                    fontFamily: mono,
                    fontSize: 12.5,
                    color: color.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {live ? f.path.replace(new RegExp(`^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`), '') : f.path}
                </Box>
                {f.size >= 0 && (
                  <Box component="span" sx={{ ...text.caption, whiteSpace: 'nowrap' }}>
                    {fmtBytes(f.size)}
                    {f.mtime ? ` · ${fmtAgo(new Date(f.mtime * 1000).toISOString())}` : ''}
                  </Box>
                )}
              </Box>
            ))}
            {files && files.length === 0 && (
              <Typography sx={{ ...text.secondary, padding: '12px' }}>No files yet.</Typography>
            )}
          </Box>
        </Box>
        <Box minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" marginBottom="8px" gap="8px">
            <Typography
              sx={{
                ...text.secondary,
                fontFamily: open ? mono : undefined,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {open ?? 'Pick a file to read it.'}
            </Typography>
            {open && (
              <Button size="small" variant="outlined" color="secondary" onClick={() => download(open)}>
                Download
              </Button>
            )}
          </Stack>
          <Terminal sx={{ height: 380 }}>
            {preview?.text ?? (
              <Box component="span" sx={{ color: sbColor.termDim }}>
                {preview?.note ?? (open ? 'Reading…' : '')}
              </Box>
            )}
          </Terminal>
        </Box>
      </Box>
    </Box>
  );
};

export default FilesPanel;
