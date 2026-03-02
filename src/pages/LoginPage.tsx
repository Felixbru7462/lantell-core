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

    // Route based on onboarding status first, then role
    if (!profile.onboarding_complete) {
      navigate(profile.role === 'pm' ? '/onboarding/pm' : '/onboarding/vendor');
    } else {
      navigate(profile.role === 'pm' ? '/pm' : '/vendor');
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ margin: 0, letterSpacing: '3px', fontSize: '1.4rem', color: '#1A1A1A' }}>LANTELL</h1>
          <p style={{ margin: '6px 0 0 0', color: '#6B7280', fontSize: '0.8rem', letterSpacing: '1px' }}>
            OPERATIONS PLATFORM
          </p>
        </div>

        <h2 style={{ margin: '0 0 24px 0', fontSize: '1rem', color: '#6B7280', fontWeight: 'normal' }}>
          Sign in to your account
        </h2>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #DC2626', color: '#DC2626', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inputStyle} />

        <button onClick={handleLogin} disabled={loading} style={btnPrimary}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', color: '#6B7280', fontSize: '0.85rem' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#2563EB', textDecoration: 'none' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', backgroundColor: '#FAF9F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const cardStyle: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px 14px', marginBottom: '14px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { display: 'block', width: '100%', padding: '13px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' };