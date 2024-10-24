#!/bin/bash

# Проверка наличия Docker и Docker Compose
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "Docker и Docker Compose должны быть установлены."
    exit 1
fi

# Проверка аргументов
if [ "$#" -ne 7 ]; then
    echo "Использование: $0 STORAGE_ROOT BLOCKCHAIN_URL MODE nodeType port grpcPort p2pPort"
    exit 1
fi

# Получение аргументов
STORAGE_ROOT=$1
BLOCKCHAIN_URL=$2
MODE=$3
nodeType=$4
port=$5
grpcPort=$6
p2pPort=$7

# Генерация seed-фразы и публичного ключа
output=$(docker run --rm parity/subkey generate --scheme Ed25519)

# Извлечение seed-фразы и публичного ключа из вывода
seed=$(echo "$output" | grep -o 'Secret phrase `[^`]*`' | sed 's/Secret phrase `//;s/`//')
public_key=$(echo "$output" | grep -o 'Public key (hex): .*' | sed 's/Public key (hex): //')

# Сохранение переменных в .env файле
echo "PEER_SECRET_PHRASE=\"$seed\"" > .env
echo "PUBLIC_KEY=\"$public_key\"" >> .env

# Вывод публичного ключа
echo "Сгенерированный публичный ключ: $public_key"

# Создание docker-compose.yml файла
cat <<EOF > docker-compose.yml
version: '3.8'
services:
  ddc-node:
    image: cerebellumnetwork/ddc-${nodeType}-node:test
    container_name: ddc-${nodeType}-node
    env_file: .env
    volumes:
      - ${STORAGE_ROOT}:/data
    ports:
      - "${port}:${port}"
      - "${grpcPort}:${grpcPort}"
      - "${p2pPort}:${p2pPort}"
    environment:
      - PEER_SECRET_PHRASE=\${PEER_SECRET_PHRASE}
      - BLOCKCHAIN_URL=${BLOCKCHAIN_URL}
      - MODE=${MODE}
      - REDUNDANCY_ERASURE_CODING_REQUIRED=2
      - REDUNDANCY_ERASURE_CODING_TOTAL=3
      - REDUNDANCY_REPLICATION_TOTAL=3
EOF

# Запуск Docker Compose
echo "Запуск ноды..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "Нода успешно запущена."
else
    echo "Произошла ошибка при запуске ноды."
    exit 1
fi
