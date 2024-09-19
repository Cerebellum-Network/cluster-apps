import { forwardRef, useCallback } from 'react';
import { MenuItem, Stack, Typography, styled, TextFieldProps, TextField } from '@mui/material';
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

export const BucketSelect = forwardRef(({ value, options, onChange, disabled, ...props }: BucketSelectProps, ref) => {
  const handleChange: NonNullable<TextFieldProps['onChange']> = useCallback(
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
    <Select
      {...props}
      disabled={disabled || noOptions}
      value={finalValue}
      select
      inputRef={ref}
      onChange={handleChange}
      SelectProps={{ displayEmpty: true }}
      InputLabelProps={{ shrink: true }} // Ensure the label shrinks
      label="Select Your Bucket"
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

              {storedBytes === undefined ? null : (
                <Typography variant="subtitle1">{<BytesSize bytes={storedBytes} />}</Typography>
              )}

              <Typography variant="subtitle1">{isPublic ? 'Public' : 'Private'}</Typography>
            </Stack>
          </Item>
        );
      })}
    </Select>
  );
});
