import Stripe from 'https://esm.sh/stripe@13.3.0?target=deno';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron schedule: 0 * * * *  (every hour)

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

  const results: { jobId: string; status: 'released' | 'error'; detail: string }[] = [];

  try {
    // Find all jobs eligible for auto-release:
    // - status = PENDING_VERIFICATION
    // - updated_at more than 48 hours ago
    // - stripe_payment_intent_id is set
    // - stripe_transfer_id is null (not yet paid out)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: jobs, error: queryError } = await supabase
      .from('jobs')
      .select('*, vendors(id, owner_id, stripe_account_id, company_name), owner_id')
      .eq('status', 'PENDING_VERIFICATION')
      .lt('updated_at', cutoff)
      .not('stripe_payment_intent_id', 'is', null)
      .is('stripe_transfer_id', null);

    if (queryError) {
      throw new Error('Query failed: ' + queryError.message);
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No eligible jobs found.', results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each eligible job
    for (const job of jobs) {
      try {
        if (!job.vendors?.stripe_account_id) {
          results.push({ jobId: job.id, status: 'error', detail: 'Vendor has no Stripe account.' });
          continue;
        }

        // Calculate transfer amount (95% to vendor, 5% platform fee)
        const amountInCents = Math.round(job.quote_amount * 100);
        const platformFee = Math.round(amountInCents * 0.05);
        const vendorAmount = amountInCents - platformFee;

        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: vendorAmount,
          currency: 'usd',
          destination: job.vendors.stripe_account_id,
          transfer_group: job.id,
          description: `Auto-released payment for job ${job.id} after 48h`,
        });

        // Mark job as VERIFIED and store transfer ID
        const now = new Date().toISOString();
        await supabase
          .from('jobs')
          .update({
            status: 'VERIFIED',
            verified_at: now,
            stripe_transfer_id: transfer.id,
            payment_status: 'released',
          })
          .eq('id', job.id);

        // Notify PM
        if (job.owner_id) {
          await supabase.from('notifications').insert({
            user_id: job.owner_id,
            title: 'Work Auto-Verified',
            body: `The job "${(job.description ?? '').slice(0, 60)}" was automatically verified after 48 hours and payment has been released to the vendor.`,
            link: '/pm',
          });
        }

        // Notify vendor
        if (job.vendors?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: job.vendors.owner_id,
            title: 'Payment Released',
            body: `$${job.quote_amount} has been released to your account. The job was automatically verified after 48 hours.`,
            link: '/vendor',
          });
        }

        results.push({ jobId: job.id, status: 'released', detail: `Transfer ${transfer.id}` });

      } catch (jobError) {
        console.error(`Failed to auto-release job ${job.id}:`, jobError);
        results.push({ jobId: job.id, status: 'error', detail: jobError.message });
      }
    }

    return new Response(
      JSON.stringify({ processed: jobs.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('auto-release-payments error:', error);
    return new Response(
      JSON.stringify({ error: error.message, results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
