/**
 * Dynamically load Razorpay Checkout script into the DOM
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay Standard Checkout Modal
 */
export const launchRazorpayCheckout = async ({
  orderData,
  user,
  onSuccess,
  onError,
  onDismiss,
}) => {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
  }

  const options = {
    key:
      orderData.keyId ||
      (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID)) ||
      'rzp_test_TviqPqgjtmOobl',
    amount: orderData.amount, // in paise
    currency: orderData.currency || 'INR',
    name: 'ParkSync Intelligent Parking',
    description: `Reservation #${orderData.reservationId} (Bay ${orderData.slotNumber || ''})`,
    order_id: orderData.orderId,
    prefill: {
      name: user?.name || orderData.customer?.name || '',
      email: user?.email || orderData.customer?.email || '',
      contact: user?.phone || orderData.customer?.phone || '',
    },
    notes: {
      reservationId: String(orderData.reservationId),
      paymentId: String(orderData.paymentId),
    },
    theme: {
      color: '#0d9488', // Teal accent
    },
    handler: async (response) => {
      // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      if (onSuccess) {
        await onSuccess(response);
      }
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) {
          onDismiss();
        }
      },
    },
  };

  const rzp = new window.Razorpay(options);

  rzp.on('payment.failed', (response) => {
    if (onError) {
      onError(response.error);
    }
  });

  rzp.open();
};

