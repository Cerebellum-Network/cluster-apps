import { Pill } from '../Pill';

export type ComingSoonProps = {
  /** User-facing label; defaults to "Coming soon". */
  label?: string;
};

/**
 * One shared "Coming soon" pill (#192 review): where the backend data isn't there
 * yet, the element stays in place with this badge in user language — never a
 * developer note like "appears here once the bills feed is wired".
 */
const ComingSoon = ({ label = 'Coming soon' }: ComingSoonProps) => <Pill>{label}</Pill>;

export default ComingSoon;
