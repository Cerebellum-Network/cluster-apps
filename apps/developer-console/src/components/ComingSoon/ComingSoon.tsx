import { Box } from '@cluster-apps/ui';

export type ComingSoonProps = {
  /** User-facing label; defaults to "Coming soon". */
  label?: string;
};

/**
 * One shared "Coming soon" pill (#192 review): where the backend data isn't there
 * yet, the element stays in place with this badge in user language — never a
 * developer note like "appears here once the bills feed is wired".
 */
const ComingSoon = ({ label = 'Coming soon' }: ComingSoonProps) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.5,
      color: '#5E5C6B',
      backgroundColor: '#ECEDF3',
      borderRadius: '999px',
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </Box>
);

export default ComingSoon;
