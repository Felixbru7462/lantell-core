import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface RetractModalProps {
  jobId: string;
  disputeId: string;
  onClose: () => void;
  onRetracted: () => void;
}

export function RetractModal({ jobId, disputeId, onClose, onRetracted }: RetractModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRetract() {
    if (!reason.trim()) return alert('Please provide a reason for retracting.');
    setLoading(true);

    try {
      // Resolve the dispute record
      const { error: disputeError } = await supabase
        .from('disputes')
        .update({
          retraction_reason: reason.trim(),
          resolution: 'retracted',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);
      if (disputeError) throw disputeError;

      // Move job to VERIFIED and stamp verified_at — this seals it into the Vault
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'VERIFIED',
          verified_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      if (jobError) throw jobError;

      // Notify vendor that the dispute was retracted
      const { data: jobData } = await supabase
        .from('jobs')
        .select('vendor_id, description')
        .eq('id', jobId)
        .single();

      if (jobData?.vendor_id) {
        const { data: vendorData } = await supabase
          .from('vendors').select('owner_id').eq('id', jobData.vendor_id).single();

        if (vendorData?.owner_id) {
          await supabase.from('notifications').insert({
            user_id: vendorData.owner_id,
            title: 'Dispute Retracted — Job Verified',
            body: `The dispute on "${jobData.description?.slice(0, 60)}${jobData.description?.length > 60 ? '...' : ''}" has been retracted. The job is now verified and sealed in the record.`,
            link: '/vendor',
          });
        }
      }

      onRetracted();
      onClose();
    } catch (err: any) {
      alert('Failed to retract: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '8px', padding: '30px', width: '100%', maxWidth: '420px', color: '#1A1A1A', fontFamily: 'sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '1px', color: '#1A1A1A' }}>RETRACT DISPUTE</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        <p style={{ color: '#6B7280', fontSize: '0.85rem', marginBottom: '8px', lineHeight: 1.5 }}>
          Retracting will seal this job in the{' '}
          <span style={{ color: '#2563EB', fontWeight: 'bold' }}>Vault</span>{' '}
          as a verified record marked as previously disputed.
        </p>
        <p style={{ color: '#9CA3AF', fontSize: '0.78rem', marginBottom: '20px', lineHeight: 1.5 }}>
          The vendor will be notified. The dispute record and your retraction reason will remain permanently attached to the vault entry. This cannot be undone.
        </p>

        <label style={labelStyle}>REASON FOR RETRACTION *</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Issue was resolved directly with the vendor, work was subsequently completed to standard..."
          style={{ ...inputStyle, height: '90px', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={handleRetract} disabled={loading} style={{ ...btnPrimary, flex: 1 }}>
            {loading ? 'Retracting...' : 'Confirm Retraction'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '11px 14px', marginBottom: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '7px', fontWeight: 'bold' };
const btnPrimary: React.CSSProperties = { background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', padding: '10px 18px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem' };