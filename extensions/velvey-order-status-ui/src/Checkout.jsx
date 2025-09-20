import React, { useEffect, useRef } from 'react';
import {
  reactExtension,
  Text,
  useApi,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';

// Thank You Page Extension
export const thankYouBlock = reactExtension(
  'purchase.thank-you.block.render',
  () => <ThankYouExtension />,
);

// Order Status Page Extension
export const orderDetailsBlock = reactExtension(
  'customer-account.order-status.block.render',
  () => <OrderStatusExtension />,
);

// ---- Shared helpers ----
async function getFormattedOrderPayloadFromWorker(numericOrderId) {
  const workerUrl = 'https://velvey-shopify-proxy.dawn-boat-0e1b.workers.dev';

  const resp = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: numericOrderId }),
  });

  if (!resp.ok) {
    // try to parse JSON error, fallback to text
    let err;
    try { err = await resp.json(); } catch { err = await resp.text(); }
    throw new Error(`Worker error (${resp.status}): ${JSON.stringify(err)}`);
  }

  const data = await resp.json();
  // Expecting: { order_id, line_items: [...] }
  return data;
}

async function sendPayloadToAzure(payload) {
  const backendUrl = 'https://yourgreetings-server.azurewebsites.net/api/accessCodes';

  console.log('PAYLOAD RIGHT HERE:', payload);

  // Some Azure setups validate Origin. If your Azure expects the store origin,
  // you can set it here. Otherwise omit it.
  const resp = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 'Origin': 'https://velveys.com', // uncomment if your server requires it
    },
    body: JSON.stringify(payload),
  });

  // Azure may return 204 No Content — handle both JSON and empty body
  const text = await resp.text();
  // const parsed = text ? JSON.parse(text) : { success: resp.ok, message: 'No content' };

  if (!resp.ok) {
    throw new Error(`Azure error (${resp.status}): ${JSON.stringify(parsed)}`);
  }

  return text;
}

function ThankYouExtension() {
  const hasRun = useRef(false);
  const { orderConfirmation } = useApi();
  const confirmation = useSubscription(orderConfirmation);
  const orderId = confirmation?.order?.id; // GID, e.g. gid://shopify/Order/1234567890

  useEffect(() => {
    if (hasRun.current) return;
    if (!orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        console.log('[ThankYou] numericId:', numericId);

        // 1) Get formatted payload from Worker
        const formattedPayload = await getFormattedOrderPayloadFromWorker(numericId);
        console.log('[ThankYou] Worker formatted payload:', formattedPayload);

        // 2) Send payload to Azure and log the response
        const azureResp = await sendPayloadToAzure(formattedPayload);
        console.log('[ThankYou] Azure response:', azureResp);
      } catch (err) {
        console.error('[ThankYou] Error in post-completion flow:', err);
      }
    })();
  }, [orderId]);

  return <Text>Order ID: {orderId ?? '...'}</Text>;
}

function OrderStatusExtension() {
  const hasRun = useRef(false);
  const { order } = useApi();
  const orderData = useSubscription(order);
  const orderId = orderData?.id; // GID

  useEffect(() => {
    if (hasRun.current) return;
    if (!orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        console.log('[OrderStatus] numericId:', numericId);
        console.log('[OrderStatus] orderData:', orderData);

        // 1) Get formatted payload from Worker
        const formattedPayload = await getFormattedOrderPayloadFromWorker(numericId);
        console.log('[OrderStatus] Worker formatted payload:', formattedPayload);

        // 2) Send payload to Azure and log the response
        const azureResp = await sendPayloadToAzure(formattedPayload);
        console.log('[OrderStatus] Azure response:', azureResp);
      } catch (err) {
        console.error('[OrderStatus] Error in post-status flow:', err);
      }
    })();
  }, [orderId, orderData]);

  return <Text>Order ID: {orderId ?? 'Loading...'}</Text>;
}
