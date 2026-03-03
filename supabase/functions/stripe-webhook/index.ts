import Stripe from 'https://esm.sh/stripe@13.3.0?target=deno';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      webhookSecret
    );
  } catch (error) {
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    await supabase
      .from('jobs')
      .update({ payment_status: 'paid' })
      .eq('stripe_payment_intent_id', paymentIntent.id);
  }

  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    const isComplete =
      account.charges_enabled &&
      account.payouts_enabled &&
      account.details_submitted;

    await supabase
      .from('vendors')
      .update({ stripe_onboarding_complete: isComplete })
      .eq('stripe_account_id', account.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});