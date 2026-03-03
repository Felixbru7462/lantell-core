import Stripe from 'https://esm.sh/stripe@13.3.0?target=deno';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error('jobId is required.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the job with vendor's Stripe account ID and owner
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, vendors(id, owner_id, stripe_account_id, company_name)')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found: ' + (jobError?.message ?? 'unknown error'));
    }

    if (!job.stripe_payment_intent_id) {
      throw new Error('No payment intent found on this job.');
    }

    if (job.stripe_transfer_id) {
      throw new Error('Payment has already been released for this job.');
    }

    if (!job.vendors?.stripe_account_id) {
      throw new Error('Vendor does not have a connected Stripe account.');
    }

    // Calculate amounts
    const amountInCents = Math.round(job.quote_amount * 100);
    const platformFee = Math.round(amountInCents * 0.05);
    const vendorAmount = amountInCents - platformFee;

    // Create the transfer to the vendor's Stripe account
    const transfer = await stripe.transfers.create({
      amount: vendorAmount,
      currency: 'usd',
      destination: job.vendors.stripe_account_id,
      transfer_group: jobId,
      description: `Payment for job ${jobId}`,
    });

    // Store the transfer ID and update payment status on the job
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        stripe_transfer_id: transfer.id,
        payment_status: 'released',
      })
      .eq('id', jobId);

    if (updateError) {
      throw new Error('Failed to update job: ' + updateError.message);
    }

    // Notify the vendor that payment has been released
    if (job.vendors?.owner_id) {
      await supabase.from('notifications').insert({
        user_id: job.vendors.owner_id,
        title: 'Payment Released',
        body: `$${job.quote_amount} has been released to your account for the completed job.`,
        link: '/vendor',
      });
    }

    return new Response(
      JSON.stringify({ success: true, transferId: transfer.id, vendorAmount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('release-payment error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
