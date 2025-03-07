import { DocItem } from './contentStorageDocs';

export const contentDeliveryDocs: DocItem[] = [
  {
    title: 'Getting Started with Content Delivery',
    content: `
# Content Delivery

Cere Network's Content Delivery service provides a fast and reliable way to deliver your content to users around the world.

## Key Features

- **Global Network**: Deliver content from edge locations around the world for low-latency access.
- **High Performance**: Optimized for fast content delivery, even for large files.
- **Scalable**: Automatically scales to handle traffic spikes and high demand.
- **Secure**: Content is delivered securely with optional encryption and access controls.

## Getting Started

1. Create a delivery configuration
2. Link it to your content storage bucket
3. Use the provided URLs to access your content through the delivery network
    `,
  },
  {
    title: 'Configuring Content Delivery',
    content: `
# Configuring Content Delivery

Learn how to configure the Content Delivery service for optimal performance.

## Basic Configuration

1. Navigate to the Content Delivery section
2. Click on "Create Configuration"
3. Select the source bucket containing your content
4. Choose delivery options (caching, compression, etc.)
5. Click "Create"

## Advanced Settings

- **Cache Control**: Set how long content should be cached at edge locations
- **Compression**: Enable compression to reduce file sizes and improve delivery speed
- **Custom Domains**: Use your own domain for content delivery
- **Access Controls**: Set who can access your content

## Performance Optimization

- Use appropriate cache settings to balance freshness and performance
- Enable compression for text-based content (HTML, CSS, JavaScript, etc.)
- Optimize images and videos before uploading to reduce file sizes
    `,
  },
  {
    title: 'Monitoring and Analytics',
    content: `
# Monitoring and Analytics

Track the performance and usage of your Content Delivery service.

## Available Metrics

- **Bandwidth Usage**: Track how much data is being delivered
- **Request Count**: Monitor the number of requests for your content
- **Cache Hit Ratio**: See how often content is served from cache vs. origin
- **Error Rate**: Track delivery errors and issues

## Viewing Analytics

1. Navigate to the Content Delivery section
2. Select the "Analytics" tab
3. Choose the time period you want to view
4. Explore the available metrics and charts

## Setting Up Alerts

- Configure alerts for high bandwidth usage
- Set up notifications for error rate spikes
- Create custom alerts based on specific metrics

## Troubleshooting

- Use the error logs to identify and resolve delivery issues
- Check cache settings if content is not updating as expected
- Verify access controls if users are unable to access content
    `,
  },
]; 