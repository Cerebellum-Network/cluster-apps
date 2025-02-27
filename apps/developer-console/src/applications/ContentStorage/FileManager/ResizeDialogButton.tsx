import * as React from 'react';

import { IconButton, Dialog, Box, FormControl, FormControlLabel, DialogContent, DialogActions } from '@cluster-apps/ui';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';

import FormLabel from '@mui/material/FormLabel';
import FormGroup from '@mui/material/FormGroup';
import Checkbox from '@mui/material/Checkbox';

export type ResolutionEntry = {
  label: string;
  maxWidth: number;
};

export const Resolutions: { [key: string]: ResolutionEntry } = {
  res_1920_1080: { label: '1920x1080 (Desktop resolution)', maxWidth: 1080 },
  res_1280x720: { label: '1280x720 (Big tablet resolution)', maxWidth: 720 },
  res_640_480: { label: '640x480 (Small tablet resolution )', maxWidth: 480 },
};

export interface SimpleDialogProps {
  open: boolean;
  onCancelButton: () => void;
  onSubmitButton: (resArr: ResolutionEntry[]) => void;
}

function ResizeDialog(props: SimpleDialogProps) {
  const { onCancelButton, open, onSubmitButton } = props;

  const [state, setState] = React.useState({
    res_640_480: false,
    res_1280x720: false,
    res_1920_1080: false,
  });

  const handleSubmit = () => {
    const result: ResolutionEntry[] = [];
    if (state.res_640_480) {
      result.push(Resolutions.res_640_480);
    }

    if (state.res_1280x720) {
      result.push(Resolutions.res_1280x720);
    }

    if (state.res_1920_1080) {
      result.push(Resolutions.res_1920_1080);
    }

    onSubmitButton(result);
    setState({
      res_640_480: false,
      res_1280x720: false,
      res_1920_1080: false,
    });
  };

  const handleClose = () => {
    onCancelButton();
    setState({
      res_640_480: false,
      res_1280x720: false,
      res_1920_1080: false,
    });
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      [event.target.name]: event.target.checked,
    });
  };

  const { res_640_480, res_1280x720, res_1920_1080 } = state;
  // TODO add Error if nothing is selected

  return (
    <Dialog onClose={handleClose} open={open}>
      <DialogContent>
        <Box sx={{ display: 'flex' }}>
          <FormControl sx={{ m: 3 }} component="fieldset" variant="standard">
            <FormLabel component="legend">Select resolutions</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox checked={res_640_480} onChange={handleChange} name="res_640_480" />}
                label={Resolutions.res_640_480.label}
              />
              <FormControlLabel
                control={<Checkbox checked={res_1280x720} onChange={handleChange} name="res_1280x720" />}
                label={Resolutions.res_1280x720.label}
              />
              <FormControlLabel
                control={<Checkbox checked={res_1920_1080} onChange={handleChange} name="res_1920_1080" />}
                label={Resolutions.res_1920_1080.label}
              />
            </FormGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <IconButton onClick={handleClose}>Cancel</IconButton>
        <IconButton onClick={handleSubmit}>Submit</IconButton>
      </DialogActions>
    </Dialog>
  );
}

export function ResizeDialogButton(props: { handleSubmit: (resArr: ResolutionEntry[]) => void }) {
  const [open, setOpen] = React.useState(false);
  //   const [selectedValue, setSelectedValue] = React.useState(resizeData[1].res);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const onSubmit = (resArr: ResolutionEntry[]) => {
    setOpen(false);
    props.handleSubmit(resArr);
  };

  return (
    <div>
      <IconButton onClick={handleClickOpen}>
        <AspectRatioIcon />
      </IconButton>
      <ResizeDialog open={open} onCancelButton={handleClose} onSubmitButton={onSubmit} />
    </div>
  );
}
