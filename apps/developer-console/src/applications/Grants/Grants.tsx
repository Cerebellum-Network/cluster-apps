import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Button, 
  Chip, 
  Divider, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Paper,
  Container,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Theme,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkIcon from '@mui/icons-material/Link';
import CodeIcon from '@mui/icons-material/Code';
import StorageIcon from '@mui/icons-material/Storage';
import SecurityIcon from '@mui/icons-material/Security';
import ImageIcon from '@mui/icons-material/Image';
import ChatIcon from '@mui/icons-material/Chat';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MemoryIcon from '@mui/icons-material/Memory';
import TokenIcon from '@mui/icons-material/Token';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.3s, box-shadow 0.3s',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: theme.shadows[10],
  },
}));

const ColorBar = styled(Box)<{ color?: string }>(({ theme, color }) => ({
  height: '8px',
  backgroundColor: color || theme.palette.primary.main,
  borderTopLeftRadius: theme.shape.borderRadius,
  borderTopRightRadius: theme.shape.borderRadius,
}));

const HeaderContainer = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(45deg, #FFD700 10%, #FFA500 50%, #FF8C00 90%)',
  color: theme.palette.common.white,
  padding: theme.spacing(6, 0),
  marginBottom: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 4px 20px rgba(255, 215, 0, 0.25)',
}));

// Add a styled button with gold gradient
const GoldButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(45deg, #FFD700 30%, #FFA500 90%)',
  color: theme.palette.getContrastText('#FFD700'),
  boxShadow: '0 3px 5px 2px rgba(255, 215, 0, .3)',
  '&:hover': {
    background: 'linear-gradient(45deg, #FFC400 30%, #FF8C00 90%)',
    boxShadow: '0 4px 10px 2px rgba(255, 215, 0, .5)',
  }
}));

// Add a styled token icon with gold color
const CereTokenIcon = styled(TokenIcon)(({ theme }) => ({
  color: '#FFD700',
  marginRight: theme.spacing(1),
  fontSize: '1.2rem',
  verticalAlign: 'middle'
}));

/**
 * Interface for TabPanel props
 */
interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

/**
 * TabPanel component for switching between Grants and Bounties tabs
 */
