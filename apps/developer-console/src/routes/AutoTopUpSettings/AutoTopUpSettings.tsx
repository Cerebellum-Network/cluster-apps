import { useState, useEffect } from 'react';
import { 
  Divider, 
  Paper, 
  Stack, 
  Typography, 
  Alert,
  Box,
  Chip,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress
} from '@mui/material';

export const AutoTopUpSettings = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    enabled: false,
  });

  const accountId = 'developer-console-account'; // Placeholder for developer console

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`http://localhost:3000/auto-topup-settings/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        setSettings({
          enabled: data.enabled || false,
        });
      }
    } catch (error) {
      console.error('Failed to fetch auto top-up settings:', error);
    }
  };

  const handleToggleAutoTopUp = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3000/auto-topup-settings/${accountId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: !settings.enabled,
        }),
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
        setSuccess(settings.enabled ? 'Auto top-up disabled successfully' : 'Auto top-up enabled successfully');
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update auto top-up settings:', error);
      setError('Failed to update settings. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableAutoTopUp = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`http://localhost:3000/auto-topup-settings/${accountId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSettings({
          enabled: false,
        });
        setSuccess('Auto top-up disabled successfully');
      } else {
        throw new Error('Failed to disable auto top-up');
      }
    } catch (error) {
      console.error('Failed to disable auto top-up:', error);
      setError('Failed to disable auto top-up. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Auto Top-Up Settings</Typography>
      
      <Alert severity="info">
        <Typography variant="body2">
          Manage your automatic top-up configuration. You can enable/disable the service and adjust the threshold and top-up amounts. Automatic top-ups will be charged from the DDC Account.
        </Typography>
      </Alert>

      <Stack component={Paper} spacing={3} padding={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4">Auto Top-Up Status</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={handleToggleAutoTopUp}
                disabled={isLoading}
              />
            }
            label={settings.enabled ? 'Enabled' : 'Disabled'}
          />
        </Box>

        {settings.enabled && (
          <>
            <Divider />
            
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDisableAutoTopUp}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {isLoading ? 'Disabling...' : 'Disable Auto Top-Up'}
              </Button>
            </Stack>
          </>
        )}

        {!settings.enabled && (
          <Alert severity="warning">
            <Typography variant="body2">
              Auto top-up is currently disabled. Enable it to automatically charge from your DDC Account when your balance falls below the threshold.
            </Typography>
          </Alert>
        )}

        {error && (
          <Alert severity="error">
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {success && (
          <Alert severity="success">
            <Typography variant="body2">{success}</Typography>
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
          <Chip label="Secure" color="success" size="small" />
          <Chip label="PCI Compliant" color="success" size="small" />
          <Chip label="256-bit SSL" color="success" size="small" />
        </Box>
      </Stack>
    </Stack>
  );
};

export default AutoTopUpSettings; 