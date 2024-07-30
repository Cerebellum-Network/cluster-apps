import { Paper, Stack, Typography, Chip, styled, Box } from '@mui/material';
import { RewardIcon, CheckCircleIcon } from '../../icons';

export type RewardWidgetProps = {
  title: string;
  amount: number;
  done?: boolean;
};

const Widget = styled(Paper)(({ theme }) => ({
  height: 48,
  padding: theme.spacing(1, 1.5),
  background: 'transparent',
}));

const Reward = styled(Chip)(() => ({
  '& .MuiSvgIcon-root': {
    fontSize: '18px !important',
  },
}));

const Check = styled(CheckCircleIcon)(({ theme }) => ({
  fontSize: '20px !important',
  color: `${theme.palette.primary.main} !important`,
}));

export const RewardWidget = ({ title, amount, done = false }: RewardWidgetProps) => (
  <Stack component={Widget} direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
    {done && <Check />}
    <Typography variant="body2" sx={{ textDecoration: done ? 'line-through' : 'none' }}>
      {title}
    </Typography>
    <Box flexGrow={1} />

    {done ? (
      <Typography variant="body2" fontWeight="bold" color="success.main">
        {amount} CERE earned
      </Typography>
    ) : (
      <Reward icon={<RewardIcon fontSize="inherit" />} size="medium" label={`Reward: ${amount} CERE`} />
    )}
  </Stack>
);
