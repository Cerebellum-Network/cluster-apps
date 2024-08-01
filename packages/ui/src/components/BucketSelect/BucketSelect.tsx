import { forwardRef, useCallback } from 'react';
import { MenuItem, Stack, Select, SelectProps, Typography, styled, FormControl, InputLabel } from '@mui/material';
import { BytesSize } from '../BytesSize';

type BucketSelectOption = {
  id: bigint;
  isPublic: boolean;
  storedBytes?: number;
};

export type BucketSelectProps = Omit<SelectProps, 'value' | 'onChange'> & {
  value?: bigint;
  options: BucketSelectOption[];
  onChange?: (value: bigint, option: BucketSelectOption) => void;
};

const Item = styled(MenuItem)(({ theme }) => ({
  margin: theme.spacing(0.5, 1),
  padding: theme.spacing(1),
  borderRadius: 4,
}));

const StyledFormControl = styled(FormControl)({
  minWidth: 300,
});

export const BucketSelect = forwardRef(({ value, options, onChange, label, ...props }: BucketSelectProps, ref) => {
  const handleChange: NonNullable<SelectProps['onChange']> = useCallback(
    (event) => {
      const selectedId = BigInt(event.target.value as string);
      const selectedOption = options.find((option) => option.id === selectedId);

      if (selectedOption) {
        onChange?.(selectedId, selectedOption);
      }
    },
    [onChange, options],
  );

  const noOptions = options.length === 0;
  const finalValue = value ? value.toString() : '';

  return (
    <StyledFormControl variant="outlined">
      <InputLabel shrink>{label}</InputLabel>
      <Select
        {...props}
        native={false}
        disabled={noOptions}
        value={finalValue}
        label={label}
        inputRef={ref}
        onChange={handleChange}
        displayEmpty
      >
        <Item value="" disabled>
          Select Your Bucket
        </Item>
        {noOptions && (
          <Item value="-">
            <Typography>No buckets</Typography>
          </Item>
        )}
        {options.map(({ id, isPublic, storedBytes }) => {
          const bucketId = id.toString();

          return (
            <Item key={bucketId} value={bucketId}>
              <Stack direction="row" spacing={1} divider={<Typography color="text.secondary">|</Typography>}>
                <Typography variant="subtitle1">ID: {bucketId}</Typography>
                {storedBytes && <Typography variant="subtitle1">{<BytesSize bytes={storedBytes} />}</Typography>}
                <Typography variant="subtitle1">{isPublic ? 'Public' : 'Private'}</Typography>
              </Stack>
            </Item>
          );
        })}
      </Select>
    </StyledFormControl>
  );
});
