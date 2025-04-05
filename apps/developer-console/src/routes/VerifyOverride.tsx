import React, { useEffect } from 'react';

/**
 * This component is used to override OTP verification
 * in development environments by finding the OTP inputs
 * in the wallet iframe and automatically filling them.
 */
const VerifyOverride: React.FC = () => {
  useEffect(() => {
    const runOverride = () => {
      // Check if we're in a development environment
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
      }

      console.log('DEVELOPMENT MODE: Initializing OTP verification bypass');

      // Function to check and fill OTP inputs
      const checkAndFillOtp = () => {
        // Look for all iframes that might contain the verification form
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            if (!iframe.contentWindow || !iframe.contentDocument) return;
            
            // Find OTP input fields in the iframe
            const inputs = iframe.contentDocument.querySelectorAll('input');
            const digitInputs = Array.from(inputs).filter(input => 
              input.maxLength === 1 || 
              input.type === 'tel' || 
              input.type === 'number' ||
              (input.placeholder && input.placeholder.length === 1)
            );
            
            // Find verification button
            const buttons = iframe.contentDocument.querySelectorAll('button');
            const verifyButton = Array.from(buttons).find(button => 
              button.textContent?.toLowerCase().includes('verify') || 
              button.textContent?.toLowerCase().includes('confirm')
            );
            
            console.log(`Found ${digitInputs.length} digit inputs and verify button: ${!!verifyButton}`);
            
            // If we found OTP inputs and a verify button
            if (digitInputs.length >= 4 && verifyButton) {
              console.log('Filling OTP code with 000000');
              
              // Fill each digit input with "0"
              digitInputs.forEach(input => {
                const inputEl = input as HTMLInputElement;
                inputEl.value = '0';
                
                // Trigger input events
                const inputEvent = new Event('input', { bubbles: true });
                inputEl.dispatchEvent(inputEvent);
                
                const changeEvent = new Event('change', { bubbles: true });
                inputEl.dispatchEvent(changeEvent);
              });
              
              // Click the verify button
              setTimeout(() => {
                console.log('Clicking verify button');
                verifyButton.click();
              }, 500);
            }
            
            // Look for a single OTP input field
            const otpInput = Array.from(inputs).find(input => 
              input.name?.toLowerCase().includes('otp') || 
              input.id?.toLowerCase().includes('otp') ||
              input.placeholder?.toLowerCase().includes('code')
            );
            
            if (otpInput && verifyButton) {
              console.log('Found single OTP input, filling with 000000');
              const inputEl = otpInput as HTMLInputElement;
              inputEl.value = '000000';
              
              // Trigger input events
              const inputEvent = new Event('input', { bubbles: true });
              inputEl.dispatchEvent(inputEvent);
              
              const changeEvent = new Event('change', { bubbles: true });
              inputEl.dispatchEvent(changeEvent);
              
              // Click the verify button
              setTimeout(() => {
                console.log('Clicking verify button');
                verifyButton.click();
              }, 500);
            }
          } catch (error) {
            // Ignore cross-origin errors
            console.log('Could not access iframe content (cross-origin restriction)');
          }
        });
      };
      
      // Run the check periodically
      const intervalId = setInterval(checkAndFillOtp, 1000);
      
      // Clean up interval after 30 seconds
      setTimeout(() => clearInterval(intervalId), 30000);
      
      return () => clearInterval(intervalId);
    };
    
    return runOverride();
  }, []);
  
  return null;
};

export default VerifyOverride; 