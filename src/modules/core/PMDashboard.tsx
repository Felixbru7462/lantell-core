import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { SmartBooking } from '../jobs/SmartBooking';
import { DisputePortal } from '../disputes/DisputePortal';
import { RetractModal } from '../disputes/RetractModal';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ─── Stripe setup ─────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

const cardElementOptions = {
  style: {
    base: {
      fontSize: '15px',
      fontFamily: 'sans-serif',
      color: '#1A1A1A',
      '::placeholder': { color: '#9CA3AF' },
    },
    invalid: { color: '#DC2626' },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatScopeDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function exportVaultEntryPDF(job: any) {
  const locLabel = (job.locations?.label || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-');
  const shortId = job.id.slice(0, 8);
  const filename = `LT-${locLabel}-${shortId}`;
  const report = Array.isArray(job.service_reports) ? job.service_reports[0] : job.service_reports;
  const dispute = Array.isArray(job.disputes) ? job.disputes[0] : job.disputes;
  const fmtFull = (ts: any) => ts ? new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${filename}</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: Georgia, serif; max-width: 720px; margin: 40px auto; color: #1A1A1A; font-size: 13px; line-height: 1.6; padding: 0 24px; } h1 { font-size: 20px; letter-spacing: 3px; font-weight: bold; margin-bottom: 2px; } .doc-subtitle { font-size: 11px; color: #6B7280; letter-spacing: 1.5px; margin-bottom: 28px; } .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #1A1A1A; margin-bottom: 24px; } .badges { display: flex; gap: 6px; } .badge { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 4px; } .badge-verified { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; } .badge-disputed { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; } .section { margin-bottom: 22px; } .section-title { font-family: Arial, sans-serif; font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #9CA3AF; text-transform: uppercase; padding-bottom: 5px; border-bottom: 1px solid #E5E3DF; margin-bottom: 12px; } .field { margin-bottom: 12px; } .field-label { font-family: Arial, sans-serif; font-size: 9px; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; } .field-value { font-size: 13px; color: #1A1A1A; } .field-sub { font-size: 12px; color: #6B7280; } .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .dispute-block { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 14px; margin-top: 8px; } .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E5E3DF; font-family: Arial, sans-serif; font-size: 10px; color: #9CA3AF; display: flex; justify-content: space-between; } @media print { body { margin: 0; padding: 20px; } }</style></head><body><div class="doc-header"><div><h1>LANTELL</h1><div class="doc-subtitle">VAULT RECORD · VERIFIED SERVICE ENTRY</div></div><div class="badges"><span class="badge badge-verified">VERIFIED</span>${dispute ? '<span class="badge badge-disputed">DISPUTED</span>' : ''}</div></div><div class="section"><div class="section-title">Location</div><div class="field"><div class="field-value">${job.locations?.label || '—'}</div><div class="field-sub">${job.locations?.address || '—'}</div></div></div><div class="section"><div class="section-title">Vendor</div><div class="field"><div class="field-value">${job.vendors?.company_name || '—'}</div><div class="field-sub">${job.vendors?.service_type || '—'}</div></div></div><div class="section"><div class="section-title">Service Details</div><div class="field"><div class="field-label">Description</div><div class="field-value">${job.description || '—'}</div></div>${job.objectives ? `<div class="field"><div class="field-label">Objectives</div><div class="field-value">${job.objectives}</div></div>` : ''}${job.quote_amount ? `<div class="field"><div class="field-label">Agreed Amount</div><div class="field-value">$${job.quote_amount}</div></div>` : ''}</div><div class="section"><div class="section-title">Timeline</div><div class="grid-2"><div class="field"><div class="field-label">Created</div><div class="field-value">${fmtFull(job.created_at)}</div></div><div class="field"><div class="field-label">Verified</div><div class="field-value">${fmtFull(job.verified_at)}</div></div></div></div>${report ? `<div class="section"><div class="section-title">Service Report</div>${report.notes ? `<div class="field"><div class="field-label">Vendor Notes</div><div class="field-value">${report.notes}</div></div>` : ''}${report.photo_urls?.length ? `<div class="field"><div class="field-label">Photos on File</div><div class="field-value">${report.photo_urls.length} photo(s) submitted</div></div>` : ''}<div class="field"><div class="field-label">Report Submitted</div><div class="field-value">${fmtFull(report.submitted_at)}</div></div></div>` : ''}${dispute ? `<div class="section"><div class="section-title">Dispute Record</div><div class="dispute-block"><div class="grid-2"><div class="field"><div class="field-label">Category</div><div class="field-value">${dispute.category || '—'}</div></div><div class="field"><div class="field-label">Severity</div><div class="field-value">${(dispute.severity || '—').toUpperCase()}</div></div></div>${dispute.resolution ? `<div class="field"><div class="field-label">Resolution</div><div class="field-value">${dispute.resolution}</div></div>` : ''}</div></div>` : ''}<div class="footer"><span>Lantell · Record ID: ${job.id}</span><span>Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div></body></html>`;
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups to export PDF.'); return; }
  win.document.write(html); win.document.close(); win.focus();
  setTimeout(() => { win.print(); }, 600);
}

const STATUS_LABELS: Record<string, string> = { PENDING_ACCEPTANCE: 'Pending Acceptance', ACCEPTED: 'Accepted', DECLINED: 'Declined', PENDING_QUOTE: 'Pending Quote', QUOTE_SUBMITTED: 'Quote Submitted', QUOTE_ACCEPTED: 'Quote Accepted', QUOTE_DECLINED: 'Quote Declined', IN_PROGRESS: 'In Progress', PENDING_VERIFICATION: 'Pending Verification', VERIFIED: 'Verified', DISPUTED: 'Disputed' };
const STATUS_COLORS: Record<string, string> = { PENDING_ACCEPTANCE: '#D97706', ACCEPTED: '#2563EB', DECLINED: '#DC2626', PENDING_QUOTE: '#D97706', QUOTE_SUBMITTED: '#7C3AED', QUOTE_ACCEPTED: '#2563EB', QUOTE_DECLINED: '#DC2626', IN_PROGRESS: '#2563EB', PENDING_VERIFICATION: '#D97706', VERIFIED: '#16A34A', DISPUTED: '#DC2626' };

interface PMProfile { full_name: string; company_name: string; address: string; account_type: string; }

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconDashboard = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>;
const IconCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconServices = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>;
const IconVendors = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IconLocations = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconVault = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const IconIntelligence = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IconSettings = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>;
const IconBell = ({ color }: { color: string }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>;

// ─── PropertyHealthBar ────────────────────────────────────────────────────────

interface HealthData {
  totalLocations: number;
  overdueJobs: number;
  longPendingVerification: number;
  pendingQuotes: number;
}

function PropertyHealthBar({ healthData }: { healthData: HealthData }) {
  const { totalLocations, overdueJobs, longPendingVerification, pendingQuotes } = healthData;
  const isRed = overdueJobs > 0;
  const isAmber = !isRed && (longPendingVerification > 0 || pendingQuotes > 0);
  const color = isRed ? '#DC2626' : isAmber ? '#D97706' : '#16A34A';
  const bgColor = isRed ? '#FEF2F2' : isAmber ? '#FFFBEB' : '#F0FDF4';
  const borderColor = isRed ? '#FECACA' : isAmber ? '#FDE68A' : '#BBF7D0';
  const message = isRed
    ? `${overdueJobs} job${overdueJobs !== 1 ? 's' : ''} past deadline — action needed`
    : isAmber
    ? longPendingVerification > 0 ? `${longPendingVerification} job${longPendingVerification !== 1 ? 's' : ''} awaiting verification for 48h+` : `${pendingQuotes} quote${pendingQuotes !== 1 ? 's' : ''} ready for review`
    : 'All properties operating normally';

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderLeft: `4px solid ${color}`, borderRadius: '8px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${color}33`, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color, marginBottom: '2px' }}>
            {isRed ? 'ATTENTION REQUIRED' : isAmber ? 'REVIEW NEEDED' : 'ALL CLEAR'}
          </div>
          <div style={{ fontSize: '0.88rem', color: '#1A1A1A', fontWeight: 500 }}>{message}</div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1A1A1A', lineHeight: 1 }}>{totalLocations}</div>
        <div style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '1px' }}>PROPERTIES</div>
      </div>
    </div>
  );
}

// ─── ScopeBlock ───────────────────────────────────────────────────────────────

function ScopeBlock({ job, userId, onRefresh }: { job: any; userId: string | null; onRefresh: () => void }) {
  const [showCounter, setShowCounter] = useState(false);
  const [counterDatetime, setCounterDatetime] = useState('');
  const minDatetime = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  const handleConfirm = async () => {
    await supabase.from('jobs').update({ scope_status: 'confirmed' }).eq('id', job.id);
    const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', job.vendor_id).single();
    if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Scope Visit Confirmed', body: `Your proposed scope visit for "${job.description.slice(0, 60)}" has been confirmed.`, link: '/vendor' });
    onRefresh();
  };

  const handleSendCounter = async () => {
    if (!counterDatetime) return;
    await supabase.from('jobs').update({ scope_counter_datetime: new Date(counterDatetime).toISOString(), scope_status: 'countered' }).eq('id', job.id);
    const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', job.vendor_id).single();
    if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Scope Visit Counter-Proposal', body: `The PM proposed an alternative time for the scope visit at "${job.description.slice(0, 60)}".`, link: '/vendor' });
    setShowCounter(false); setCounterDatetime(''); onRefresh();
  };

  return (
    <div style={{ marginBottom: '12px', padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
      <div style={{ fontSize: '0.68rem', color: '#D97706', letterSpacing: '1px', marginBottom: '6px', fontWeight: 'bold' }}>SCOPE VISIT REQUESTED</div>
      {job.scope_status === 'confirmed' && (
        <div style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 600 }}>✓ Confirmed: {formatScopeDate(job.scope_proposed_datetime)}</div>
      )}
      {job.scope_status === 'proposed' && job.scope_proposed_datetime && (
        <div>
          <div style={{ fontSize: '0.82rem', color: '#D97706', marginBottom: '10px' }}>Vendor proposed: {formatScopeDate(job.scope_proposed_datetime)}</div>
          {!showCounter ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleConfirm} style={{ ...btnPrimary, fontSize: '0.75rem', padding: '5px 12px', background: '#16A34A' }}>Confirm</button>
              <button onClick={() => setShowCounter(true)} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '5px 12px' }}>Propose Different Time</button>
            </div>
          ) : (
            <div>
              <input type="datetime-local" value={counterDatetime} min={minDatetime} onChange={e => setCounterDatetime(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSendCounter} disabled={!counterDatetime} style={{ ...btnPrimary, fontSize: '0.75rem', padding: '5px 12px', opacity: !counterDatetime ? 0.5 : 1 }}>Send Counter</button>
                <button onClick={() => { setShowCounter(false); setCounterDatetime(''); }} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '5px 12px' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      {job.scope_status === 'countered' && job.scope_counter_datetime && (
        <div>
          <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '2px' }}>Vendor proposed: {formatScopeDate(job.scope_proposed_datetime)}</div>
          <div style={{ fontSize: '0.82rem', color: '#2563EB', fontWeight: 600 }}>Your counter: {formatScopeDate(job.scope_counter_datetime)} — awaiting vendor</div>
        </div>
      )}
    </div>
  );
}

