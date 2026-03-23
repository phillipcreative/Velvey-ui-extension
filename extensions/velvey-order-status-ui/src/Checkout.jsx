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

// -------------------- HELPERS --------------------

// Send order ID to Cloudflare worker and get formatted payload
async function getFormattedOrderPayloadFromWorker(numericOrderId) {
  const workerUrl = 'https://velvey-shopify-proxy.dawn-boat-0e1b.workers.dev';

  const resp = await fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: numericOrderId }),
  });

  if (!resp.ok) {
    let err;
    try {
      err = await resp.json();
    } catch {
      err = await resp.text();
    }
    throw new Error(`Worker error (${resp.status}): ${JSON.stringify(err)}`);
  }

  return await resp.json();
}

// Send payload to Azure backend
async function sendPayloadToAzure(payload) {
  const backendUrl =
    'https://yourgreetings-server-dev.azurewebsites.net/api/accessCodes';

  console.log('[Azure] POST URL:', backendUrl);
  console.log('[Azure] Request payload:', payload);

  const resp = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await resp.text();

  console.log('[Azure] status:', resp.status);
  console.log('[Azure] response text:', text);

  // Handle non-2xx safely
  if (!resp.ok) {
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : { message: 'No content' };
    } catch {
      parsed = { message: text || 'No content' };
    }
    throw new Error(`Azure error (${resp.status}): ${JSON.stringify(parsed)}`);
  }

  // Parse success response (could be JSON or plain string)
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);

    // common possibilities
    // - { accessCode: "..." }
    // - { access_code: "..." }
    // - { data: { accessCode: "..." } }
    // - { data: { access_code: "..." } }
    // - or the API might just return the code as string
    return (
      parsed?.accessCode ||
      parsed?.access_code ||
      parsed?.data?.accessCode ||
      parsed?.data?.access_code ||
      text
    );
  } catch {
    return text;
  }
}

// -------------------- EXTENSIONS --------------------

function ThankYouExtension() {
  const hasRun = useRef(false);

  const { orderConfirmation, shop } = useApi();
  const confirmation = useSubscription(orderConfirmation);

  const orderId = confirmation?.order?.id;

  const [accessCode, setAccessCode] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const formattedPayload = await getFormattedOrderPayloadFromWorker(
          numericId,
        );

        // ✅ Add shopDomain to payload
        const azureResp = await sendPayloadToAzure({
          ...formattedPayload
        });

        if (azureResp) setAccessCode(azureResp);
      } catch (err) {
        console.error('[ThankYou] Error in post-completion flow:', err);
      }
    })();
  }, [orderId]);

  return (
    <Grid columns={['fill', 'auto', 'fill']} minBlockSize="100%">
      <View />

      <BlockStack
        inlineAlignment="stretch"
        background="surface"
        border="base"
        cornerRadius="base"
        padding="loose"
        spacing="loose"
        maxInlineSize="540px"
      >
        {accessCode ? (
          <>
            <BlockStack spacing="base" inlineAlignment="center">
              <Heading level={3} textAlignment="center">
                NOW IT&apos;S TIME TO INCLUDE AN ANONYMOUS MESSAGE. JUST PRESS
                THE BUTTON BELOW TO GET STARTED
              </Heading>

              <Image
                source="https://cdn.shopify.com/s/files/1/0447/4047/7095/files/Message_841279b9-569d-4d2f-89a9-766d84deb4fe.webp?v=1758400013"
                alt="Order Status UI Image"
                maxInlineSize="88px"
              />

              <Button
                kind="primary"
                to={`https://setup.velvey.com/typeOfMessage/?AccessCode=${encodeURIComponent(
                  accessCode,
                )}`}
              >
                ADD YOUR MESSAGE&nbsp;
                <Icon source="arrowRight" />
              </Button>
            </BlockStack>

            <TextBlock appearance="info" textAlignment="center">
              Can&apos;t commit to your message quite yet? The order confirmation
              email that was just sent to you also includes a message creation
              link. Just be sure to complete your anonymous message BEFORE your
              recipient gets their VELVEY. Otherwise, they&apos;ll get a
              boring auto-generated message from us.
            </TextBlock>
          </>
        ) : (
          <Text appearance="subdued">Loading message options...</Text>
        )}
      </BlockStack>

      <View />
    </Grid>
  );
}

function OrderStatusExtension() {
  const hasRun = useRef(false);

  const { order, shop } = useApi();
  const orderData = useSubscription(order);

  const orderId = orderData?.id;

  const [accessCode, setAccessCode] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const formattedPayload = await getFormattedOrderPayloadFromWorker(
          numericId,
        );

        // ✅ Add shopDomain to payload
        const azureResp = await sendPayloadToAzure({
          ...formattedPayload
        });

        if (azureResp) setAccessCode(azureResp);
      } catch (err) {
        console.error('[OrderStatus] Error in post-status flow:', err);
      }
    })();
  }, [orderId]);

  return (
    <Grid columns={['fill', 'auto', 'fill']} minBlockSize="100%">
      <View />

      <BlockStack
        inlineAlignment="stretch"
        background="surface"
        border="base"
        cornerRadius="base"
        padding="loose"
        spacing="loose"
        maxInlineSize="540px"
      >
        {accessCode ? (
          <>
            <BlockStack spacing="base" inlineAlignment="center">
              <Heading level={3} textAlignment="center">
                NOW IT&apos;S TIME TO INCLUDE AN ANONYMOUS MESSAGE. JUST PRESS
                THE BUTTON BELOW TO GET STARTED
              </Heading>

              <Image
                source="https://cdn.shopify.com/s/files/1/0447/4047/7095/files/Message_841279b9-569d-4d2f-89a9-766d84deb4fe.webp?v=1758400013"
                alt="Order Status UI Image"
                maxInlineSize="88px"
              />

              <Button
                kind="primary"
                to={`https://setup.velvey.com/typeOfMessage/?AccessCode=${encodeURIComponent(
                  accessCode,
                )}`}
              >
                ADD YOUR MESSAGE&nbsp;
                <Icon source="arrowRight" />
              </Button>
            </BlockStack>

            <TextBlock appearance="info" textAlignment="center">
              Can&apos;t commit to your message quite yet? The order confirmation
              email that was just sent to you also includes a message creation
              link. Just be sure to complete your anonymous message BEFORE your
              recipient gets their VELVEY. Otherwise, they&apos;ll get a
              boring auto-generated message from us.
            </TextBlock>
          </>
        ) : (
          <Text appearance="subdued">Loading message options...</Text>
        )}
      </BlockStack>

      <View />
    </Grid>
  );
}
