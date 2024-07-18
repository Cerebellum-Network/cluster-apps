import { FileManager } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Box, Typography } from '@mui/material';

const ContentStorage = () => (
  <Box display="flex" flexDirection="column" border="1px solid #CDCCCD" borderRadius="12px">
    <Box padding="34px 32px" borderBottom="1px solid #CDCCCD">
      <Typography>Content Storage</Typography>
    </Box>
    <Box
      sx={{
        backgroundColor: '#F5F7FA',
      }}
      padding="24px"
      borderRadius="0 0 12px 12px"
    >
      <FileManager />
    </Box>
  </Box>
);

export default observer(ContentStorage);
