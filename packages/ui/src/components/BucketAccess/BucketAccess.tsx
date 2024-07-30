import { ReactNode, useCallback } from 'react';
import {
  FormControl,
  Radio,
  RadioGroup,
  RadioGroupProps,
  FormControlProps,
  styled,
  Stack,
  Typography,
  FormControlLabel,
} from '@mui/material';

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

const Option = styled(FormControlLabel, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<OptionStyleProps>(({ theme, selected }) => ({
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

  ['& .MuiFormControlLabel-label']: {
    display: 'flex',
    flex: 1,
  },
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
          <Option value="public" selected={value === 'public'} control={<Radio />} label="Public" />
          <Option
            value="private"
            selected={value === 'private'}
            control={<Radio />}
            label={
              !guideButton ? (
                <>Private</>
              ) : (
                <Stack flex={1} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography>Private</Typography>
                  {guideButton}
                </Stack>
              )
            }
          />
          <Option disabled value="gnr" control={<Radio />} label="NFT Global Registry (Coming Soon)" />
        </Stack>
      </RadioGroup>
    </FormControl>
  );
};
