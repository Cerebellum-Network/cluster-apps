import { observer } from 'mobx-react-lite';
import { Table, TableHead, TableBody, TableCell, TableRow, Box, Collapse, Typography } from '@developer-console/ui';
import { useState } from 'react';
import TreeView, { flattenTree } from 'react-accessible-treeview';
import FilledFolderIcon from '../../assets/icons/filled-folder.svg';
import FolderIcon from '../../assets/icons/folder.svg';
import Arrow from '../../assets/icons/arrow.svg';

const ArrowIcon = ({ isOpen }) => {
  return (
    <Box
      sx={{
        display: 'inline-block',
        transition: 'transform 0.2s',
        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        '&:hover': {
          cursor: 'pointer',
        },
      }}
    >
      <Arrow />
    </Box>
  );
};

const Row = ({ row }) => {
  const [open, setOpen] = useState(false);

  const treeData = flattenTree(row.files);

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
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box margin={1}>
              <TreeView
                data={treeData}
                nodeRenderer={({ element, isBranch, isExpanded, getNodeProps, level }) => (
                  <div
                    {...getNodeProps()}
                    style={{
                      marginLeft: 40 * (level - 1),
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      rowGap: '8px',
                      maxWidth: '400px',
                      width: '100%',
                    }}
                  >
                    {isBranch && <ArrowIcon isOpen={isExpanded} />}

                    {isBranch ? <FilledFolderIcon /> : <FolderIcon />}

                    <Typography variant="body2">{element.name}</Typography>
                    <Typography>{element.metadata?.usedStorage}</Typography>
                  </div>
                )}
              />
            </Box>
          </Collapse>
        </TableCell>
        <TableCell>111</TableCell>
      </TableRow>
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
        children: [
          {
            name: 'Folder 123',
            metadata: {
              usedStorage: '101 KB',
            },
            children: [
              { name: 'Folder 99', metadata: { usedStorage: '0 KB' }, children: [{ name: 'index.js' }] },
              { name: 'File 65.mp4', metadata: { usedStorage: '101 KB' } },
            ],
          },
          {
            name: 'Folder 456',
            metadata: {
              usedStorage: '101 KB',
            },
            children: [
              {
                name: 'Folder 11',
                metadata: {
                  usedStorage: '0 KB',
                },
                children: [{ name: 'index.css' }],
              },
              {
                name: 'File 09.mp4',
                metadata: {
                  usedStorage: '101 KB',
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