// ─── ServiceReportInline ──────────────────────────────────────────────────────

function ServiceReportInline({ job, onVerify, onDispute }: { job: any; onVerify: () => void; onDispute: () => void }) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from('service_reports').select('*').eq('job_id', job.id).order('submitted_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
  }, [job.id]);

  const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ width: '100%' }}>
      {loading ? (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '6px', fontSize: '0.78rem', color: '#9CA3AF' }}>Loading service report...</div>
      ) : report ? (
        <div style={{ marginBottom: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', overflow: 'hidden' }}>
          <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' as const }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#16A34A', letterSpacing: '1px' }}>SERVICE REPORT SUBMITTED</span>
              {report.photo_urls?.length > 0 && <span style={{ fontSize: '0.65rem', color: '#6B7280', border: '1px solid #E5E3DF', padding: '1px 6px', borderRadius: '10px', background: '#FFFFFF' }}>{report.photo_urls.length} photo{report.photo_urls.length !== 1 ? 's' : ''}</span>}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>{expanded ? '▲ Hide' : '▼ View'}</span>
          </button>
          {expanded && (
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid #BBF7D0' }}>
              {report.notes && <div style={{ marginTop: '12px' }}><div style={{ fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '4px' }}>VENDOR NOTES</div><p style={{ margin: 0, fontSize: '0.85rem', color: '#1A1A1A', lineHeight: 1.5 }}>{report.notes}</p></div>}
              {report.photo_urls?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '8px' }}>PHOTOS</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {report.photo_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '72px', height: '72px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #BBF7D0', flexShrink: 0 }}>
                        <img src={url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: '10px', fontSize: '0.7rem', color: '#9CA3AF' }}>Submitted {fmtDate(report.submitted_at)}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '0.78rem', color: '#D97706' }}>⚠ Vendor marked work complete but no service report was filed.</div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onVerify} style={{ background: '#16A34A', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.78rem' }}>✓ Verify Work</button>
        <button onClick={onDispute} style={{ background: 'transparent', color: '#DC2626', border: '1px solid #FEE2E2', padding: '6px 14px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.78rem' }}>Raise Dispute</button>
      </div>
    </div>
  );
}

// ─── Page: Dashboard Home ─────────────────────────────────────────────────────

