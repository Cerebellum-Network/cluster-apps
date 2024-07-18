import { FileManager } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Box, Typography } from '@mui/material';

const ContentStorage = () => {
  const data = [
    { bucketId: '123497971', size: 123.13, name: 'Folder 123/Folder 99/file.txt', cid: '' },
    { bucketId: '123497971', size: 101, name: 'Folder 123/file.txt', cid: '' },
    { bucketId: '123794123', size: 1678, name: 'Folder 456/Folder 11/file.txt', cid: '' },
    { bucketId: '123794123', size: 101, name: 'Folder 456/File 09.mp4', cid: '' },
  ];
  return (
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
        <FileManager data={data} />
      </Box>
    </Box>
  );
};

export default observer(ContentStorage);
