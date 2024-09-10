- [Setting Up Your Environment](#setting-up-your-environment)
- [Configuring Your Environment](#configuring-your-environment)
- [Uploading Content to DDC](#uploading-content-to-ddc)
  - [Option 1: Use the File Uploader](#option-1-use-the-file-uploader)
  - [Option 2: Use the DDC CLI to Upload](#option-2-use-the-ddc-cli-to-upload)
- [Accessing Your Uploaded Content](#accessing-your-uploaded-content)

## Setting Up Your Environment
1) Install Node.js and npm (if not already installed):
    - Download Node.js
    - Follow the installation steps provided on the Node.js website. 
2) Access Your Cere Wallet: 
   - Visit the wallet at [wallet.cere.io](https://wallet.cere.io). 
   - Log in using your email OTP.
   - You'll see your EVM and Cere wallets, along with your $CERE token balance.
3) Download Wallet Backup: 
   - Go to Settings in your [Cere wallet](https://wallet.cere.io).
   - Export your Cere account as an Encrypted JSON file.
   - This file is crucial for accessing your bucket, so keep it secure.

## Configuring Your Environment

1) Create Configuration File:
   - Create a new file named `ddc.config.json`.
   - Add the following content, replacing placeholders with your information:
    ```json
    {
      "path": "./your-wallet-address.json",
      "clusterId": "0x0059f5ada35eee46802d80750d5ca4a490640511",
      "bucketId": "your-bucket-id",
      "network": "mainnet",
      "logLevel": "info"
    }
    ```
   - The path should point to your wallet backup file.
   - Find your `bucketId` in the developer console.


## Uploading Content to DDC

You have two options for uploading content:

## Option 1: Use the File Uploader

1) In the Developer Console, navigate to the file upload section.
2) Follow the on-screen instructions to upload your file directly through the interface.

## Option 2: Use the DDC CLI to Upload

1) Prepare Your File:
   - Ensure your file is in a supported format.
   - Place the file in the same directory as your `ddc.config.js`.
2) Use the DDC CLI to Upload:
   - Open a command prompt or terminal.
   - Navigate to the directory containing your config file and video.
   - Run the following command:

```bash
npx @cere-ddc-sdk/cli@latest --config=dcc.config.js upload "your-file-name"
```
3) Verify Upload:
   - After successful upload, you'll receive metadata including:
     - Network (testnet or mainnet)
     - Bucket ID
     - File path
     - Content Identifier (CID)
   - Save this information for future reference.


## Accessing Your Uploaded Content

To access your uploaded content, construct the URL using the following format:
- `Mainnet: https://cdn.dragon.cere.network/<YOUR_BUCKET_ID>/<YOUR_CID>`

Replace `<YOUR_BUCKET_ID>` and `<YOUR_CID>` with the values provided after upload.
