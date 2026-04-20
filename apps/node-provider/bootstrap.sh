#!/bin/bash

# Check for installed dependencies
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "Docker and Docker Compose must be installed."
    exit 1
fi

# Check the number of arguments
if [ "$#" -ne 9 ]; then
    echo "Usage: $0 STORAGE_ROOT BLOCKCHAIN_URL MODE NODE_TYPE PORT GRPC_PORT P2P_PORT NETWORK_NAME CLUSTER_ID"
    exit 1
fi

# Set variables from arguments
export STORAGE_ROOT=$1
export BLOCKCHAIN_URL=$2
export MODE=$3
export NODE_TYPE=$4
export PORT=$5
export GRPC_PORT=$6
export P2P_PORT=$7
export NETWORK_NAME=$8
export CLUSTER_ID=$9

# Generating a seed phrase and public key
output=$(docker run --rm parity/subkey generate --scheme Ed25519)

export PEER_SECRET_PHRASE=$(echo "$output" | grep -o 'Secret phrase `[^`]*`' | sed 's/Secret phrase `//;s/`//')
export PUBLIC_KEY=$(echo "$output" | grep -o 'Public key (hex): .*' | sed 's/Public key (hex): //')

# Use PUBLIC_KEY as NODE_ID
export NODE_ID=$PUBLIC_KEY

# Output public key and NODE_ID
echo "Generated public key: $PUBLIC_KEY"
echo "Using NODE_ID: $NODE_ID"

# Path to agent configuration file
AGENT_CONFIG_FILE="$(dirname "$(realpath "$0")")/agent-config.yaml"

# Check for the existence of the configuration file
if [ ! -f "$AGENT_CONFIG_FILE" ]; then
    echo "Agent configuration file not found: $AGENT_CONFIG_FILE"
    exit 1
fi

# Substituting variables into the configuration file using envsubst
envsubst < "$AGENT_CONFIG_FILE" > "${AGENT_CONFIG_FILE}.tmp" && mv "${AGENT_CONFIG_FILE}.tmp" "$AGENT_CONFIG_FILE"

# Running containers
echo "Running node and agent..."
STORAGE_ROOT=$STORAGE_ROOT \
BLOCKCHAIN_URL=$BLOCKCHAIN_URL \
MODE=$MODE \
NODE_TYPE=$NODE_TYPE \
PORT=$PORT \
GRPC_PORT=$GRPC_PORT \
P2P_PORT=$P2P_PORT \
PEER_SECRET_PHRASE=$PEER_SECRET_PHRASE \
PUBLIC_KEY=$PUBLIC_KEY \
NODE_ID=$NODE_ID \
NETWORK_NAME=$NETWORK_NAME \
CLUSTER_ID=$CLUSTER_ID \
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "The node and agent have been launched successfully."
else
    echo "An error occurred while starting the node and agent."
    exit 1
fi
