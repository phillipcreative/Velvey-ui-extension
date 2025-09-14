import React, { useEffect } from 'react';
import {
  reactExtension,
  Text,
  useApi,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <ThankYouExtension />,
);

function ThankYouExtension() {
  const { orderConfirmation } = useApi();
  const confirmation = useSubscription(orderConfirmation);
  const orderId = confirmation?.order?.id; // This is the full GID string

  useEffect(() => {
    // Make sure we have an orderId before processing it.
    if (orderId) {
      // --- FIX IS HERE ---
      // 1. Extract the numeric ID from the full GID string.
      // e.g., "gid://shopify/OrderIdentity/6675439255728" becomes "6675439255728"
      const numericId = orderId.split('/').pop();
      console.log('numericId', numericId);
      // 2. Send only the numeric ID to the worker.
      sendOrderIdToCloudflareWorker(numericId);
    }
  }, [orderId]); // The dependency array ensures this effect runs when orderId changes.

  // This function now expects the numeric ID
  async function sendOrderIdToCloudflareWorker(numericOrderId) {
    const workerUrl = 'https://velvey-shopify-proxy.dawn-boat-0e1b.workers.dev';

    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: numericOrderId, // Sending the correct numeric ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Worker error:', errorData);
        return;
      }

      const data = await response.json();
      console.log('Successfully sent order ID. Worker response:', data);

    } catch (error) {
      console.error('Error sending data to worker:', error);
    }
  }

  return (
    <Text>Order ID: {orderId ?? '...'}</Text>
  );
}
