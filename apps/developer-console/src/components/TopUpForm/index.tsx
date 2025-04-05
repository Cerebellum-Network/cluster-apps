import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  FormControl, 
  InputLabel, 
  MenuItem, 
  Select, 
  TextField, 
  Typography, 
  Divider, 
  Paper, 
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  SelectChangeEvent,
  styled
} from '@mui/material';
import { CreditCard, AccountBalanceWallet } from '@mui/icons-material';

// Colores de marca Cere
const cerePurple = '#8e44ef';
const cereDarkPurple = '#6c2ee3';
const cereDarkBackground = '#121212';
const cereLightBackground = '#1e1e1e';
const cereAccent = '#a46dff';

// Componentes estilizados
const CerePaper = styled(Paper)({
  padding: 24,
  background: cereDarkBackground,
  border: `1px solid ${cerePurple}30`,
  borderRadius: 16,
  color: '#fff',
});

const CereButton = styled(Button)({
  background: `linear-gradient(135deg, ${cerePurple} 0%, ${cereDarkPurple} 100%)`,
  color: 'white',
  '&:hover': {
    background: `linear-gradient(135deg, ${cerePurple} 30%, ${cereDarkPurple} 100%)`,
    boxShadow: `0 4px 20px 0 ${cerePurple}60`,
  },
  '&.Mui-disabled': {
    background: '#333',
    color: '#666',
  },
  padding: '10px 24px',
  borderRadius: 8,
  textTransform: 'none',
  fontWeight: 600,
});

const CereTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': {
      borderColor: '#444',
    },
    '&:hover fieldset': {
      borderColor: cerePurple,
    },
    '&.Mui-focused fieldset': {
      borderColor: cerePurple,
    },
    '& input': {
      color: '#fff',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#aaa',
    '&.Mui-focused': {
      color: cerePurple,
    },
  },
  '& .MuiFormHelperText-root': {
    color: '#f44336',
  },
});

const CereTabs = styled(Tabs)({
  '& .MuiTabs-indicator': {
    backgroundColor: cerePurple,
  },
  '& .MuiTab-root': {
    color: '#aaa',
    '&.Mui-selected': {
      color: '#fff',
    },
  },
});

const CereTab = styled(Tab)({
  '&.Mui-selected': {
    color: '#fff',
  },
});

const CereSelect = styled(Select)({
  color: '#fff',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#444',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: cerePurple,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: cerePurple,
  },
  '& .MuiSvgIcon-root': {
    color: '#aaa',
  },
});

const CereInputLabel = styled(InputLabel)({
  color: '#aaa',
  '&.Mui-focused': {
    color: cerePurple,
  },
});

const CereTabPanel = styled(Box)({
  padding: '16px 0',
  backgroundColor: 'transparent',
});

interface TopUpFormProps {
    onSubmit: (amount: number, currency: string, paymentMethod: string) => Promise<void>;
    isLoading?: boolean;
}

