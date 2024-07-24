import { forwardRef, useCallback } from 'react';
import { MenuItem, Stack, styled, TextField, TextFieldProps, Typography } from '@mui/material';
import { BytesSize } from '../BytesSize';

type BucketSelectOption = {
  id: bigint;
  access: 'private' | 'public';
  storedBytes: number;
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

const accessLabels = {
  private: 'Private',
  public: 'Public',
};

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

  return (
    <Select {...props} value={value?.toString()} select inputRef={ref} onChange={handleChange}>
      {options.map(({ id, access, storedBytes }) => {
        const bucketId = id.toString();

        return (
          <Item key={bucketId} value={bucketId}>
            <Stack direction="row" spacing={1} divider={<Typography color="text.secondary">|</Typography>}>
              <Typography variant="body2">ID: {bucketId}</Typography>
              <Typography variant="body2">
                <BytesSize bytes={storedBytes} />
              </Typography>
              <Typography variant="body2">{accessLabels[access]}</Typography>
            </Stack>
          </Item>
        );
      })}
    </Select>
  );
});
