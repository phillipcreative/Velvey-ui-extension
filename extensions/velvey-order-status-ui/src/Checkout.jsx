import React, { useEffect, useState, useMemo } from 'react';
import {
  reactExtension,
  BlockStack,
  View,
  Text,
  Button,
  Image,
  Link,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.thank-you.block.render', () => <VenmoBanner />);

const ACCESS_CODE_KEY = 'ghostgiver_access_code';
const CHECKOUT_FOR_KEY = 'ghostgiver_checkoutFor';

function VenmoBanner() {
  const [accessCode, setAccessCode] = useState(null);
  const [hasCheckoutFor, setHasCheckoutFor] = useState(false);

  useEffect(() => {
    try {
      const code = typeof localStorage !== 'undefined'
        ? localStorage.getItem(ACCESS_CODE_KEY)
        : null;
      setAccessCode(code);

      const checkoutForRaw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(CHECKOUT_FOR_KEY)
          : null;

      const checkoutFor = checkoutForRaw ? JSON.parse(checkoutForRaw) : [];
      setHasCheckoutFor(Array.isArray(checkoutFor) && checkoutFor.length > 0);

      // Fetch access codes from API
      fetch("https://yourgreetings-server.azurewebsites.net/api/accessCodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Shopify.checkout),
      })
        .then(response => response.text())
        .then(data => {
          console.log('DATA:', data);
          if (!data) {
            document
              .getElementById("physical-card-case")
              .classList.remove("d-none");
            return;
          }
        })
        .catch(error => {
          console.error('Error fetching access codes:', error);
        });
    } catch {
      setAccessCode(null);
      setHasCheckoutFor(false);
    }
  }, []);

  const { buttonLabel, href, disabled } = useMemo(() => {
    if (accessCode) {
      return {
        buttonLabel: 'Edit Your Message',
        href: `https://setup.ghostgiver.com/typeOfMessage/?AccessCode=${encodeURIComponent(accessCode)}`,
        disabled: false,
      };
    }
    if (hasCheckoutFor) {
      return {
        buttonLabel: 'Add Your Anonymous Message',
        href: 'https://setup.ghostgiver.com/typeOfMessage/',
        disabled: false,
      };
    }
    return {
      buttonLabel: 'Message Not Available',
      href: '',
      disabled: true,
    };
  }, [accessCode, hasCheckoutFor]);

  return (
    <View padding="base" border="base" borderRadius="base" background="subdued" style={{ borderColor: '#af59d7' }}>
      <BlockStack alignment="center" spacing="tight" inlineAlignment="center">
        <Image
          source="https://cdn.shopify.com/s/files/1/0447/4047/7095/files/Message.png?v=1712211206"
          alt="Confirmation Image"
          style={{ maxWidth: '100px', marginBottom: '2.5rem' }}
        />

        <Text alignment="center" weight="bold">
          The cash amount you designated will be sent to the following Venmo address within the next 24 hours:
        </Text>

        <View
          border="dashed"
          padding="tight"
          borderRadius="base"
          style={{
            marginTop: '2.5rem',
            marginBottom: '2.5rem',
            padding: '1rem',
            width: 'fit-content',
            borderColor: '#af59d7',
          }}
        >
          <Text size="large" weight="bold">@yourVenmoAddress</Text>
        </View>

        {href && !disabled ? (
          <Link to={href} external>
            <Button role="button" kind="secondary" appearance="success">
              {buttonLabel}
            </Button>
          </Link>
        ) : (
          <Button role="button" kind="primary" appearance="success" disabled inlineAlignment="stretch">
            {buttonLabel}
          </Button>
        )}

        <Text alignment="center" weight="bold">
          For a quick refresher on what to expect next, please refer to our HOW IT WORKS and EXAMPLE pages below
        </Text>

        <Link to={href} external>
            <Button role="button" kind="primary" appearance="success">
              HOW IT WORKS
            </Button>
        </Link>
      </BlockStack>
    </View>
  );
}
