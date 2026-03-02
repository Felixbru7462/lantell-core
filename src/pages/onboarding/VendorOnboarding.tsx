import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// Four steps: the last one is the new Stripe Connect step
const STEPS = ['Business Info', 'Address & Services', 'Review', 'Connect Payments'];

const SERVICE_OPTIONS = [
  'Cleaning', 'Plumbing', 'Electrical', 'HVAC', 'Landscaping',
  'Security', 'Pest Control', 'Painting', 'Roofing', 'General Maintenance',
];

export function VendorOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once profile is saved (at step 2 → 3 transition)
  const [savedVendorId, setSavedVendorId] = useState<string | null>(null);
  const [savedVendorEmail, setSavedVendorEmail] = useState<string | null>(null);

  const [connectingStripe, setConnectingStripe] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    address: '',
    service_type: '',
    custom_service: '',
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const selectedService =
    form.service_type === 'custom' ? form.custom_service : form.service_type;

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.full_name.trim()) return 'Full name is required.';
      if (!form.company_name.trim()) return 'Company name is required.';
    }
    if (step === 1) {
      if (!form.address.trim()) return 'Address is required.';
      if (!selectedService.trim()) return 'Please select or enter your service type.';
    }
    return null;
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const next = async () => {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);

    // At step 2 (Review), save the profile before advancing to the Stripe step
    if (step === 2) {
      await saveProfile();
      return; // saveProfile advances to step 3 internally
    }

    setStep(s => s + 1);
  };

  // ── Save profile (step 2 → 3 transition) ─────────────────────────────────

  const saveProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No active session. Please log in again.');

      setSavedVendorEmail(user.email ?? null);

      // 1. Upsert vendor profile
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .upsert(
          {
            owner_id: user.id,
            contact_email: user.email,
            full_name: form.full_name,
            company_name: form.company_name,
            address: form.address,
            service_type: selectedService,
          },
          { onConflict: 'owner_id' }
        )
        .select('id')
        .single();

      if (vendorError || !vendorData) {
        throw new Error('Failed to save vendor profile: ' + (vendorError?.message ?? 'Unknown error'));
      }

      setSavedVendorId(vendorData.id);

      // 2. Mark onboarding complete on profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_complete: true,
          full_name: form.full_name,
          company_name: form.company_name,
        })
        .eq('id', user.id);

      if (profileError) {
        throw new Error('Failed to mark onboarding complete: ' + profileError.message);
      }

      // 3. Consume invite token if present
      if (inviteToken) {
        const { data: invite, error: inviteError } = await supabase
          .from('invite_links')
          .select('id, created_by, role, expires_at, status')
          .eq('id', inviteToken)
          .single();

        if (
          !inviteError &&
          invite &&
          invite.status === 'active' &&
          new Date(invite.expires_at) >= new Date()
        ) {
          const pmId = invite.role === 'pm' ? invite.created_by : user.id;

          const { data: existing } = await supabase
            .from('pm_vendor_connections')
            .select('id')
            .eq('pm_id', pmId)
            .eq('vendor_id', vendorData.id)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from('pm_vendor_connections')
              .insert([{ pm_id: pmId, vendor_id: vendorData.id, status: 'accepted' }]);
          }

          await supabase
            .from('invite_links')
            .update({ status: 'used', used_by: user.id })
            .eq('id', invite.id);
        }
      }

      // Advance to Stripe Connect step
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Stripe Connect ────────────────────────────────────────────────────────

  const handleConnectStripe = async () => {
    if (!savedVendorId || !savedVendorEmail) return;
    setConnectingStripe(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        'https://guuctgeqzwbfgwmrgfez.supabase.co/functions/v1/create-connect-account',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ vendorId: savedVendorId, email: savedVendorEmail }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      const { accountId, onboardingUrl } = await response.json();

      // Store the Stripe account ID before redirecting
      await supabase
        .from('vendors')
        .update({ stripe_account_id: accountId })
        .eq('id', savedVendorId);

      // Redirect to Stripe-hosted onboarding
      // Stripe will redirect back to /vendor?stripe=success when done
      window.location.href = onboardingUrl;
    } catch (err: any) {
      setError(err.message);
      setConnectingStripe(false);
    }
  };

  const handleSkipStripe = () => {
    navigate('/vendor');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const showInviteBanner = !!inviteToken && step >= 2;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        {/* Wordmark */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#1A1A1A' }}>
            Lantell
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: '0.72rem', letterSpacing: '1.5px' }}>
            VENDOR ONBOARDING
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            {STEPS.map((label, i) => (
              <span
                key={label}
                style={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.3px',
                  color: i < step ? '#16A34A' : i === step ? '#2563EB' : '#C4C2BE',
                  fontWeight: i === step ? 'bold' : 'normal',
                }}
              >
                {i < step ? '✓' : label}
              </span>
            ))}
          </div>
          <div style={{ height: '3px', background: '#E5E3DF', borderRadius: '2px' }}>
            <div style={{ height: '100%', borderRadius: '2px', background: '#2563EB', width: `${progress}%`, transition: 'width 0.35s ease' }} />
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        {/* ── STEP 0: Business Info ─────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h2 style={stepTitle}>Tell us about your business</h2>

            <label style={labelStyle}>FULL NAME</label>
            <input
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => update('full_name', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>COMPANY / BUSINESS NAME</label>
            <input
              placeholder="e.g. Ace Plumbing Services"
              value={form.company_name}
              onChange={e => update('company_name', e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {/* ── STEP 1: Address & Services ───────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={stepTitle}>Where are you based & what do you do?</h2>

            <label style={labelStyle}>BUSINESS ADDRESS</label>
            <input
              placeholder="123 Trade St, City, State"
              value={form.address}
              onChange={e => update('address', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>SERVICE TYPE</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {SERVICE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => update('service_type', s)}
                  style={{
                    padding: '10px', borderRadius: '6px', cursor: 'pointer',
                    background: form.service_type === s ? '#EFF6FF' : '#F9FAFB',
                    border: form.service_type === s ? '2px solid #2563EB' : '1px solid #E5E3DF',
                    color: form.service_type === s ? '#2563EB' : '#6B7280',
                    fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'left' as const,
                  }}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => update('service_type', 'custom')}
                style={{
                  padding: '10px', borderRadius: '6px', cursor: 'pointer',
                  background: form.service_type === 'custom' ? '#EFF6FF' : '#F9FAFB',
                  border: form.service_type === 'custom' ? '2px solid #2563EB' : '1px solid #E5E3DF',
                  color: form.service_type === 'custom' ? '#2563EB' : '#6B7280',
                  fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'left' as const,
                }}
              >
                + Other
              </button>
            </div>
            {form.service_type === 'custom' && (
              <input
                placeholder="Describe your service…"
                value={form.custom_service}
                onChange={e => update('custom_service', e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        )}

        {/* ── STEP 2: Review ───────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={stepTitle}>Review your details</h2>
            <p style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '20px', lineHeight: 1.5 }}>
              Confirm everything looks right before we set up payments.
            </p>

            <div style={{ background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
              {[
                { label: 'NAME', value: form.full_name },
                { label: 'COMPANY', value: form.company_name },
                { label: 'ADDRESS', value: form.address },
                { label: 'SERVICE TYPE', value: selectedService },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.62rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '2px' }}>{row.label}</div>
                  <div style={{ color: '#1A1A1A', fontSize: '0.9rem' }}>{row.value || '—'}</div>
                </div>
              ))}
            </div>

            {showInviteBanner && (
              <div style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🔗</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#16A34A', marginBottom: '2px' }}>Invite link detected</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>You'll be automatically connected to the PM who invited you.</div>
                </div>
              </div>
            )}

            <p style={{ color: '#9CA3AF', fontSize: '0.78rem', margin: 0 }}>
              You can edit all of this later in Settings.
            </p>
          </div>
        )}

        {/* ── STEP 3: Connect Payments ──────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={stepTitle}>Connect your bank account</h2>

            <div style={{ background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '8px', padding: '22px', marginBottom: '24px' }}>
              {/* Stripe branding row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px',
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', flexShrink: 0,
                }}>
                  🏦
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1A1A' }}>Stripe Connect</div>
                  <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>Secure · Verified · Instant deposits</div>
                </div>
              </div>

              <p style={{ margin: '0 0 18px 0', fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.6 }}>
                To receive payments through Lantell, you need to connect your bank account via Stripe. This is secure and takes about 2 minutes.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Your identity is verified directly by Stripe',
                  'Payments deposited straight to your bank account',
                  'Lantell retains a 5% platform fee per verified job',
                ].map(point => (
                  <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <span style={{ color: '#16A34A', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '1px', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connect button */}
            <button
              onClick={handleConnectStripe}
              disabled={connectingStripe}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '14px',
                background: connectingStripe ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF', border: 'none', borderRadius: '7px',
                cursor: connectingStripe ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.95rem', marginBottom: '14px',
                transition: 'background 0.15s',
              }}
            >
              {connectingStripe
                ? <>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: '__lt_spin 0.7s linear infinite' }} />
                    Redirecting to Stripe…
                  </>
                : '🏦 Connect Bank Account'
              }
            </button>

            {/* Skip link */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleSkipStripe}
                style={{
                  background: 'none', border: 'none',
                  color: '#9CA3AF', cursor: 'pointer',
                  fontSize: '0.8rem', textDecoration: 'underline',
                  padding: '6px 8px', fontFamily: 'sans-serif',
                }}
              >
                Skip for now — I'll connect later in Settings
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation (steps 0–2 only) ───────────────────────────────── */}
        {step < 3 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            {step > 0 && (
              <button
                onClick={() => { setError(null); setStep(s => s - 1); }}
                style={btnSecondary}
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              disabled={loading}
              style={{ ...btnPrimary, flex: 1, opacity: loading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading
                ? <>
                    <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: '__lt_spin 0.7s linear infinite' }} />
                    Saving…
                  </>
                : step === 2 ? 'Looks good →' : 'Continue →'
              }
            </button>
          </div>
        )}

      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes __lt_spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Style constants ──────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#FAF9F7',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  fontFamily: 'sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '12px',
  padding: '40px', width: '100%', maxWidth: '480px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const stepTitle: React.CSSProperties = {
  margin: '0 0 20px 0', fontSize: '1.05rem', color: '#1A1A1A', fontWeight: 700,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', color: '#9CA3AF',
  letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold',
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '12px 14px', marginBottom: '20px',
  background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A',
  borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'sans-serif',
};

const btnPrimary: React.CSSProperties = {
  padding: '13px', background: '#2563EB', color: '#FFFFFF', border: 'none',
  borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
  fontFamily: 'sans-serif',
};

const btnSecondary: React.CSSProperties = {
  padding: '13px 20px', background: 'transparent', color: '#6B7280',
  border: '1px solid #E5E3DF', borderRadius: '6px', cursor: 'pointer',
  fontSize: '0.95rem', fontFamily: 'sans-serif',
};

const errorStyle: React.CSSProperties = {
  background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
  padding: '12px 14px', borderRadius: '6px', marginBottom: '16px',
  fontSize: '0.85rem', lineHeight: 1.4,
};

export default VendorOnboarding;