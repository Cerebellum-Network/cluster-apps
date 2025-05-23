# Dev Console Top-Up RFP

## Index

- [Problem Statement](#problem-statement)
- [Objective](#objective)
- [Key Concepts/Keywords 📝](#key-conceptskewords-)
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [User Flow](#user-flow)
  - [Step-by-Step Sequence](#step-by-step-sequence)
- [Sequence Diagram](#sequence-diagram)
- [User Interface](#user-interface)
- [Data Flow](#data-flow)
- [Security & Compliance](#security--compliance)
- [Quick Start Guide 🚀](#quick-start-guide-)
- [Deliverables](#deliverables)
- [Acceptance Criteria](#acceptance-criteria)

---

## Problem Statement

Using Cere Network's Decentralized Data Cluster (DDC) infrastructure requires users to convert CERE tokens into DDC Credits, which are essential for storage, data retrieval, and computations. To top up a DDC account, users must first acquire CERE tokens, often through external services, creating friction in the onboarding process.

This project aims to streamline the experience by enabling users to top up their DDC balance directly via credit card payments (e.g., through Stripe). The architecture should also be designed for future support of direct USDC/USDT transfers.

---

## Objective

Enhance the **Developer Console UI** by integrating an IFRAME that allows users to seamlessly top up their **DDC wallets** with fiat currencies (e.g., USD). This feature will:

- Streamline the onboarding experience for developers
- Minimize dependence on third-party services for obtaining CERE tokens

---

## Key Concepts/Keywords 📝

- **DDC (Decentralized Data Cluster):** Blockchain-based storage solution.
- **Fiat:** Government-issued currency like USD.
- **USDC/USDT:** Stablecoins pegged to USD.

---

## Overview

This document details the technical specification for topping up a DDC account via credit/debit card using the Cluster’s Developer Console.

---

## System Architecture

The top-up flow involves several components working together to securely process payments and update user balances.

![image](https://github.com/user-attachments/assets/123965b4-ba52-42e3-b110-07889f49fffc)
x![image](https://github.com/user-attachments/assets/93b06c70-ff19-43d3-a0fb-c3e8ea8909e9)

---

## User Flow

### Step-by-Step Sequence

- Users enter card details on the Cluster's Dev Console (Frontend) via IFRAME.
- The frontend sends card details to the backend (Customer Payment Service, CPS).
- The backend delegates secure card handling to the payment provider (e.g., Stripe or Razorpay).
- The backend creates a **SetupIntent** (to save the card) and/or a **PaymentIntent** (to process payment).
- The payment provider manages sensitive card data and returns confirmation to the frontend.
- The payment provider notifies the backend of successful setup or payment.
- The backend stores a safe reference (e.g., payment method ID), not the actual card number.
- For automated top-ups, the Notification Service instructs the backend to charge the saved card.
- The backend uses the reference to process the payment via the provider.
- The payment provider completes the transaction and updates the backend with the result.

---

## Sequence Diagram

![image](https://github.com/user-attachments/assets/a001cdd7-1740-470b-8faf-8ac3b0c93636)


---

## User Interface

The top-up UI allows users to:

- Enter the amount
- Input card details
- Review fees before submitting

![image](https://github.com/user-attachments/assets/de81ee7b-280a-4b27-a87b-0617634be9ab)
![image](https://github.com/user-attachments/assets/7116fd76-6468-433c-9c06-55342373dc0e)
![image](https://github.com/user-attachments/assets/4ba1c4b6-998b-40ed-b9ae-bb877aa1e124)

---

## Data Flow

| Step | Source              | Destination               | Data/Action                                 |
|------|---------------------|---------------------------|---------------------------------------------|
| 1    | Customer            | Top Up Window             | Initiate top-up, enter card details         |
| 2    | Top Up Window       | Customer Payment Service  | Process payment with card info              |
| 3    | Customer Payment Service | Payment Gateway      | Send card info, amount                      |
| 4    | Payment Gateway     | Customer Payment Service  | Payment success (OrderId, Card Token)       |
| 5    | Customer Payment Service | Top Up Window        | Send OrderId and Card Token                 |
| 6    | Top Up Window       | Customer                  | Notify user of success                      |
| 7    | Customer Payment Service | (Internal)           | Track OrderId status, store card token      |

---

## Security & Compliance

- **Tokenization:** Card tokens are used for recurring or auto top-ups, avoiding storage of raw card data.
- **PCI DSS Compliance:** All card data is handled via secure, compliant payment components.

---

## Quick Start Guide 🚀

**1. Setting Up Your Environment 🛠️**

- **Clone the Repository**
  ```bash
  git clone https://github.com/Cerebellum-Network/cluster-apps.git
  ```
- **Payment Provider Test Accounts**
  - Sign up for a Stripe test account and obtain test API keys.
- **Configure the Project**
  - Update configuration files (e.g., `.env`) with your test API keys.

**2. Running the Base Implementation ⚙️**

- **Install Dependencies**
  ```bash
  npm install
  # or
  yarn install
  ```
- **Start the Application**
  ```bash
  npm start
  # or
  yarn start
  ```
- **Test the Base Functionality**
  - Access the Developer Console at `http://localhost:3000` and attempt a test top-up.

---

## Deliverables

1. **Technical Documentation**
   - System architecture, data flow, security, and integration steps.
   - Diagrams and detailed API/interface specifications.
   - Step-by-step Quick Start Guide.

2. **Developer Console UI Integration**
   - IFRAME-based UI component for seamless DDC wallet top-ups.
   - Includes amount entry, card details, fee breakdown, and confirmation screens.

3. **Backend Payment Service Implementation**
   - Secure payment initiation, tokenization, and provider communication.
   - Handles one-time and recurring payments using saved methods.

4. **Payment Provider Integration**
   - Integration with Stripe (or equivalent) for card processing.
   - Webhook handling for asynchronous payment updates.

5. **Automated Top-Up Support**
   - Logic to trigger automated top-ups using saved payment methods.

6. **Security & Compliance Measures**
   - Tokenization and adherence to PCI DSS and other standards.
   - Documentation of compliance procedures.

7. **Deployment & Operations Guide**
   - Instructions for deploying in test and production environments.

---

## Acceptance Criteria

- **User Successfully Tops Up DDC Wallet via Credit/Debit Card**
  - User logs in, enters amount and card details, payment is processed, DDC balance increases, confirmation displayed, transaction recorded.

- **Payment Security and Compliance**
  - Card fields rendered via secure, PCI DSS-compliant IFRAME; raw card data never stored.

- **Handling Failed or Declined Payments**
  - Clear error messages for failed payments, no funds deducted, failed transactions logged.

- **Payment Method Management**
  - Users can add, remove, or update payment methods securely; changes are immediate and confirmed.

---
