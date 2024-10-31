#!/bin/bash

if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "Docker and Docker Compose must be installed."
    exit 1
fi

if [ "$#" -ne 7 ]; then
    echo "Usage: $0 STORAGE_ROOT BLOCKCHAIN_URL MODE nodeType port grpcPort p2pPort"
    exit 1
fi

export STORAGE_ROOT=$1
export BLOCKCHAIN_URL=$2
export MODE=$3
export NODE_TYPE=$4
export PORT=$5
export GRPC_PORT=$6
export P2P_PORT=$7

# Generating a seed phrase and public key
output=$(docker run --rm parity/subkey generate --scheme Ed25519)

export PEER_SECRET_PHRASE=$(echo "$output" | grep -o 'Secret phrase `[^`]*`' | sed 's/Secret phrase `//;s/`//')
export PUBLIC_KEY=$(echo "$output" | grep -o 'Public key (hex): .*' | sed 's/Public key (hex): //')

# Output public key
echo "Generated public key: $PUBLIC_KEY"

echo "Running node..."
STORAGE_ROOT=$STORAGE_ROOT \
BLOCKCHAIN_URL=$BLOCKCHAIN_URL \
MODE=$MODE \
NODE_TYPE=$NODE_TYPE \
PORT=$PORT \
GRPC_PORT=$GRPC_PORT \
P2P_PORT=$P2P_PORT \
PEER_SECRET_PHRASE=$PEER_SECRET_PHRASE \
PUBLIC_KEY=$PUBLIC_KEY \
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "The node has been launched successfully."
else
    echo "An error occurred while starting the node."
    exit 1
fi
