import { Box, Typography } from '@mui/material';
import { Row } from './Row.tsx';

export const FileManager = () => {
  const rows = [
    {
      bucketId: '123497971',
      usedStorage: '123.13 GB',
      acl: 'Public',
      files: {
        name: '',
        children: [
          {
            name: 'Folder 123',
            metadata: {
              usedStorage: '101 KB',
              type: 'public',
            },
            children: [
              {
                name: 'Folder 99',
                metadata: { usedStorage: '0 KB', type: 'public' },
                children: [{ name: 'index.js', metadata: { usedStorage: '0 KB', type: 'public' } }],
              },
              { name: 'File 65.mp4', metadata: { usedStorage: '101 KB', type: 'public' } },
            ],
          },
          {
            name: 'Folder 456',
            metadata: {
              usedStorage: '101 KB',
              type: 'public',
            },
            children: [
              {
                name: 'Folder 11',
                metadata: {
                  usedStorage: '0 KB',
                  type: 'public',
                },
                children: [
                  {
                    name: 'index.css',
                    metadata: {
                      usedStorage: '101 KB',
                      type: 'public',
                    },
                  },
                ],
              },
              {
                name: 'File 09.mp4',
                metadata: {
                  usedStorage: '101 KB',
                  type: 'public',
                },
              },
            ],
          },
        ],
      },
    },
    {
      bucketId: '123794123',
      usedStorage: '1.678 GB',
      acl: 'Private',
      files: {
        name: '',
        children: [
          {
            name: 'Folder A',
            children: [],
          },
          {
            name: 'Folder B',
            children: [],
          },
        ],
      },
    },
  ];

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '2px solid #e0e0e0',
          padding: '8px 0',
          backgroundColor: '#f9f9f9',
        }}
      >
        <Typography variant="body1" sx={{ flex: 1 }}>
          Bucket ID
        </Typography>
        <Typography variant="body1" sx={{ flex: 1, textAlign: 'right' }}>
          Used Storage
        </Typography>
        <Typography variant="body1" sx={{ flex: 1, textAlign: 'center' }}>
          ACL
        </Typography>
        <Box sx={{ flex: 1 }}></Box> {/* Пустая колонка */}
      </Box>
      {rows.map((row) => (
        <Row key={row.bucketId} row={row} />
      ))}
    </>
  );
};
