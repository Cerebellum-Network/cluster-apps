import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useAccountStore } from '~/hooks/useAccountStore';
import { EventDispatcher } from '@cere-activity-sdk/events';
import { NoOpCipher } from '@cere-activity-sdk/ciphers';
import { Signer } from '@cere-activity-sdk/signers';

// Wrapper to adapt CereWalletSigner to the expected Signer interface
class SignerAdapter extends Signer {
  constructor(private readonly cereWalletSigner: any) {
    super();
  }

  get type(): string {
    return 'ed25519';
  }

  get address(): string {
    return this.cereWalletSigner.address;
  }

  get publicKey(): string {
    return Buffer.from(this.cereWalletSigner.publicKey).toString('hex');
  }

  async isReady(): Promise<boolean> {
    return this.cereWalletSigner.isReady();
  }

  async sign(data: string): Promise<string> {
    return this.cereWalletSigner.sign(data);
  }
}

export const DataActivity = observer(() => {
  const account = useAccountStore();
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const handleSendMessage = async () => {
    if (!message.trim() || !account.address) return;

    try {
      setStatus('Sending message...');
      
      // Use the existing signer from the account store with our adapter
      const dispatcher = new EventDispatcher(new SignerAdapter(account.signer), new NoOpCipher(), {
        appId: 'developer-console',
        appPubKey: account.address,
        dataServicePubKey: account.address,
        baseUrl: 'https://activity.cere.network',
      });

      await dispatcher.dispatchEvent({
        type: 'message',
        payload: {
          content: message,
          timestamp: Date.now(),
        },
      } as any); // TODO: Fix type once we have the correct ActivityEvent type

      setMessage('');
      setStatus('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      setStatus('Failed to send message. Please try again.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        Data Activity
      </Typography>
      
      <Box sx={{ maxWidth: 600, mt: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here..."
          variant="outlined"
          disabled={!account.address}
        />
        
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            {status}
          </Typography>
          
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!message.trim() || !account.address}
          >
            Send Message
          </Button>
        </Box>
      </Box>
    </Box>
  );
}); 