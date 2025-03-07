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
  margin: theme.spacing(0.5, 0),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius / 2,
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.08)' 
      : 'rgba(0, 0, 0, 0.04)',
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(122, 159, 255, 0.15)' 
      : 'rgba(122, 159, 255, 0.1)',
    '&:hover': {
      backgroundColor: theme.palette.mode === 'dark' 
        ? 'rgba(122, 159, 255, 0.25)' 
        : 'rgba(122, 159, 255, 0.2)',
    },
  },
}));

const Select = styled(TextField)(({ theme }) => ({
  minWidth: 300,
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.background.paper,
    '& fieldset': {
      borderColor: theme.palette.divider,
    },
    '&:hover fieldset': {
      borderColor: theme.palette.mode === 'dark' 
        ? theme.palette.grey[700] 
        : theme.palette.grey[300],
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
  '& .MuiSelect-select': {
    backgroundColor: 'transparent',
  },
}));

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
      SelectProps={{ 
        displayEmpty: true,
        MenuProps: {
          PaperProps: {
            sx: {
              maxHeight: 300,
            },
          },
        },
      }}
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
