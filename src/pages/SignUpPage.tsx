import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Role = 'pm' | 'vendor';

export function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) return setError('Please fill in all fields.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (!role) return setError('Please select your account type.');

    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('Sign up failed. Please try again.');
      setLoading(false);
      return;
    }

    // Write role to profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ id: data.user.id, role }]);

    if (profileError) {
      setError('Account created but role assignment failed: ' + profileError.message);
      setLoading(false);
      return;
    }

    // Preserve invite token if present — complete onboarding first, then consume invite
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');

    if (inviteToken) {
      // Route through onboarding with invite token preserved in URL
      navigate(role === 'pm'
        ? `/onboarding/pm?invite=${inviteToken}`
        : `/onboarding/vendor?invite=${inviteToken}`
      );
    } else {
      navigate(role === 'pm' ? '/onboarding/pm' : '/onboarding/vendor');
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, letterSpacing: '3px', fontSize: '1.4rem', color: '#1A1A1A' }}>ANCHORPOINT</h1>
          <p style={{ margin: '6px 0 0 0', color: '#6B7280', fontSize: '0.8rem', letterSpacing: '1px' }}>
            OPERATIONS PLATFORM
          </p>
        </div>

        <h2 style={{ margin: '0 0 24px 0', fontSize: '1rem', color: '#6B7280', fontWeight: 'normal' }}>
          Create your account
        </h2>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #DC2626', color: '#DC2626', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Role Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '10px', letterSpacing: '1px' }}>
            ACCOUNT TYPE
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              onClick={() => setRole('pm')}
              style={{
                padding: '14px 10px', borderRadius: '8px', cursor: 'pointer',
                background: role === 'pm' ? '#EFF6FF' : '#F9FAFB',
                border: role === 'pm' ? '2px solid #2563EB' : '1px solid #E5E3DF',
                color: role === 'pm' ? '#2563EB' : '#6B7280',
                fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.15s'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🏢</div>
              Customer / PM
            </button>
            <button
              onClick={() => setRole('vendor')}
              style={{
                padding: '14px 10px', borderRadius: '8px', cursor: 'pointer',
                background: role === 'vendor' ? '#EFF6FF' : '#F9FAFB',
                border: role === 'vendor' ? '2px solid #2563EB' : '1px solid #E5E3DF',
                color: role === 'vendor' ? '#2563EB' : '#6B7280',
                fontSize: '0.85rem', fontWeight: 'bold', transition: 'all 0.15s'
              }}
            >
              <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🔧</div>
              Vendor / Provider
            </button>
          </div>
        </div>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSignUp()}
          style={inputStyle}
        />

        <button onClick={handleSignUp} disabled={loading} style={btnPrimary}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#6B7280', fontSize: '0.85rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#2563EB', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#FAF9F7',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px'
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E3DF',
  borderRadius: '12px', padding: '40px',
  width: '100%', maxWidth: '400px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '12px 14px',
  marginBottom: '14px', background: '#FFFFFF',
  border: '1px solid #E5E3DF', color: '#1A1A1A',
  borderRadius: '6px', fontSize: '0.95rem',
  boxSizing: 'border-box', outline: 'none'
};

const btnPrimary: React.CSSProperties = {
  display: 'block', width: '100%', padding: '13px',
  background: '#2563EB', color: '#FFFFFF',
  border: 'none', borderRadius: '6px',
  cursor: 'pointer', fontWeight: 'bold',
  fontSize: '0.95rem', letterSpacing: '0.5px',
  marginTop: '4px'
};