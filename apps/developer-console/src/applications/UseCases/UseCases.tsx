import { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  styled,
  TextField,
  CircularProgress,
  useMessages,
  Grid,
  Card,
  CardContent,
} from '@cluster-apps/ui';
import { Chip } from '@mui/material';
import {
  StreamOutlined,
  PeopleOutlined,
  SecurityOutlined,
  CollectionsOutlined,
  PublicOutlined,
  BusinessOutlined,
} from '@mui/icons-material';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  padding: theme.spacing(4),
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  overflow: 'hidden',
  position: 'relative',
  '&:hover': {
    transform: 'translateY(-4px)',
    borderColor: theme.palette.primary.main,
    '& .hover-gradient': {
      opacity: 0.1,
    },
  },
}));

const GradientOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  opacity: 0,
  transition: 'opacity 0.3s ease-in-out',
}));

const ContactForm = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(8),
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.03)' 
    : 'rgba(0, 0, 0, 0.02)',
}));

const StyledChip = styled(Chip)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(0, 0, 0, 0.05)',
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(0, 0, 0, 0.03)',
}));

const UseCases = () => {
  const { showMessage } = useMessages();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    showMessage({
      appearance: 'success',
      message: 'Thank you for your interest! We will get back to you soon.',
    });

    setFormData({
      name: '',
      email: '',
      company: '',
      message: '',
    });
    setIsSubmitting(false);
  };

  const useCases = [
    {
      title: "Decentralized Content Streaming",
      description: "Stream content securely and efficiently with our decentralized infrastructure. Perfect for video platforms, gaming, and media distribution.",
      tags: ["Video", "Gaming", "Media"],
      icon: <StreamOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    },
    {
      title: "Hyper-personalized Community Manager",
      description: "Build and manage engaged communities with AI-driven personalization and seamless interaction tools.",
      tags: ["AI", "Community", "Engagement"],
      icon: <PeopleOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    },
    {
      title: "Secure Data Storage",
      description: "Store and manage data with enterprise-grade security and decentralized redundancy.",
      tags: ["Security", "Storage", "Enterprise"],
      icon: <SecurityOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    },
    {
      title: "NFT Marketplace",
      description: "Create and manage NFT marketplaces with built-in content delivery and authentication.",
      tags: ["NFT", "Marketplace", "Web3"],
      icon: <CollectionsOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    },
    {
      title: "Decentralized Social Platform",
      description: "Build social platforms with user-owned data and content distribution.",
      tags: ["Social", "Web3", "Content"],
      icon: <PublicOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    },
    {
      title: "Enterprise Data Management",
      description: "Manage and share enterprise data securely across organizations.",
      tags: ["Enterprise", "Security", "B2B"],
      icon: <BusinessOutlined sx={{ fontSize: 32, color: 'primary.main' }} />,
    }
  ];

  return (
    <Box maxWidth={1200} mx="auto" px={3}>
      <Box textAlign="center" mb={8}>
        <Typography 
          variant="h2" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontWeight: 700,
            background: (theme) => 
              `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Use Cases
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto', mb: 6 }}>
          Discover how Cere Network's decentralized infrastructure can transform your applications
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {useCases.map((useCase, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <StyledCard>
              <GradientOverlay className="hover-gradient" />
              <CardContent sx={{ height: '100%', position: 'relative' }}>
                <IconWrapper>
                  {useCase.icon}
                </IconWrapper>
                <Box mb={2}>
                  {useCase.tags.map((tag, tagIndex) => (
                    <StyledChip
                      key={tagIndex}
                      label={tag}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Box>
                <Typography variant="subtitle1" gutterBottom>
                  {useCase.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {useCase.description}
                </Typography>
                <Button 
                  variant="outlined" 
                  color="primary"
                  sx={{ mt: 2 }}
                >
                  Learn More
                </Button>
              </CardContent>
            </StyledCard>
          </Grid>
        ))}
      </Grid>

      <Paper component="form" onSubmit={handleSubmit} elevation={0}>
        <ContactForm>
          <Typography variant="h3" gutterBottom align="center">
            Want to Learn More?
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph align="center" sx={{ mb: 4 }}>
            Get in touch with our team to discuss how Cere can help your business succeed in the decentralized future.
          </Typography>
          
          <Box 
            display="grid" 
            gridTemplateColumns={{ xs: '1fr', md: 'repeat(2, 1fr)' }}
            gap={3} 
            mb={3}
          >
            <TextField
              name="name"
              label="Name"
              value={formData.name}
              onChange={handleInputChange}
              required
              fullWidth
            />
            <TextField
              name="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              fullWidth
            />
          </Box>
          
          <TextField
            name="company"
            label="Company"
            value={formData.company}
            onChange={handleInputChange}
            fullWidth
            sx={{ mb: 3 }}
          />
          
          <TextField
            name="message"
            label="Message"
            multiline
            rows={4}
            value={formData.message}
            onChange={handleInputChange}
            required
            fullWidth
            sx={{ mb: 4 }}
          />
          
          <Box display="flex" justifyContent="center">
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ 
                minWidth: 200,
                height: 48,
                borderRadius: 3,
                fontSize: '1.1rem'
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Get in Touch'
              )}
            </Button>
          </Box>
        </ContactForm>
      </Paper>
    </Box>
  );
};

export default UseCases; 