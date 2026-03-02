import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const STEPS = ['Business Info', 'Address', 'Finish'];

export function PMOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    address: '',
    account_type: 'smb' as 'smb' | 'multi',
  });

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.full_name.trim()) return 'Full name is required.';
      if (!form.company_name.trim()) return 'Company name is required.';
    }
    if (step === 1) {
      if (!form.address.trim()) return 'Primary address is required.';
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

      // Save to pm_profiles
      const { error: pmError } = await supabase
        .from('pm_profiles')
        .upsert({
          id: user.id,
          full_name: form.full_name,
          company_name: form.company_name,
          address: form.address,
          account_type: form.account_type,
        }, { onConflict: 'id' });

      if (pmError) throw new Error('Failed to save profile: ' + pmError.message);

      // Mark onboarding complete on profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_complete: true,
          full_name: form.full_name,
          company_name: form.company_name,
        })
        .eq('id', user.id);

      if (profileError) throw new Error('Failed to mark onboarding complete: ' + profileError.message);

      navigate('/pm');

    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, letterSpacing: '3px', fontSize: '1.2rem', color: '#1A1A1A' }}>ANCHORPOINT</h1>
          <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.75rem', letterSpacing: '1px' }}>
            PM ONBOARDING
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

            <label style={labelStyle}>ACCOUNT TYPE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[
                { value: 'smb', icon: '🏪', label: 'Single Business' },
                { value: 'multi', icon: '🏢', label: 'Multiple Locations' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => update('account_type', opt.value)}
                  style={{
                    padding: '14px 10px', borderRadius: '8px', cursor: 'pointer',
                    background: form.account_type === opt.value ? '#EFF6FF' : '#F9FAFB',
                    border: form.account_type === opt.value ? '2px solid #2563EB' : '1px solid #E5E3DF',
                    color: form.account_type === opt.value ? '#2563EB' : '#6B7280',
                    fontSize: '0.85rem', fontWeight: 'bold'
                  }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{opt.icon}</div>
                  {opt.label}
                </button>
              ))}
            </div>

            <label style={labelStyle}>FULL NAME</label>
            <input
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => update('full_name', e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>COMPANY / BUSINESS NAME</label>
            <input
              placeholder="e.g. Sunrise Properties LLC"
              value={form.company_name}
              onChange={e => update('company_name', e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {/* Step 1 — Address */}
        {step === 1 && (
          <div>
            <h2 style={stepTitle}>Your primary address</h2>
            <p style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '24px' }}>
              This is your main business address. You can add more locations in your dashboard.
            </p>
            <label style={labelStyle}>STREET ADDRESS</label>
            <input
              placeholder="123 Main St, Suite 100"
              value={form.address}
              onChange={e => update('address', e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {/* Step 2 — Finish */}
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
                { label: 'ACCOUNT TYPE', value: form.account_type === 'smb' ? 'Single Business' : 'Multiple Locations' },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '1px' }}>{row.label}</div>
                  <div style={{ color: '#1A1A1A', fontSize: '0.95rem', marginTop: '2px' }}>{row.value}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>
              You can edit all of this later in Settings.
            </p>
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