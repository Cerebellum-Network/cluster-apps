import { Stack, Typography, Button } from '@cluster-apps/ui';

const ConfigureNode = () => {
  const handleSave = () => {
    console.log('Node configured!');
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Node Configuration</Typography>
      <Button variant="contained" onClick={handleSave}>
        Save
      </Button>
    </Stack>
  );
};

export default ConfigureNode;
