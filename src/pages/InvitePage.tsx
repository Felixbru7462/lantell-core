import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type PageState =
  | 'loading'
  | 'prompt'
  | 'connecting'
  | 'invalid'
  | 'error'
  | 'done';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [invite, setInvite] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg('No invite token provided.');
      setPageState('invalid');
      return;
    }
    checkTokenAndAuth(token);
  }, [token]);

  // Pick up auth state change in the same tab — user signs up/logs in while on this page
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session && invite && pageState === 'prompt') {
          await createConnection(invite, session.user);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [invite, pageState]);

  async function checkTokenAndAuth(tok: string) {
    setPageState('loading');

    const { data: inviteData, error: inviteError } = await supabase
      .from('invite_links')
      .select('id, created_by, role, expires_at, status')
      .eq('id', tok)
      .single();

    if (inviteError || !inviteData) {
      setErrorMsg('This invite link is invalid or no longer exists.');
      setPageState('invalid');
      return;
    }

    if (inviteData.status === 'used') {
      setErrorMsg('This invite link has already been used.');
      setPageState('invalid');
      return;
    }

    if (inviteData.status === 'expired' || new Date(inviteData.expires_at) < new Date()) {
      setErrorMsg('This invite link has expired.');
      setPageState('invalid');
      return;
    }

    setInvite(inviteData);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setPageState('prompt');
      return;
    }

    await createConnection(inviteData, user);
  }

  async function createConnection(inviteData: any, user: any) {
    setPageState('connecting');

    try {
      let pmId: string;
      let vendorId: string;

      if (inviteData.role === 'pm') {
        // PM created the link — the person clicking must be a vendor
        pmId = inviteData.created_by;

        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (vendorError || !vendorData) {
          setErrorMsg('This invite link is for vendors only. Make sure you have a vendor account on Anchorpoint.');
          setPageState('error');
          return;
        }

        vendorId = vendorData.id;

      } else {
        // Vendor created the link — the person clicking must be a PM
        pmId = user.id;

        const { data: vendorData, error: vendorError } = await supabase
          .from('vendors')
          .select('id')
          .eq('owner_id', inviteData.created_by)
          .single();

        if (vendorError || !vendorData) {
          setErrorMsg('Could not locate the vendor account that created this invite.');
          setPageState('error');
          return;
        }

        vendorId = vendorData.id;
      }

      // Don't create a duplicate connection
      const { data: existing } = await supabase
        .from('pm_vendor_connections')
        .select('id')
        .eq('pm_id', pmId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('pm_vendor_connections')
          .insert([{ pm_id: pmId, vendor_id: vendorId, status: 'accepted' }]);

        if (insertError) {
          setErrorMsg('Failed to establish connection: ' + insertError.message);
          setPageState('error');
          return;
        }
      }

      // Mark invite as used
      await supabase
        .from('invite_links')
        .update({ status: 'used', used_by: user.id })
        .eq('id', inviteData.id);

      setPageState('done');

      // Redirect based on which profile type the current user has
      const { data: pmProfile } = await supabase
        .from('pm_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      navigate(pmProfile ? '/pm' : '/vendor', { replace: true });

    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setPageState('error');
    }
  }

  // Sign up → vendor onboarding with invite token in URL
  // VendorOnboarding reads ?invite= and auto-connects at completion
  const goToSignup = () => navigate(`/signup?invite=${token}`);

  // Sign in → land back on this page via the onAuthStateChange listener above
  const goToLogin  = () => navigate(`/login?invite=${token}`);

  return (
    <div style={pageWrap}>
      <div style={card}>

        <div style={wordmark}>ANCHORPOINT</div>

        {/* Loading */}
        {pageState === 'loading' && (
          <div style={centerContent}>
            <div style={spinnerStyle} />
            <p style={subText}>Verifying invite link…</p>
          </div>
        )}

        {/* Prompt — not logged in */}
        {pageState === 'prompt' && (
          <>
            <div style={iconCircle}>🔗</div>
            <h1 style={heading}>You've been invited to Anchorpoint</h1>
            <p style={bodyText}>
              Create a free account to connect and start receiving work — takes about 2 minutes.
            </p>
            <button onClick={goToSignup} style={{ ...btnPrimary, width: '100%', marginBottom: '12px' }}>
              Create Account
            </button>
            <button onClick={goToLogin} style={{ ...btnSecondaryStyle, width: '100%' }}>
              I already have an account — Sign In
            </button>
            <p style={{ ...hint, marginTop: '20px' }}>
              The connection will be established automatically once you're signed in.
            </p>
          </>
        )}

        {/* Connecting */}
        {pageState === 'connecting' && (
          <div style={centerContent}>
            <div style={spinnerStyle} />
            <p style={subText}>Establishing connection…</p>
          </div>
        )}

        {/* Done */}
        {pageState === 'done' && (
          <div style={centerContent}>
            <div style={successIcon}>✓</div>
            <p style={subText}>Connected! Redirecting to your dashboard…</p>
          </div>
        )}

        {/* Invalid token */}
        {pageState === 'invalid' && (
          <>
            <div style={{ ...iconCircle, background: '#FEF2F2', color: '#DC2626', fontSize: '1.5rem' }}>✕</div>
            <h1 style={{ ...heading, color: '#1A1A1A' }}>Invite Link Unavailable</h1>
            <p style={{ ...bodyText, color: '#6B7280' }}>
              {errorMsg || 'This invite link is invalid, has expired, or has already been used.'}
            </p>
            <p style={hint}>Ask the person who shared this link to generate a new one from their dashboard.</p>
          </>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <>
            <div style={{ ...iconCircle, background: '#FEF2F2', color: '#DC2626', fontSize: '1.3rem' }}>!</div>
            <h1 style={{ ...heading, color: '#1A1A1A' }}>Something went wrong</h1>
            <p style={{ ...bodyText, color: '#DC2626', background: '#FEF2F2', padding: '12px 16px', borderRadius: '6px', border: '1px solid #FECACA' }}>
              {errorMsg}
            </p>
            <button onClick={() => token && checkTokenAndAuth(token)} style={{ ...btnPrimary, marginTop: '8px' }}>
              Try Again
            </button>
          </>
        )}

      </div>
    </div>
  );
}

