import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Menu, MenuItem, Stack, Typography } from '@cluster-apps/ui';
import { Chip, ListSubheader } from '@mui/material';
import { Check, Close, FilterList } from '@mui/icons-material';
import { NavLink } from 'react-router-dom';

import { ComingSoon } from '~/components';
import { DISCORD_LINK } from '~/constants';
import type { UsageData } from '~/inference/useUsage';
import {
  fmtCount,
  gpuWords,
  inView,
  modelColors,
  NO_FILTER,
  PREVIOUS_LABEL,
  stackSeries,
  stepPhrase,
  stepsByModel,
  throttleNotice,
  usageRows,
  usageTiles,
  toggle,
  type UsageFilter,
  type UsagePreset,
} from '~/inference/usageMath';
import UsageChart from './UsageChart';
import UsageModelsTable from './UsageModelsTable';
import UsageTiles from './UsageTiles';
import { chartOther, color, CONTROL_HEIGHT, text } from '~/theme/tokens';

/** "N requests were refused at your plan's limit of X at once." with what to do about it. */
export function UpgradeNotice({ refused, limit }: { refused: number; limit: number | null }) {
  return (
    <Alert
      severity="warning"
      sx={{
        alignItems: 'center',
        backgroundColor: color.warningTint,
        color: color.text,
        '& .MuiAlert-icon': { color: color.warning },
        '& .MuiAlert-action': { paddingTop: 0 },
      }}
      action={
        <Stack direction="row" alignItems="center" gap="8px" sx={{ paddingRight: '4px' }}>
          <Button size="small" variant="outlined" color="secondary" disabled>
            Upgrade plan
          </Button>
          <ComingSoon />
          <Button size="small" variant="text" component="a" href={DISCORD_LINK} target="_blank" rel="noopener noreferrer">
            Talk to us
          </Button>
        </Stack>
      }
    >
      {`${fmtCount(refused)} request${refused === 1 ? ' was' : 's were'} refused at your plan’s limit`}
      {limit !== null ? ` of ${fmtCount(limit)} at once.` : '.'}
    </Alert>
  );
}

/** No usage in the period: what to do next. */
export function EmptyUsage() {
  return (
    <Box sx={{ border: `1px dashed ${color.border}`, borderRadius: '16px', padding: '56px 24px', textAlign: 'center', backgroundColor: color.surface }}>
      <Typography sx={{ ...text.title, marginBottom: '6px' }}>No usage yet</Typography>
      <Typography sx={{ ...text.secondary, marginBottom: '20px' }}>
        Make your first call with an API key and it shows up here, by model, within a minute or two.
      </Typography>
      <Button variant="contained" component={NavLink} to="/inference?quickstart=1">
        Get started
      </Button>
    </Box>
  );
}

const chipSx = {
  height: 28,
  fontSize: 13,
  fontWeight: 600,
  color: color.primaryDark,
  backgroundColor: color.primaryTint,
  '& .MuiChip-label': { paddingLeft: '10px', paddingRight: '6px' },
  '& .MuiChip-deleteIcon': { fontSize: 16, color: color.primaryDark, opacity: 0.7, marginRight: '6px', '&:hover': { color: color.primaryDark, opacity: 1 } },
} as const;

/** One applied filter: "Type: Chat ×". */
function FilterChip({ field, value, onRemove }: { field: string; value: string; onRemove: () => void }) {
  return (
    <Chip
      size="small"
      sx={chipSx}
      label={
        <>
          <Box component="span" sx={{ fontWeight: 400, color: color.textSecondary }}>{`${field}: `}</Box>
          {value}
        </>
      }
      onDelete={onRemove}
      deleteIcon={<Close aria-label={`Remove ${value} from the filter`} />}
    />
  );
}

