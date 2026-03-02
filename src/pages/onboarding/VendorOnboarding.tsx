import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const STEPS = ['Business Info', 'Address & Services', 'Finish'];

const SERVICE_OPTIONS = [
  'Cleaning', 'Plumbing', 'Electrical', 'HVAC', 'Landscaping',
  'Security', 'Pest Control', 'Painting', 'Roofing', 'General Maintenance'
];

export function VendorOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    address: '',
    service_type: '',
    custom_service: '',
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const selectedService = form.service_type === 'custom'
    ? form.custom_service
    : form.service_type;

  const validateStep = () => {
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

  const next = () => {
    const err = validateStep();
    if (err) return setError(err);
    setError(null);
    setStep(s => s + 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No active session. Please log in again.');

      // 1. Create vendor profile
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .upsert({
          owner_id: user.id,
          contact_email: user.email,
          full_name: form.full_name,
          company_name: form.company_name,
          address: form.address,
          service_type: selectedService,
        }, { onConflict: 'owner_id' })
        .select('id')
        .single();

      if (vendorError) throw new Error('Failed to save vendor profile: ' + vendorError.message);

      // 2. Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_complete: true,
          full_name: form.full_name,
          company_name: form.company_name,
        })
        .eq('id', user.id);

      if (profileError) throw new Error('Failed to mark onboarding complete: ' + profileError.message);

      // 3. If there's an invite token, consume it and create the PM connection
      if (inviteToken && vendorData) {
        const { data: invite, error: inviteError } = await supabase
          .from('invite_links')
          .select('id, created_by, role, expires_at, status')
          .eq('id', inviteToken)
          .single();

        // Only proceed if invite is valid — don't block onboarding if it's not
        if (!inviteError && invite && invite.status === 'active' && new Date(invite.expires_at) >= new Date()) {

          // invite.role === 'pm' means a PM created this link, vendor is clicking it
          const pmId = invite.role === 'pm' ? invite.created_by : user.id;
          const vendorId = vendorData.id;

          // Check no duplicate connection exists
          const { data: existing } = await supabase
            .from('pm_vendor_connections')
            .select('id')
            .eq('pm_id', pmId)
            .eq('vendor_id', vendorId)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from('pm_vendor_connections')
              .insert([{ pm_id: pmId, vendor_id: vendorId, status: 'accepted' }]);
          }

          // Mark invite used
          await supabase
            .from('invite_links')
            .update({ status: 'used', used_by: user.id })
            .eq('id', invite.id);
        }
      }

      navigate('/vendor');

    } catch (err: any) {
      console.error('Vendor onboarding error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const progress = Math.round((step / STEPS.length) * 100);

  // Show a banner on the final step if coming from an invite
  const showInviteBanner = !!inviteToken && step === 2;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, letterSpacing: '3px', fontSize: '1.2rem', color: '#1A1A1A' }}>ANCHORPOINT</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.75rem', letterSpacing: '1px' }}>
            VENDOR ONBOARDING
          </p>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            {STEPS.map((label, i) => (
              <span key={label} style={{
                fontSize: '0.7rem', letterSpacing: '0.5px',
                color: i <= step ? '#2563EB' : '#9CA3AF',
                fontWeight: i === step ? 'bold' : 'normal'
              }}>
                {label}
              </span>
            ))}
          </div>
          <div style={{ height: '3px', background: '#E5E3DF', borderRadius: '2px' }}>
            <div style={{
              height: '100%', borderRadius: '2px', background: '#2563EB',
              width: `${progress}%`, transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        {/* Step 0 — Business Info */}
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

        {/* Step 1 — Address & Services */}
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
                placeholder="Describe your service..."
                value={form.custom_service}
                onChange={e => update('custom_service', e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        )}

        {/* Step 2 — Summary */}
        {step === 2 && (
          <div>
            <h2 style={stepTitle}>You're all set</h2>
            <p style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '24px' }}>
              Here's a summary of what you entered:
            </p>
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '8px', padding: '20px', marginBottom: '16px' }}>
              {[
                { label: 'NAME', value: form.full_name },
                { label: 'COMPANY', value: form.company_name },
                { label: 'ADDRESS', value: form.address },
                { label: 'SERVICE TYPE', value: selectedService },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '1px' }}>{row.label}</div>
                  <div style={{ color: '#1A1A1A', fontSize: '0.95rem', marginTop: '2px' }}>{row.value}</div>
                </div>
              ))}
            </div>

            {/* Invite banner — shown when coming via invite link */}
            {showInviteBanner && (
              <div style={{ padding: '12px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem' }}>🔗</span>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#16A34A', marginBottom: '2px' }}>Invite link detected</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>You'll be automatically connected once you enter the dashboard.</div>
                </div>
              </div>
            )}

            <p style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>You can edit all of this later in Settings.</p>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          {step > 0 && (
            <button onClick={() => { setError(null); setStep(s => s - 1); }} style={btnSecondary}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={next} style={{ ...btnPrimary, flex: 1 }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleComplete} disabled={loading} style={{ ...btnPrimary, flex: 1 }}>
              {loading ? 'Saving...' : 'Enter Dashboard →'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#FAF9F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const cardStyle: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '480px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const stepTitle: React.CSSProperties = { margin: '0 0 24px 0', fontSize: '1.1rem', color: '#1A1A1A', fontWeight: 'bold' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '8px' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px 14px', marginBottom: '20px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { padding: '13px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' };
const btnSecondary: React.CSSProperties = { padding: '13px 20px', background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem' };
const errorStyle: React.CSSProperties = { background: '#FEF2F2', border: '1px solid #DC2626', color: '#DC2626', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85rem' };