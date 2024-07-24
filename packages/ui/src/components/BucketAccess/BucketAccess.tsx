import {
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  RadioGroupProps,
  FormControlProps,
  styled,
  Stack,
} from '@mui/material';
import { useCallback } from 'react';

export type BucketAccessValue = 'public' | 'private' | 'gnr';
export type BucketAccessProps = Omit<FormControlProps, 'onChange'> & {
  value?: BucketAccessValue;
  onChange?: (value: BucketAccessValue) => void;
};

type OptionStyleProps = {
  selected?: boolean;
};

const Option = styled(FormControlLabel, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<OptionStyleProps>(({ theme, selected }) => ({
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: theme.palette.divider,

  ...(selected && {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
  }),
}));

export const BucketAccess = ({ value, onChange, ...props }: BucketAccessProps) => {
  const handleChange: NonNullable<RadioGroupProps['onChange']> = useCallback(
    (_event, value) => onChange?.(value as BucketAccessValue),
    [onChange],
  );

  return (
    <FormControl {...props}>
      <RadioGroup value={value} onChange={handleChange}>
        <Stack spacing={1}>
          <Option value="public" selected={value === 'public'} control={<Radio />} label="Public" />
          <Option value="private" selected={value === 'private'} control={<Radio />} label="Token-Based Control" />
          <Option disabled value="gnr" control={<Radio />} label="NFT Global Registry (Coming Soon)" />
        </Stack>
      </RadioGroup>
    </FormControl>
  );
};
