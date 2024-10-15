import { observer } from 'mobx-react-lite';
import { Stack, Typography, Button } from '@cluster-apps/ui';
import { useNavigate } from 'react-router-dom';

const NetworkTopology = () => {
  const navigate = useNavigate(); // Хук для навигации

  const handleConfigureNode = () => {
    navigate('/configure-node'); // Переход на страницу конфигурации ноды
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Network Topology</Typography>
      <Button variant="contained" onClick={handleConfigureNode}>
        Сконфигурировать первую ноду
      </Button>
    </Stack>
  );
};

export default observer(NetworkTopology);
