import React, { useEffect, useState } from 'react';
import { styled, keyframes } from '@mui/material';

const fadeInDown = keyframes`
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const Overlay = styled('div')<{ isVisible: boolean }>`
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom right, #4f46e5, #6d28d9, #db2777);
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: white;
  transition: opacity 0.5s;
  opacity: ${({ isVisible }) => (isVisible ? 1 : 0)};
`;

const Content = styled('div')`
  max-width: 24rem;
  width: 100%;
  text-align: center;
`;

const Title = styled('h1')`
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 24px;
  animation: ${fadeInDown} 0.5s ease-out forwards;
`;

const SubTitle = styled('h1')`
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 24px;
  animation: ${fadeInDown} 0.5s ease-out forwards;
  background: linear-gradient(to right, #fde047, #f472b6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 8px;
`;

const Subtitle = styled('h2')`
  font-size: 1.875rem;
  font-weight: 700;
  margin-bottom: 32px;
  animation: ${fadeInDown} 0.5s ease-out forwards;
  animation-delay: 0.2s;
`;

const Text = styled('p')`
  margin-bottom: 32px;
  font-size: 1.125rem;
  animation: ${fadeInDown} 0.5s ease-out forwards;
  animation-delay: 0.4s;
`;

const Button = styled('a')`
  display: inline-block;
  background-color: #4f46e5;
  color: white;
  font-weight: 600;
  padding: 12px 32px;
  border-radius: 0.5rem;
  text-align: center;
  text-decoration: none;
  transition: background-color 0.3s;
  animation: ${fadeInDown} 0.5s ease-out forwards;
  animation-delay: 0.6s;

  &:hover {
    background-color: #4338ca;
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3);
  }
`;

export const MobileOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    root!.style.overflow = 'hidden';
    setIsVisible(true);
    return () => {
      root!.style.overflow = 'unset';
    };
  }, []);

  return (
    <Overlay isVisible={isVisible}>
      <Content>
        <Title>Dragon 1</Title>
        <SubTitle>Mobile Experience</SubTitle>

        <Subtitle>Coming Soon</Subtitle>

        <Text>
          We&apos;re crafting an extraordinary mobile journey just for you. In the meantime, please use a desktop
          browser to explore our full suite of features.
        </Text>

        <Button href="https://discord.com/invite/cYVKUYHWhp" target="_blank" rel="noopener noreferrer">
          Join Dragon 1 on Discord
        </Button>
      </Content>
    </Overlay>
  );
};
