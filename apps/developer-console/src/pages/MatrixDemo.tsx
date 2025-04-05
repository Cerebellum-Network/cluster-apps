import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Stepper, 
  Step, 
  StepLabel, 
  Paper, 
  Button, 
  Typography,
  styled,
  CircularProgress,
  Backdrop,
  Grid
} from '@mui/material';

// Matrix theme colors
const matrixGreen = '#00FF41';
const matrixDarkGreen = '#008F11';
const matrixBlack = '#0D0208';
const matrixAccent = '#00FF41';

// Binary effect component
const BinaryBackground = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: -1,
  overflow: 'hidden',
  backgroundColor: matrixBlack,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48dGV4dCB4PSIwIiB5PSIyMCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzAwRkY0MSI+MTAxMDAxMTAwMTExMDEwMTAxMDwvdGV4dD48dGV4dCB4PSIwIiB5PSI0MCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzAwRkY0MSI+MDAxMTEwMTAwMTAxMDAwMTExMTwvdGV4dD48dGV4dCB4PSIwIiB5PSI2MCIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIyMCIgZmlsbD0iIzAwRkY0MSI+MTEwMDEwMTAxMDEwMTAxMDExPC90ZXh0Pjx0ZXh0IHg9IjAiIHk9IjgwIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjIwIiBmaWxsPSIjMDBGRjQxIj4wMTAxMDExMTAwMTAxMDEwMTA8L3RleHQ+PHRleHQgeD0iMCIgeT0iMTAwIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjIwIiBmaWxsPSIjMDBGRjQxIj4xMDEwMTAxMDEwMTAxMDEwMTA8L3RleHQ+PC9zdmc+")',
    opacity: 0.05,
    animation: 'scroll 20s linear infinite',
  },
  '@keyframes scroll': {
    '0%': {
      transform: 'translateY(0)',
    },
    '100%': {
      transform: 'translateY(100%)',
    },
  },
});

// Glitch text effect
const GlitchText = styled(Typography)({
  fontFamily: '"monospace", monospace',
  color: matrixGreen,
  textShadow: `0 0 5px ${matrixGreen}, 0 0 10px ${matrixGreen}`,
  position: 'relative',
  display: 'inline-block',
  '&::before, &::after': {
    content: 'attr(data-text)',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  '&::before': {
    left: '2px',
    textShadow: `-2px 0 ${matrixDarkGreen}`,
    animation: 'glitch-anim 2s infinite linear alternate-reverse',
  },
  '&::after': {
    left: '-2px',
    textShadow: `2px 0 ${matrixAccent}`,
    animation: 'glitch-anim2 3s infinite linear alternate-reverse',
  },
  '@keyframes glitch-anim': {
    '0%': { clipPath: 'inset(40% 0 61% 0)' },
    '20%': { clipPath: 'inset(92% 0 1% 0)' },
    '40%': { clipPath: 'inset(43% 0 1% 0)' },
    '60%': { clipPath: 'inset(25% 0 58% 0)' },
    '80%': { clipPath: 'inset(54% 0 7% 0)' },
    '100%': { clipPath: 'inset(58% 0 43% 0)' },
  },
  '@keyframes glitch-anim2': {
    '0%': { clipPath: 'inset(25% 0 58% 0)' },
    '20%': { clipPath: 'inset(54% 0 7% 0)' },
    '40%': { clipPath: 'inset(58% 0 43% 0)' },
    '60%': { clipPath: 'inset(40% 0 61% 0)' },
    '80%': { clipPath: 'inset(92% 0 1% 0)' },
    '100%': { clipPath: 'inset(43% 0 1% 0)' },
  },
});

// Styled components
const MatrixContainer = styled(Container)({
  marginTop: 32,
  marginBottom: 32,
  color: matrixGreen,
  position: 'relative',
  zIndex: 1,
});

const MatrixPaper = styled(Paper)({
  padding: 24,
  background: `rgba(13, 2, 8, 0.9)`,
  border: `1px solid ${matrixGreen}`,
  borderRadius: 0,
  boxShadow: `0 0 10px ${matrixGreen}, 0 0 20px ${matrixGreen}`,
  color: matrixGreen,
  fontFamily: '"monospace", monospace',
});

const MatrixButton = styled(Button)({
  background: matrixBlack,
  color: matrixGreen,
  border: `1px solid ${matrixGreen}`,
  '&:hover': {
    background: matrixGreen,
    color: matrixBlack,
    boxShadow: `0 0 10px ${matrixGreen}`,
  },
  '&.Mui-disabled': {
    background: '#111',
    color: '#0a3f0a',
    borderColor: '#0a3f0a',
  },
  padding: '8px 16px',
  borderRadius: 0,
  textTransform: 'uppercase',
  fontFamily: '"monospace", monospace',
  letterSpacing: 2,
});

const MatrixStepper = styled(Stepper)({
  '& .MuiStepIcon-root': {
    color: matrixBlack,
    border: `1px solid ${matrixGreen}`,
    borderRadius: '50%',
    '&.Mui-active, &.Mui-completed': {
      color: matrixGreen,
    }
  },
  '& .MuiStepLabel-label': {
    fontFamily: '"monospace", monospace',
    color: matrixGreen,
    '&.Mui-active': {
      color: matrixAccent,
    }
  },
  '& .MuiStepConnector-line': {
    borderColor: matrixGreen,
  }
});

const PixelBox = styled(Box)({
  border: `2px solid ${matrixGreen}`,
  backgroundColor: `rgba(0, 255, 65, 0.05)`,
  padding: 16,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: `linear-gradient(to right, ${matrixGreen}, transparent)`,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '1px',
    background: `linear-gradient(to right, transparent, ${matrixGreen})`,
  }
});

