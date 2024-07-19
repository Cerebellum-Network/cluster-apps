import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const FolderIcon = memo((props: SvgIconProps) => (
  <SvgIcon
    {...props}
    sx={{
      width: props.width,
      height: props.height,
      fill: 'none',
    }}
    viewBox="0 0 22 22"
  >
    <rect x="0.5" y="0.5" width="21" height="21" rx="4.5" fill="currentColor" />
    <rect x="0.5" y="0.5" width="21" height="21" rx="4.5" stroke="#E6E6E6" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.125 6.41711C10.8948 6.37799 10.581 6.37503 10.0149 6.37503C9.05656 6.37503 8.37537 6.37581 7.85893 6.44493C7.35298 6.51265 7.06226 6.63966 6.85095 6.85098C6.63935 7.06258 6.51251 7.3524 6.44488 7.85545C6.3758 8.36928 6.375 9.04661 6.375 10V12C6.375 12.9534 6.3758 13.6308 6.44488 14.1446C6.51251 14.6476 6.63935 14.9375 6.85095 15.1491C7.06256 15.3607 7.35238 15.4875 7.85542 15.5551C8.36926 15.6242 9.04659 15.625 10 15.625H12C12.9534 15.625 13.6307 15.6242 14.1446 15.5551C14.6476 15.4875 14.9374 15.3607 15.149 15.1491C15.3607 14.9375 15.4875 14.6476 15.5551 14.1446C15.6242 13.6308 15.625 12.9534 15.625 12V11.7815C15.625 11.0135 15.6196 10.6494 15.5381 10.375H13.9732C13.4067 10.375 12.9439 10.375 12.5784 10.3259C12.1965 10.2746 11.8653 10.1634 11.601 9.89907C11.3366 9.63473 11.2255 9.30356 11.1741 8.92158C11.125 8.55615 11.125 8.09329 11.125 7.52687V6.41711ZM11.875 6.80475V7.50003C11.875 8.09988 11.8758 8.51205 11.9174 8.82165C11.9576 9.12046 12.0295 9.26697 12.1313 9.36874C12.2331 9.47051 12.3796 9.54243 12.6784 9.5826C12.988 9.62423 13.4001 9.62502 14 9.62502H15.0097C14.8615 9.48125 14.6716 9.30898 14.425 9.08703L12.4456 7.30558C12.2029 7.08716 12.0223 6.92594 11.875 6.80475ZM10.0877 5.62501C10.78 5.62483 11.2273 5.62471 11.639 5.78268C12.0506 5.94064 12.3816 6.23867 12.8936 6.69978C12.9113 6.71569 12.9292 6.73181 12.9473 6.74811L14.9267 8.52956C14.9478 8.54853 14.9686 8.56725 14.9892 8.58575C15.581 9.11807 15.9637 9.46229 16.1696 9.92451C16.3754 10.3867 16.3753 10.9015 16.375 11.6975C16.375 11.7251 16.375 11.7531 16.375 11.7815V12.0282C16.375 12.9471 16.375 13.6749 16.2984 14.2445C16.2196 14.8307 16.0536 15.3052 15.6794 15.6794C15.3052 16.0536 14.8307 16.2196 14.2445 16.2985C13.6749 16.375 12.9471 16.375 12.0282 16.375H9.9718C9.05291 16.375 8.3251 16.375 7.75549 16.2985C7.16928 16.2196 6.6948 16.0536 6.32062 15.6794C5.94644 15.3052 5.78038 14.8307 5.70157 14.2445C5.62499 13.6749 5.62499 12.9471 5.625 12.0282V9.97182C5.62499 9.05294 5.62499 8.32512 5.70157 7.75551C5.78038 7.1693 5.94644 6.69483 6.32062 6.32065C6.6951 5.94617 7.17116 5.7803 7.75944 5.70156C8.33141 5.62501 9.06285 5.62502 9.98676 5.62503L10.0149 5.62503C10.0395 5.62503 10.0637 5.62502 10.0877 5.62501Z"
      fill="currentColor"
      stroke="#818083"
      strokeWidth="0.5"
    />
  </SvgIcon>
));
