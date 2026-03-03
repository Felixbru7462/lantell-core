import Stripe from 'https://esm.sh/stripe@13.3.0?target=deno';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron schedule: 0 9 * * *  (daily at 9am UTC)

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const results: { jobId: string; status: 'partial_released' | 'error'; detail: string }[] = [];

  try {
    // Find all jobs eligible for partial release:
    // - status = DISPUTED
    // - stripe_transfer_id is null (no payment released yet)
    // - stripe_payment_intent_id is set (payment was captured)
    // - dispute created_at is 7+ days ago
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Join disputes to find ones older than 7 days with no resolution
    const { data: jobs, error: queryError } = await supabase
      .from('jobs')
      .select(`
        *,
        vendors(id, owner_id, stripe_account_id, company_name),
        disputes!inner(id, created_at, resolution)
      `)
      .eq('status', 'DISPUTED')
      .is('stripe_transfer_id', null)
      .not('stripe_payment_intent_id', 'is', null)
      .is('disputes.resolution', null)
      .lt('disputes.created_at', cutoff7d);

    if (queryError) {
      throw new Error('Query failed: ' + queryError.message);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No eligible disputed jobs found.', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const job of jobs) {
      try {
        if (!job.vendors?.stripe_account_id) {
          results.push({ jobId: job.id, status: 'error', detail: 'Vendor has no Stripe account.' });
          continue;
        }

        // Release 50% of the vendor's share (after platform fee)
        const amountInCents = Math.round(job.quote_amount * 100);
        const platformFee = Math.round(amountInCents * 0.05);
        const vendorFullAmount = amountInCents - platformFee;
        const partialAmount = Math.round(vendorFullAmount * 0.5);

        // Create partial Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: partialAmount,
          currency: 'usd',
          destination: job.vendors.stripe_account_id,
          transfer_group: job.id,
          description: `Partial release (50%) for disputed job ${job.id} after 7-day window`,
        });

        // Update job: store transfer ID and mark payment_status as partial
        await supabase
          .from('jobs')
          .update({
            stripe_transfer_id: transfer.id,
            payment_status: 'partial',
          })
          .eq('id', job.id);

        const partialDollars = (partialAmount / 100).toFixed(2);
        const fullDollars = job.quote_amount;

        // Notify PM
        if (job.owner_id) {
          await supabase.from('notifications').insert({
            user_id: job.owner_id,
            title: 'Partial Payment Released',
            body: `The dispute on "${(job.description ?? '').slice(0, 60)}" has been open for 7 days. 50% ($${partialDollars}) has been released to the vendor. The remaining 50% is held pending resolution.`,
            link: '/pm',
          });
        }

        // Notify vendor
        if (job.vendors?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: job.vendors.owner_id,
            title: '50% Payment Released',
            body: `$${partialDollars} (50% of $${fullDollars}) has been released for the disputed job. The remaining 50% is held pending dispute resolution.`,
            link: '/vendor',
          });
        }

        results.push({
          jobId: job.id,
          status: 'partial_released',
          detail: `Transfer ${transfer.id} — $${partialDollars} of $${fullDollars}`,
        });

      } catch (jobError) {
        console.error(`Failed partial release for job ${job.id}:`, jobError);
        results.push({ jobId: job.id, status: 'error', detail: jobError.message });
      }
    }

    return new Response(
      JSON.stringify({ processed: jobs.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('partial-release-payment error:', error);
    return new Response(
      JSON.stringify({ error: error.message, results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
