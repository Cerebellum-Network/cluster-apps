---
title: Node Provider Console
description: Management interface for DDC node operators
---

# Node Provider Console

The Node Provider Console is a specialized web application designed for DDC (Decentralized Data Cloud) node operators to manage, deploy, and monitor their nodes.

## Overview

This application provides a streamlined interface for:
- **Node Deployment**: Automated DDC node setup and configuration
- **Monitoring**: Real-time node performance and health metrics
- **Container Management**: Docker-based node orchestration
- **Metrics Collection**: Grafana Agent integration for observability

## Architecture

### Application Structure

```
apps/node-provider/
├── src/
│   ├── components/          # Node management UI components
│   ├── services/           # Node operation services
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── bootstrap.sh            # Node setup automation script
├── docker-compose.yml      # Container orchestration
├── agent-config.yaml       # Grafana Agent monitoring config
└── [config files]         # Build configuration
```

### Key Components

1. **Node Deployment Interface**: Web UI for node configuration
2. **Bootstrap Script**: Automated node setup with Docker
3. **Monitoring System**: Grafana Agent integration
4. **Container Orchestration**: Docker Compose configuration

## Node Deployment System

### Bootstrap Script (`bootstrap.sh`)

The bootstrap script automates the entire node deployment process:

```bash
#!/bin/bash
# Usage: ./bootstrap.sh STORAGE_ROOT BLOCKCHAIN_URL MODE NODE_TYPE PORT GRPC_PORT P2P_PORT NETWORK_NAME CLUSTER_ID

# Key functionality:
# 1. Validates Docker/Docker Compose installation
# 2. Generates cryptographic keys for the node
# 3. Configures monitoring agent
# 4. Starts node and monitoring containers
```

**Parameters**:
- `STORAGE_ROOT`: Local storage path for node data
- `BLOCKCHAIN_URL`: Cere blockchain endpoint
- `MODE`: Node operation mode (storage/cache/etc.)
- `NODE_TYPE`: Type of DDC node being deployed
- `PORT`: HTTP API port
- `GRPC_PORT`: gRPC communication port
- `P2P_PORT`: Peer-to-peer networking port
- `NETWORK_NAME`: DDC network identifier
- `CLUSTER_ID`: Target DDC cluster ID

### Key Generation

The bootstrap script generates cryptographic keys for node identity:

