import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { 
  Box, 
  Stack, 
  Typography, 
  Paper, 
  styled, 
  Grid, 
  TextField, 
  Button,
  Divider,
  IconButton,
} from '@cluster-apps/ui';
import { GithubLogoIcon } from '@cluster-apps/ui';
import { 
  InputAdornment, 
  Tabs, 
  Tab, 
  Chip 
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { contentStorageDocs, DocItem } from './docs/contentStorageDocs';

// Styled components for better dark mode support
const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTab-root': {
    fontWeight: 500,
    fontSize: '1rem',
    textTransform: 'none',
    minWidth: 120,
    '&.Mui-selected': {
      color: theme.palette.primary.main,
    },
  },
  '& .MuiTabs-indicator': {
    backgroundColor: theme.palette.primary.main,
    height: 3,
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  '&:hover': {
    color: theme.palette.primary.main,
    opacity: 0.8,
  },
}));

const DocCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: theme.shadows[3],
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-2px)',
  },
}));

const ResourceCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const SearchBar = styled(TextField)(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  '& h1': {
    fontSize: '2rem',
    marginBottom: theme.spacing(3),
  },
  '& h2': {
    fontSize: '1.5rem',
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  '& h3': {
    fontSize: '1.25rem',
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1.5),
  },
  '& p': {
    marginBottom: theme.spacing(2),
    lineHeight: 1.6,
  },
  '& ul, & ol': {
    paddingLeft: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  '& li': {
    marginBottom: theme.spacing(1),
  },
  '& code': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.1)' 
      : 'rgba(0, 0, 0, 0.05)',
    padding: theme.spacing(0.5, 1),
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  '& pre': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? 'rgba(255, 255, 255, 0.05)' 
      : 'rgba(0, 0, 0, 0.03)',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    margin: theme.spacing(2, 0),
  },
  '& a': {
    color: theme.palette.primary.main,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

// Mock data for tutorials
const tutorials = [
  {
    id: 1,
    title: 'Getting Started with File Manager',
    description: 'Learn how to create buckets, upload files, and manage your content',
    level: 'Beginner',
    duration: '10 min',
    link: '/tutorials/file-manager',
  },
  {
    id: 2,
    title: 'Working with Customer Data',
    description: 'Collect and analyze customer data using the platform',
    level: 'Intermediate',
    duration: '15 min',
    link: '/tutorials/customer-data',
  },
  {
    id: 3,
    title: 'Advanced Analytics',
    description: 'Deep dive into analytics features and custom reporting',
    level: 'Advanced',
    duration: '20 min',
    link: '/tutorials/analytics',
  },
];

// Mock data for external resources
const externalResources = [
  {
    title: 'GitHub Repository',
    description: 'Access the source code and contribute to the project',
    icon: <GithubLogoIcon />,
    link: 'https://github.com/cere-io/cere-ddc-sdk-js',
  },
  {
    title: 'API Reference',
    description: 'Comprehensive API documentation for developers',
    icon: <Box component="span" sx={{ fontSize: '24px' }}>API</Box>,
    link: 'https://docs.cere.network/ddc/reference/js-sdk',
  },
  {
    title: 'Community Forum',
    description: 'Join discussions and get help from the community',
    icon: <Box component="span" sx={{ fontSize: '24px' }}>💬</Box>,
    link: 'https://discord.gg/cere-network',
  },
];

const Documentation = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSelectedDoc(null);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleDocClick = (doc: DocItem) => {
    setSelectedDoc(doc);
  };

  const handleBackToList = () => {
    setSelectedDoc(null);
  };

  // Filter docs based on search query
  const filteredDocs = contentStorageDocs.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Explore guides, tutorials, and resources to help you get the most out of the platform.
        </Typography>
      </Box>

      <SearchBar
        fullWidth
        placeholder="Search documentation..."
        value={searchQuery}
        onChange={handleSearch}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      <StyledTabs value={activeTab} onChange={handleTabChange}>
        <StyledTab label="Guides" />
        <StyledTab label="Tutorials" />
        <StyledTab label="Resources" />
      </StyledTabs>

      <Box mt={4}>
        {activeTab === 0 && (
          <>
            {selectedDoc ? (
              <Box>
                <Button 
                  variant="text" 
                  onClick={handleBackToList}
                  sx={{ mb: 2 }}
                >
                  ← Back to Guides
                </Button>
                <Paper sx={{ p: 4, borderRadius: 2 }}>
                  <ContentContainer>
                    <div dangerouslySetInnerHTML={{ __html: selectedDoc.content.replace(/`/g, '<code>').replace(/`/g, '</code>') }} />
                  </ContentContainer>
                  
                  <Divider sx={{ my: 4 }} />
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Was this helpful?
                      </Typography>
                      <Box mt={1}>
                        <Button variant="outlined" size="small" sx={{ mr: 1 }}>
                          Yes
                        </Button>
                        <Button variant="outlined" size="small">
                          No
                        </Button>
                      </Box>
                    </Box>
                    <Box>
                      <Button 
                        variant="contained" 
                        color="primary"
                        endIcon={<GithubLogoIcon />}
                        component="a"
                        href="https://github.com/cere-io/cere-ddc-sdk-js"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on GitHub
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {filteredDocs.map((doc, index) => (
                  <Grid item xs={12} key={index}>
                    <DocCard onClick={() => handleDocClick(doc)}>
                      <Typography variant="subtitle1" fontWeight="500" gutterBottom>
                        {doc.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {doc.content.substring(0, 150).replace(/#/g, '').trim()}...
                      </Typography>
                      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={index === 0 ? 'Getting Started' : index === 1 ? 'Intermediate' : 'Advanced'} 
                          size="small" 
                          color={index === 0 ? 'primary' : index === 1 ? 'secondary' : 'default'}
                          sx={{ borderRadius: 1 }}
                        />
                        <Typography variant="body2" color="primary">
                          Read more →
                        </Typography>
                      </Box>
                    </DocCard>
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}

        {activeTab === 1 && (
          <Grid container spacing={3}>
            {tutorials.map((tutorial) => (
              <Grid item xs={12} md={6} lg={4} key={tutorial.id}>
                <DocCard>
                  <Typography variant="subtitle1" fontWeight="500" gutterBottom>
                    {tutorial.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {tutorial.description}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <Box display="flex" gap={1}>
                      <Chip 
                        label={tutorial.level} 
                        size="small" 
                        color={tutorial.level === 'Beginner' ? 'primary' : tutorial.level === 'Intermediate' ? 'secondary' : 'default'}
                        sx={{ borderRadius: 1 }}
                      />
                      <Chip 
                        label={tutorial.duration} 
                        size="small" 
                        variant="outlined"
                        sx={{ borderRadius: 1 }}
                      />
                    </Box>
                    <Button variant="text" color="primary">
                      Start Tutorial
                    </Button>
                  </Box>
                </DocCard>
              </Grid>
            ))}
          </Grid>
        )}

        {activeTab === 2 && (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="500" gutterBottom>
                  SDK Documentation
                </Typography>
                <Typography variant="body2" paragraph>
                  Comprehensive documentation for the Cere DDC SDK, including API references, examples, and best practices.
                </Typography>
                <Box display="flex" gap={2}>
                  <Button variant="contained" color="primary">
                    JavaScript SDK
                  </Button>
                  <Button variant="outlined">
                    Rust SDK
                  </Button>
                  <Button variant="outlined">
                    Go SDK
                  </Button>
                </Box>
              </Paper>
              
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight="500" gutterBottom>
                  Sample Applications
                </Typography>
                <Typography variant="body2" paragraph>
                  Explore sample applications built with the Cere DDC SDK to learn best practices and implementation patterns.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <DocCard sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        File Storage Demo
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        A simple demo showing how to upload and manage files
                      </Typography>
                      <Button variant="text" color="primary" sx={{ mt: 1 }}>
                        View Demo
                      </Button>
                    </DocCard>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <DocCard sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Customer Data Platform
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Example implementation of a customer data platform
                      </Typography>
                      <Button variant="text" color="primary" sx={{ mt: 1 }}>
                        View Demo
                      </Button>
                    </DocCard>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            
            <Grid item xs={12} lg={4}>
              <Typography variant="subtitle1" gutterBottom>
                External Resources
              </Typography>
              <Stack spacing={2}>
                {externalResources.map((resource, index) => (
                  <ResourceCard key={index}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Box mr={1} display="flex" alignItems="center" justifyContent="center" width={40} height={40}>
                        {resource.icon}
                      </Box>
                      <Typography variant="subtitle1">
                        {resource.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {resource.description}
                    </Typography>
                    <Button 
                      variant="outlined" 
                      fullWidth
                      component="a"
                      href={resource.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Visit
                    </Button>
                  </ResourceCard>
                ))}
              </Stack>
            </Grid>
          </Grid>
        )}
      </Box>
    </Box>
  );
};

export default observer(Documentation); 