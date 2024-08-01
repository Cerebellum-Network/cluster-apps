import { forwardRef, useCallback } from 'react';
import { MenuItem, Stack, styled, TextField, TextFieldProps, Typography } from '@mui/material';
import { BytesSize } from '../BytesSize';

type BucketSelectOption = {
  id: bigint;
  isPublic: boolean;
  storedBytes?: number;
};

export type BucketSelectProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value?: bigint;
  options: BucketSelectOption[];
  onChange?: (value: bigint, options: BucketSelectOption) => void;
};

const Item = styled(MenuItem)(({ theme }) => ({
  margin: theme.spacing(0.5, 1),
  padding: theme.spacing(1),
  borderRadius: 4,
}));

const Select = styled(TextField)({
  minWidth: 300,
});

export const BucketSelect = forwardRef(({ value, options, onChange, ...props }: BucketSelectProps, ref) => {
  const handleChange: NonNullable<TextFieldProps['onChange']> = useCallback(
    (event) => {
      const selectedId = BigInt(event.target.value);
      const selectedOption = options.find((option) => option.id === selectedId);

      if (selectedOption) {
        onChange?.(selectedId, selectedOption);
      }
    },
    [onChange, options],
  );

  const noOptions = options.length === 0;
  const finalValue = noOptions ? '-' : value?.toString() || '';

  return (
    <Select {...props} disabled={noOptions} value={finalValue} select inputRef={ref} onChange={handleChange}>
      {noOptions && (
        <Item value="-">
          <Typography>No buckets</Typography>
        </Item>
      )}
      <Item value="Select Your Bucket">Select Your Bucket</Item>
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
  );
});
