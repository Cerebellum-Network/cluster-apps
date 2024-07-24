import { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { Snackbar, SnackbarOrigin, Alert, AlertColor } from '@developer-console/ui';

interface MessageOptions {
  message: string;
  appearance?: AlertColor;
  autoDismiss?: boolean;
  placement?: SnackbarOrigin;
}

interface MessagesContextProps {
  showMessage: (options: MessageOptions) => void;
}

const MessagesContext = createContext<MessagesContextProps | undefined>(undefined);

export const useMessages = (): MessagesContextProps => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};

export const MessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const [snackPack, setSnackPack] = useState<MessageOptions[]>([]);
  const [open, setOpen] = useState(false);
  const [messageInfo, setMessageInfo] = useState<MessageOptions | undefined>(undefined);

  const showMessage = useCallback((options: MessageOptions) => {
    setSnackPack((prev) => [...prev, { ...options }]);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleExited = useCallback(() => {
    setMessageInfo(undefined);
  }, []);

  useEffect(() => {
    if (snackPack.length && !messageInfo) {
      setMessageInfo({ ...snackPack[0] });
      setSnackPack((prev) => prev.slice(1));
      setOpen(true);
    } else if (snackPack.length && messageInfo && open) {
      setOpen(false);
    }
  }, [snackPack, messageInfo, open]);

  return (
    <MessagesContext.Provider value={{ showMessage }}>
      {children}
      <Snackbar
        key={messageInfo ? messageInfo.message : undefined}
        anchorOrigin={messageInfo?.placement || { vertical: 'top', horizontal: 'center' }}
        open={open}
        autoHideDuration={messageInfo?.autoDismiss ? 3000 : null}
        onClose={handleClose}
        TransitionProps={{ onExited: handleExited }}
      >
        <Alert onClose={handleClose} severity={messageInfo?.appearance}>
          {messageInfo?.message}
        </Alert>
      </Snackbar>
    </MessagesContext.Provider>
  );
};
