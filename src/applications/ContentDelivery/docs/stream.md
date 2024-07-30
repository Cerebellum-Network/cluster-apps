## Get Started with Media Streaming
The Decentralized Data Cloud (DDC) offers robust solutions for video streaming, catering to various use cases and integration needs. This comprehensive guide covers two primary methods for streaming video from DDC:
1. Direct streaming: Ideal for public content or simple implementations, allowing playback via browser, HTML5 video tag, or
Media SDK.
2. NFT-gated streaming: Perfect for exclusive or monetized content, restricting access based on NFT ownership.

Before diving into the implementation details, ensure you have:
- **Basic familiarity with JavaScript and React (for SDK implementations)**
- **Node.js and npm installed on your machine**

## 1. Direct Video Streaming
This method allows you to stream video content directly from DDC without any access restrictions.

## Upload Video to DDC
Before streaming, you need to upload your video content to DDC. This process involves creating a configuration file and using the DDC CLI tool.

1. __Create a DDC bucket__: If you haven't already, complete the onboarding process in the Cere Developer Console and create a bucket. Buckets are containers for your content in DDC.
2. Prepare `ddc.config.json`: This configuration file is crucial for interacting with DDC. It contains your credentials and specifies which network and bucket you're using.

```json
{
  "signer": "./your-wallet-address.json",
  "clusterId": "0x0059f5ada35eee46802d80750d5ca4a490640511",
  "bucketId": "your-bucket-id",
  "network": "mainnet",
  "logLevel": "info"
}
```
> Replace `signer` with the path to your wallet key file, which you can export from the [Cere wallet](https://wallet.cere.io). The `bucketId` should be the ID of the bucket you created in Developer Console.

3. Upload your video:Use the DDC CLI tool to upload your video file. Open a terminal, navigate to the directory containing your ddc.config.json file and your video, then run:

```bash
npx @cere-ddc-sdk/cli@latest --config=ddc.config.json upload "your-video-file.mp4"
```

After a successful upload, you'll receive metadata including:
- Network: The DDC network you're using (testnet or mainnet) 
- Bucket ID: The ID of your DDC bucket 
- Path: The path of your file within the bucket 
- CID: The Content Identifier, a unique hash representing your file

Save this information, as you'll need it to construct your streaming URL.

## Construct Streaming URL
With your video uploaded, you can now construct the URL for streaming. The URL structure differs slightly between testnet and mainnet:

__Mainnet:__ `https://cdn.dragon.cere.network/<YOUR_BUCKET_ID>/<YOUR_CID>`

Replace

`<YOUR_BUCKET_ID>`

with your bucket ID and

`<YOUR_CID>`

with the CID you received after uploading.


For example, if your bucket ID is "101061n" and your CID is `"baebb4ibg7dutnehizvyhx2pv65eozejvduc277gf5fhuykdwlgxwza32sq"`, your streaming URL would be:

```
https://cdn.dragon.cere.network/101061n/baebb4ibg7dutnehizvyhx2pv65eozejvduc277gf5fhuykdwlgxwza32sq
```


## Implement Streaming

Now that you have your streaming URL, you can implement video playback using one of three methods:
1. Direct Browser Streaming: The simplest method - just enter the streaming URL in a web browser. This is useful for quick testing or if you're embedding the video in an iframe.
2. HTML5 Video Tag:For more control over playback within a web page, use the HTML5 `<video>` tag:

```js
<video src="<https://cdn.dragon.cere.network/><YOUR_BUCKET_ID>/<YOUR_CID>" controls></video>
```

The controls attribute adds default video controls (play, pause, volume, etc.). You can further customize the video player with additional attributes or JavaScript.

3. Media SDK: For the most flexibility and features, especially within a React application, use the Cere Media SDK:
   - Install the SDK: `npm install @cere/media-sdk-client @cere/media-sdk-react --save`
   - Implement in React:

```tsx
import { VideoPlayer } from '@cere/media-sdk-react'; import React from 'react';

export const VideoComponent = () => {
  const videoUrl = "<https://cdn.dragon.cere.network/<YOUR_BUCKET_ID>/<YOUR_CID>";

  return <VideoPlayer src={videoUrl} />;
};
```
The controls attribute adds default video controls (play, pause, volume, etc.). You can further customize the video player with additional attributes or JavaScript.

## 2. NFT-Gated Video Streaming
NFT-gated streaming allows you to restrict video access to NFT holders, enabling new monetization models for your content.

## Mint NFT and Upload Content
1. Access Freeport Creator Suite:Open the Freeport Creator Suite, which provides tools for minting NFTs and managing content.
2. Select NFT Minter: In the Creator Suite, navigate to the NFT minter section.
3. Prepare Metamask: Ensure you have the Metamask browser extension installed and configured. You'll need this to interact with the blockchain.
4. Mint Your NFT:
   - Go to: My Account → Mint NFT
   - First, create a Collection if you haven't already. This groups related NFTs.
   - Enter your NFT information, including name, description, and other metadata.
   - Attach your video file to the NFT. This associates the content with the token.
5. Complete the Minting Process: Follow the prompts to finalize the NFT creation. This process will upload your content to DDC and create the corresponding NFT on the blockchain.

## Integrate Media SDK
To implement NFT-gated streaming in your application:

1. Install the Media SDK

`npm install @cere/media-sdk-client @cere/media-sdk-react @cere/embed-wallet --save`

2. Set up the MediaSdkClientProvider
   Wrap your React application with the provider to enable SDK functionality:
```tsx
import { MediaSdkClientProvider } from '@cere/media-sdk-react';
import { EmbedWallet } from '@cere/embed-wallet'; 

const App = () => { 
  const cereWallet = new EmbedWallet();

  /**
   * Initialize and connect Cere Wallet using this documentation:
   * https://www.npmjs.com/package/@cere/embed-wallet
   */

  return (
    <MediaSdkClientProvider signer={cereWallet.getSigner()}>
      {/* Your app components */} 
    </MediaSdkClientProvider> 
  );
};
```
__Implement the Encrypted Video Player__
Use the `EncryptedVideoPlayer` component to render your NFT-gated video:

```tsx
import { EncryptedVideoPlayer } from '@cere/media-sdk-react';

export const NFTVideoComponent = () => { 
  const collectionId = '...'; // Your collection ID from Freeport Creator Suite
  const nftId = '...'; // Your NFT ID from Freeport Creator Suite
  const assetUrl = '...'; // Your asset URL from Freeport Creator Suite

  return (
    <EncryptedVideoPlayer
      src={assetUrl}
      collectionAddress={collectionId}
      nftId={nftId}
    />
  );
};
```

The `EncryptedVideoPlayer` will automatically check for NFT ownership before allowing playback.

__Meet the Cere Community!__
For further assistance or to connect with other developers, join the Cere Network community on [Telegram](https://t.me/thisiscere/) or [Discord](https://discord.com/invite/8RBXaQ6nT5)

Remember, DDC is continually evolving, so always refer to the official documentation for the most up-to-date information and best practices.
