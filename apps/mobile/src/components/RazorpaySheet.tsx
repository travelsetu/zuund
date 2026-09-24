import type { PaymentCheckoutDto } from '@zuund/shared';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { Modal, Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { Header } from './ui';

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Razorpay's standard web checkout inside a WebView. The result only carries
 * ids and a signature; the app sends them to POST /payments/verify and the
 * server (plus the webhook) decides whether the pass activates.
 */
export function RazorpaySheet({
  checkout,
  prefill,
  onResult,
  onDismiss,
}: {
  checkout: PaymentCheckoutDto | null;
  prefill: { name: string; email?: string; contact?: string };
  onResult: (r: RazorpayResult) => void;
  onDismiss: () => void;
}) {
  const web = Platform.OS === 'web';
  // Web: open Razorpay's own checkout on this page (there is no WebView in a browser).
  useEffect(() => {
    if (!web || !checkout) return;
    let cancelled = false;
    void loadRazorpayScript()
      .then(() => {
        if (cancelled) return;
        const Razorpay = (window as unknown as { Razorpay: new (o: object) => { open(): void } })
          .Razorpay;
        new Razorpay({
          key: checkout.checkout.key,
          order_id: checkout.checkout.orderId,
          amount: checkout.payment.amount,
          currency: checkout.payment.currency,
          name: 'ZUUND',
          description: 'Elite Pass',
          prefill,
          theme: { color: colors.brand },
          handler: (r: RazorpayResult) => onResult(r),
          modal: { ondismiss: onDismiss },
        }).open();
      })
      .catch(onDismiss);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [web, checkout]);

  if (!checkout || web) return null;
  const options = {
    key: checkout.checkout.key,
    order_id: checkout.checkout.orderId,
    amount: checkout.payment.amount,
    currency: checkout.payment.currency,
    name: 'ZUUND',
    description: 'Elite Pass',
    prefill,
    theme: { color: colors.brand },
  };
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="margin:0;background:#F5F8FE"><script>
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var o = ${JSON.stringify(options)};
  o.handler = function (r) { post({ type: 'success', result: r }); };
  o.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
  try { new Razorpay(o).open(); } catch (e) { post({ type: 'dismiss' }); }
</script></body></html>`;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; result?: RazorpayResult };
      if (m.type === 'success' && m.result) onResult(m.result);
      else onDismiss();
    } catch {
      onDismiss();
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onDismiss} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Header title="Secure payment" subtitle="Powered by Razorpay" back={false} />
        </View>
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://api.zuund.com' }}
          onMessage={onMessage}
          javaScriptEnabled
          // UPI apps open through intent/deep links, which the WebView cannot load itself.
          onShouldStartLoadWithRequest={(req) => {
            if (/^(https?|about|data|blob):/.test(req.url)) return true;
            void Linking.openURL(req.url).catch(() => {});
            return false;
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

let scriptLoad: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = 'https://checkout.razorpay.com/v1/checkout.js';
    el.onload = () => resolve();
    el.onerror = () => {
      scriptLoad = null;
      reject(new Error('Could not load the payment window'));
    };
    document.body.appendChild(el);
  });
  return scriptLoad;
}
