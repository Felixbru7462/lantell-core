import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) return setError('Please fill in all fields.');
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_complete')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      setError('No profile found. Please contact support.');
      setLoading(false);
      return;
    }

    if (!profile.onboarding_complete) {
      navigate(profile.role === 'pm' ? '/onboarding/pm' : '/onboarding/vendor');
    } else {
      navigate(profile.role === 'pm' ? '/pm' : '/vendor');
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>

        {/* Wordmark */}
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#1A1A1A', lineHeight: 1 }}>
            Lantell
          </div>
          <p style={{ margin: '10px 0 0 0', color: '#9CA3AF', fontSize: '0.82rem', lineHeight: 1.5, maxWidth: '280px' }}>
            Operations and verification for real-world service work
          </p>
        </div>

        <h2 style={{ margin: '0 0 24px 0', fontSize: '0.95rem', color: '#1A1A1A', fontWeight: 600 }}>
          Sign in to your account
        </h2>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FEE2E2',
            color: '#DC2626', padding: '12px 14px', borderRadius: '6px',
            marginBottom: '20px', fontSize: '0.85rem', lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <label style={formLabel}>EMAIL ADDRESS</label>
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label style={formLabel}>PASSWORD</label>
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={inputStyle}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ ...btnPrimary, marginTop: '8px', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '24px', color: '#9CA3AF', fontSize: '0.82rem' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#FAF9F7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  fontFamily: 'sans-serif',
};

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E3DF',
  borderRadius: '12px',
  padding: '44px 40px',
  width: '100%',
  maxWidth: '420px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const formLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.67rem',
  color: '#9CA3AF',
  letterSpacing: '1px',
  fontWeight: 'bold',
  marginBottom: '7px',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 14px',
  marginBottom: '18px',
  background: '#FFFFFF',
  border: '1px solid #E5E3DF',
  color: '#1A1A1A',
  borderRadius: '6px',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  background: '#2563EB',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.9rem',
  letterSpacing: '0.2px',
};

export default LoginPage;