const pageWrap: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#FAF9F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'sans-serif' };
const card: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '12px', padding: '48px 40px', maxWidth: '440px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' };
const wordmark: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '3px', color: '#9CA3AF', marginBottom: '36px' };
const iconCircle: React.CSSProperties = { width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', margin: '0 auto 24px' };
const heading: React.CSSProperties = { margin: '0 0 14px 0', fontSize: '1.35rem', fontWeight: 'bold', color: '#1A1A1A', lineHeight: 1.3 };
const bodyText: React.CSSProperties = { margin: '0 0 28px 0', fontSize: '0.95rem', color: '#6B7280', lineHeight: 1.6 };
const btnPrimary: React.CSSProperties = { background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '13px 28px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' };
const btnSecondaryStyle: React.CSSProperties = { background: 'transparent', color: '#2563EB', border: '1px solid #2563EB', padding: '13px 28px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' };
const hint: React.CSSProperties = { margin: 0, fontSize: '0.78rem', color: '#9CA3AF', lineHeight: 1.5 };
const subText: React.CSSProperties = { margin: '14px 0 0 0', fontSize: '0.88rem', color: '#9CA3AF' };
const centerContent: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' };
const successIcon: React.CSSProperties = { width: '52px', height: '52px', borderRadius: '50%', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 'bold', margin: '0 auto' };
const spinnerStyle: React.CSSProperties = { width: '36px', height: '36px', border: '3px solid #E5E3DF', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'ap-spin 0.8s linear infinite' };

if (typeof document !== 'undefined' && !document.getElementById('ap-invite-spin')) {
  const style = document.createElement('style');
  style.id = 'ap-invite-spin';
  style.textContent = `@keyframes ap-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}