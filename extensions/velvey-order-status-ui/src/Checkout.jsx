import React, { useEffect, useRef, useState } from 'react';
import {
  reactExtension,
  Heading,
  Text,
  TextBlock,
  Grid,
  useApi,
  Icon,
  useSubscription,
  BlockStack,
  View,
  Button,
  Image,
  Link,
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
    let err;
    try { err = await resp.json(); } catch { err = await resp.text(); }
    throw new Error(`Worker error (${resp.status}): ${JSON.stringify(err)}`);
  }

  const data = await resp.json();
  return data;
}

async function sendPayloadToAzure(payload) {
  const backendUrl = 'https://yourgreetings-server.azurewebsites.net/api/accessCodes';

  console.log('PAYLOAD RIGHT HERE:', payload);

  const resp = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();
  let accessCode = null;

  if (text.length > 0) {
    try {
      const parsed = JSON.parse(text);
      accessCode = parsed.accessCode || parsed.access_code || text;
    } catch {
      accessCode = text;
    }
  }

  if (!resp.ok) {
    const parsed = text ? JSON.parse(text) : { success: resp.ok, message: 'No content' };
    throw new Error(`Azure error (${resp.status}): ${JSON.stringify(parsed)}`);
  }

  return accessCode;
}

function ThankYouExtension() {
  const hasRun = useRef(false);
  const { orderConfirmation } = useApi();
  const confirmation = useSubscription(orderConfirmation);
  const orderId = confirmation?.order?.id;
  const [accessCode, setAccessCode] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const formattedPayload = await getFormattedOrderPayloadFromWorker(numericId);
        const azureResp = await sendPayloadToAzure(formattedPayload);
        if (azureResp) {
          setAccessCode(azureResp);
        }
      } catch (err) {
        console.error('[ThankYou] Error in post-completion flow:', err);
      }
    })();
  }, [orderId]);

  // Use <View inlineAlignment="center"> to center its children horizontally.
  // Use <BlockStack inlineAlignment="center"> to center items within the stack.
  return (
    <View inlineAlignment="center">
      <BlockStack inlineAlignment="center" spacing="base">
        <Text textAlignment="center" appearance="subdued">
          Order ID: {orderId ? orderId.split('/').pop() : '...'}
        </Text>
        {accessCode && (
          <Button
            to={`https://setup.velvey.com/typeOfMessage/?AccessCode=${encodeURIComponent(accessCode)}`}
          >
            View Your Message
          </Button>
        )}
      </BlockStack>
    </View>
  );
}

function OrderStatusExtension() {
  const hasRun = useRef(false);
  const { order } = useApi();
  const orderData = useSubscription(order);
  const orderId = orderData?.id;
  const [accessCode, setAccessCode] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const formattedPayload = await getFormattedOrderPayloadFromWorker(numericId);
        const azureResp = await sendPayloadToAzure(formattedPayload);
        if (azureResp) {
          setAccessCode(azureResp);
        }
      } catch (err) {
        console.error('[OrderStatus] Error in post-status flow:', err);
      }
    })();
  }, [orderId, orderData]);

  // This structure is already well-centered.
  // The outer <View> centers the <Grid>.
  // The inner <View>s center their respective content blocks.
  return (
    <Grid columns={['fill', 'auto', 'fill']} minBlockSize="100%">
      {/* Column 1: Left spacer. This View is intentionally empty. */}
      <View />

      {/* Column 2: Your centered content. */}
      <BlockStack
        inlineAlignment="stretch"
        background="surface"
        border="base"
        cornerRadius="base"
        padding="loose"
        spacing="loose"
        maxInlineSize="540px" // Prevents the block from getting too wide
      >
        {accessCode ? (
          <>
            {/* ---- Top Section: Heading, Image, Button ---- */}
            <BlockStack spacing="base" inlineAlignment="center">
              <Heading level={3} textAlignment="center">
                NOW IT’S TIME TO INCLUDE AN ANONYMOUS MESSAGE. JUST PRESS THE BUTTON BELOW TO GET STARTED
              </Heading>

              <Image
                source="https://cdn.shopify.com/s/files/1/0447/4047/7095/files/Message_841279b9-569d-4d2f-89a9-766d84deb4fe.webp?v=1758400013"
                alt="Order Status UI Image"
                maxInlineSize="88px"
              />
              <Button
                kind="primary"
                to={`https://setup.velvey.com/typeOfMessage/?AccessCode=${encodeURIComponent(accessCode)}`}
              >
                ADD YOUR ANONYMOUS MESSAGE&nbsp;<Icon source="arrowRight" />
              </Button>
            </BlockStack>

            {/* ---- Bottom Section: Informational Text ---- */}
            <TextBlock appearance="info" textAlignment="center">
              Can’t commit to your message quite yet? The order confirmation email that was just sent to you also
              includes a message creation link. Just be sure to complete your anonymous message BEFORE your recipient
              gets their GHOST GIVE. Otherwise, they'll get a boring auto-generated message from us. Booooo!
            </TextBlock>
          </>
        ) : (
          // Optional: Show a loading state
          <Text appearance="subdued">Loading message options...</Text>
        )}
      </BlockStack>

      {/* Column 3: Right spacer. This View is also empty. */}
      <View />
    </Grid>
  );
}
