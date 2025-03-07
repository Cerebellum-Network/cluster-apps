import { observer } from 'mobx-react-lite';
import { Box, Typography, Paper, styled, Grid, Button } from '@cluster-apps/ui';
import { useNavigate } from 'react-router-dom';
import { StorageAppIcon, ActivityAppIcon, BarTrackingIcon } from '@cluster-apps/ui';

// Styled components
const NavigationCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  border: `1px solid ${theme.palette.divider}`,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[4],
  },
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: 80,
  height: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(122, 159, 255, 0.1)' 
    : 'rgba(122, 159, 255, 0.05)',
  marginBottom: theme.spacing(2),
  '& svg': {
    width: 40,
    height: 40,
    color: theme.palette.primary.main,
  },
}));

// Documentation icon
const DocumentationIcon = (props: any) => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="currentColor" />
    <path d="M14 8V3L19 8H14Z" fill="currentColor" opacity="0.3" />
    <path d="M8 12H16V14H8V12Z" fill="white" />
    <path d="M8 16H16V18H8V16Z" fill="white" />
    <path d="M8 8H10V10H8V8Z" fill="white" />
  </svg>
);

const ActivationBar = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(4),
  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  color: theme.palette.common.white,
  borderRadius: theme.shape.borderRadius,
}));

const UpdateLog = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(4),
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.03)' 
    : 'rgba(0, 0, 0, 0.02)',
}));

const UpdateItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(2),
  '&:not(:last-child)': {
    marginBottom: theme.spacing(2),
  },
}));

const DateBadge = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.1)' 
    : 'rgba(0, 0, 0, 0.05)',
  fontSize: '0.875rem',
  minWidth: '100px',
  textAlign: 'center',
}));

const Home = () => {
  const navigate = useNavigate();

  const navigationItems = [
    {
      title: 'File Manager',
      description: 'Upload, manage, and organize your files',
      icon: <StorageAppIcon />,
      path: '/content-storage',
    },
    {
      title: 'Customer Data',
      description: 'Collect and manage customer data',
      icon: <ActivityAppIcon />,
      path: '/activity-capture',
    },
    {
      title: 'Analytics',
      description: 'View insights and analytics',
      icon: <BarTrackingIcon />,
      path: '/analytics',
    },
    {
      title: 'Documentation',
      description: 'Learn how to use the platform',
      icon: <DocumentationIcon />,
      path: '/documentation',
    },
  ];

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  const updates = [
    {
      date: 'Mar 6, 2024',
      title: 'New File Manager Interface',
      description: 'Improved bucket management with hide/show functionality and better dark mode support.'
    },
    {
      date: 'Mar 5, 2024',
      title: 'Customer Data Launch',
      description: 'Introducing our new CDP with advanced customer behavior tracking capabilities.'
    },
    {
      date: 'Mar 4, 2024',
      title: 'Analytics Dashboard Update',
      description: 'Enhanced metrics visualization and new data export options.'
    }
  ];

  return (
    <Box maxWidth={1200} mx="auto" px={3}>
      <ActivationBar elevation={0}>
        <Typography variant="h4" gutterBottom>
          Welcome to Cere Network
        </Typography>
        <Typography variant="body1">
          Start building decentralized applications with our powerful suite of tools. 
          Create your first bucket, manage files, and track customer data all in one place.
        </Typography>
      </ActivationBar>

      <Box 
        display="grid" 
        gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }}
        gap={3}
      >
        {navigationItems.map((item, index) => (
          <Grid item xs={12} sm={6} key={index}>
            <NavigationCard onClick={() => handleCardClick(item.path)}>
              <IconWrapper>
                {item.icon}
              </IconWrapper>
              <Typography variant="subtitle1" gutterBottom>
                {item.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.description}
              </Typography>
            </NavigationCard>
          </Grid>
        ))}
      </Box>

      <UpdateLog elevation={0}>
        <Typography variant="h3" gutterBottom>
          Product Updates
        </Typography>
        {updates.map((update, index) => (
          <UpdateItem key={index}>
            <DateBadge>
              {update.date}
            </DateBadge>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {update.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {update.description}
              </Typography>
            </Box>
          </UpdateItem>
        ))}
      </UpdateLog>
    </Box>
  );
};

export default observer(Home); 