const TabPanel: React.FC<TabPanelProps> = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`grants-tabpanel-${index}`}
      aria-labelledby={`grants-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

/**
 * Returns the appropriate icon for a given category
 */
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'AI':
      return <MemoryIcon />;
    case 'Storage':
      return <StorageIcon />;
    case 'Security':
      return <SecurityIcon />;
    case 'Media':
      return <ImageIcon />;
    case 'Analytics':
      return <ChatIcon />;
    case 'Payments':
      return <AccountBalanceWalletIcon />;
    default:
      return <CodeIcon />;
  }
};

/**
 * Returns the appropriate color for a given category
 */
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'AI':
      return '#8E24AA'; // purple
    case 'Storage':
      return '#1E88E5'; // blue
    case 'Security':
      return '#43A047'; // green
    case 'Media':
      return '#FB8C00'; // orange
    case 'Analytics':
      return '#E53935'; // red
    case 'Payments':
      return '#FFD600'; // yellow
    default:
      return '#546E7A'; // blue grey
  }
};

interface GrantItem {
  id: number;
  title: string;
  description: string;
  amount: string;
  difficulty: string;
  category: string;
  status: string;
  deadline: string;
  proposer: string;
  repository: string;
  tags: string[];
}

const grants: GrantItem[] = [
  {
    id: 1,
    title: 'Turn-key Private Standalone Blockchain Network',
    description: 'Develop a turn-key Private/Permissioned/Standalone blockchain network which can be readily integrated by any enterprise. This network will abstract implementation complexity for businesses and provide a ready-made package optimized for security, privacy, and performance.',
    amount: '50,000 CERE',
    difficulty: 'Advanced',
    category: 'Storage',
    status: 'Open',
    deadline: '2025-06-30',
    proposer: 'Cere-Network',
    repository: 'https://github.com/Cerebellum-Network/private-standalone-network-node',
    tags: ['blockchain', 'substrate', 'enterprise', 'privacy']
  },
  {
    id: 2,
    title: 'Conversation Analysis Using NLP & Real-Time Data Segmentations',
    description: 'Build an AI-powered conversation analysis system designed to process, structure, and analyze large-scale messaging data from communication platforms like WhatsApp and Telegram groups. Transform community discussions into clear, actionable insights in real-time.',
    amount: '35,000 CERE',
    difficulty: 'Intermediate',
    category: 'Analytics',
    status: 'Open',
    deadline: '2025-05-15',
    proposer: 'Cef.ai',
    repository: 'https://github.com/cere-io/conversation-analytics',
    tags: ['NLP', 'analytics', 'AI', 'real-time']
  },
  {
    id: 3,
    title: 'Built-in Images and Video Optimization in Developer Console',
    description: 'Extend the Developer Console UI by adding a way to optimize (resize, convert) images and videos before uploading. Create a solution that automatically processes media to generate multiple resolutions/formats optimized for different devices and bandwidths.',
    amount: '20,000 CERE',
    difficulty: 'Intermediate',
    category: 'Media',
    status: 'Open',
    deadline: '2025-04-30',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/media-optimization',
    tags: ['media', 'optimization', 'UI', 'UX']
  },
  {
    id: 4,
    title: 'Built-in Encryption in DDC SDK for Secure Data Storage',
    description: 'Integrate new functionality into the DDC SDK that allows encryption of data using one or more encryption algorithms. Both encryption & decryption will happen on the client side, enhancing data privacy by default.',
    amount: '30,000 CERE',
    difficulty: 'Advanced',
    category: 'Security',
    status: 'Open',
    deadline: '2025-05-31',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/ddc-sdk-encryption',
    tags: ['encryption', 'security', 'SDK', 'privacy']
  },
  {
    id: 5,
    title: 'Simplified Top-up of Developer Console Account Balance',
    description: 'Build a system that enables developers to top up their Cere Developer Console accounts using USDC and fiat via integrated payment providers and securely deposit these funds on-chain into a custom smart contract.',
    amount: '25,000 CERE',
    difficulty: 'Intermediate',
    category: 'Payments',
    status: 'Open',
    deadline: '2025-06-15',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/developer-console-payments',
    tags: ['payments', 'USDC', 'fiat', 'smart contract']
  },
  {
    id: 6,
    title: 'Computer Vision AI for Real-time Object Identification and Search',
    description: 'Develop a system utilizing Computer Vision AI models for real-time object identification, tagging, and search. The solution should identify and label media in real-time for eventual search in a vector database.',
    amount: '40,000 CERE',
    difficulty: 'Advanced',
    category: 'AI',
    status: 'Open',
    deadline: '2025-07-31',
    proposer: 'Cef.ai',
    repository: 'https://github.com/cere-io/computer-vision-ai',
    tags: ['computer vision', 'AI', 'object detection', 'vector search']
  }
];

const bounties: GrantItem[] = [
  {
    id: 101,
    title: 'Implement Dark Mode Toggle in Developer Console',
    description: 'Add a toggle switch in the Developer Console that allows users to switch between light and dark mode. The implementation should respect the user\'s system preferences by default.',
    amount: '5,000 CERE',
    difficulty: 'Beginner',
    category: 'UI/UX',
    status: 'Open',
    deadline: '2025-04-15',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/developer-console',
    tags: ['UI', 'dark mode', 'accessibility']
  },
  {
    id: 102,
    title: 'Fix File Upload Progress Indicator Bug',
    description: 'There is a bug in the file upload progress indicator where it sometimes shows 100% before the file is fully uploaded. Fix this issue to ensure the progress indicator accurately reflects the upload status.',
    amount: '2,500 CERE',
    difficulty: 'Beginner',
    category: 'Bug Fix',
    status: 'Open',
    deadline: '2025-04-10',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/developer-console',
    tags: ['bug fix', 'file upload', 'UI']
  },
  {
    id: 103,
    title: 'Optimize DDC SDK Performance for Large File Transfers',
    description: 'The current DDC SDK implementation has performance issues when transferring files larger than 1GB. Optimize the SDK to handle large file transfers more efficiently, with a target of at least 50% improvement in transfer speed.',
    amount: '10,000 CERE',
    difficulty: 'Intermediate',
    category: 'Performance',
    status: 'Open',
    deadline: '2025-05-20',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/ddc-sdk',
    tags: ['performance', 'optimization', 'file transfer']
  },
  {
    id: 104,
    title: 'Add Multi-language Support to Documentation',
    description: 'Translate the existing developer documentation into Spanish, French, and German. This includes the API reference, tutorials, and getting started guides.',
    amount: '7,500 CERE',
    difficulty: 'Beginner',
    category: 'Documentation',
    status: 'Open',
    deadline: '2025-06-01',
    proposer: 'Cere Network',
    repository: 'https://github.com/cere-io/docs',
    tags: ['documentation', 'translation', 'i18n']
  }
];

/**
 * Grants & Bounties component
 * Displays available grants and bounties in the Cere ecosystem
 */
const Grants: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleCategoryFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setCategoryFilter(event.target.value as string);
  };

  const handleDifficultyFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setDifficultyFilter(event.target.value as string);
  };

  const filterItems = (items: GrantItem[]) => {
    return items.filter(item => {
      const matchesSearch = 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesDifficulty = difficultyFilter === 'All' || item.difficulty === difficultyFilter;
      
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  };

  const filteredGrants = filterItems(grants);
  const filteredBounties = filterItems(bounties);

  const categories = ['All', 'AI', 'Storage', 'Security', 'Media', 'Analytics', 'Payments', 'UI/UX', 'Performance', 'Documentation', 'Bug Fix'];
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

  const renderItems = (items: GrantItem[]) => {
    return (
      <Grid container spacing={3}>
        {items.length > 0 ? (
          items.map(item => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <StyledCard>
                <ColorBar color={getCategoryColor(item.category)} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography component="div" gutterBottom noWrap>
                      {item.title}
                    </Typography>
                    <Avatar sx={{ bgcolor: getCategoryColor(item.category) }}>
                      {getCategoryIcon(item.category)}
                    </Avatar>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, height: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.description}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {item.tags.map(tag => (
                      <Chip 
                        key={tag} 
                        label={tag} 
                        size="small" 
                        sx={{ mr: 0.5, mb: 0.5 }} 
                        variant="outlined" 
                      />
                    ))}
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      Reward:
                    </Typography>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="CERE Token">
                        <CereTokenIcon />
                      </Tooltip>
                      {item.amount}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      Difficulty:
                    </Typography>
                    <Chip 
                      label={item.difficulty} 
                      size="small" 
                      color={
                        item.difficulty === 'Beginner' ? 'success' : 
                        item.difficulty === 'Intermediate' ? 'warning' : 'error'
                      } 
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2">
                      Deadline:
                    </Typography>
                    <Typography variant="body2">
                      {new Date(item.deadline).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
                <Box sx={{ p: 2, pt: 0 }}>
                  <GoldButton 
                    fullWidth 
                    sx={{ mb: 1 }}
                  >
                    Apply Now
                  </GoldButton>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <IconButton 
                      size="small" 
                      component="a" 
                      href={item.repository} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <GitHubIcon />
                    </IconButton>
                    <IconButton size="small">
                      <LinkIcon />
                    </IconButton>
                  </Box>
                </Box>
              </StyledCard>
            </Grid>
          ))
        ) : (
          <Box sx={{ width: '100%', textAlign: 'center', py: 5 }}>
            <Typography variant="body1" color="text.secondary">
              No items match your search criteria
            </Typography>
          </Box>
        )}
      </Grid>
    );
  };

  return (
    <Box>
      <HeaderContainer>
        <Container>
          <Typography variant="h3" component="h1" gutterBottom>
            Cere Network Grants & Bounties
          </Typography>
          <Typography variant="subtitle1">
            Contribute to the Cere ecosystem and earn rewards by working on exciting projects
          </Typography>
        </Container>
      </HeaderContainer>

      <Container>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search by keyword, tag, or description"
                value={searchTerm}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="category-filter-label">Category</InputLabel>
                <Select
                  labelId="category-filter-label"
                  value={categoryFilter}
                  onChange={handleCategoryFilterChange as any}
                  label="Category"
                  startAdornment={<FilterListIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                >
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel id="difficulty-filter-label">Difficulty</InputLabel>
                <Select
                  labelId="difficulty-filter-label"
                  value={difficultyFilter}
                  onChange={handleDifficultyFilterChange as any}
                  label="Difficulty"
                >
                  {difficulties.map(difficulty => (
                    <MenuItem key={difficulty} value={difficulty}>{difficulty}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="grants and bounties tabs">
            <Tab label={`Grants (${filteredGrants.length})`} id="grants-tab-0" aria-controls="grants-tabpanel-0" />
            <Tab label={`Bounties (${filteredBounties.length})`} id="grants-tab-1" aria-controls="grants-tabpanel-1" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h2" gutterBottom>
              Available Grants
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Grants are larger projects that typically require more time and expertise. They offer higher rewards and are perfect for teams looking to make a significant contribution to the Cere ecosystem.
            </Typography>
          </Box>
          {renderItems(filteredGrants)}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" component="h2" gutterBottom>
              Available Bounties
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Bounties are smaller, more focused tasks that can typically be completed in a shorter timeframe. They're great for individual contributors looking to make quick contributions and earn rewards.
            </Typography>
          </Box>
          {renderItems(filteredBounties)}
        </TabPanel>

        <Box sx={{ mt: 6, mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h2" gutterBottom>
            How to Apply
          </Typography>
          <Grid container spacing={4} justifyContent="center" sx={{ mt: 2 }}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>1</Avatar>
                <Typography variant="subtitle1" gutterBottom>Choose a Project</Typography>
                <Typography variant="body2" color="text.secondary">
                  Browse through our available grants and bounties to find one that matches your skills and interests.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>2</Avatar>
                <Typography variant="subtitle1" gutterBottom>Submit Your Proposal</Typography>
                <Typography variant="body2" color="text.secondary">
                  Click "Apply Now" and fill out the application form with your project plan, timeline, and team information.
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>3</Avatar>
                <Typography variant="subtitle1" gutterBottom>Start Building</Typography>
                <Typography variant="body2" color="text.secondary">
                  Once approved, start working on your project with support from the Cere team. Submit milestones to receive funding.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mt: 6, mb: 4, textAlign: 'center', p: 3, bgcolor: 'rgba(255, 215, 0, 0.05)', borderRadius: 2 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            About CERE Token
          </Typography>
          <Grid container spacing={4} justifyContent="center" sx={{ mt: 2 }}>
            <Grid item xs={12} md={8}>
              <Typography variant="body1" paragraph>
                The CERE token is the native utility token of the Cere Network ecosystem. All grants and bounties are paid out in CERE tokens, which can be used for various purposes within the ecosystem.
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' }, 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: { xs: 2, sm: 4 }, 
                my: 3 
              }}>
                <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 0 } }}>
                  <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'rgba(255, 215, 0, 0.2)' }}>
                    <StorageIcon sx={{ color: '#FFD700' }} />
                  </Avatar>
                  <Typography variant="subtitle1" gutterBottom>Storage Fees</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pay for decentralized storage on the Cere DDC network
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center', mb: { xs: 2, sm: 0 } }}>
                  <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'rgba(255, 215, 0, 0.2)' }}>
                    <SecurityIcon sx={{ color: '#FFD700' }} />
                  </Avatar>
                  <Typography variant="subtitle1" gutterBottom>Network Security</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stake tokens to secure the network and earn rewards
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Avatar sx={{ width: 60, height: 60, mx: 'auto', mb: 2, bgcolor: 'rgba(255, 215, 0, 0.2)' }}>
                    <AccountBalanceWalletIcon sx={{ color: '#FFD700' }} />
                  </Avatar>
                  <Typography variant="subtitle1" gutterBottom>Governance</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Participate in network governance and decision-making
                  </Typography>
                </Box>
              </Box>
              <Button 
                variant="outlined" 
                sx={{ 
                  borderColor: '#FFD700', 
                  color: '#FFD700',
                  '&:hover': {
                    borderColor: '#FFA500',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)'
                  }
                }}
                component="a"
                href="https://cere.network/token"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn More About CERE Token
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default Grants; 