import { FileManager } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { Box, styled, Typography } from '@mui/material';

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
}));

const ContentStorage = () => {
  const data = [
    { bucketId: '123497971', size: 123.13, name: 'Folder 123/Folder 99/file.txt', cid: '' },
    { bucketId: '123497971', size: 101, name: 'Folder 123/file.txt', cid: '' },
    { bucketId: '123794123', size: 1678, name: 'Folder 456/Folder 11/file.txt', cid: '' },
    { bucketId: '123794123', size: 101, name: 'Folder 456/File 09.mp4', cid: '' },
  ];
  return (
    <Box
      display="flex"
      flexDirection="column"
      border={(theme) => `1px solid ${theme.palette.divider}`}
      borderRadius="12px"
    >
      <Box padding="34px 32px" borderBottom={(theme) => `1px solid ${theme.palette.divider}`}>
        <Typography>Content Storage</Typography>
      </Box>
      <Container padding="24px" borderRadius={(theme) => theme.spacing(0, 0, 1.5, 1.5)}>
        <FileManager data={data} />
      </Container>
    </Box>
  );
};

export default observer(ContentStorage);
