import { observer } from 'mobx-react-lite';
import { Table, TableHead, TableBody, TableCell, TableRow, Typography } from '@developer-console/ui';
import { useState } from 'react';
import { TreeNode } from '~/components';

const Row = ({ row }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        sx={{
          '&:hover': {
            cursor: 'pointer',
          },
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell>{row.bucketId}</TableCell>
        <TableCell align="right">{row.usedStorage}</TableCell>
        <TableCell>{row.acl}</TableCell>
      </TableRow>
      {open && <TreeNode node={row.files} level={1} />}
    </>
  );
};

const ContentStorage = () => {
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
                children: [{ name: 'index.js', type: 'public' }],
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
                children: [{ name: 'index.css' }],
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
    <Table>
      <TableHead>
        <TableRow>
          <TableCell>
            <Typography variant="body1">Bucket ID</Typography>
          </TableCell>
          <TableCell align="right">Used Storage</TableCell>
          <TableCell>ACL</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <Row key={row.bucketId} row={row} />
        ))}
      </TableBody>
    </Table>
  );
};

export default observer(ContentStorage);