```bash
# Generate Ed25519 key pair using Substrate's subkey tool
output=$(docker run --rm parity/subkey generate --scheme Ed25519)

# Extract secret phrase and public key
export PEER_SECRET_PHRASE=$(echo "$output" | grep -o 'Secret phrase `[^`]*`' | sed 's/Secret phrase `//;s/`//')
export PUBLIC_KEY=$(echo "$output" | grep -o 'Public key (hex): .*' | sed 's/Public key (hex): //')

# Use public key as node identifier
export NODE_ID=$PUBLIC_KEY
```

### Docker Compose Configuration

The `docker-compose.yml` orchestrates multiple containers:

```yaml
# Key services:
# 1. DDC Node container - main storage/compute node
# 2. Grafana Agent - metrics and log collection
# 3. Nginx (optional) - reverse proxy and load balancing
```

**Environment Variables**:
- Storage and network configuration
- Cryptographic keys and identifiers
- Monitoring and logging settings

## Monitoring and Observability

### Grafana Agent Configuration

The monitoring system uses Grafana Agent to collect:

1. **Metrics**: Performance and operational metrics
2. **Logs**: Application and system logs
3. **Traces**: Distributed tracing data

### Metrics Collection

**Container Metrics**:
```yaml
# Key metrics collected via cAdvisor integration:
- container_cpu_usage_seconds_total
- container_memory_usage_bytes
- container_network_receive_bytes_total
- container_network_transmit_bytes_total
- container_fs_usage_bytes
```

**Application Metrics**:
```yaml
# DDC node-specific metrics:
- Node performance indicators
- Storage utilization
- Network connectivity
- Request processing rates
```

### Log Management

**Log Sources**:
- DDC node application logs
- Container system logs
- Nginx access logs (if configured)

**Log Processing**:
```yaml
# Pipeline stages for log processing:
- JSON parsing for structured logs
- Request filtering (excludes health checks)
- Activity log filtering (optional)
- Structured labeling and routing
```

### Remote Monitoring

All metrics, logs, and traces are forwarded to remote monitoring infrastructure:

```yaml
# Remote endpoints (configured in agent-config.yaml):
- Prometheus: http://167.235.185.121:2053/api/v1/push
- Loki: http://167.235.185.121:2083/loki/api/v1/push  
- Jaeger: 167.235.185.121:2087
```

## User Interface

### Node Management Dashboard

**Features**:
- Node status overview
- Real-time performance metrics
- Configuration management
- Log viewing interface
- Deployment wizard

### Deployment Wizard

**Steps**:
1. **Prerequisites Check**: Verify Docker installation
2. **Configuration Input**: Set node parameters
3. **Key Generation**: Create node identity
4. **Deployment**: Launch containers
5. **Verification**: Confirm successful deployment

### Monitoring Interface

**Dashboards**:
- Node health and status
- Resource utilization (CPU, memory, storage)
- Network connectivity metrics
- Error rates and alerts

## Node Types and Modes

### Supported Node Types

1. **Storage Nodes**: Provide data storage capacity
2. **Cache Nodes**: Optimize data access performance
3. **Compute Nodes**: Execute distributed computations
4. **Gateway Nodes**: API endpoints and load balancing

### Operation Modes

- **Full Node**: Complete DDC functionality
- **Light Node**: Minimal resource requirements
- **Validator Node**: Consensus participation
- **Archive Node**: Historical data retention

## Configuration Management

### Environment Configuration

All node configuration is managed through environment variables:

```bash
# Core node configuration
STORAGE_ROOT=/data/ddc
BLOCKCHAIN_URL=wss://mainnet.cere.network
MODE=storage
NODE_TYPE=storage-node

# Network configuration
PORT=8080
GRPC_PORT=9944
P2P_PORT=30333

# Identity and clustering
PEER_SECRET_PHRASE="generated secret phrase"
PUBLIC_KEY=0x...
NODE_ID=0x...
NETWORK_NAME=mainnet
CLUSTER_ID=0x...
```

### Dynamic Configuration

The monitoring configuration supports template variables:

```yaml
# Template variables in agent-config.yaml:
- "{{ NETWORK_NAME }}" - replaced with actual network name
- "{{ NODE_TYPE }}" - replaced with node type
- "{{ NODE_ID }}" - replaced with generated node ID
- "{{ CLUSTER_ID }}" - replaced with cluster identifier
```

## Security Considerations

### Key Management

- **Private Keys**: Stored securely in container environment
- **Key Generation**: Uses cryptographically secure random generation
- **Key Rotation**: [TODO: Document key rotation procedures]

### Network Security

- **Firewall Configuration**: Only required ports exposed
- **TLS/SSL**: Encrypted communication channels
- **Access Control**: Container-level isolation

### Data Protection

- **Storage Encryption**: Data encrypted at rest
- **Transport Security**: Encrypted data transmission
- **Access Logging**: All access attempts logged

## Deployment Process

### Prerequisites

1. **System Requirements**:
   - Linux-based operating system
   - Docker Engine (latest stable)
   - Docker Compose (v2.0+)
   - Minimum 2GB RAM, 20GB storage

2. **Network Requirements**:
   - Internet connectivity
   - Open ports for P2P, gRPC, and HTTP
   - Access to Cere blockchain network

### Installation Steps

1. **Download Node Provider Console**:
   ```bash
   git clone <repository-url>
   cd cluster-apps/apps/node-provider
   ```

2. **Configure Environment**:
   ```bash
   # Set required environment variables
   export STORAGE_ROOT=/path/to/storage
   export BLOCKCHAIN_URL=wss://network.endpoint
   # ... other variables
   ```

3. **Run Bootstrap Script**:
   ```bash
   chmod +x bootstrap.sh
   ./bootstrap.sh $STORAGE_ROOT $BLOCKCHAIN_URL $MODE $NODE_TYPE $PORT $GRPC_PORT $P2P_PORT $NETWORK_NAME $CLUSTER_ID
   ```

4. **Verify Deployment**:
   ```bash
   docker-compose ps
   curl http://localhost:$PORT/health
   ```

## Maintenance and Operations

### Health Monitoring

**Health Check Endpoints**:
- `/health` - Basic health status
- `/info` - Node information and statistics
- `/metrics` - Prometheus-compatible metrics

**Monitoring Commands**:
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f [service-name]

# Check resource usage
docker stats
```

### Backup and Recovery

**Data Backup**:
```bash
# Backup node data
docker-compose stop
tar -czf node-backup-$(date +%Y%m%d).tar.gz $STORAGE_ROOT
```

**Recovery Process**:
```bash
# Restore from backup
docker-compose stop
tar -xzf node-backup-YYYYMMDD.tar.gz
docker-compose up -d
```

### Updates and Upgrades

**Container Updates**:
```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d
```

**Configuration Updates**:
```bash
# Update configuration
vim agent-config.yaml

# Restart monitoring
docker-compose restart grafana-agent
```

## Troubleshooting

### Common Issues

1. **Container Start Failures**:
   - Check Docker daemon status
   - Verify port availability
   - Review container logs

2. **Network Connectivity Issues**:
   - Verify firewall settings
   - Check port forwarding
   - Test blockchain connectivity

3. **Storage Problems**:
   - Check disk space availability
   - Verify storage permissions
   - Monitor I/O performance

### Diagnostic Commands

```bash
# Container diagnostics
docker-compose logs [service-name]
docker inspect [container-name]

# Network diagnostics
netstat -tulpn | grep [port]
ping [blockchain-endpoint]

# Storage diagnostics
df -h
ls -la $STORAGE_ROOT
```

### Log Analysis

**Key Log Locations**:
- Container logs: `docker-compose logs`
- Application logs: Within containers at `/var/log/`
- System logs: `/var/log/syslog` or `journalctl`

## Integration with Developer Console

The Node Provider Console integrates with the main Developer Console for:

- **Cluster Management**: Centralized node oversight
- **Performance Analytics**: Aggregated metrics across nodes
- **Configuration Sync**: Consistent settings across infrastructure

## Future Enhancements

### Planned Features

- **Web-based Configuration**: GUI for node setup
- **Automated Scaling**: Dynamic node deployment
- **Advanced Monitoring**: Custom dashboards and alerts
- **Cluster Orchestration**: Multi-node management

### API Integration

[TODO: Document API endpoints once implemented]

See [Extension Guide](../extension/guide.md) for information on extending node provider functionality. 