/** "Filter" (model or type) and the chips of what the page is narrowed to. */
function FilterBar({ models, kinds, filter, onFilter, colorOf }: {
  models: string[];
  kinds: string[];
  filter: UsageFilter;
  onFilter: (f: UsageFilter) => void;
  colorOf: (model: string) => string;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (f: UsageFilter) => {
    onFilter(f);
    setAnchor(null);
  };
  const active = filter.models.length + filter.kinds.length > 0;
  const item = (key: string, selected: boolean, onClick: () => void, label: ReactNode) => (
    <MenuItem key={key} selected={selected} onClick={onClick} sx={{ fontSize: 14, minWidth: 220, gap: '8px' }}>
      <Box component="span" sx={{ width: 16, display: 'inline-flex', color: color.primary }}>
        {selected && <Check sx={{ fontSize: 16 }} />}
      </Box>
      {label}
    </MenuItem>
  );
  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap="8px">
      <Button
        size="small"
        variant="outlined"
        color="secondary"
        startIcon={<FilterList />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        sx={{ height: CONTROL_HEIGHT, backgroundColor: color.surface, borderColor: color.border }}
      >
        Filter
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <ListSubheader sx={{ ...text.label, lineHeight: '28px' }}>Model</ListSubheader>
        {models.map((m) =>
          item(`m:${m}`, filter.models.includes(m), () => pick({ ...filter, models: toggle(filter.models, m) }), (
            <>
              <Box aria-hidden component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: colorOf(m), flexShrink: 0 }} />
              {m}
            </>
          )),
        )}
        <ListSubheader sx={{ ...text.label, lineHeight: '28px' }}>Type</ListSubheader>
        {kinds.map((k) => item(`k:${k}`, filter.kinds.includes(k), () => pick({ ...filter, kinds: toggle(filter.kinds, k) }), k))}
      </Menu>
      {filter.kinds.map((k) => (
        <FilterChip key={`k:${k}`} field="Type" value={k} onRemove={() => onFilter({ ...filter, kinds: toggle(filter.kinds, k) })} />
      ))}
      {filter.models.map((m) => (
        <FilterChip key={`m:${m}`} field="Model" value={m} onRemove={() => onFilter({ ...filter, models: toggle(filter.models, m) })} />
      ))}
      {active && (
        <Button size="small" variant="text" onClick={() => onFilter(NO_FILTER)}>
          Clear all
        </Button>
      )}
    </Stack>
  );
}

/** The page body for one window's data: notice, filter, tiles, two charts, the models table. */
const UsageView = ({ data, preset, gatewayKey, onAuthError, kindOf = () => 'Model' }: {
  data: UsageData;
  preset: UsagePreset;
  gatewayKey: string;
  onAuthError: () => void;
  /** A model's kind ("Chat", "Embeddings", …) from the catalogue. */
  kindOf?: (model: string) => string;
}) => {
  const [filter, setFilter] = useState<UsageFilter>(NO_FILTER);
  const all = useMemo(() => {
    const rows = usageRows(data.reads, data.fallbackLimits);
    const colors = modelColors(rows);
    return {
      rows,
      colorOf: (m: string) => colors.get(m) ?? chartOther,
      // The plan's limit is the account's, whatever is filtered.
      notice: throttleNotice(rows),
      gpu: stepsByModel(data.gpuSteps, data.window),
      requests: stepsByModel(data.requestSteps, data.window),
    };
  }, [data]);

  const view = useMemo(() => {
    const shown = (m: string) => inView(m, filter, kindOf);
    const only = <T,>(m: Map<string, T>) => new Map([...m].filter(([k]) => shown(k)));
    const rows = all.rows.filter((r) => shown(r.model));
    return {
      shown,
      tiles: usageTiles(rows, data.reads.prev, shown),
      gpu: stackSeries(only(all.gpu.byModel), only(data.reads.gpu), all.colorOf, all.gpu.startsMs.length),
      requests: stackSeries(only(all.requests.byModel), only(data.reads.requests), all.colorOf, all.requests.startsMs.length),
    };
  }, [all, data, filter, kindOf]);

  if (all.rows.length === 0) return <EmptyUsage />;

  const models = all.rows.map((r) => r.model);
  const kinds = [...new Set(models.map(kindOf))].sort();
  const sub = `per ${stepPhrase(data.window.barMs)}, by model`;
  const inScope = all.rows.filter((r) => view.shown(r.model)).map((r) => r.model);
  const scope = filter.models.length + filter.kinds.length === 0 ? 'All models' : inScope.length === 1 ? inScope[0] : `${inScope.length} models`;
  return (
    <Stack spacing="16px">
      {all.notice && <UpgradeNotice refused={all.notice.refused} limit={all.notice.limit} />}
      <FilterBar models={models} kinds={kinds} filter={filter} onFilter={setFilter} colorOf={all.colorOf} />
      <UsageTiles tiles={view.tiles} prevLabel={PREVIOUS_LABEL[preset]} scope={scope} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, gap: '16px' }}>
        <UsageChart title="GPU units" sub={sub} startsMs={all.gpu.startsMs} barMs={data.window.barMs} series={view.gpu} format={gpuWords} />
        <UsageChart title="Requests" sub={sub} startsMs={all.requests.startsMs} barMs={data.window.barMs} series={view.requests} format={fmtCount} />
      </Box>
      <UsageModelsTable
        rows={all.rows}
        colorOf={all.colorOf}
        isInView={view.shown}
        selected={filter.models}
        onPickModel={(m) => setFilter({ ...filter, models: toggle(filter.models, m) })}
        kindOf={kindOf}
        selectedKinds={filter.kinds}
        onPickKind={(k) => setFilter({ ...filter, kinds: toggle(filter.kinds, k) })}
        gatewayKey={gatewayKey}
        window={data.window}
        tokensAvailable={data.tokensAvailable}
        onAuthError={onAuthError}
      />
    </Stack>
  );
};

export default UsageView;