const TerminalText = styled(Typography)({
  fontFamily: '"monospace", monospace',
  color: matrixGreen,
  margin: '8px 0',
});

// Matrix ASCII Art
const asciiArt = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓▓▓  ███████ ██    ██ ██████   █████   ▓▓▓▓▓▓
▓▓▓     ███   ██  ██  ██   ██ ██   ██  ▓▓▓▓▓▓
▓▓▓    ███     ████   ██████  ███████  ▓▓▓▓▓▓
▓▓▓   ███       ██    ██   ██ ██   ██  ▓▓▓▓▓▓
▓▓▓  ███████    ██    ██   ██ ██   ██  ▓▓▓▓▓▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓`;

// Simulate typing effect
interface TypedTerminalProps {
  text: string;
  speed?: number;
}

const TypedTerminal: React.FC<TypedTerminalProps> = ({ text, speed = 50 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text.charAt(index));
        setIndex(index + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [index, text, speed]);

  return (
    <Box sx={{ fontFamily: '"monospace", monospace', color: matrixGreen, whiteSpace: 'pre-wrap' }}>
      {displayedText}
      {index < text.length && <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>}
    </Box>
  );
};

// Main component
const MatrixSwapDemo = () => {
  // States for managing the flow
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [swapComplete, setSwapComplete] = useState(false);
  const [teleportComplete, setTeleportComplete] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);

  // Step configurations
  const steps = [
    'Connect Wallet',
    'Swap USDT → CERE',
    'Teleport Tokens',
    'Verify DDC Account'
  ];

  // Terminal commands and outputs
  const connectWalletCommand = 'connect_wallet -t metamask -a 0x7A2...F9B3';
  const swapTokensCommand = 'swap_tokens -amount 100 -from USDT -to CERE -slippage 0.5';
  const teleportCommand = 'teleport -amount 95.5 -token CERE -to "cere_mainnet" -address c3r3...d83f';
  const verifyCommand = 'verify_ddc_balance -account "DDC_123456" -network "cere_mainnet"';

  // Handle wallet connection
  const handleConnectWallet = async () => {
    setLoading(true);
    setTerminalOutput('> ' + connectWalletCommand + '\nInitiating wallet connection...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setTerminalOutput(prev => prev + '\nConnection established.\nWallet address: 0x7A2...F9B3\nNetwork: Ethereum\nBalance: 1,234.56 USDT');
    setWalletConnected(true);
    setLoading(false);
  };

  // Handle token swap
  const handleSwapTokens = async () => {
    setLoading(true);
    setTerminalOutput('> ' + swapTokensCommand + '\nInitiating swap via Uniswap V3...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setTerminalOutput(prev => prev + '\nSwap path: USDT → CERE\nAmount in: 100 USDT\nAmount out: 95.5 CERE\nPrice impact: 0.32%\nTransaction hash: 0xf8a...b12c\nSwap completed successfully.');
    setSwapComplete(true);
    setLoading(false);
  };

  // Handle token teleportation
  const handleTeleportTokens = async () => {
    setLoading(true);
    setTerminalOutput('> ' + teleportCommand + '\nInitiating teleport via Hyperbridge...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    setTerminalOutput(prev => prev + '\nSource network: Ethereum\nDestination network: Cere Mainnet\nToken: CERE\nAmount: 95.5 CERE\nSource tx hash: 0xa23...d47b\nTeleport status: INITIATED\n\n...\n\nTeleport status: CONFIRMED\nDestination tx hash: 0xc9b...872a\nTeleport completed successfully.');
    setTeleportComplete(true);
    setLoading(false);
  };

  // Handle DDC verification
  const handleVerifyDDC = async () => {
    setLoading(true);
    setTerminalOutput('> ' + verifyCommand + '\nVerifying DDC account balance...');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setTerminalOutput(prev => prev + '\nAccount: DDC_123456\nNetwork: Cere Mainnet\nPrevious balance: 50.25 CERE\nNew tokens received: 95.5 CERE\nCurrent balance: 145.75 CERE\nDDC account updated successfully.');
    setVerificationComplete(true);
    setLoading(false);
  };

  // Handle next step
  const handleNextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  // Handle button click based on current step
  const handleActionForCurrentStep = async () => {
    switch (step) {
      case 0:
        await handleConnectWallet();
        break;
      case 1:
        await handleSwapTokens();
        break;
      case 2:
        await handleTeleportTokens();
        break;
      case 3:
        await handleVerifyDDC();
        break;
    }
  };

  // Determine if the current step is completed
  const isCurrentStepCompleted = () => {
    switch (step) {
      case 0: return walletConnected;
      case 1: return swapComplete;
      case 2: return teleportComplete;
      case 3: return verificationComplete;
      default: return false;
    }
  };

  // Determine button label
  const getButtonLabel = () => {
    if (loading) return "PROCESSING...";
    if (isCurrentStepCompleted()) return "NEXT STEP";
    
    switch (step) {
      case 0: return "CONNECT WALLET";
      case 1: return "SWAP TOKENS";
      case 2: return "TELEPORT";
      case 3: return "VERIFY DDC";
      default: return "PROCEED";
    }
  };

  // Handle button click
  const handleButtonClick = async () => {
    if (loading) return;
    
    if (isCurrentStepCompleted()) {
      handleNextStep();
    } else {
      await handleActionForCurrentStep();
    }
  };

  return (
    <>
      <BinaryBackground />
      <Backdrop open={true} sx={{ color: '#fff', zIndex: -1, backgroundColor: 'rgba(0,0,0,0.8)' }} />
      
      <MatrixContainer maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <pre style={{ color: matrixGreen, margin: '0 auto', fontFamily: '"monospace", monospace' }}>
            {asciiArt}
          </pre>
          <GlitchText data-text="DIGITAL CHAOS INTERFACE" variant="h4" sx={{ mt: 1 }}>
            DIGITAL CHAOS INTERFACE
          </GlitchText>
        </Box>
        
        <MatrixPaper elevation={6}>
          <Box sx={{ mb: 4 }}>
            <TerminalText variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
              // SYSTEM: HYPERBRIDGE TRANSFER PROTOCOL
            </TerminalText>
            <TerminalText variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
              // CLEARANCE: LEVEL 5
            </TerminalText>
            <TerminalText variant="body2" sx={{ opacity: 0.7, mb: 3 }}>
              // STATUS: INITIALIZED
            </TerminalText>
            
            <MatrixStepper activeStep={step} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </MatrixStepper>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <PixelBox>
                <TerminalText variant="subtitle1" sx={{ borderBottom: `1px solid ${matrixGreen}`, pb: 1, mb: 2 }}>
                  _EXECUTION_INTERFACE_
                </TerminalText>
                
                <Box sx={{ mb: 3, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {step === 0 && (
                    <Box sx={{ textAlign: 'center' }}>
                      <TerminalText>
                        Connect your wallet to begin the transfer sequence
                      </TerminalText>
                    </Box>
                  )}
                  
                  {step === 1 && (
                    <Box sx={{ textAlign: 'center' }}>
                      <TerminalText>
                        Swap 100 USDT for CERE tokens using decentralized exchange
                      </TerminalText>
                      {swapComplete && (
                        <TerminalText sx={{ mt: 2, color: matrixAccent }}>
                          Received: 95.5 CERE tokens
                        </TerminalText>
                      )}
                    </Box>
                  )}
                  
                  {step === 2 && (
                    <Box sx={{ textAlign: 'center' }}>
                      <TerminalText>
                        Teleport 95.5 CERE tokens to Cere Mainnet via Hyperbridge
                      </TerminalText>
                      {teleportComplete && (
                        <TerminalText sx={{ mt: 2, color: matrixAccent }}>
                          Teleport confirmed: Tokens arrived at destination
                        </TerminalText>
                      )}
                    </Box>
                  )}
                  
                  {step === 3 && (
                    <Box sx={{ textAlign: 'center' }}>
                      <TerminalText>
                        Verify DDC account has been updated with transferred tokens
                      </TerminalText>
                      {verificationComplete && (
                        <TerminalText sx={{ mt: 2, color: matrixAccent }}>
                          Verification complete: Balance updated to 145.75 CERE
                        </TerminalText>
                      )}
                    </Box>
                  )}
                </Box>
                
                <Box sx={{ textAlign: 'center' }}>
                  <MatrixButton 
                    onClick={handleButtonClick}
                    disabled={loading}
                    sx={{ width: '100%' }}
                  >
                    {loading ? (
                      <CircularProgress size={20} sx={{ color: matrixGreen }} />
                    ) : getButtonLabel()}
                  </MatrixButton>
                </Box>
              </PixelBox>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <PixelBox sx={{ backgroundColor: `rgba(0, 0, 0, 0.9)` }}>
                <TerminalText variant="subtitle1" sx={{ borderBottom: `1px solid ${matrixGreen}`, pb: 1, mb: 2 }}>
                  _TERMINAL_OUTPUT_
                </TerminalText>
                <Box sx={{ 
                  fontFamily: '"monospace", monospace', 
                  color: matrixGreen, 
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  p: 2,
                  height: 250,
                  overflow: 'auto',
                  whiteSpace: 'pre-line'
                }}>
                  {terminalOutput ? (
                    <TypedTerminal text={terminalOutput} speed={5} />
                  ) : (
                    "> Awaiting input... _"
                  )}
                </Box>
              </PixelBox>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 4, textAlign: 'center', opacity: 0.5 }}>
            <TerminalText variant="caption">
              // CERE NETWORK DECENTRALIZED DATA CLOUD - UNAUTHORIZED ACCESS WILL BE TRACED
            </TerminalText>
          </Box>
        </MatrixPaper>
      </MatrixContainer>
    </>
  );
};

// Page container
const PageContainer = styled(Box)({
  minHeight: '100vh',
  width: '100%',
  background: '#000',
  padding: 0,
  margin: 0,
  overflow: 'hidden',
});

// Export the complete demo page
const MatrixDemo: React.FC = () => {
  return (
    <PageContainer>
      <MatrixSwapDemo />
    </PageContainer>
  );
};

export default MatrixDemo; 