function DashboardHome({ jobs, locations, notifications, onNavigate }: { jobs: any[]; locations: any[]; notifications: any[]; onNavigate: (page: PageKey) => void; }) {
  const now = Date.now();
  const pipelineJobs = jobs.filter(j => j.status !== 'VERIFIED');

  const healthData: HealthData = useMemo(() => {
    const overdueJobs = pipelineJobs.filter(j => j.deadline && new Date(j.deadline).getTime() < now && !['VERIFIED', 'PENDING_VERIFICATION'].includes(j.status)).length;
    const longPendingVerification = pipelineJobs.filter(j => j.status === 'PENDING_VERIFICATION' && j.updated_at && (now - new Date(j.updated_at).getTime()) > 48 * 3600000).length;
    const pendingQuotes = pipelineJobs.filter(j => j.status === 'QUOTE_SUBMITTED').length;
    return { totalLocations: locations.length, overdueJobs, longPendingVerification, pendingQuotes };
  }, [pipelineJobs, locations, now]);

  // Next actions — max 5, priority sorted
  const nextActions = useMemo(() => {
    const actions: { priority: number; job: any; label: string; cta?: string; ctaAction?: string }[] = [];
    for (const job of pipelineJobs) {
      const isOverdue = job.deadline && new Date(job.deadline).getTime() < now;
      if (isOverdue && !['VERIFIED', 'PENDING_VERIFICATION'].includes(job.status)) {
        actions.push({ priority: 1, job, label: 'Past deadline', cta: undefined });
      } else if (job.status === 'PENDING_VERIFICATION') {
        const hoursOld = (now - new Date(job.updated_at || job.created_at).getTime()) / 3600000;
        actions.push({ priority: hoursOld > 48 ? 2 : 3, job, label: 'Work complete — review needed', cta: 'Verify work', ctaAction: 'SERVICES' });
      } else if (job.status === 'QUOTE_SUBMITTED') {
        actions.push({ priority: 3, job, label: 'Quote received', cta: 'Review quote', ctaAction: 'SERVICES' });
      } else if (job.status === 'PENDING_ACCEPTANCE') {
        const daysOld = (now - new Date(job.created_at).getTime()) / 86400000;
        if (daysOld >= 3) actions.push({ priority: 4, job, label: 'Awaiting vendor for 3+ days', cta: undefined });
      }
    }
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [pipelineJobs, now]);

  // Upcoming events
  const upcoming = useMemo(() => {
    const events: { date: Date; label: string; type: 'scope' | 'deadline' }[] = [];
    for (const job of pipelineJobs) {
      if (job.deadline) {
        const d = new Date(job.deadline);
        if (d.getTime() > now) events.push({ date: d, label: `Deadline: ${job.description?.slice(0, 40) || 'Job'} @ ${job.locations?.label || '—'}`, type: 'deadline' });
      }
      if (job.scope_status === 'confirmed' && job.scope_proposed_datetime) {
        const d = new Date(job.scope_proposed_datetime);
        if (d.getTime() > now) events.push({ date: d, label: `Scope visit: ${job.locations?.label || '—'}`, type: 'scope' });
      }
    }
    return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);
  }, [pipelineJobs, now]);

  const urgencyColor = (priority: number) => priority <= 1 ? '#DC2626' : priority <= 2 ? '#D97706' : '#2563EB';

  return (
    <div>
      <PropertyHealthBar healthData={healthData} />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Next actions */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#9CA3AF' }}>NEXT ACTIONS</div>
              <button onClick={() => onNavigate('SERVICES')} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#2563EB', cursor: 'pointer', padding: 0 }}>View all →</button>
            </div>
            {nextActions.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No pending actions — all clear.</div>
            ) : nextActions.map((action, i) => (
              <div key={action.job.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < nextActions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: urgencyColor(action.priority), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{action.job.locations?.label || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{action.label}</div>
                </div>
                {action.cta ? (
                  <button onClick={() => onNavigate('SERVICES')} style={{ ...btnPrimary, fontSize: '0.72rem', padding: '5px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}>{action.cta}</button>
                ) : (
                  <span style={{ fontSize: '0.68rem', color: urgencyColor(action.priority), border: `1px solid ${urgencyColor(action.priority)}33`, padding: '3px 8px', borderRadius: '10px', background: `${urgencyColor(action.priority)}11`, flexShrink: 0, whiteSpace: 'nowrap' }}>Flag</span>
                )}
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#9CA3AF', marginBottom: '16px' }}>RECENT ACTIVITY</div>
            {notifications.slice(0, 5).length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No recent activity.</div>
            ) : notifications.slice(0, 5).map((n, i) => (
              <div key={n.id} style={{ padding: '8px 0', borderBottom: i < 4 ? '1px solid #F3F4F6' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.read ? '#E5E3DF' : '#2563EB', flexShrink: 0, marginTop: '5px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: '#1A1A1A', lineHeight: 1.4 }}>{n.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px' }}>{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Upcoming */}
          <div style={cardStyle}>
            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#9CA3AF', marginBottom: '16px' }}>UPCOMING</div>
            {upcoming.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>No upcoming events.</div>
            ) : upcoming.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: i < upcoming.length - 1 ? '1px solid #F3F4F6' : 'none', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, width: '36px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: ev.type === 'deadline' ? '#DC2626' : '#2563EB', letterSpacing: '0.5px' }}>{ev.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1A1A1A', lineHeight: 1 }}>{ev.date.getDate()}</div>
                </div>
                <div style={{ flex: 1, fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.4, paddingTop: '2px' }}>{ev.label}</div>
              </div>
            ))}
          </div>

          {/* AI Intelligence placeholder */}
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)', border: '1px solid #BFDBFE' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ color: '#7C3AED' }}><IconIntelligence /></div>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#7C3AED' }}>LANTELL INTELLIGENCE</div>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#4C1D95', lineHeight: 1.5, marginBottom: '12px' }}>Insights and anomaly detection coming soon.</div>
            <div style={{ fontSize: '0.72rem', color: '#7C3AED', background: '#EDE9FE', border: '1px solid #DDD6FE', padding: '4px 10px', borderRadius: '20px', display: 'inline-block' }}>Coming Soon</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page: Calendar ───────────────────────────────────────────────────────────

function CalendarPage({ jobs }: { jobs: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const eventsMap = useMemo(() => {
    const map: Record<number, { type: 'deadline' | 'scope'; label: string; color: string }[]> = {};
    for (const job of jobs) {
      if (job.deadline) {
        const d = new Date(job.deadline);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({ type: 'deadline', label: `Deadline: ${job.locations?.label || job.description?.slice(0, 20) || 'Job'}`, color: '#DC2626' });
        }
      }
      if (job.scope_status === 'confirmed' && job.scope_proposed_datetime) {
        const d = new Date(job.scope_proposed_datetime);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push({ type: 'scope', label: `Scope: ${job.locations?.label || '—'}`, color: '#2563EB' });
        }
      }
    }
    return map;
  }, [jobs, year, month]);

  const selectedEvents = selectedDay ? (eventsMap[selectedDay] || []) : [];
  const today = new Date();
  const isToday = (day: number) => today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#1A1A1A', fontWeight: 'bold' }}>{monthName}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ ...btnSecondary, padding: '6px 14px' }}>←</button>
          <button onClick={() => setCurrentDate(new Date())} style={{ ...btnSecondary, padding: '6px 14px', fontSize: '0.75rem' }}>Today</button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ ...btnSecondary, padding: '6px 14px' }}>→</button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#E5E3DF', borderRadius: '6px', overflow: 'hidden' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ background: '#F9FAFB', padding: '8px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 'bold', letterSpacing: '1px', color: '#9CA3AF' }}>{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} style={{ background: '#FAF9F7', minHeight: '80px' }} />;
            const events = eventsMap[day] || [];
            const selected = selectedDay === day;
            return (
              <div key={day} onClick={() => setSelectedDay(selected ? null : day)} style={{ background: selected ? '#EFF6FF' : '#FFFFFF', minHeight: '80px', padding: '8px', cursor: 'pointer', transition: 'background 0.1s', borderTop: isToday(day) ? '2px solid #2563EB' : 'none' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: isToday(day) ? 'bold' : 'normal', color: isToday(day) ? '#2563EB' : '#1A1A1A', marginBottom: '4px' }}>{day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {events.slice(0, 2).map((ev, j) => (
                    <div key={j} style={{ background: `${ev.color}18`, border: `1px solid ${ev.color}44`, borderRadius: '3px', padding: '1px 4px', fontSize: '0.6rem', color: ev.color, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ev.type === 'deadline' ? '⏱' : '📋'} {ev.label.split(': ')[1] || ev.label}
                    </div>
                  ))}
                  {events.length > 2 && <div style={{ fontSize: '0.6rem', color: '#9CA3AF' }}>+{events.length - 2} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={{ ...cardStyle, marginTop: '16px', borderColor: '#2563EB' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#2563EB', marginBottom: '12px' }}>
            {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>No events on this day.</div>
          ) : selectedEvents.map((ev, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < selectedEvents.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.color, flexShrink: 0 }} />
              <div style={{ fontSize: '0.85rem', color: '#1A1A1A' }}>{ev.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page: Services (Pipeline) ────────────────────────────────────────────────

function ServicesPage({ jobs, userId, onRefresh, onDispute, onRetract, onReviewQuote }: {
  jobs: any[]; userId: string | null;
  onRefresh: () => void;
  onDispute: (job: any) => void;
  onRetract: (jobId: string, disputeId: string) => void;
  onReviewQuote: (job: any) => void;
}) {
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const pipelineJobs = jobs.filter(j => j.status !== 'VERIFIED');
  const uniqueLocations = Array.from(new Set(pipelineJobs.map(j => j.location_id))).map(id => pipelineJobs.find(j => j.location_id === id)?.locations).filter(Boolean);
  const uniqueStatuses = Array.from(new Set(pipelineJobs.map(j => j.status)));

  const filtered = pipelineJobs.filter(j => {
    if (filterStatus && j.status !== filterStatus) return false;
    if (filterLocation && j.location_id !== filterLocation) return false;
    return true;
  });

  const getActiveDispute = (job: any) => job.disputes?.find((d: any) => !d.resolution);

  const verifyWork = async (job: any) => {
    if (!window.confirm('Verify this work as satisfactorily completed?\n\nThis will seal the record in the Vault. You can still raise a dispute afterwards if needed.')) return;
    const { error } = await supabase.from('jobs').update({ status: 'VERIFIED', verified_at: new Date().toISOString() }).eq('id', job.id);
    if (error) return alert('Failed: ' + error.message);
    const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', job.vendor_id).single();
    if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Work Verified', body: `Your work on "${job.description.slice(0, 60)}" has been verified and added to the Vault.`, link: '/vendor' });
    // Release payment to vendor if payment was captured
    if (job.stripe_payment_intent_id && !job.stripe_transfer_id) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('https://guuctgeqzwbfgwmrgfez.supabase.co/functions/v1/release-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ jobId: job.id }),
        });
      } catch (e) { console.error('Payment release failed:', e); }
    }
    onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#6B7280' }}>ACTIVE JOBS ({filtered.length})</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '7px 10px', fontSize: '0.8rem', minWidth: '140px' }}>
            <option value="">All statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
          </select>
          <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '7px 10px', fontSize: '0.8rem', minWidth: '140px' }}>
            <option value="">All locations</option>
            {uniqueLocations.map((loc: any) => <option key={loc?.id} value={pipelineJobs.find(j => j.locations === loc)?.location_id}>{loc?.label}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={emptyState}><p style={{ margin: 0 }}>No active jobs. Go to Locations and create a job to get started.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '15px' }}>
          {filtered.map(job => {
            const activeDispute = getActiveDispute(job);
            const statusColor = STATUS_COLORS[job.status] || '#6B7280';
            const statusLabel = STATUS_LABELS[job.status] || job.status;
            const deadlinePassed = job.deadline && new Date(job.deadline) < new Date();
            return (
              <div key={job.id} style={{ ...cardStyle, borderLeft: `4px solid ${statusColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '0.72rem', letterSpacing: '1px', border: `1px solid ${statusColor}33`, padding: '2px 8px', borderRadius: '10px', background: `${statusColor}11` }}>{statusLabel.toUpperCase()}</span>
                    {deadlinePassed && !['VERIFIED', 'PENDING_VERIFICATION'].includes(job.status) && <span style={{ fontSize: '0.68rem', color: '#DC2626', border: '1px solid #FEE2E2', padding: '2px 6px', borderRadius: '10px', background: '#FEF2F2' }}>⚠ PAST DEADLINE</span>}
                  </div>
                  <span style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>#{job.id.slice(0, 8)}</span>
                </div>
                <h3 style={{ margin: '0 0 4px 0', color: '#1A1A1A' }}>{job.locations?.label || 'Unknown Location'}</h3>
                <p style={{ color: '#6B7280', fontSize: '0.88rem', margin: '0 0 8px 0', lineHeight: 1.4 }}>{job.description}</p>
                <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '4px' }}>Vendor: <span style={{ color: '#6B7280', fontWeight: 600 }}>{job.vendors?.company_name || 'Unassigned'}</span></div>
                {job.deadline && <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '12px' }}>Deadline: <span style={{ color: deadlinePassed ? '#DC2626' : '#6B7280', fontWeight: 600 }}>{new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}

                {job.status === 'QUOTE_SUBMITTED' && job.quote_amount && (
                  <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.68rem', color: '#7C3AED', letterSpacing: '1px', marginBottom: '4px' }}>QUOTE RECEIVED</div>
                    <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#7C3AED' }}>${job.quote_amount}</div>
                    {job.quote_timeframe && <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>Timeframe: {job.quote_timeframe}</div>}
                    {job.vendor_note && <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '4px', fontStyle: 'italic' }}>"{job.vendor_note}"</div>}
                  </div>
                )}

                {job.scope_requested && job.status === 'PENDING_QUOTE' && (
                  <ScopeBlock job={job} userId={userId} onRefresh={onRefresh} />
                )}

                {activeDispute && <div style={{ fontSize: '0.75rem', color: '#DC2626', marginBottom: '10px', padding: '6px 10px', border: '1px solid #FEE2E2', borderRadius: '4px', background: '#FEF2F2' }}>⚠ Dispute: {activeDispute.category} · {activeDispute.severity}</div>}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {job.status === 'QUOTE_SUBMITTED' && (
                    <button onClick={() => onReviewQuote(job)} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>Review Quote</button>
                  )}
                  {job.status === 'PENDING_VERIFICATION' && !activeDispute && (
                    <ServiceReportInline job={job} onVerify={() => verifyWork(job)} onDispute={() => onDispute(job)} />
                  )}
                  {job.status === 'DISPUTED' && activeDispute && (
                    <button onClick={() => onRetract(job.id, activeDispute.id)} style={{ ...btnSecondary, fontSize: '0.78rem', padding: '6px 14px' }}>Retract Dispute</button>
                  )}
                  {job.status === 'DECLINED' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', color: '#DC2626' }}>Vendor declined this job.</span>
                      <button onClick={async () => { if (window.confirm('Delete this declined job?')) { await supabase.from('jobs').delete().eq('id', job.id); onRefresh(); } }} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '4px 10px', color: '#DC2626', borderColor: '#FEE2E2' }}>Dismiss</button>
                    </div>
                  )}
                  {job.status === 'QUOTE_DECLINED' && (
                    <span style={{ fontSize: '0.78rem', color: '#DC2626' }}>Quote declined — awaiting vendor revision.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page: Vendors ────────────────────────────────────────────────────────────

function VendorsPage({ userId, vendorConnections, connectedVendors, pendingVendors, locationServices, onRefresh }: {
  userId: string | null; vendorConnections: any[]; connectedVendors: any[]; pendingVendors: any[]; locationServices: any[]; onRefresh: () => void;
}) {
  const [vendorSearch, setVendorSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingConnectionId, setSendingConnectionId] = useState<string | null>(null);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const handleVendorSearch = async () => {
    if (!vendorSearch.trim()) return;
    setSearching(true); setSearchResults([]);
    const { data, error } = await supabase.from('vendors').select('id, company_name, full_name, service_type, contact_email').or(`contact_email.ilike.%${vendorSearch.trim()}%,company_name.ilike.%${vendorSearch.trim()}%`).limit(10);
    setSearching(false);
    if (error) alert('Search failed: ' + error.message);
    else setSearchResults(data || []);
  };

  const sendConnectionRequest = async (vendor: any) => {
    if (!userId) return;
    const existing = vendorConnections.find(c => c.vendor_id === vendor.id);
    if (existing?.status === 'accepted') { alert(`${vendor.company_name} is already connected.`); return; }
    if (existing?.status === 'pending') { alert(`A request is already pending for ${vendor.company_name}.`); return; }
    setSendingConnectionId(vendor.id);
    const { error } = await supabase.from('pm_vendor_connections').insert([{ pm_id: userId, vendor_id: vendor.id, status: 'pending' }]);
    setSendingConnectionId(null);
    if (error) alert('Failed to send request: ' + error.message);
    else { setSearchResults([]); setVendorSearch(''); onRefresh(); }
  };

  const handleCancelRequest = async (connectionId: string, vendorName: string) => {
    if (!window.confirm(`Cancel connection request to "${vendorName}"?`)) return;
    const { error } = await supabase.from('pm_vendor_connections').delete().eq('id', connectionId);
    if (error) alert('Failed to cancel: ' + error.message);
    else onRefresh();
  };

  const handleDisconnectVendor = async (vendor: any) => {
    if (!window.confirm(`Disconnect "${vendor.company_name}"?\n\nThis removes them from your network and all location assignments.\n\nThis cannot be undone.`)) return;
    await supabase.from('location_services').delete().eq('vendor_id', vendor.id);
    const { error } = await supabase.from('pm_vendor_connections').delete().eq('pm_id', userId).eq('vendor_id', vendor.id);
    if (error) alert('Failed to disconnect: ' + error.message);
    else onRefresh();
  };

  const generatePMInviteLink = async () => {
    if (!userId) return;
    setGeneratingInvite(true);
    try {
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
      const { data, error } = await supabase.from('invite_links').insert([{ created_by: userId, role: 'pm', expires_at: expiresAt.toISOString() }]).select('id').single();
      if (error || !data) { alert('Failed to generate invite link: ' + (error?.message || 'Unknown error')); return; }
      const link = `${window.location.origin}/invite/${data.id}`;
      await navigator.clipboard.writeText(link);
      setInviteLinkCopied(true); setTimeout(() => setInviteLinkCopied(false), 6000);
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setGeneratingInvite(false); }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '1rem', color: '#6B7280' }}>VENDOR NETWORK</h2>
      <div style={{ ...cardStyle, marginBottom: '24px' }}>
        <label style={labelStyle}>FIND A VENDOR BY EMAIL OR COMPANY NAME</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input placeholder="e.g. vendor@email.com or Acme Services" style={{ ...inputStyle, marginBottom: 0, flex: 1, minWidth: '200px' }} value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVendorSearch()} />
          <button onClick={handleVendorSearch} disabled={searching} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>{searching ? 'Searching...' : 'Search'}</button>
          <button onClick={generatePMInviteLink} disabled={generatingInvite} style={{ ...btnSecondary, whiteSpace: 'nowrap' }}>{generatingInvite ? 'Generating...' : '🔗 Generate Invite Link'}</button>
        </div>
        {inviteLinkCopied && <div style={{ marginTop: '12px', padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#16A34A' }}>✓</span><span style={{ color: '#16A34A', fontSize: '0.82rem', fontWeight: 600 }}>Link copied to clipboard — valid for 7 days</span></div>}
        {searchResults.length > 0 && (
          <div style={{ marginTop: '16px', display: 'grid', gap: '8px' }}>
            {searchResults.map(v => {
              const conn = vendorConnections.find(c => c.vendor_id === v.id);
              return (
                <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '6px', padding: '12px 14px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.9rem', color: '#1A1A1A' }}>{v.company_name || v.full_name}</p>
                    <p style={{ margin: '2px 0 0 0', color: '#6B7280', fontSize: '0.75rem' }}>{v.contact_email}</p>
                    {v.service_type && <p style={{ margin: '2px 0 0 0', color: '#9CA3AF', fontSize: '0.7rem' }}>{v.service_type}</p>}
                  </div>
                  {conn?.status === 'accepted' ? <span style={{ color: '#16A34A', fontSize: '0.7rem', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: '10px', background: '#F0FDF4' }}>CONNECTED</span>
                    : conn?.status === 'pending' ? <span style={{ color: '#D97706', fontSize: '0.7rem', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '10px', background: '#FFFBEB' }}>PENDING</span>
                    : <button onClick={() => sendConnectionRequest(v)} disabled={sendingConnectionId === v.id} style={{ ...btnPrimary, fontSize: '0.75rem', padding: '6px 12px' }}>{sendingConnectionId === v.id ? 'Sending...' : 'Connect'}</button>}
                </div>
              );
            })}
          </div>
        )}
        {searchResults.length === 0 && vendorSearch && !searching && <p style={{ margin: '12px 0 0 0', color: '#9CA3AF', fontSize: '0.8rem' }}>No vendors found. Make sure they have registered on Lantell.</p>}
      </div>

      {pendingVendors.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#D97706', letterSpacing: '1px', marginBottom: '12px' }}>PENDING REQUESTS ({pendingVendors.length})</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {pendingVendors.map(conn => (
              <div key={conn.id} style={{ ...cardStyle, borderColor: '#FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#1A1A1A' }}>{conn.vendors?.company_name || conn.vendors?.full_name}</p>
                  <p style={{ margin: '2px 0 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{conn.vendors?.contact_email}</p>
                  <p style={{ margin: '4px 0 0 0', color: '#D97706', fontSize: '0.7rem' }}>Awaiting vendor acceptance</p>
                </div>
                <button onClick={() => handleCancelRequest(conn.id, conn.vendors?.company_name || 'vendor')} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '6px 12px', color: '#DC2626', borderColor: '#FEE2E2' }}>Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: '0.8rem', color: '#6B7280', letterSpacing: '1px', marginBottom: '12px' }}>CONNECTED VENDORS ({connectedVendors.length})</h3>
      {connectedVendors.length === 0 ? (
        <div style={emptyState}><p style={{ margin: 0 }}>No connected vendors yet. Search above to get started.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {connectedVendors.map(v => (
            <div key={v.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#1A1A1A' }}>{v.company_name}</h3>
                <p style={{ margin: 0, color: '#6B7280', fontSize: '0.8rem' }}>{v.contact_email}</p>
                {v.service_type && <p style={{ margin: '4px 0 0 0', color: '#9CA3AF', fontSize: '0.75rem' }}>{v.service_type}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#16A34A', fontSize: '0.7rem', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: '10px', background: '#F0FDF4' }}>CONNECTED</span>
                <button onClick={() => handleDisconnectVendor(v)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }} onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')} onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page: Locations ──────────────────────────────────────────────────────────

function LocationsPage({ userId, locations, jobs, locationServices, connectedVendors, onRefresh, onCreateJob }: {
  userId: string | null; locations: any[]; jobs: any[]; locationServices: any[]; connectedVendors: any[]; onRefresh: () => void; onCreateJob: (locId: string) => void;
}) {
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLoc, setNewLoc] = useState({ label: '', address: '' });
  const [assigningLocationId, setAssigningLocationId] = useState<string | null>(null);
  const [selectedVendorToAssign, setSelectedVendorToAssign] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const handleAddLocation = async () => {
    if (!newLoc.label || !newLoc.address) return alert('Please fill in all fields');
    if (!userId) return;
    const { error } = await supabase.from('locations').insert([{ ...newLoc, owner_id: userId }]);
    if (error) alert('Error adding location: ' + error.message);
    else { setShowAddLocation(false); setNewLoc({ label: '', address: '' }); onRefresh(); }
  };

  const handleDeleteLocation = async (loc: any) => {
    const linkedJobs = jobs.filter(j => j.location_id === loc.id);
    const activeJobs = linkedJobs.filter(j => !['VERIFIED'].includes(j.status));
    const message = activeJobs.length > 0 ? `Delete "${loc.label}"?\n\nWARNING: This location has ${activeJobs.length} active job(s) that will also be permanently deleted.\n\nThis cannot be undone.` : linkedJobs.length > 0 ? `Delete "${loc.label}"?\n\nThis will also delete ${linkedJobs.length} completed job(s). Vault records will be removed.\n\nThis cannot be undone.` : `Delete "${loc.label}"?\n\nThis cannot be undone.`;
    if (!window.confirm(message)) return;
    await supabase.from('location_services').delete().eq('location_id', loc.id);
    const { error } = await supabase.from('locations').delete().eq('id', loc.id);
    if (error) alert('Failed to delete location: ' + error.message);
    else onRefresh();
  };

  const handleUnassignVendor = async (lsId: string, vendorName: string, locationLabel: string) => {
    if (!window.confirm(`Unassign "${vendorName}" from "${locationLabel}"?\n\nThis only removes them from this location. They stay connected to your account.`)) return;
    const { error } = await supabase.from('location_services').delete().eq('id', lsId);
    if (error) alert('Failed to unassign: ' + error.message);
    else onRefresh();
  };

  const sendVendorLocationAssignment = async (locationId: string) => {
    if (!selectedVendorToAssign) return alert('Please select a vendor first.');
    if (!userId) return;
    const existing = locationServices.find(ls => ls.location_id === locationId && ls.vendor_id === selectedVendorToAssign);
    if (existing) return alert('This vendor is already assigned to this location.');
    setSendingRequest(true);
    const loc = locations.find(l => l.id === locationId);
    const { error } = await supabase.from('location_services').insert([{ location_id: locationId, vendor_id: selectedVendorToAssign, requested_by: userId, status: 'accepted' }]);
    setSendingRequest(false);
    if (error) alert('Failed to assign: ' + error.message);
    else {
      const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', selectedVendorToAssign).single();
      if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Assigned to New Location', body: `You have been assigned to ${loc?.label || 'a new location'}.`, link: '/vendor' });
      setAssigningLocationId(null); setSelectedVendorToAssign(''); onRefresh();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', color: '#6B7280' }}>MANAGED PROPERTIES ({locations.length})</h2>
        <button onClick={() => setShowAddLocation(!showAddLocation)} style={btnPrimary}>{showAddLocation ? 'Cancel' : '+ Add Property'}</button>
      </div>
      {showAddLocation && (
        <div style={{ ...cardStyle, marginBottom: '20px', borderColor: '#2563EB' }}>
          <label style={labelStyle}>PROPERTY NAME</label>
          <input placeholder="e.g. Sunset Apartments" style={inputStyle} value={newLoc.label} onChange={e => setNewLoc({ ...newLoc, label: e.target.value })} />
          <label style={labelStyle}>ADDRESS</label>
          <input placeholder="Full address" style={inputStyle} value={newLoc.address} onChange={e => setNewLoc({ ...newLoc, address: e.target.value })} />
          <button onClick={handleAddLocation} style={{ ...btnPrimary, width: '100%' }}>Save Property</button>
        </div>
      )}
      {locations.length === 0 ? (
        <div style={emptyState}><p style={{ margin: 0 }}>No properties yet. Add your first location above.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {locations.map(loc => {
            const locAssignments = locationServices.filter(ls => ls.location_id === loc.id);
            const locJobs = jobs.filter(j => j.location_id === loc.id && j.status !== 'VERIFIED');
            return (
              <div key={loc.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, color: '#1A1A1A' }}>{loc.label}</h3>
                  <button onClick={() => handleDeleteLocation(loc)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }} onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')} onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>✕</button>
                </div>
                <p style={{ margin: '0 0 8px 0', color: '#6B7280', fontSize: '0.85rem' }}>{loc.address}</p>
                {locJobs.length > 0 && <div style={{ marginBottom: '10px', fontSize: '0.75rem', color: '#6B7280' }}>{locJobs.length} active job{locJobs.length !== 1 ? 's' : ''}</div>}
                {locAssignments.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    {locAssignments.map(ls => (
                      <div key={ls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', marginBottom: '4px', background: '#F9FAFB', borderRadius: '4px', border: '1px solid #E5E3DF' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{ls.vendors?.company_name || ls.vendors?.full_name || 'Unknown vendor'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#16A34A', border: '1px solid #BBF7D0', padding: '2px 6px', borderRadius: '10px', background: '#F0FDF4' }}>ASSIGNED</span>
                          <button onClick={() => handleUnassignVendor(ls.id, ls.vendors?.company_name || 'Vendor', loc.label)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: '0.7rem', padding: '1px 4px' }} onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')} onMouseLeave={e => (e.currentTarget.style.color = '#D1D5DB')}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => onCreateJob(loc.id)} style={{ ...btnPrimary, width: '100%', marginBottom: '10px' }}>+ Create Job</button>
                {connectedVendors.length > 0 && (
                  assigningLocationId === loc.id ? (
                    <div style={{ background: '#F9FAFB', padding: '12px', borderRadius: '6px', border: '1px solid #E5E3DF' }}>
                      <select style={{ ...inputStyle, marginBottom: '10px' }} value={selectedVendorToAssign} onChange={e => setSelectedVendorToAssign(e.target.value)}>
                        <option value="">-- Select Vendor --</option>
                        {connectedVendors.map(v => { const alreadyAssigned = locationServices.some(ls => ls.location_id === loc.id && ls.vendor_id === v.id); return <option key={v.id} value={v.id} disabled={alreadyAssigned}>{v.company_name}{alreadyAssigned ? ' (assigned)' : ''}</option>; })}
                      </select>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => sendVendorLocationAssignment(loc.id)} disabled={sendingRequest} style={{ ...btnPrimary, flex: 1 }}>{sendingRequest ? 'Assigning...' : 'Assign'}</button>
                        <button onClick={() => { setAssigningLocationId(null); setSelectedVendorToAssign(''); }} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningLocationId(loc.id)} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '6px 12px', width: '100%' }}>+ Assign Vendor</button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page: Vault ──────────────────────────────────────────────────────────────

function VaultPage({ vaultJobs, vaultLoading, vaultLoaded, onRefreshVault }: { vaultJobs: any[]; vaultLoading: boolean; vaultLoaded: boolean; onRefreshVault: () => void; }) {
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set());
  const vaultLabelStyle: React.CSSProperties = { fontSize: '0.65rem', color: '#9CA3AF', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' };

  const vaultByLocation = useMemo(() => {
    const groups: Record<string, { locId: string; label: string; address: string; jobs: any[] }> = {};
    for (const job of vaultJobs) { const locId = job.location_id || 'unknown'; if (!groups[locId]) groups[locId] = { locId, label: job.locations?.label || 'Unknown Location', address: job.locations?.address || '', jobs: [] }; groups[locId].jobs.push(job); }
    return Object.values(groups);
  }, [vaultJobs]);

  const toggleLocation = (locId: string) => { setCollapsedLocations(prev => { const next = new Set(prev); if (next.has(locId)) next.delete(locId); else next.add(locId); return next; }); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#1A1A1A' }}>THE VAULT</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280' }}>Immutable ledger of all verified service records · {vaultJobs.length} entr{vaultJobs.length === 1 ? 'y' : 'ies'}</p>
        </div>
        {vaultLoaded && !vaultLoading && <button onClick={onRefreshVault} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '5px 12px' }}>↻ Refresh</button>}
      </div>
      {vaultLoading && <div style={{ ...emptyState, border: '1px solid #E5E3DF' }}><p style={{ margin: 0, color: '#9CA3AF' }}>Loading vault records…</p></div>}
      {!vaultLoading && vaultLoaded && vaultJobs.length === 0 && <div style={emptyState}><p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#6B7280' }}>No verified records yet.</p><p style={{ margin: 0 }}>Jobs will appear here once they reach VERIFIED status.</p></div>}
      {!vaultLoading && vaultByLocation.map(group => (
        <div key={group.locId} style={{ marginBottom: '28px' }}>
          <button onClick={() => toggleLocation(group.locId)} style={{ width: '100%', background: '#F5F4F0', border: '1px solid #E5E3DF', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', marginBottom: '12px', borderRadius: '6px', textAlign: 'left' } as React.CSSProperties}>
            <div><span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1A1A1A' }}>{group.label}</span><span style={{ marginLeft: '10px', fontSize: '0.75rem', color: '#9CA3AF' }}>{group.address}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '10px', background: '#EFF6FF' }}>{group.jobs.length} VERIFIED</span>
              <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{collapsedLocations.has(group.locId) ? '▶' : '▼'}</span>
            </div>
          </button>
          {!collapsedLocations.has(group.locId) && (
            <div style={{ display: 'grid', gap: '16px', paddingLeft: '4px' }}>
              {group.jobs.map(job => {
                const report = Array.isArray(job.service_reports) ? job.service_reports[0] : job.service_reports;
                const dispute = Array.isArray(job.disputes) ? job.disputes[0] : job.disputes;
                const isDisputed = !!dispute;
                return (
                  <div key={job.id} style={{ background: '#FFFFFF', border: '1px solid #E5E3DF', borderLeft: `4px solid ${isDisputed ? '#D97706' : '#2563EB'}`, borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#2563EB', letterSpacing: '1px', border: '1px solid #BFDBFE', padding: '2px 7px', borderRadius: '10px', background: '#EFF6FF' }}>VERIFIED</span>
                        {isDisputed && <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#D97706', letterSpacing: '1px', border: '1px solid #FDE68A', padding: '2px 7px', borderRadius: '10px', background: '#FFFBEB' }}>DISPUTED</span>}
                        <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>#{job.id.slice(0, 8)}</span>
                      </div>
                      <button onClick={() => exportVaultEntryPDF(job)} style={{ ...btnSecondary, fontSize: '0.75rem', padding: '5px 12px', whiteSpace: 'nowrap' }}>↓ Export PDF</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '8px 12px', background: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E3DF' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#1A1A1A' }}>{job.vendors?.company_name || '—'}</span>
                      {job.vendors?.service_type && <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>{job.vendors.service_type}</span>}
                    </div>
                    <div style={{ marginBottom: '14px' }}><div style={vaultLabelStyle}>DESCRIPTION</div><p style={{ margin: 0, color: '#1A1A1A', fontSize: '0.9rem', lineHeight: 1.5 }}>{job.description}</p></div>
                    {job.objectives && <div style={{ marginBottom: '14px' }}><div style={vaultLabelStyle}>OBJECTIVES</div><p style={{ margin: 0, color: '#6B7280', fontSize: '0.85rem', lineHeight: 1.5 }}>{job.objectives}</p></div>}
                    {job.quote_amount && <div style={{ marginBottom: '14px' }}><div style={vaultLabelStyle}>AGREED AMOUNT</div><p style={{ margin: 0, color: '#D97706', fontWeight: 'bold', fontSize: '0.9rem' }}>${job.quote_amount}</p></div>}
                    <div style={{ marginBottom: '14px', paddingTop: '14px', borderTop: '1px solid #F3F4F6' }}>
                      <div style={vaultLabelStyle}>TIMELINE</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>CREATED</div><div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{formatDate(job.created_at)}</div></div>
                        <div><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>VERIFIED</div><div style={{ fontSize: '0.8rem', color: '#2563EB', fontWeight: 600 }}>{formatDate(job.verified_at)}</div></div>
                      </div>
                    </div>
                    {report && (
                      <div style={{ marginBottom: '14px', paddingTop: '14px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={vaultLabelStyle}>SERVICE REPORT</div>
                        {report.notes && <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>VENDOR NOTES</div><p style={{ margin: 0, color: '#6B7280', fontSize: '0.85rem', lineHeight: 1.5 }}>{report.notes}</p></div>}
                        {report.photo_urls?.length > 0 && <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{report.photo_urls.length} photo(s) on file</div>}
                        <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginTop: '4px' }}>SUBMITTED {formatDate(report.submitted_at)}</div>
                      </div>
                    )}
                    {isDisputed && (
                      <div style={{ marginTop: '14px', padding: '14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#D97706', letterSpacing: '1px', marginBottom: '10px' }}>DISPUTE RECORD</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>CATEGORY</div><div style={{ fontSize: '0.8rem', color: '#1A1A1A' }}>{dispute.category}</div></div>
                          <div><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>SEVERITY</div><div style={{ fontSize: '0.8rem', color: '#1A1A1A', textTransform: 'uppercase' }}>{dispute.severity}</div></div>
                        </div>
                        {dispute.resolution && <div style={{ marginTop: '8px' }}><div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginBottom: '2px' }}>RESOLUTION</div><div style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>{dispute.resolution}</div></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page: Settings ───────────────────────────────────────────────────────────

function SettingsPage({ userId, profile, editProfile, setEditProfile }: {
  userId: string | null; profile: PMProfile | null; editProfile: PMProfile | null; setEditProfile: React.Dispatch<React.SetStateAction<PMProfile | null>>;
}) {
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = async () => {
    if (!userId || !editProfile) return;
    setSavingProfile(true);
    const { error } = await supabase.from('pm_profiles').update({ full_name: editProfile.full_name, company_name: editProfile.company_name, address: editProfile.address }).eq('id', userId);
    if (error) alert('Failed to save: ' + error.message);
    else { setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); }
    setSavingProfile(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1rem', color: '#6B7280', marginBottom: '20px' }}>ACCOUNT SETTINGS</h2>
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '0.9rem', letterSpacing: '1px', color: '#6B7280' }}>BUSINESS PROFILE</h3>
        <label style={labelStyle}>FULL NAME</label>
        <input style={inputStyle} value={editProfile?.full_name || ''} onChange={e => setEditProfile(p => p ? { ...p, full_name: e.target.value } : p)} />
        <label style={labelStyle}>COMPANY NAME</label>
        <input style={inputStyle} value={editProfile?.company_name || ''} onChange={e => setEditProfile(p => p ? { ...p, company_name: e.target.value } : p)} />
        <label style={labelStyle}>PRIMARY ADDRESS</label>
        <input style={inputStyle} value={editProfile?.address || ''} onChange={e => setEditProfile(p => p ? { ...p, address: e.target.value } : p)} />
        <button onClick={handleSaveProfile} disabled={savingProfile} style={btnPrimary}>{savingProfile ? 'Saving...' : profileSaved ? '✓ Saved' : 'Save Changes'}</button>
      </div>
    </div>
  );
}

// ─── Nav types ────────────────────────────────────────────────────────────────

type PageKey = 'DASHBOARD' | 'CALENDAR' | 'SERVICES' | 'VENDORS' | 'LOCATIONS' | 'VAULT' | 'SETTINGS';

const NAV_ITEMS: { key: PageKey; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { key: 'DASHBOARD', label: 'Dashboard', icon: <IconDashboard /> },
  { key: 'CALENDAR', label: 'Calendar', icon: <IconCalendar /> },
  { key: 'SERVICES', label: 'Services', icon: <IconServices /> },
  { key: 'VENDORS', label: 'Vendors', icon: <IconVendors /> },
  { key: 'LOCATIONS', label: 'Locations', icon: <IconLocations /> },
  { key: 'VAULT', label: 'Vault', icon: <IconVault /> },
];

const BOTTOM_NAV: { key: PageKey; label: string; icon: React.ReactNode; comingSoon?: boolean }[] = [
  { key: 'SETTINGS' as PageKey, label: 'Intelligence', icon: <IconIntelligence />, comingSoon: true },
  { key: 'SETTINGS', label: 'Settings', icon: <IconSettings /> },
];

// ─── PaymentForm (Stripe Elements sub-component) ──────────────────────────────

function PaymentForm({ job, onSuccess, onDecline }: {
  job: any;
  onSuccess: (paymentIntentId: string) => void;
  onDecline: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    setCardError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('https://guuctgeqzwbfgwmrgfez.supabase.co/functions/v1/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ jobId: job.id, amount: Math.round(job.quote_amount * 100) }),
      });
      const { clientSecret, error: fnError } = await res.json();
      if (fnError) throw new Error(fnError);

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });
      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      setCardError(err.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>CARD DETAILS</label>
        <div style={{ border: '1px solid #E5E3DF', borderRadius: '6px', padding: '12px 14px', background: '#FFFFFF' }}>
          <CardElement options={cardElementOptions} />
        </div>
        {cardError && <div style={{ marginTop: '8px', color: '#DC2626', fontSize: '0.8rem' }}>{cardError}</div>}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '16px', lineHeight: 1.4 }}>
        Payment is held in escrow and released to the vendor upon work verification. A 5% platform fee applies.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onDecline} disabled={paying} style={{ ...btnSecondary, flex: 1, color: '#DC2626', borderColor: '#FEE2E2' }}>Decline Quote</button>
        <button onClick={handlePay} disabled={paying || !stripe} style={{ ...btnPrimary, flex: 1, opacity: paying || !stripe ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          {paying ? (
            <>
              <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#FFFFFF', borderRadius: '50%', display: 'inline-block', animation: '__lt_spin 0.6s linear infinite' }} />
              Processing…
            </>
          ) : `Pay $${job.quote_amount} & Authorise`}
        </button>
      </div>
    </div>
  );
}

// ─── Main PMDashboard ─────────────────────────────────────────────────────────

export function PMDashboard() {
  const [page, setPage] = useState<PageKey>('DASHBOARD');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PMProfile | null>(null);
  const [editProfile, setEditProfile] = useState<PMProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [locationServices, setLocationServices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [vendorConnections, setVendorConnections] = useState<any[]>([]);
  const [connectedVendors, setConnectedVendors] = useState<any[]>([]);
  const [pendingVendors, setPendingVendors] = useState<any[]>([]);
  const [vaultJobs, setVaultJobs] = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [smartBookingLocationId, setSmartBookingLocationId] = useState<string | null>(null);
  const [disputeJob, setDisputeJob] = useState<any | null>(null);
  const [retractInfo, setRetractInfo] = useState<{ jobId: string; disputeId: string } | null>(null);
  const [reviewingQuoteJob, setReviewingQuoteJob] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  useEffect(() => {
    const id = 'lt-notif-slide';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = '@keyframes __lt_slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } } @keyframes __lt_spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    if (!showNotifPanel) return;
    const t = setTimeout(() => markNotificationsRead(), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifPanel]);

  useEffect(() => { initDashboard(); }, []);
  useEffect(() => { if (page === 'VAULT' && !vaultLoaded) loadVaultData(); }, [page, vaultLoaded]);

  async function initDashboard() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: pmProfile } = await supabase.from('pm_profiles').select('*').eq('id', user.id).single();
    if (pmProfile) { setProfile(pmProfile); setEditProfile(pmProfile); }
    await loadSystemData(user.id);
  }

  async function loadSystemData(uid: string) {
    try {
      const [{ data: jobData }, { data: locData }, { data: lsData }, { data: connData }, { data: notifData }] = await Promise.all([
        supabase.from('jobs').select('*, locations(label, address), vendors(id, company_name, full_name, stripe_account_id), disputes(id, category, severity, resolution), stripe_payment_intent_id, stripe_transfer_id'),
        supabase.from('locations').select('*'),
        supabase.from('location_services').select('*, vendors(id, company_name, full_name, service_type, contact_email), locations(label)'),
        supabase.from('pm_vendor_connections').select('*, vendors(id, company_name, full_name, service_type, contact_email)').eq('pm_id', uid),
        supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
      ]);
      if (jobData) setJobs(jobData);
      if (locData) setLocations(locData);
      if (lsData) setLocationServices(lsData);
      if (notifData) setNotifications(notifData);
      if (connData) { setVendorConnections(connData); setConnectedVendors(connData.filter((c: any) => c.status === 'accepted').map((c: any) => c.vendors).filter(Boolean)); setPendingVendors(connData.filter((c: any) => c.status === 'pending')); }
    } catch (error) { console.error('Load error:', error); }
    finally { setLoading(false); }
  }

  async function loadVaultData() {
    setVaultLoading(true);
    const { data, error } = await supabase.from('jobs').select('*, locations(label, address), vendors(company_name, full_name, service_type), service_reports(notes, objectives_completed, photo_urls, submitted_at), disputes(category, severity, resolution, retraction_reason, resolved_at)').eq('status', 'VERIFIED').order('verified_at', { ascending: false });
    if (!error && data) setVaultJobs(data);
    setVaultLoading(false); setVaultLoaded(true);
  }

  const markNotificationsRead = async () => {
    const hasUnread = notifications.some(n => !n.read);
    if (!hasUnread || !userId) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const acceptQuote = async (job: any, paymentIntentId?: string) => {
    const updateData: any = { status: 'IN_PROGRESS' };
    if (paymentIntentId) updateData.stripe_payment_intent_id = paymentIntentId;
    const { error } = await supabase.from('jobs').update(updateData).eq('id', job.id);
    if (error) return alert('Failed: ' + error.message);
    const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', job.vendor_id).single();
    if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Quote Accepted — Work Approved', body: `Your quote for "${job.description.slice(0, 60)}" has been accepted. You can now begin work.`, link: '/vendor' });
    setReviewingQuoteJob(null);
    if (userId) loadSystemData(userId);
  };

  const declineQuote = async (job: any) => {
    const isSecondDecline = !!job.decline_reason;
    const message = isSecondDecline ? `Decline this quote again?\n\nThis is the second decline. The job will be permanently deleted.\n\nThis cannot be undone.` : `Decline this quote?\n\nThe vendor will be notified and can submit a revised quote. If you decline again, the job will be permanently deleted.`;
    if (!window.confirm(message)) return;
    const { data: vd } = await supabase.from('vendors').select('owner_id').eq('id', job.vendor_id).single();
    if (isSecondDecline) {
      if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Quote Declined — Job Closed', body: `Your revised quote for "${job.description.slice(0, 60)}" was declined. The job has been closed.`, link: '/vendor' });
      await supabase.from('jobs').delete().eq('id', job.id);
    } else {
      await supabase.from('jobs').update({ status: 'QUOTE_DECLINED', decline_reason: 'first_decline' }).eq('id', job.id);
      if (vd?.owner_id) await supabase.from('notifications').insert({ user_id: vd.owner_id, title: 'Quote Declined — Revision Welcome', body: `Your quote for "${job.description.slice(0, 60)}" was declined. You can submit a revised quote or withdraw.`, link: '/vendor' });
    }
    setReviewingQuoteJob(null);
    if (userId) loadSystemData(userId);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FAF9F7', color: '#9CA3AF', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>Loading…</div>;

  // ── Page title map
  const pageTitles: Record<PageKey, string> = { DASHBOARD: 'Dashboard', CALENDAR: 'Calendar', SERVICES: 'Services', VENDORS: 'Vendors', LOCATIONS: 'Locations', VAULT: 'Vault', SETTINGS: 'Settings' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF9F7', fontFamily: 'sans-serif' }}>

      {/* ── SIDEBAR (desktop) ──────────────────────────────────────────────── */}
      {!isMobile && (
        <aside style={{ width: '240px', flexShrink: 0, background: '#FFFFFF', borderRight: '1px solid #E5E3DF', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
          {/* Wordmark */}
          <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #E5E3DF' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: '700', letterSpacing: '2px', color: '#1A1A1A', fontFamily: 'sans-serif' }}>Lantell</div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
            {NAV_ITEMS.map(item => {
              const active = page === item.key;
              const hasBadge = item.key === 'SERVICES' && unreadCount > 0;
              return (
                <button key={item.key} onClick={() => setPage(item.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', border: 'none', background: active ? '#EFF6FF' : 'transparent', borderLeft: `3px solid ${active ? '#2563EB' : 'transparent'}`, color: active ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: '0.88rem', fontWeight: active ? 600 : 400, textAlign: 'left', position: 'relative', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F9FAFB'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  {item.icon}
                  {item.label}
                  {hasBadge && <span style={{ position: 'absolute', right: '16px', background: '#DC2626', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
              );
            })}
          </nav>

          {/* Bottom nav */}
          <div style={{ borderTop: '1px solid #E5E3DF', padding: '12px 0' }}>
            {/* Intelligence (coming soon) */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', color: '#C4C2BE', fontSize: '0.88rem', cursor: 'default' }}>
              <IconIntelligence />
              Intelligence
              <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 'bold', background: '#F3F4F6', color: '#9CA3AF', border: '1px solid #E5E3DF', padding: '2px 6px', borderRadius: '10px', whiteSpace: 'nowrap' }}>SOON</span>
            </div>
            {/* Settings */}
            <button onClick={() => setPage('SETTINGS')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', border: 'none', background: page === 'SETTINGS' ? '#EFF6FF' : 'transparent', borderLeft: `3px solid ${page === 'SETTINGS' ? '#2563EB' : 'transparent'}`, color: page === 'SETTINGS' ? '#2563EB' : '#6B7280', cursor: 'pointer', fontSize: '0.88rem', fontWeight: page === 'SETTINGS' ? 600 : 400, textAlign: 'left' }}
              onMouseEnter={e => { if (page !== 'SETTINGS') e.currentTarget.style.background = '#F9FAFB'; }}
              onMouseLeave={e => { if (page !== 'SETTINGS') e.currentTarget.style.background = 'transparent'; }}>
              <IconSettings />
              Settings
            </button>
            {/* User info */}
            <div style={{ padding: '12px 20px 8px', borderTop: '1px solid #F3F4F6', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 'bold', color: '#2563EB', flexShrink: 0 }}>
                  {(profile?.full_name || 'PM').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name || 'Property Manager'}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>Property Manager</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: isMobile ? 0 : '240px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Top bar */}
        <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E3DF', padding: isMobile ? '12px 16px' : '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#1A1A1A', letterSpacing: '0.5px' }}>{pageTitles[page]}</div>
            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '1px' }}>{profile?.company_name || 'Property Manager'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { setShowNotifPanel(p => !p); }} style={{ position: 'relative', background: showNotifPanel ? '#EFF6FF' : 'transparent', border: `1px solid ${showNotifPanel ? '#BFDBFE' : '#E5E3DF'}`, borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <IconBell color={showNotifPanel ? '#2563EB' : '#6B7280'} />
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#DC2626', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: isMobile ? '16px' : '28px', maxWidth: '1100px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {page === 'DASHBOARD' && (
            <DashboardHome jobs={jobs} locations={locations} notifications={notifications} onNavigate={setPage} />
          )}
          {page === 'CALENDAR' && (
            <CalendarPage jobs={jobs} />
          )}
          {page === 'SERVICES' && (
            <ServicesPage
              jobs={jobs}
              userId={userId}
              onRefresh={() => { if (userId) loadSystemData(userId); }}
              onDispute={setDisputeJob}
              onRetract={(jobId, disputeId) => setRetractInfo({ jobId, disputeId })}
              onReviewQuote={setReviewingQuoteJob}
            />
          )}
          {page === 'VENDORS' && (
            <VendorsPage
              userId={userId}
              vendorConnections={vendorConnections}
              connectedVendors={connectedVendors}
              pendingVendors={pendingVendors}
              locationServices={locationServices}
              onRefresh={() => { if (userId) loadSystemData(userId); }}
            />
          )}
          {page === 'LOCATIONS' && (
            <LocationsPage
              userId={userId}
              locations={locations}
              jobs={jobs}
              locationServices={locationServices}
              connectedVendors={connectedVendors}
              onRefresh={() => { if (userId) loadSystemData(userId); }}
              onCreateJob={setSmartBookingLocationId}
            />
          )}
          {page === 'VAULT' && (
            <VaultPage
              vaultJobs={vaultJobs}
              vaultLoading={vaultLoading}
              vaultLoaded={vaultLoaded}
              onRefreshVault={() => setVaultLoaded(false)}
            />
          )}
          {page === 'SETTINGS' && (
            <SettingsPage
              userId={userId}
              profile={profile}
              editProfile={editProfile}
              setEditProfile={setEditProfile}
            />
          )}
        </main>

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderTop: '1px solid #E5E3DF', display: 'flex', zIndex: 100, padding: '8px 0 4px' }}>
            {[...NAV_ITEMS, { key: 'SETTINGS' as PageKey, label: 'Settings', icon: <IconSettings /> }].map(item => {
              const active = page === item.key;
              return (
                <button key={item.key} onClick={() => setPage(item.key)} style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: active ? '#2563EB' : '#9CA3AF', padding: '4px 2px' }}>
                  {item.icon}
                  <span style={{ fontSize: active ? '0.6rem' : '0', fontWeight: 600, letterSpacing: '0.5px', overflow: 'hidden', maxHeight: active ? '12px' : '0', transition: 'all 0.15s' }}>{item.label.toUpperCase()}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      {smartBookingLocationId && <SmartBooking locationId={smartBookingLocationId} onClose={() => setSmartBookingLocationId(null)} onJobCreated={() => { setSmartBookingLocationId(null); setPage('SERVICES'); if (userId) loadSystemData(userId); }} />}
      {disputeJob && <DisputePortal job={disputeJob} onClose={() => setDisputeJob(null)} onDisputeFiled={() => { if (userId) loadSystemData(userId); }} />}
      {retractInfo && <RetractModal jobId={retractInfo.jobId} disputeId={retractInfo.disputeId} onClose={() => setRetractInfo(null)} onRetracted={() => { if (userId) loadSystemData(userId); }} />}

      {reviewingQuoteJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '10px', padding: '30px', width: '100%', maxWidth: '480px', fontFamily: 'sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div><h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#1A1A1A' }}>REVIEW QUOTE</h3><p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.82rem' }}>{reviewingQuoteJob.locations?.label}</p></div>
              <button onClick={() => setReviewingQuoteJob(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ marginBottom: '16px', padding: '14px', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '4px' }}>JOB</div>
              <p style={{ margin: 0, color: '#1A1A1A', fontSize: '0.9rem' }}>{reviewingQuoteJob.description}</p>
              <p style={{ margin: '6px 0 0 0', color: '#6B7280', fontSize: '0.8rem' }}>Vendor: {reviewingQuoteJob.vendors?.company_name}</p>
            </div>
            <div style={{ marginBottom: '20px', padding: '16px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.68rem', color: '#7C3AED', letterSpacing: '1px', marginBottom: '8px' }}>VENDOR QUOTE</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#7C3AED', marginBottom: '6px' }}>${reviewingQuoteJob.quote_amount}</div>
              {reviewingQuoteJob.quote_timeframe && <div style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '6px' }}>Timeframe: {reviewingQuoteJob.quote_timeframe}</div>}
              {reviewingQuoteJob.vendor_note && <div style={{ fontSize: '0.85rem', color: '#6B7280', fontStyle: 'italic' }}>"{reviewingQuoteJob.vendor_note}"</div>}
              {reviewingQuoteJob.scope_requested && <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#7C3AED' }}>📋 Based on scope visit</div>}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '20px', lineHeight: 1.5 }}>Accepting this quote authorises the vendor to proceed with the work.{' '}{reviewingQuoteJob?.decline_reason ? "This is the vendor's revised quote. Declining again will permanently delete this job." : 'Declining will give the vendor one chance to submit a revised quote.'}</p>
            {reviewingQuoteJob.vendors?.stripe_account_id ? (
              <Elements stripe={stripePromise}>
                <PaymentForm
                  job={reviewingQuoteJob}
                  onSuccess={(paymentIntentId) => acceptQuote(reviewingQuoteJob, paymentIntentId)}
                  onDecline={() => declineQuote(reviewingQuoteJob)}
                />
              </Elements>
            ) : (
              <>
                <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', fontSize: '0.78rem', color: '#D97706' }}>
                  ⚠ This vendor hasn't connected a bank account yet. Accepting will authorise work without payment capture.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => declineQuote(reviewingQuoteJob)} style={{ ...btnSecondary, flex: 1, color: '#DC2626', borderColor: '#FEE2E2' }}>Decline Quote</button>
                  <button onClick={() => acceptQuote(reviewingQuoteJob)} style={{ ...btnPrimary, flex: 1 }}>Accept & Authorise</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Notification panel */}
      {showNotifPanel && (
        <>
          <div onClick={() => setShowNotifPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 900 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh', background: '#FFFFFF', borderLeft: '1px solid #E5E3DF', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', zIndex: 901, display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif', animation: '__lt_slideIn 0.2s ease-out' }}>
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E5E3DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#1A1A1A' }}>NOTIFICATIONS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {unreadCount > 0 && <button onClick={markNotificationsRead} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#2563EB', cursor: 'pointer', padding: 0, fontFamily: 'sans-serif' }}>Mark all read</button>}
                <button onClick={() => setShowNotifPanel(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No notifications yet</div>
              ) : notifications.map(notif => (
                <div key={notif.id} onClick={async () => { if (!notif.read) { await supabase.from('notifications').update({ read: true }).eq('id', notif.id); setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n)); } }} style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', borderLeft: notif.read ? '3px solid transparent' : '3px solid #2563EB', backgroundColor: notif.read ? '#FFFFFF' : '#F8FBFF', cursor: notif.read ? 'default' : 'pointer' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: notif.read ? 'normal' : 600, color: '#1A1A1A', marginBottom: '3px', lineHeight: 1.4 }}>{notif.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.4, marginBottom: '6px' }}>{notif.body}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{timeAgo(notif.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared style constants ───────────────────────────────────────────────────

const cardStyle: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const btnPrimary: React.CSSProperties = { background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '9px 18px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '0.5px' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', padding: '9px 18px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.85rem' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '11px 14px', marginBottom: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '7px' };
const emptyState: React.CSSProperties = { border: '1px dashed #E5E3DF', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' };

export default PMDashboard;