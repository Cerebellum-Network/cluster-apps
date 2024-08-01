import { Button } from '@mui/material';
import { DiscordIcon } from '../../icons/DiscordIcon';

type DiscordButtonProps = {
  text: string;
  link: string;
  className?: string;
};
export const DiscordButton = ({ text, link, className }: DiscordButtonProps) => (
  <Button
    variant="outlined"
    color="secondary"
    href={link}
    startIcon={<DiscordIcon />}
    className={className}
    target="_blank"
    rel="noopener noreferrer"
  >
    {text}
  </Button>
);
