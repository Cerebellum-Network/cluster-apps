import { SvgIcon, SvgIconProps } from '@mui/material';

export const RightArrowIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props} width="25" height="24" viewBox="0 0 25 24">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M13.9697 5.46967C14.2626 5.17678 14.7374 5.17678 15.0303 5.46967L21.0303 11.4697C21.3232 11.7626 21.3232 12.2374 21.0303 12.5303L15.0303 18.5303C14.7374 18.8232 14.2626 18.8232 13.9697 18.5303C13.6768 18.2374 13.6768 17.7626 13.9697 17.4697L18.6893 12.75H4.5C4.08579 12.75 3.75 12.4142 3.75 12C3.75 11.5858 4.08579 11.25 4.5 11.25H18.6893L13.9697 6.53033C13.6768 6.23744 13.6768 5.76256 13.9697 5.46967Z"
      />
    </SvgIcon>
  );
};
