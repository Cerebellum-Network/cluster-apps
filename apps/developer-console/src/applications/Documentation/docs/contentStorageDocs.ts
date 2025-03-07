export interface DocItem {
  title: string;
  content: string;
}

export const contentStorageDocs: DocItem[] = [
  {
    title: 'Getting Started with Content Storage',
    content: `
# Content Storage

Cere Network's Content Storage service provides a decentralized solution for storing your data securely on the blockchain.

## Key Features

- **Decentralized Storage**: Your data is stored across multiple nodes in the network, ensuring high availability and redundancy.
- **Secure**: All data is encrypted and can only be accessed by authorized users.
- **Scalable**: Store as much data as you need, with the ability to scale up or down as required.
- **Cost-effective**: Pay only for the storage you use, with no minimum commitments.

## Getting Started

1. Create a bucket to store your data
2. Upload your files to the bucket
3. Access your files using the provided URLs
    `,
  },
  {
    title: 'Creating and Managing Buckets',
    content: `
# Creating and Managing Buckets

Buckets are containers for your data in the Cere Network Content Storage service.

## Creating a Bucket

1. Navigate to the Content Storage section
2. Click on "Create Bucket"
3. Enter a name for your bucket
4. Select the desired storage options
5. Click "Create"

## Managing Buckets

- **View Bucket Details**: Click on a bucket to view its details, including storage usage and access settings.
- **Delete Bucket**: Select a bucket and click "Delete" to remove it. Note that this will delete all files in the bucket.
- **Update Access Settings**: Modify who can access the bucket and its contents.

## Best Practices

- Use meaningful names for your buckets to easily identify their purpose
- Regularly review your buckets to ensure you're not storing unnecessary data
- Set appropriate access controls to protect sensitive data
    `,
  },
  {
    title: 'Uploading and Managing Files',
    content: `
# Uploading and Managing Files

Learn how to upload, download, and manage files in your Cere Network Content Storage buckets.

## Uploading Files

1. Navigate to the desired bucket
2. Click "Upload"
3. Select the files you want to upload
4. Click "Upload" to start the upload process

## Managing Files

- **Download**: Click on a file and select "Download" to retrieve it
- **Delete**: Select a file and click "Delete" to remove it from the bucket
- **View Details**: Click on a file to view its details, including size, upload date, and URL

## Supported File Types

Cere Network Content Storage supports all file types, including:

- Images (JPEG, PNG, GIF, etc.)
- Videos (MP4, AVI, MOV, etc.)
- Documents (PDF, DOCX, XLSX, etc.)
- Audio files (MP3, WAV, etc.)
- And many more!

## File Size Limits

- Maximum file size: 5GB per file
- No limit on the number of files per bucket (subject to your storage quota)
    `,
  },
]; 