export const TopUpForm: React.FC<TopUpFormProps> = ({
    onSubmit,
    isLoading = false
}) => {
    const [amount, setAmount] = useState<string>('100');
    const [currency, setCurrency] = useState<string>('USDC');
    const [paymentMethod, setPaymentMethod] = useState<string>('creditCard');
    const [paymentTab, setPaymentTab] = useState<number>(0);

    // Validation states
    const [amountError, setAmountError] = useState<string>('');

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setAmount(value);
        
        // Validate amount
        if (!value) {
            setAmountError('Amount is required');
        } else if (parseFloat(value) <= 0) {
            setAmountError('Amount must be greater than 0');
        } else {
            setAmountError('');
        }
    };

    const handleCurrencyChange = (e: SelectChangeEvent) => {
        setCurrency(e.target.value);
    };

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setPaymentTab(newValue);
        setPaymentMethod(newValue === 0 ? 'creditCard' : 'crypto');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate before submission
        if (!amount || parseFloat(amount) <= 0) {
            setAmountError('Please enter a valid amount');
            return;
        }
        
        await onSubmit(parseFloat(amount), currency, paymentMethod);
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#fff', fontWeight: 600 }}>
                Top Up DDC Account
            </Typography>
            <Divider sx={{ mb: 3, opacity: 0.3 }} />
            
            <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                    {/* Amount Field */}
                    <CereTextField
                        fullWidth
                        label="Amount"
                        type="number"
                        value={amount}
                        onChange={handleAmountChange}
                        error={!!amountError}
                        helperText={amountError}
                        InputProps={{
                            inputProps: { min: 0, step: "0.01" }
                        }}
                    />
                    
                    {/* Currency Selection */}
                    <FormControl fullWidth>
                        <CereInputLabel id="currency-select-label">Currency</CereInputLabel>
                        <CereSelect
                            labelId="currency-select-label"
                            value={currency}
                            label="Currency"
                            onChange={handleCurrencyChange}
                        >
                            <MenuItem value="USDC">USDC</MenuItem>
                            <MenuItem value="USDT">USDT</MenuItem>
                            <MenuItem value="USD">USD</MenuItem>
                            <MenuItem value="EUR">EUR</MenuItem>
                        </CereSelect>
                    </FormControl>
                    
                    {/* Payment Method Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <CereTabs 
                            value={paymentTab} 
                            onChange={handleTabChange}
                            variant="fullWidth"
                        >
                            <CereTab 
                                icon={<CreditCard />} 
                                label="Credit Card" 
                                id="payment-tab-0"
                                aria-controls="payment-tabpanel-0"
                            />
                            <CereTab 
                                icon={<AccountBalanceWallet />} 
                                label="Crypto Wallet" 
                                id="payment-tab-1"
                                aria-controls="payment-tabpanel-1"
                            />
                        </CereTabs>
                    </Box>
                    
                    {/* Payment Method Content */}
                    <CereTabPanel
                        role="tabpanel"
                        hidden={paymentTab !== 0}
                        id="payment-tabpanel-0"
                        aria-labelledby="payment-tab-0"
                    >
                        {paymentTab === 0 && (
                            <Box sx={{ py: 2 }}>
                                <Typography variant="body2" color="text.secondary" paragraph sx={{ color: '#aaa' }}>
                                    Enter your payment details to complete the transaction using Stripe's secure payment processing.
                                </Typography>
                                {/* Stripe Elements will be integrated here */}
                                <Box sx={{ 
                                    border: `1px dashed ${cerePurple}50`, 
                                    p: 2, 
                                    borderRadius: 1,
                                    bgcolor: cereLightBackground
                                }}>
                                    <Typography variant="body2" align="center" sx={{ color: '#aaa' }}>
                                        Stripe Elements Integration
                                    </Typography>
                                </Box>
                            </Box>
                        )}
                    </CereTabPanel>
                    
                    <CereTabPanel
                        role="tabpanel"
                        hidden={paymentTab !== 1}
                        id="payment-tabpanel-1"
                        aria-labelledby="payment-tab-1"
                    >
                        {paymentTab === 1 && (
                            <Box sx={{ py: 2 }}>
                                <Typography variant="body2" paragraph sx={{ color: '#aaa' }}>
                                    Connect your wallet to make a payment using {currency}.
                                </Typography>
                                <Button 
                                    variant="outlined" 
                                    fullWidth
                                    startIcon={<AccountBalanceWallet />}
                                    sx={{ 
                                        my: 1, 
                                        borderColor: cerePurple,
                                        color: '#fff',
                                        '&:hover': {
                                            borderColor: cereAccent,
                                            backgroundColor: `${cerePurple}20`,
                                        }
                                    }}
                                >
                                    Connect Wallet
                                </Button>
                            </Box>
                        )}
                    </CereTabPanel>
                    
                    {/* Submit Button */}
                    <CereButton 
                        type="submit" 
                        variant="contained" 
                        fullWidth
                        disabled={isLoading || !!amountError}
                        sx={{ mt: 3 }}
                    >
                        {isLoading ? (
                            <CircularProgress size={24} color="inherit" />
                        ) : (
                            'Top Up Now'
                        )}
                    </CereButton>
                </Stack>
            </form>
        </Box>
    );
}; 