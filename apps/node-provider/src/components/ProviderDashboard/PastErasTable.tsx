import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@cluster-apps/ui';
import { ProviderTableRowData } from '@cluster-apps/api';
import { formatInteger, formatDecimal, formatCurrency, formatDelta } from '~/utils/formatters';

interface PastErasTableProps {
  data: ProviderTableRowData[];
}

const noWrap = { whiteSpace: 'nowrap' } as const;

export const PastErasTable = ({ data }: PastErasTableProps) => (
  <TableContainer sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <Table sx={{ minWidth: 700 }} aria-label="past eras provider table" role="table">
      <TableHead>
        <TableRow>
          <TableCell sx={noWrap}>Era</TableCell>
          <TableCell align="right" sx={noWrap}>
            GETs
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            PUTs
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            CPU
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            GPU
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            RAM
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            Reward ($)
          </TableCell>
          <TableCell align="right" sx={noWrap}>
            Reward Δ
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.era_id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
            <TableCell component="th" scope="row" sx={noWrap}>
              {row.era_id}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatInteger(row.gets)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatInteger(row.puts)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatDecimal(row.cpu_units)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatDecimal(row.gpu_units)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatDecimal(row.ram_units)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatCurrency(row.reward)}
            </TableCell>
            <TableCell align="right" sx={noWrap}>
              {formatDelta(row.rewardDelta)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);
