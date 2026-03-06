import { useEffect, useMemo, useState } from 'react';
import { Box, Card, Typography } from '@cluster-apps/ui';
import { ProviderTableRowData } from '@cluster-apps/api';
import { PastErasTable } from './PastErasTable';
import { Pagination } from './Pagination';

const PAGE_SIZE = 10;

interface PastErasCardProps {
  data: ProviderTableRowData[];
}

export const PastErasCard = ({ data }: PastErasCardProps) => {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, safePage]);

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="subtitle1" mb={2}>
        Past Eras
      </Typography>

      <Box sx={{ overflowX: 'auto' }}>
        <PastErasTable data={pageData} />
      </Box>

      <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
    </Card>
  );
};
