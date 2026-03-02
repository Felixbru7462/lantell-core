import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface DisputePortalProps {
  job: any;
  onClose: () => void;
  onDisputeFiled: () => void;
}

const CATEGORIES = [
  'Work not completed',
  'Work done incorrectly',
  'No-show / access issue',
  'Property damage',
  'Safety concern',
  'Other',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export function DisputePortal({ job, onClose, onDisputeFiled }: DisputePortalProps) {
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [failedObjectives, setFailedObjectives] = useState('');
  const [accessIssues, setAccessIssues] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!category) return alert('Please select a category.');
    if (!description.trim()) return alert('Please describe the issue.');
    setLoading(true);

    try {
      // Insert dispute record
      const { error: disputeError } = await supabase.from('disputes').insert({
        job_id: job.id,
        category,
        severity,
        failed_objectives: failedObjectives.trim() || null,
        access_issues: accessIssues.trim() || null,
        description: description.trim(),
      });
      if (disputeError) throw disputeError;

      // Move job to DISPUTED
      await supabase.from('jobs').update({ status: 'DISPUTED' }).eq('id', job.id);

      // Notify vendor with the full PM report
      if (job.vendor_id) {
        const { data: vendorData } = await supabase
          .from('vendors').select('owner_id').eq('id', job.vendor_id).single();

        if (vendorData?.owner_id) {
          const notifBody = [
            `A dispute has been raised on "${job.description?.slice(0, 60)}${job.description?.length > 60 ? '...' : ''}".`,
            `Category: ${category} · Severity: ${severity.toUpperCase()}`,
            failedObjectives ? `Failed objectives: ${failedObjectives}` : null,
            accessIssues ? `Access issues: ${accessIssues}` : null,
            `PM report: ${description.trim()}`,
            `This dispute will be resolved outside of Anchorpoint. You will be notified if the claim is retracted.`,
          ].filter(Boolean).join('\n\n');

          await supabase.from('notifications').insert({
            user_id: vendorData.owner_id,
            title: `Dispute Filed — ${category}`,
            body: notifBody,
            link: '/vendor',
          });
        }
      }

      onDisputeFiled();
      onClose();
    } catch (err: any) {
      alert('Failed to file dispute: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const severityStyle = (s: string, active: boolean) => {
    if (!active) return { color: '#9CA3AF', border: '1px solid #E5E3DF', background: 'transparent' };
    const colors: Record<string, string> = { low: '#2563EB', medium: '#D97706', high: '#D97706', critical: '#DC2626' };
    const bgs: Record<string, string> = { low: '#EFF6FF', medium: '#FFFBEB', high: '#FFF7ED', critical: '#FEF2F2' };
    return { color: colors[s], border: `1px solid ${colors[s]}`, background: bgs[s] };
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #FEE2E2', borderRadius: '8px', padding: '30px', width: '100%', maxWidth: '480px', color: '#1A1A1A', fontFamily: 'sans-serif', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '1px', color: '#DC2626' }}>FILE A DISPUTE</h3>
            <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.8rem' }}>
              {job.locations?.label || 'Job'} · {job.vendors?.company_name || 'Vendor'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', marginBottom: '20px', fontSize: '0.78rem', color: '#92400E', lineHeight: 1.5 }}>
          The vendor will be notified with your full report. Disputes are currently resolved outside of Anchorpoint — you can retract at any time, which will seal the record in the Vault marked as previously disputed.
        </div>

        <label style={labelStyle}>CATEGORY *</label>
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
          <option value="">— Select category —</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={labelStyle}>SEVERITY</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              style={{
                flex: 1, padding: '7px 4px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '0.5px',
                textTransform: 'uppercase' as const,
                ...severityStyle(s, severity === s),
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <label style={labelStyle}>
          FAILED OBJECTIVES{' '}
          <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          value={failedObjectives}
          onChange={e => setFailedObjectives(e.target.value)}
          placeholder="Which objectives were not met?"
          style={{ ...inputStyle, height: '60px', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
        />

        <label style={labelStyle}>
          ACCESS ISSUES{' '}
          <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
        </label>
        <input
          type="text"
          value={accessIssues}
          onChange={e => setAccessIssues(e.target.value)}
          placeholder="e.g. Vendor couldn't access unit 4B"
          style={inputStyle}
        />

        <label style={labelStyle}>YOUR REPORT *</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe the issue in detail. This will be sent to the vendor alongside the evidence already on file."
          style={{ ...inputStyle, height: '90px', resize: 'vertical' as const, fontFamily: 'sans-serif' }}
        />

        <p style={{ margin: '-8px 0 18px 0', fontSize: '0.72rem', color: '#9CA3AF' }}>
          📎 Photo attachments — coming soon.
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
          <button onClick={handleSubmit} disabled={loading} style={{ ...btnDanger, flex: 1 }}>
            {loading ? 'Filing...' : 'File Dispute'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '11px 14px', marginBottom: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '7px', fontWeight: 'bold' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', padding: '10px 18px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem' };
const btnDanger: React.CSSProperties = { background: '#FEF2F2', color: '#DC2626', border: '1px solid #DC2626', padding: '10px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' };