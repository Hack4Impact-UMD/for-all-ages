import { styled } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import styles from './Toggle.module.css';

const ToggleSwitch = styled(Switch)(({ theme }) => ({
  width: 36,
  height: 21,
  padding: 0,
  display: 'flex',
  '&:active': {
    '& .MuiSwitch-thumb': {
      width: 16,
    },
    '& .MuiSwitch-switchBase.Mui-checked': {
      transform: 'translateX(19px)',
    },
  },
  '& .MuiSwitch-switchBase': {
    padding: 3.5,
    '&.Mui-checked': {
      transform: 'translateX(15px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: '#2E8B57',
        ...theme.applyStyles('dark', {
          backgroundColor: '#2E8B57',
        }),
      },
    },
  },
  '& .MuiSwitch-thumb': {
    boxShadow: '0 2px 4px 0 rgb(0 35 11 / 20%)',
    width: 14,
    height: 14,
    borderRadius: 7,
    transition: theme.transitions.create(['width'], {
      duration: 200,
    }),
  },
  '& .MuiSwitch-track': {
    borderRadius: 21 / 2,
    opacity: 1,
    backgroundColor: '#CEDDED',
    boxSizing: 'border-box',
    ...theme.applyStyles('dark', {
      backgroundColor: '#CEDDED',
    }),
  },
}));

interface ToggleProps {
  checked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function Toggle({ checked = false, onChange }: ToggleProps) {
  return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <ToggleSwitch
          checked={checked}
          onChange={onChange}
          slotProps={{ input: { 'aria-label': 'Toggle waitlisted participants' } }}
        />
        <p className={styles.label}>View Waitlisted Participants</p>
      </Stack>
  );
}