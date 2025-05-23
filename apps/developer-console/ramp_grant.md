# Cere DDC Ramp Service

A modular, secure, and extensible Ramp Service for seamless top-up of DDC (Decentralized Data Cluster) accounts on Cere Network using familiar payment methods and blockchain assets.

---

## Index

- [Problem Statement](#problem-statement)
- [Objective](#objective)
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Top-Up Flow Overview](#top-up-flow-overview)
- [Data Flow](#data-flow)
- [API Specification](#api-specification)
    - [1. Get Supported Networks and Assets](#1-get-supported-networks-and-assets)
    - [2. Get Commission Charged](#2-get-commission-charged)
    - [3. Check if Network and Asset Supported](#3-check-if-network-and-asset-supported)
    - [4. Submit Transaction Receipt, DDC Account, and Top-Up Amount](#4-submit-transaction-receipt-ddc-account-and-top-up-amount)
- [Multi-Ramp Service Design](#multi-ramp-service-design)
- [Deliverables](#deliverables)
- [Acceptance Criteria](#acceptance-criteria)

---

## Problem Statement

The current process for topping up DDC accounts on Cere Network is complex and user-unfriendly, requiring manual acquisition of CERE tokens, wallet management, and direct blockchain interaction. This creates friction for developers and end-users, limiting adoption and efficient use of Cere’s DDC infrastructure.

**Solution:**  
Introduce an intermediary Ramp Service to bridge the Developer Console, Customer Payment Service, and Cere Mainnet Node. This service abstracts blockchain complexities, enabling smooth, secure, and extensible top-up flows using familiar payment methods.

---

## Objective

- Bridge the Cluster’s Developer Console, Customer Payment Service (CPS), and Cere Mainnet Node.
- Accept crypto payments from CPS on a designated L2 blockchain, verify and process these payments, and top up user DDC accounts on Cere Mainnet using a hot wallet.
- Ensure the system is modular, secure, and easily extensible to support new L2s, assets, and payment flows.

---

## Overview

This specification details the architecture, flow, and API design for topping up DDC accounts via one or more Ramp Services.

---

## System Architecture

The system supports integration with multiple Ramp Services, each capable of processing top-ups using supported blockchain networks and assets. The Ramp Service handles payment processing, commission deduction, and token transfer to the DDC cluster.

![image](https://github.com/user-attachments/assets/e045acae-29aa-437a-92cc-faee50b11c80)



---

## Top-Up Flow Overview

The top-up process is orchestrated by the Cluster Manager and Ramp Service Provider:

1. **Get Supported Networks & Assets:** CustomerPaymentService queries RampService for available networks and assets.
2. **Transfer Token:** Customer transfers their preferred token on the selected network.
3. **Submit Transaction Proof:** CustomerPaymentService submits the transaction proof, DDC account, and amount to RampService.
4. **Verification & Processing:** RampService verifies the transaction, fetches token price, and deducts commission.
5. **Top-Up on Mainnet:** RampService executes the top-up by transferring tokens to the cluster’s smart contract on CereMainnet.
6. **Notify Completion:** RampService notifies CustomerPaymentService of successful top-up and sends a receipt.

![image](https://github.com/user-attachments/assets/9e20eded-c08a-43c8-85b7-2dfd648c74ca)


---

## Data Flow

| Step | Source                 | Destination           | Data/Action                                               |
|------|------------------------|----------------------|-----------------------------------------------------------|
| 1    | CustomerPaymentService | RampService          | API Call: Get supported networks & tokens                 |
| 2    | RampService            | CustomerPaymentService | Supported networks & tokens (JSON)                        |
| 3    | Customer               | Blockchain Network   | Transfer preferred token                                  |
| 4    | CustomerPaymentService | RampService          | API Call: Submit transaction proof/hash, DDC account, amount |
| 5    | RampService            | Blockchain Network   | Verify transaction, fetch price, deduct commission, process top-up |
| 6    | RampService            | CereMainnet          | Transaction: Top up DDC account (transfer tokens to Cluster Smart Contract) |
| 7    | RampService            | CustomerPaymentService | Top-up confirmation & details (JSON)                      |

---

## API Specification

The API is designed to be extensible, allowing integration with multiple Ramp Services.

### 1. Get Supported Networks and Assets

**Endpoint:**
```http
GET /api/v1/supported-networks-assets
```

**Response:**
```json
{
  "networks": {
    "Ethereum": ["USDT", "USDC", "ETH"],
    "Polygon": ["USDT", "MATIC"],
    "CereMainnet": ["CERE"]
  }
}
```
*Returns a map of supported blockchain networks and their available assets.*

---

### 2. Get Commission Charged

**Endpoint:**
```http
GET /api/v1/commission
```

**Request Parameters:**  
Optional: `network`, `asset`

**Response:**
```json
{
  "commission": {
    "network": "Ethereum",
    "asset": "USDT",
    "rate": "0.015",
    "fixed_fee": "1.00"
  }
}
```
*Returns the commission rate and/or fixed fee for a given network and asset.*

---

### 3. Check if Network and Asset Supported

**Endpoint:**
```http
GET /api/v1/is-supported
```

**Request Parameters:**
- `network` (string, required)
- `asset` (string, required)

**Response:**
```json
{
  "supported": true
}
```
*Returns a boolean indicating if the specific network and asset pair is supported.*

---

### 4. Submit Transaction Receipt, DDC Account, and Top-Up Amount

**Endpoint:**
```http
POST /api/v1/submit-topup
```

**Request:**
```json
{
  "network": "Ethereum",
  "asset": "USDT",
  "transaction_hash": "0x123abc...",
  "ddc_account": "ddc_456",
  "amount": "100.00"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Top-up successful",
  "topup_details": {
    "ddc_account": "ddc_456",
    "amount_credited": "98.50",
    "transaction_id": "topup789"
  }
}
```
*Processes the top-up, verifies the transaction, credits the DDC account, and returns confirmation.*

---

## Multi-Ramp Service Design

- The system supports multiple Ramp Services, each exposing the above APIs with a unique base URL or identifier.
- The Cluster Manager or CustomerPaymentService can select the appropriate Ramp Service based on network/asset support, commission rates, or customer preference.
- Future Ramp Services can be integrated by adhering to the same API contract.

---

## Deliverables

- **Ramp Service Source Code & Deployment**
    - Complete, production-ready codebase for the Ramp Service, including all modules for payment reception, verification, commission handling, and DDC account top-up.
    - Deployment scripts and configuration files for staging and production environments.
- **API Documentation**
    - Comprehensive documentation of all Ramp Service APIs, including endpoints for payment submission, status checking, and DDC top-up requests.
    - Example requests and responses for each endpoint.

---

## Acceptance Criteria

- Ramp Service receives and verifies on-chain payments from CPS on the designated L2 blockchain.
- Upon successful verification, the user’s DDC account on Cere Mainnet is credited via the Ramp Service’s hot wallet.
- All APIs function as specified, with robust error handling and clear status reporting.
- Documentation is complete, and the system is validated through integration tests with Developer Console, CPS, and Cere Mainnet Node.
- The architecture allows for easy extension to additional L2s and assets in the future.

---

