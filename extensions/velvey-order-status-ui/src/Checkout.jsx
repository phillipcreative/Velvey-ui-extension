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
  InlineStack,
  View,
  Button,
  Image,
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

/** Dev Azure Shopify API base (fetchOrder / fetchAndProcess). */
const YOURGREETINGS_SHOPIFY_API_BASE =
  'https://yourgreetings-server-dev.azurewebsites.net/api/shopify';

/**
 * POST { orderId, shopDomain } to the backend Shopify helper endpoint and log the result.
 * @param {'fetchOrder' | 'fetchAndProcess'} endpointName
 * @param {string} numericOrderId - digits from the GID tail
 * @param {string} shopDomain - e.g. velveys.myshopify.com
 */
async function postShopifyBackend(endpointName, numericOrderId, shopDomain) {
  const url = `${YOURGREETINGS_SHOPIFY_API_BASE}/${endpointName}`;
  const body = {
    orderId: Number(numericOrderId),
    shopDomain,
  };

  console.log('[Shopify API] POST', url);
  console.log('[Shopify API] body', body);

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { _raw: text };
  }

  console.log('[Shopify API] status', resp.status);
  console.log('[Shopify API] response (parsed)', parsed);

  if (!resp.ok) {
    throw new Error(
      `[Shopify API] ${resp.status}: ${text || resp.statusText}`,
    );
  }

  return parsed;
}

/**
 * Reads access code from API envelope { success, data: { accessCode }, message, errors }.
 * @returns {{ accessCode: string } | { errorMessage: string }}
 */
function parseAccessCodeResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { errorMessage: 'Unexpected response from server.' };
  }

  const success = parsed.success === true;
  const rawCode = parsed.data?.accessCode;
  const code =
    rawCode !== undefined && rawCode !== null ? String(rawCode).trim() : '';

  if (success && code) {
    return { accessCode: code };
  }

  const errParts = [];
  if (parsed.message) {
    errParts.push(String(parsed.message));
  }
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    for (const entry of parsed.errors) {
      errParts.push(typeof entry === 'string' ? entry : JSON.stringify(entry));
    }
  }
  if (errParts.length > 0) {
    return { errorMessage: errParts.join(' ') };
  }
  if (!success) {
    return {
      errorMessage:
        'We could not issue a confirmation code. Please try again or contact support.',
    };
  }
  return {
    errorMessage:
      'No confirmation code was returned. Please contact support.',
  };
}

/** Use `fetchOrder` for a minimal ping; `fetchAndProcess` for full payload. */
const SHOPIFY_API_ENDPOINT = 'fetchAndProcess';

const LOADING_GIF_URL =
  'https://cdn.shopify.com/s/files/1/0447/4047/7095/files/800.gif?v=1774277017';

// -------------------- UI --------------------

/** GIF + “Hold tight!” row shown only while the access-code request is in flight. */
function LoadingIndicatorRow() {
  return (
    <InlineStack spacing="base" blockAlignment="center" inlineAlignment="start">
      <Text emphasis="bold" accessibilityRole="strong">
        HOLD TIGHT! GRABBING YOUR CONFIRMATION CODE
      </Text>
      <View
        maxInlineSize={30}
        maxBlockSize={30}
        overflow="hidden"
        blockAlignment="center"
        inlineAlignment="center"
      >
        <Image
          source={LOADING_GIF_URL}
          alt=""
          accessibilityDescription=""
          accessibilityRole="decorative"
          fit="contain"
        />
      </View>
    </InlineStack>
  );
}

/**
 * Success CTA block (heading, image, button, disclaimer).
 * @param {{ accessCode: string }} props
 */
function AccessCodeSuccessBlock({ accessCode }) {
  return (
    <>
      <BlockStack spacing="base" inlineAlignment="center">
        <Heading level={3} textAlignment="center">
          NOW IT&apos;S TIME TO INCLUDE AN ANONYMOUS MESSAGE. JUST PRESS THE
          BUTTON BELOW TO GET STARTED
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
        email that was just sent to you also includes a message creation link.
        Just be sure to complete your anonymous message BEFORE your recipient
        gets their VELVEY. Otherwise, they&apos;ll get a boring auto-generated
        message from us.
      </TextBlock>
    </>
  );
}

/**
 * Thank-you / order-status card: loading copy, success CTA, or error.
 * @param {{ accessCode: string | null, errorMessage: string | null }} props
 */
function ConfirmationCodeCard({ accessCode, errorMessage }) {
  if (errorMessage) {
    return <Text appearance="critical">{errorMessage}</Text>;
  }

  if (accessCode) {
    return <AccessCodeSuccessBlock accessCode={accessCode} />;
  }

  return <LoadingIndicatorRow />;
}

function OrderMessageShell({ accessCode, errorMessage }) {
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
        <ConfirmationCodeCard
          accessCode={accessCode}
          errorMessage={errorMessage}
        />
      </BlockStack>

      <View />
    </Grid>
  );
}

// -------------------- EXTENSIONS --------------------

function ThankYouExtension() {
  const hasRun = useRef(false);

  const { orderConfirmation, shop } = useApi();
  const confirmation = useSubscription(orderConfirmation);

  const orderId = confirmation?.order?.id;
  const shopDomain = shop?.myshopifyDomain;

  const [accessCode, setAccessCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId || !shopDomain) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const parsed = await postShopifyBackend(
          SHOPIFY_API_ENDPOINT,
          numericId,
          shopDomain,
        );
        const result = parseAccessCodeResponse(parsed);
        if ('accessCode' in result) {
          setAccessCode(result.accessCode);
        } else {
          setErrorMessage(result.errorMessage);
        }
      } catch (err) {
        console.error('[ThankYou] Shopify API error:', err);
        setErrorMessage(String(err?.message || err));
      }
    })();
  }, [orderId, shopDomain]);

  return (
    <OrderMessageShell
      accessCode={accessCode}
      errorMessage={errorMessage}
    />
  );
}

function OrderStatusExtension() {
  const hasRun = useRef(false);

  const { order, shop } = useApi();
  const orderData = useSubscription(order);

  const orderId = orderData?.id;
  const shopDomain = shop?.myshopifyDomain;

  const [accessCode, setAccessCode] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (hasRun.current || !orderId || !shopDomain) return;

    const numericId = orderId.split('/').pop();
    hasRun.current = true;

    (async () => {
      try {
        const parsed = await postShopifyBackend(
          SHOPIFY_API_ENDPOINT,
          numericId,
          shopDomain,
        );
        const result = parseAccessCodeResponse(parsed);
        if ('accessCode' in result) {
          setAccessCode(result.accessCode);
        } else {
          setErrorMessage(result.errorMessage);
        }
      } catch (err) {
        console.error('[OrderStatus] Shopify API error:', err);
        setErrorMessage(String(err?.message || err));
      }
    })();
  }, [orderId, shopDomain]);

  return (
    <OrderMessageShell
      accessCode={accessCode}
      errorMessage={errorMessage}
    />
  );
}
