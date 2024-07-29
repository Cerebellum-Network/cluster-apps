import {
  FormControl,
  Radio,
  RadioGroup,
  RadioGroupProps,
  FormControlProps,
  styled,
  Stack,
  Box,
  Typography,
} from '@mui/material';
import { ReactNode, useCallback } from 'react';

export type BucketAccessValue = 'public' | 'private' | 'gnr';
export type BucketAccessProps = Omit<FormControlProps, 'onChange'> & {
  value?: BucketAccessValue;
  onChange?: (value: BucketAccessValue) => void;
  guideButton?: ReactNode;
};

type OptionStyleProps = {
  selected?: boolean;
  disabled?: boolean;
};

const Option = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'disabled',
})<OptionStyleProps>(({ theme, selected, disabled }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: theme.palette.divider,
  display: 'flex',
  alignItems: 'center',
  ...(selected && {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
  }),
  ...(disabled && {
    opacity: 0.5,
    pointerEvents: 'none',
  }),
}));

export const BucketAccess = ({ value, onChange, guideButton, ...props }: BucketAccessProps) => {
  const handleChange: NonNullable<RadioGroupProps['onChange']> = useCallback(
    (_event, value) => onChange?.(value as BucketAccessValue),
    [onChange],
  );

  return (
    <FormControl {...props}>
      <RadioGroup value={value} onChange={handleChange}>
        <Stack spacing={1}>
          <Option selected={value === 'public'}>
            <Radio value="public" />
            <Typography>Public</Typography>
          </Option>
          <Option selected={value === 'private'}>
            <Radio value="private" />
            <Box display="flex" alignItems="center" flexGrow={1}>
              <Typography>Token-Based Control</Typography>
            </Box>
            {guideButton && <Box ml={2}>{guideButton}</Box>}
          </Option>
          <Option selected={value === 'gnr'} disabled>
            <Radio value="gnr" />
            <Typography>NFT Global Registry (Coming Soon)</Typography>
          </Option>
        </Stack>
      </RadioGroup>
    </FormControl>
  );
};
