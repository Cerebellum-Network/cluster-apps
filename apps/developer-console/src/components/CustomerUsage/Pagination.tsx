import { Box, Button, Typography } from '@cluster-apps/ui';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({ currentPage, totalPages, onPageChange }: PaginationProps) => {
  if (totalPages <= 1) return null;

  return (
    <Box display="flex" justifyContent="center" alignItems="center" gap={2} py={2}>
      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>

      <Typography variant="body2" color="text.secondary">
        Page {currentPage} of {totalPages}
      </Typography>

      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </Box>
  );
};
