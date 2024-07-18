import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Box, Typography, TableCell, TableRow } from '@developer-console/ui';
import FilledFolderIcon from '../../assets/icons/filled-folder.svg';
import FolderIcon from '../../assets/icons/folder.svg';
import Arrow from '~/assets/icons/arrow.svg';

export const TreeNode = ({ node, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  if (!node.name && hasChildren) {
    return (
      <>
        {node.children.map((child, index) => (
          <TreeNode key={index} node={child} level={level} />
        ))}
      </>
    );
  }

  return (
    <>
      <TableRow>
        <TableCell sx={{ border: 'none' }}>
          <Box sx={{ paddingLeft: 2 * level, alignItems: 'center' }}>
            <Box display="flex" alignItems="center" gap="8px" width="auto">
              {hasChildren && (
                <Box
                  display="inline-block"
                  sx={{
                    transition: 'transform 0.2s',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    '&:hover': {
                      cursor: 'pointer',
                    },
                  }}
                  onClick={handleToggle}
                >
                  <Arrow />
                </Box>
              )}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: hasChildren ? 'pointer' : 'default',
                }}
                onClick={hasChildren ? handleToggle : undefined}
              >
                <Box marginRight="8px">{hasChildren ? <FilledFolderIcon /> : <FolderIcon />}</Box>
                <Typography variant="body2">{node.name}</Typography>
              </Box>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ border: 'none' }}>
          {node.metadata?.usedStorage && <Typography variant="body2">{node.metadata.usedStorage}</Typography>}
        </TableCell>
        <TableCell sx={{ border: 'none' }}>
          {node.metadata?.type && <Typography variant="body2">{node.metadata.type}</Typography>}
        </TableCell>
      </TableRow>
      {isOpen &&
        hasChildren &&
        node.children.map((child, index) => <TreeNode key={index} node={child} level={level + 1} />)}
    </>
  );
};

export default observer(TreeNode);
