import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  reactExtension,
  View,
  Text,
  Button,
  useExtensionApi,
  useSubscription,
} from '@shopify/ui-extensions-react/checkout';

export default reactExtension('purchase.thank-you.block.render', () => <GhostGiver />);

function GhostGiver() {
  const api = useExtensionApi();

  // 1) Read available signals
  const rawLines = useSubscription(api.lines);                 // line items
  const orderConfirmation = useSubscription(api.orderConfirmation); // order info on thank-you
  const checkoutAttributes = useSubscription(api.attributes);  // checkout attributes

  // 2) Build a legacy-like payload (replacement for Shopify.checkout)
  const payload = useMemo(() => {
    const line_items = (rawLines || []).map((li) => {
      const props = Object.fromEntries((li.attributes || []).map(a => [a.key, a.value]));
      return {
        title: li.title,
        quantity: li.quantity,
        variant_id: li.merchandise ? li.merchandise.id : null,
        properties: props, // holds _For, _Contact, etc.
      };
    });

    // Order id/name can differ by version; keep this flexible
    const order_id =
      (orderConfirmation && orderConfirmation.order && (orderConfirmation.order.id || orderConfirmation.order.name)) ||
      (orderConfirmation && orderConfirmation.name) ||
      null;

    const attributesObj = Object.fromEntries((checkoutAttributes || []).map(a => [a.key, a.value]));

    return {
      line_items,
      order_id,
      attributes: attributesObj,
      source: 'purchase.thank-you.block.render',
    };
  }, [rawLines, orderConfirmation, checkoutAttributes]);

  // 3) Fetch via App Proxy and store access code
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setResp(null);

    console.log('POST payload:', payload); // appears in `shopify app dev` CLI

    try {
      const r = await fetch('/apps/velvey-custom-app/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + text.slice(0, 200));

      setResp(text); // access code
      try { localStorage.setItem('ghostgiver_access_code', text); } catch (e) {}
    } catch (e) {
      setErr(String((e && e.message) || e));
    } finally {
      setLoading(false);
    }
  }, [payload]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <View padding="base" border="base" borderRadius="base" background="subdued">
      <Text emphasis="bold">Ghost Giver — fetch debug</Text>
      {loading && <Text size="small">Fetching…</Text>}
      {resp && <Text size="small">Access code: {resp}</Text>}
      {err && <Text tone="critical" size="small">Error: {err}</Text>}
      <Button onPress={run} disabled={loading}>{loading ? 'Running…' : 'Run again'}</Button>
    </View>
  );
}
