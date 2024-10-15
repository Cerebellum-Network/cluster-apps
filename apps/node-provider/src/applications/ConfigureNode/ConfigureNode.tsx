import { Stack, Typography, Button } from '@cluster-apps/ui';

const ConfigureNode = () => {
  const handleSave = () => {
    // Логика для сохранения конфигурации ноды
    console.log('Node configured!');
    // После конфигурации можно перейти к другой странице или показать сообщение
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Конфигурация ноды</Typography>
      {/* Ваши поля для ввода конфигурации */}
      <Button variant="contained" onClick={handleSave}>
        Сохранить конфигурацию
      </Button>
    </Stack>
  );
};

export default ConfigureNode;
