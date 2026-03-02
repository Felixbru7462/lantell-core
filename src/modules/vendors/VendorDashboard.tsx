import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { PhotoUpload } from '../../components/PhotoUpload';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatScopeDate(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING_ACCEPTANCE: 'Pending Your Acceptance',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  PENDING_QUOTE: 'Pending Your Quote',
  QUOTE_SUBMITTED: 'Quote Submitted',
  QUOTE_ACCEPTED: 'Quote Accepted',
  QUOTE_DECLINED: 'Quote Declined',
  IN_PROGRESS: 'In Progress',
  PENDING_VERIFICATION: 'Pending Client Verification',
  VERIFIED: 'Verified',
  DISPUTED: 'Disputed',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_ACCEPTANCE: '#D97706',
  ACCEPTED: '#2563EB',
  DECLINED: '#DC2626',
  PENDING_QUOTE: '#D97706',
  QUOTE_SUBMITTED: '#7C3AED',
  QUOTE_ACCEPTED: '#2563EB',
  QUOTE_DECLINED: '#DC2626',
  IN_PROGRESS: '#2563EB',
  PENDING_VERIFICATION: '#D97706',
  VERIFIED: '#16A34A',
  DISPUTED: '#DC2626',
};

type Page = 'DASHBOARD' | 'MY_JOBS' | 'SCHEDULE' | 'EARNINGS' | 'VAULT' | 'SETTINGS';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorProfile {
  id: string;
  company_name: string;
  full_name: string;
  service_type: string;
  address: string;
  contact_email: string;
}

interface ClientConnection {
  pmId: string;
  pmProfile: { full_name: string; company_name: string } | null;
  locations: { id: string; label: string; address: string }[];
}

interface EarningsData {
  thisMonth: number;
  thisQuarter: number;
  allTime: number;
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

const IcoDashboard = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IcoJobs = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
    <line x1="9" y1="16" x2="13" y2="16" strokeLinecap="round" />
  </svg>
);

const IcoCalendar = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
    <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IcoEarnings = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
  </svg>
);

const IcoVault = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9V7M12 17v-2M9 12H7M17 12h-2" strokeLinecap="round" />
  </svg>
);

const IcoSettings = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" />
  </svg>
);

const IcoSparkle = ({ color }: { color: string }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" style={{ flexShrink: 0 }}>
    <path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6L12 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IcoBell = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── SidebarItem ──────────────────────────────────────────────────────────────

function SidebarItem({
  label, icon, isActive, onClick, badge,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '11px',
        width: '100%', padding: '10px 16px',
        background: isActive ? '#EFF6FF' : hov ? '#F9FAFB' : 'transparent',
        border: 'none',
        borderLeft: `3px solid ${isActive ? '#2563EB' : 'transparent'}`,
        cursor: 'pointer',
        color: isActive ? '#2563EB' : '#6B7280',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 'normal',
        textAlign: 'left',
        fontFamily: 'sans-serif',
        position: 'relative',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          background: '#DC2626', color: '#FFFFFF', borderRadius: '50%',
          width: '17px', height: '17px', fontSize: '0.6rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ─── ScheduleCalendar ────────────────────────────────────────────────────────

function ScheduleCalendar({ jobs }: { jobs: any[] }) {
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const eventsMap = useMemo(() => {
    const map: Record<number, { label: string; type: 'scope' | 'deadline'; sub: string }[]> = {};
    for (const job of jobs) {
      if (job.scope_status === 'confirmed') {
        const raw = job.scope_proposed_datetime || job.scope_counter_datetime;
        if (!raw) continue;
        const dt = new Date(raw);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const d = dt.getDate();
          if (!map[d]) map[d] = [];
          map[d].push({
            label: job.locations?.label || 'Scope Visit',
            type: 'scope',
            sub: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
      if (job.deadline) {
        const dt = new Date(job.deadline);
        if (dt.getFullYear() === year && dt.getMonth() === month) {
          const d = dt.getDate();
          if (!map[d]) map[d] = [];
          map[d].push({
            label: job.locations?.label || 'Job',
            type: 'deadline',
            sub: job.description?.slice(0, 50) || '',
          });
        }
      }
    }
    return map;
  }, [jobs, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedEvents = selectedDay !== null ? (eventsMap[selectedDay] || []) : [];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const navBtn: React.CSSProperties = {
    background: 'none', border: '1px solid #E5E3DF', borderRadius: '6px',
    padding: '6px 16px', cursor: 'pointer', color: '#6B7280',
    fontSize: '0.9rem', fontFamily: 'sans-serif',
  };

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <button style={navBtn} onClick={() => { setViewDate(new Date(year, month - 1, 1)); setSelectedDay(null); }}>←</button>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1A1A1A' }}>
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button style={navBtn} onClick={() => { setViewDate(new Date(year, month + 1, 1)); setSelectedDay(null); }}>→</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '18px', marginBottom: '14px' }}>
        {([
          { color: '#EFF6FF', border: '#BFDBFE', label: 'Confirmed scope visit', dot: '#2563EB' },
          { color: '#FFFBEB', border: '#FDE68A', label: 'Job deadline',           dot: '#D97706' },
        ] as { color: string; border: string; label: string; dot: string }[]).map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color, border: `1px solid ${l.border}` }} />
            <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.67rem', color: '#9CA3AF', fontWeight: 'bold', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((day, i) => {
          const dayEvents = day ? (eventsMap[day] || []) : [];
          const isSelected = day === selectedDay;
          return (
            <div
              key={i}
              onClick={() => day && setSelectedDay(isSelected ? null : day)}
              style={{
                minHeight: '72px', padding: '5px', borderRadius: '6px',
                background: !day ? 'transparent' : isSelected ? '#EFF6FF' : '#FFFFFF',
                border: !day ? 'none' : `1px solid ${isSelected ? '#BFDBFE' : '#E5E3DF'}`,
                cursor: day ? 'pointer' : 'default',
              }}
            >
              {day && (
                <>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', marginBottom: '3px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.78rem', fontWeight: isToday(day) ? 700 : 'normal',
                    color: isToday(day) ? '#FFFFFF' : '#1A1A1A',
                    background: isToday(day) ? '#2563EB' : 'transparent',
                  }}>
                    {day}
                  </div>
                  {dayEvents.slice(0, 2).map((ev, ei) => (
                    <div key={ei} style={{
                      fontSize: '0.59rem', padding: '1px 4px', borderRadius: '3px', marginBottom: '2px',
                      background: ev.type === 'scope' ? '#EFF6FF' : '#FFFBEB',
                      color: ev.type === 'scope' ? '#2563EB' : '#D97706',
                      border: `1px solid ${ev.type === 'scope' ? '#BFDBFE' : '#FDE68A'}`,
                      whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {ev.label}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: '0.57rem', color: '#9CA3AF' }}>+{dayEvents.length - 2} more</div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay !== null && (
        <div style={{ marginTop: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#6B7280', letterSpacing: '1.5px', marginBottom: '14px' }}>
            {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()}
          </div>
          {selectedEvents.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF' }}>No events on this day.</p>
          ) : selectedEvents.map((ev, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '10px 0',
              borderBottom: i < selectedEvents.length - 1 ? '1px solid #F3F4F6' : 'none',
            }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                background: ev.type === 'scope' ? '#2563EB' : '#D97706',
              }} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A1A1A' }}>{ev.label}</div>
                {ev.sub && <div style={{ fontSize: '0.77rem', color: '#6B7280', marginTop: '2px', lineHeight: 1.4 }}>{ev.sub}</div>}
                <div style={{
                  fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.5px', marginTop: '4px',
                  color: ev.type === 'scope' ? '#2563EB' : '#D97706',
                }}>
                  {ev.type === 'scope' ? 'CONFIRMED SCOPE VISIT' : 'JOB DEADLINE'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EarningsBanner ──────────────────────────────────────────────────────────

function EarningsBanner({ earningsData }: { earningsData: EarningsData }) {
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E5E3DF',
      borderLeft: '4px solid #2563EB', borderRadius: '8px',
      padding: '22px 28px', marginBottom: '22px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    }}>
      {([
        { label: 'THIS MONTH',   value: fmt(earningsData.thisMonth),   color: '#2563EB' },
        { label: 'THIS QUARTER', value: fmt(earningsData.thisQuarter), color: '#7C3AED' },
        { label: 'ALL TIME',     value: fmt(earningsData.allTime),     color: '#D97706' },
      ] as { label: string; value: string; color: string }[]).map((stat, i) => (
        <div key={stat.label} style={{
          padding: i > 0 ? '0 0 0 28px' : '0',
          borderLeft: i > 0 ? '1px solid #F3F4F6' : 'none',
        }}>
          <div style={{ fontSize: '0.62rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '8px' }}>{stat.label}</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
          <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '5px' }}>earned</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VendorDashboard() {

  // ── Core state ────────────────────────────────────────────────────────────
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [verifiedJobsEarnings, setVerifiedJobsEarnings] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [clientConnections, setClientConnections] = useState<ClientConnection[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [page, setPage] = useState<Page>('DASHBOARD');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // ── Job actions ───────────────────────────────────────────────────────────
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [quotingJob, setQuotingJob] = useState<any | null>(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteTimeframe, setQuoteTimeframe] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [completingJob, setCompletingJob] = useState<any | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [scopeJob, setScopeJob] = useState<any | null>(null);
  const [scopeDatetime, setScopeDatetime] = useState('');
  const [submittingScope, setSubmittingScope] = useState(false);

  // ── My Jobs filter ────────────────────────────────────────────────────────
  const [jobFilter, setJobFilter] = useState('ALL');

  // ── Vault ─────────────────────────────────────────────────────────────────
  const [vaultJobs, setVaultJobs] = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(new Set());

  // ── Settings ──────────────────────────────────────────────────────────────
  const [editVendor, setEditVendor] = useState<VendorProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Slide-in animation keyframe injection
  useEffect(() => {
    const id = 'lantell-slide-in';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = '@keyframes __lt_slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }';
      document.head.appendChild(s);
    }
  }, []);

  // Mobile resize listener
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Mark notifications read when panel opens
  useEffect(() => {
    if (!showNotifPanel) return;
    const t = setTimeout(() => markNotificationsRead(), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showNotifPanel]);

  useEffect(() => { loadDashboard(); }, []);

  // Lazy-load vault when tab first opened
  useEffect(() => {
    if (page === 'VAULT' && vendor && !vaultLoaded) loadVaultData(vendor.id);
  }, [page, vendor, vaultLoaded]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session.');

      const { data: vendorData, error: vError } = await supabase
        .from('vendors').select('*').eq('owner_id', user.id).single();
      if (vError || !vendorData) throw new Error('Vendor profile not found.');

      setVendor(vendorData);
      setEditVendor(vendorData);

      // Active jobs (non-verified)
      const { data: jobsData, error: jError } = await supabase
        .from('jobs')
        .select(`*, owner_id, locations(id, label, address), disputes(id, category, severity, resolution)`)
        .eq('vendor_id', vendorData.id)
        .neq('status', 'VERIFIED')
        .order('created_at', { ascending: false });
      if (jError) throw jError;
      setJobs(jobsData || []);

      // Verified jobs — lightweight, for earnings banner + earnings page
      const { data: verifiedData } = await supabase
        .from('jobs')
        .select(`id, quote_amount, verified_at, description, locations(label)`)
        .eq('vendor_id', vendorData.id)
        .eq('status', 'VERIFIED')
        .order('verified_at', { ascending: false });
      setVerifiedJobsEarnings(verifiedData || []);

      // Notifications
      const { data: notifData } = await supabase
        .from('notifications').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(50);
      setNotifications(notifData || []);

      // Pending PM invites
      const { data: inviteData } = await supabase
        .from('pm_vendor_connections').select('id, pm_id, status')
        .eq('vendor_id', vendorData.id).eq('status', 'pending');
      if (inviteData && inviteData.length > 0) {
        const pmIds = inviteData.map((i: any) => i.pm_id);
        const { data: pmProfiles } = await supabase
          .from('pm_profiles').select('id, full_name, company_name').in('id', pmIds);
        const pmMap = Object.fromEntries((pmProfiles || []).map((p: any) => [p.id, p]));
        setPendingInvites(inviteData.map((i: any) => ({ ...i, pmProfile: pmMap[i.pm_id] || null })));
      } else {
        setPendingInvites([]);
      }

      // Accepted client connections + assigned locations
      const { data: acceptedConns } = await supabase
        .from('pm_vendor_connections').select('id, pm_id, status')
        .eq('vendor_id', vendorData.id).eq('status', 'accepted');
      if (acceptedConns && acceptedConns.length > 0) {
        const pmIds = acceptedConns.map((c: any) => c.pm_id);
        const [{ data: pmProfiles }, { data: lsData }] = await Promise.all([
          supabase.from('pm_profiles').select('id, full_name, company_name').in('id', pmIds),
          supabase.from('location_services')
            .select(`locations(id, label, address, owner_id)`)
            .eq('vendor_id', vendorData.id).eq('status', 'accepted'),
        ]);
        const pmMap = Object.fromEntries((pmProfiles || []).map((p: any) => [p.id, p]));
        const locsByPM: Record<string, any[]> = {};
        (lsData || []).forEach((ls: any) => {
          const ownerId = ls.locations?.owner_id;
          if (ownerId) { if (!locsByPM[ownerId]) locsByPM[ownerId] = []; locsByPM[ownerId].push(ls.locations); }
        });
        setClientConnections(acceptedConns.map((c: any) => ({
          pmId: c.pm_id, pmProfile: pmMap[c.pm_id] || null, locations: locsByPM[c.pm_id] || [],
        })));
      } else {
        setClientConnections([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  async function loadVaultData(vendorId: string) {
    setVaultLoading(true);
    const { data, error: vErr } = await supabase
      .from('jobs')
      .select(`*, locations(label, address), service_reports(notes, photo_urls, submitted_at), disputes(category, severity, resolution)`)
      .eq('vendor_id', vendorId).eq('status', 'VERIFIED')
      .order('verified_at', { ascending: false });
    if (!vErr && data) setVaultJobs(data);
    setVaultLoading(false);
    setVaultLoaded(true);
  }

  // ── Notification helpers ──────────────────────────────────────────────────

  const markNotificationsRead = async () => {
    const hasUnread = notifications.some(n => !n.read);
    if (!hasUnread || !vendor) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // ── Job action handlers ───────────────────────────────────────────────────

  const acceptJob = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    const { error: e } = await supabase.from('jobs').update({ status: 'PENDING_QUOTE' }).eq('id', jobId);
    if (e) return alert('Failed: ' + e.message);
    if (job?.owner_id) await supabase.from('notifications').insert({
      user_id: job.owner_id, title: 'Job Accepted',
      body: `${vendor?.company_name} accepted the job "${job.description?.slice(0, 60)}". They will now submit a quote.`,
      link: '/pm',
    });
    loadDashboard();
  };

  const declineJob = async (jobId: string) => {
    if (!window.confirm('Decline this job?\n\nThe PM will be notified and can create a new request with a different vendor.')) return;
    const job = jobs.find(j => j.id === jobId);
    const { error: e } = await supabase.from('jobs').update({ status: 'DECLINED' }).eq('id', jobId);
    if (e) return alert('Failed: ' + e.message);
    if (job?.owner_id) await supabase.from('notifications').insert({
      user_id: job.owner_id, title: 'Job Declined',
      body: `${vendor?.company_name} declined the job "${job.description?.slice(0, 60)}". You can create a new request with a different vendor.`,
      link: '/pm',
    });
    loadDashboard();
  };

  const openScopeModal = (job: any) => {
    setScopeJob(job);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setScopeDatetime(tomorrow.toISOString().slice(0, 16));
  };

  const submitScopeRequest = async () => {
    if (!scopeJob || !scopeDatetime) return;
    setSubmittingScope(true);
    const { error: e } = await supabase.from('jobs').update({
      scope_requested: true,
      scope_proposed_datetime: new Date(scopeDatetime).toISOString(),
      scope_status: 'proposed',
    }).eq('id', scopeJob.id);
    if (e) { alert('Failed: ' + e.message); setSubmittingScope(false); return; }
    if (scopeJob.owner_id) await supabase.from('notifications').insert({
      user_id: scopeJob.owner_id, title: 'Scope Visit Requested',
      body: `${vendor?.company_name} requested a scope visit for "${scopeJob.description?.slice(0, 60)}" — proposed: ${formatScopeDate(scopeDatetime)}`,
      link: '/pm',
    });
    setSubmittingScope(false);
    setScopeJob(null);
    setScopeDatetime('');
    loadDashboard();
  };

  const confirmScopeCounter = async (job: any) => {
    await supabase.from('jobs').update({
      scope_proposed_datetime: job.scope_counter_datetime,
      scope_counter_datetime: null,
      scope_status: 'confirmed',
    }).eq('id', job.id);
    if (job.owner_id) await supabase.from('notifications').insert({
      user_id: job.owner_id, title: 'Scope Visit Confirmed',
      body: `${vendor?.company_name} confirmed the scope visit — ${formatScopeDate(job.scope_counter_datetime)}`,
      link: '/pm',
    });
    loadDashboard();
  };

  const submitQuote = async () => {
    if (!quotingJob) return;
    if (!quoteAmount || isNaN(parseFloat(quoteAmount))) return alert('Please enter a valid amount.');
    setSubmittingQuote(true);
    const isRevision = quotingJob.status === 'QUOTE_DECLINED';
    const { error: e } = await supabase.from('jobs').update({
      status: 'QUOTE_SUBMITTED',
      quote_amount: parseFloat(quoteAmount),
      quote_timeframe: quoteTimeframe.trim() || null,
      vendor_note: quoteNote.trim() || null,
    }).eq('id', quotingJob.id);
    if (e) { alert('Failed: ' + e.message); setSubmittingQuote(false); return; }
    if (quotingJob.owner_id) await supabase.from('notifications').insert({
      user_id: quotingJob.owner_id,
      title: isRevision ? 'Revised Quote Received' : 'Quote Received',
      body: `${vendor?.company_name} submitted a${isRevision ? ' revised' : ''} quote of $${quoteAmount} for "${quotingJob.description?.slice(0, 60)}".`,
      link: '/pm',
    });
    setSubmittingQuote(false); setQuotingJob(null); setQuoteAmount(''); setQuoteTimeframe(''); setQuoteNote('');
    loadDashboard();
  };

  const markWorkDone = (job: any) => { setCompletingJob(job); setCompletionNotes(''); setCompletionPhotos([]); };

  const submitCompletion = async () => {
    if (!completingJob || !completionNotes.trim()) return;
    setSubmittingCompletion(true);
    try {
      const { error: rErr } = await supabase.from('service_reports').insert({
        job_id: completingJob.id, notes: completionNotes.trim(),
        photo_urls: completionPhotos.length > 0 ? completionPhotos : null,
        submitted_at: new Date().toISOString(),
      });
      if (rErr) throw rErr;
      const { error: jErr } = await supabase.from('jobs').update({ status: 'PENDING_VERIFICATION' }).eq('id', completingJob.id);
      if (jErr) throw jErr;
      if (completingJob.owner_id) await supabase.from('notifications').insert({
        user_id: completingJob.owner_id, title: 'Work Complete — Verification Required',
        body: `${vendor?.company_name} has marked the job "${completingJob.description?.slice(0, 60)}" as complete. Please review and verify the work.`,
        link: '/pm',
      });
      setCompletingJob(null); setCompletionNotes(''); setCompletionPhotos([]);
      loadDashboard();
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setSubmittingCompletion(false); }
  };

  const withdrawFromJob = async (job: any) => {
    if (!window.confirm('Withdraw from this job?\n\nThe PM will be notified and will need to create a new request with a different vendor.')) return;
    if (job.owner_id) await supabase.from('notifications').insert({
      user_id: job.owner_id, title: 'Vendor Withdrew',
      body: `${vendor?.company_name} withdrew from "${job.description?.slice(0, 60)}". Please create a new job with a different vendor.`,
      link: '/pm',
    });
    await supabase.from('jobs').delete().eq('id', job.id);
    loadDashboard();
  };

  const acceptInvite = async (inviteId: string) => {
    setAcceptingId(inviteId);
    const { error: e } = await supabase.from('pm_vendor_connections').update({ status: 'accepted' }).eq('id', inviteId);
    if (e) alert('Failed to accept: ' + e.message);
    else loadDashboard();
    setAcceptingId(null);
  };

  const handleSaveProfile = async () => {
    if (!vendor || !editVendor) return;
    setSavingProfile(true);
    const { error: e } = await supabase.from('vendors').update({
      full_name: editVendor.full_name, company_name: editVendor.company_name,
      address: editVendor.address, service_type: editVendor.service_type,
    }).eq('id', vendor.id);
    if (e) alert('Failed: ' + e.message);
    else { setVendor(editVendor); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 3000); }
    setSavingProfile(false);
  };

  const generateVendorInviteLink = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setGeneratingInvite(true);
    try {
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
      const { data, error: e } = await supabase
        .from('invite_links')
        .insert([{ created_by: user.id, role: 'vendor', expires_at: expiresAt.toISOString() }])
        .select('id').single();
      if (e || !data) { alert('Failed: ' + (e?.message || 'Unknown error')); return; }
      const link = `${window.location.origin}/invite/${data.id}`;
      await navigator.clipboard.writeText(link);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 6000);
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setGeneratingInvite(false); }
  };

  // ── Computed values ───────────────────────────────────────────────────────

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Earnings aggregates (from verified jobs loaded at startup)
  const earningsData: EarningsData = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const qtrMonth = Math.floor(now.getMonth() / 3) * 3;
    const qtrStart = new Date(now.getFullYear(), qtrMonth, 1);
    let thisMonth = 0, thisQuarter = 0, allTime = 0;
    for (const j of verifiedJobsEarnings) {
      const amt = j.quote_amount || 0;
      const v = new Date(j.verified_at);
      allTime += amt;
      if (v >= qtrStart) thisQuarter += amt;
      if (v >= monthStart) thisMonth += amt;
    }
    return { thisMonth, thisQuarter, allTime };
  }, [verifiedJobsEarnings]);

  // Monthly chart data — last 6 months
  const monthlyChartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const amount = verifiedJobsEarnings
        .filter(j => { const v = new Date(j.verified_at); return v >= d && v < next; })
        .reduce((sum, j) => sum + (j.quote_amount || 0), 0);
      return { label, amount };
    });
  }, [verifiedJobsEarnings]);

  // Vault: group by location
  const vaultByLocation = useMemo(() => {
    const groups: Record<string, { locId: string; label: string; address: string; jobs: any[] }> = {};
    for (const job of vaultJobs) {
      const locId = job.location_id || 'unknown';
      if (!groups[locId]) groups[locId] = {
        locId, label: job.locations?.label || 'Unknown Location',
        address: job.locations?.address || '', jobs: [],
      };
      groups[locId].jobs.push(job);
    }
    return Object.values(groups);
  }, [vaultJobs]);

  // Action queue for Dashboard home (max 5, prioritised)
  const actionItems = useMemo(() => {
    const items: { job: any; type: string; priority: number }[] = [];
    const now = new Date();
    for (const job of jobs) {
      if (job.status === 'IN_PROGRESS' && job.deadline && new Date(job.deadline) < now) {
        items.push({ job, type: 'OVERDUE', priority: 0 });
      } else if (job.status === 'PENDING_ACCEPTANCE') {
        items.push({ job, type: 'PENDING_ACCEPTANCE', priority: 1 });
      } else if (job.status === 'QUOTE_DECLINED') {
        items.push({ job, type: 'QUOTE_DECLINED', priority: 2 });
      } else if (job.status === 'PENDING_QUOTE' && job.scope_status === 'confirmed') {
        items.push({ job, type: 'PENDING_QUOTE_SCOPE', priority: 2 });
      }
    }
    return items.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [jobs]);

  // Upcoming schedule events (next 4, future only)
  const upcomingEvents = useMemo(() => {
    const evts: { date: Date; label: string; type: 'scope' | 'deadline' }[] = [];
    const now = new Date();
    for (const job of jobs) {
      if (job.scope_status === 'confirmed') {
        const dt = new Date(job.scope_proposed_datetime || job.scope_counter_datetime);
        if (dt > now) evts.push({ date: dt, label: `${job.locations?.label || 'Scope Visit'}`, type: 'scope' });
      }
      if (job.deadline && new Date(job.deadline) > now) {
        evts.push({ date: new Date(job.deadline), label: `${job.locations?.label || 'Job'}`, type: 'deadline' });
      }
    }
    return evts.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);
  }, [jobs]);

  // My Jobs filtered list
  const filteredJobs = useMemo(() =>
    jobFilter === 'ALL' ? jobs : jobs.filter(j => j.status === jobFilter),
    [jobs, jobFilter]
  );

  const minDatetime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  // ── Page title map ────────────────────────────────────────────────────────

  const PAGE_TITLES: Record<Page, string> = {
    DASHBOARD: 'Dashboard',
    MY_JOBS: 'My Jobs',
    SCHEDULE: 'Schedule',
    EARNINGS: 'Earnings',
    VAULT: 'Vault',
    SETTINGS: 'Settings',
  };

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF9F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9CA3AF', fontSize: '0.9rem' }}>
      Loading…
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF9F7', padding: '50px', fontFamily: 'sans-serif' }}>
      <div style={{ color: '#DC2626', background: '#FEF2F2', border: '1px solid #FEE2E2', padding: '20px', borderRadius: '8px' }}>{error}</div>
    </div>
  );

  const initials = vendor?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'V';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#FAF9F7' }}>

      {/* ── SIDEBAR (desktop only) ─────────────────────────────────────── */}
      {!isMobile && (
        <aside style={{
          position: 'fixed', top: 0, left: 0, width: '240px', height: '100vh',
          background: '#FFFFFF', borderRight: '1px solid #E5E3DF',
          display: 'flex', flexDirection: 'column', zIndex: 50,
        }}>
          {/* Wordmark */}
          <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #E5E3DF' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#1A1A1A' }}>
              Lantell
            </div>
          </div>

          {/* Primary nav */}
          <nav style={{ flex: 1, paddingTop: '10px', overflowY: 'auto' }}>
            <SidebarItem label="Dashboard" icon={<IcoDashboard color={page === 'DASHBOARD' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'DASHBOARD'} onClick={() => setPage('DASHBOARD')} />
            <SidebarItem label="My Jobs" icon={<IcoJobs color={page === 'MY_JOBS' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'MY_JOBS'} onClick={() => setPage('MY_JOBS')} badge={pendingInvites.length + jobs.filter(j => j.status === 'PENDING_ACCEPTANCE').length} />
            <SidebarItem label="Schedule" icon={<IcoCalendar color={page === 'SCHEDULE' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'SCHEDULE'} onClick={() => setPage('SCHEDULE')} />
            <SidebarItem label="Earnings" icon={<IcoEarnings color={page === 'EARNINGS' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'EARNINGS'} onClick={() => setPage('EARNINGS')} />
            <SidebarItem label="Vault" icon={<IcoVault color={page === 'VAULT' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'VAULT'} onClick={() => setPage('VAULT')} />
          </nav>

          {/* Bottom pinned */}
          <div style={{ borderTop: '1px solid #E5E3DF', paddingTop: '8px', paddingBottom: '8px' }}>
            {/* Intelligence — coming soon */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '11px',
              padding: '10px 16px', color: '#9CA3AF', cursor: 'default',
              borderLeft: '3px solid transparent',
            }}>
              <IcoSparkle color="#9CA3AF" />
              <span style={{ fontSize: '0.875rem', flex: 1 }}>Intelligence</span>
              <span style={{
                fontSize: '0.58rem', fontWeight: 'bold', color: '#9CA3AF',
                border: '1px solid #E5E3DF', padding: '1px 6px', borderRadius: '8px',
                letterSpacing: '0.5px',
              }}>SOON</span>
            </div>
            <SidebarItem label="Settings" icon={<IcoSettings color={page === 'SETTINGS' ? '#2563EB' : '#9CA3AF'} />} isActive={page === 'SETTINGS'} onClick={() => setPage('SETTINGS')} />
            {/* User chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px 10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: '#2563EB', color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.5px',
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {vendor?.company_name}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#9CA3AF' }}>Vendor</div>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <div style={{
        marginLeft: isMobile ? 0 : '240px',
        flex: 1, display: 'flex', flexDirection: 'column',
        minHeight: '100vh',
        paddingBottom: isMobile ? '64px' : 0,
      }}>

        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: '#FAF9F7', borderBottom: '1px solid #E5E3DF',
          padding: '0 28px', height: '56px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A1A1A' }}>
              {PAGE_TITLES[page]}
            </span>
            {page === 'DASHBOARD' && vendor && (
              <span style={{ marginLeft: '10px', fontSize: '0.78rem', color: '#9CA3AF' }}>
                {vendor.service_type}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Bell */}
            <button
              onClick={() => setShowNotifPanel(p => !p)}
              style={{
                position: 'relative', background: showNotifPanel ? '#EFF6FF' : 'transparent',
                border: `1px solid ${showNotifPanel ? '#BFDBFE' : '#E5E3DF'}`,
                borderRadius: '7px', width: '36px', height: '36px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <IcoBell color={showNotifPanel ? '#2563EB' : '#6B7280'} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  background: '#DC2626', color: '#FFFFFF', borderRadius: '50%',
                  width: '16px', height: '16px', fontSize: '0.6rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {/* Wordmark on mobile topbar */}
            {isMobile && (
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
                Lantell
              </span>
            )}
          </div>
        </div>

        {/* ── PAGE CONTENT ────────────────────────────────────────────── */}
        <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

          {/* DASHBOARD */}
          {page === 'DASHBOARD' && (
            <div>

              {/* Earnings Banner */}
              <EarningsBanner earningsData={earningsData} />

              {/* Pending invite alert */}
              {pendingInvites.length > 0 && (
                <div style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px',
                  padding: '12px 18px', marginBottom: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#D97706' }}>
                      {pendingInvites.length} connection request{pendingInvites.length > 1 ? 's' : ''} pending
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: '#6B7280' }}>
                      from {pendingInvites.map(i => i.pmProfile?.company_name || 'a PM').join(', ')}
                    </span>
                  </div>
                  <button onClick={() => setPage('MY_JOBS')} style={{ ...btnPrimary, fontSize: '0.78rem', padding: '6px 14px' }}>
                    Review
                  </button>
                </div>
              )}

              {/* 2/3 + 1/3 grid */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* ── Left column (2/3) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Action Queue */}
                  <div style={{ ...card, padding: '20px' }}>
                    <div style={sectionLabel}>Action Queue</div>
                    {actionItems.length === 0 ? (
                      <div style={{ border: '1px dashed #E5E3DF', borderRadius: '6px', padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem' }}>
                        Nothing needs your attention right now.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {actionItems.map(({ job, type }) => {
                          const dotColor =
                            type === 'OVERDUE'           ? '#DC2626' :
                            type === 'PENDING_ACCEPTANCE'? '#D97706' : '#7C3AED';
                          return (
                            <div key={job.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '11px 14px', background: '#F9FAFB',
                              border: '1px solid #E5E3DF', borderRadius: '6px',
                            }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.84rem', color: '#1A1A1A', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {job.description?.slice(0, 55)}
                                </div>
                                <div style={{ fontSize: '0.71rem', color: '#9CA3AF', marginTop: '2px' }}>
                                  {job.locations?.label}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                {type === 'OVERDUE' && (
                                  <span style={{ fontSize: '0.7rem', color: '#DC2626', border: '1px solid #FEE2E2', padding: '3px 8px', borderRadius: '4px', background: '#FEF2F2', whiteSpace: 'nowrap' }}>
                                    Overdue
                                  </span>
                                )}
                                {type === 'PENDING_ACCEPTANCE' && (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => acceptJob(job.id)} style={{ ...btnPrimary, fontSize: '0.74rem', padding: '5px 10px' }}>Accept</button>
                                    <button onClick={() => declineJob(job.id)} style={{ background: 'transparent', color: '#DC2626', border: '1px solid #FEE2E2', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.74rem', fontFamily: 'sans-serif' }}>Decline</button>
                                  </div>
                                )}
                                {(type === 'QUOTE_DECLINED' || type === 'PENDING_QUOTE_SCOPE') && (
                                  <button
                                    onClick={() => {
                                      setQuotingJob(job);
                                      setQuoteAmount(job.quote_amount?.toString() || '');
                                      setQuoteTimeframe(job.quote_timeframe || '');
                                      setQuoteNote(job.vendor_note || '');
                                    }}
                                    style={{ ...btnPrimary, fontSize: '0.74rem', padding: '5px 10px', whiteSpace: 'nowrap' }}
                                  >
                                    {type === 'QUOTE_DECLINED' ? 'Revise Quote' : 'Submit Quote'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div style={{ ...card, padding: '20px' }}>
                    <div style={sectionLabel}>Recent Activity</div>
                    {notifications.length === 0 ? (
                      <div style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>No recent activity.</div>
                    ) : (
                      <div>
                        {notifications.slice(0, 5).map((n, i) => (
                          <div key={n.id} style={{
                            padding: '10px 0',
                            borderBottom: i < Math.min(notifications.length, 5) - 1 ? '1px solid #F3F4F6' : 'none',
                          }}>
                            <div style={{ fontSize: '0.82rem', color: '#1A1A1A', fontWeight: n.read ? 'normal' : 600 }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#6B7280', marginTop: '2px', lineHeight: 1.4 }}>{n.body}</div>
                            <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '4px' }}>{timeAgo(n.created_at)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* ── Right column (1/3) ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Upcoming Schedule */}
                  <div style={{ ...card, padding: '20px' }}>
                    <div style={sectionLabel}>Upcoming Schedule</div>
                    {upcomingEvents.length === 0 ? (
                      <div style={{ border: '1px dashed #E5E3DF', borderRadius: '6px', padding: '18px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.8rem' }}>
                        No upcoming events.
                      </div>
                    ) : (
                      <div>
                        {upcomingEvents.map((evt, i) => (
                          <div key={i} style={{
                            display: 'flex', gap: '14px', alignItems: 'flex-start',
                            padding: '10px 0',
                            borderBottom: i < upcomingEvents.length - 1 ? '1px solid #F3F4F6' : 'none',
                          }}>
                            {/* Date block */}
                            <div style={{ flexShrink: 0, minWidth: '40px', textAlign: 'center' }}>
                              <div style={{ fontSize: '0.6rem', color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                                {evt.date.toLocaleDateString('en-US', { month: 'short' })}
                              </div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>
                                {evt.date.getDate()}
                              </div>
                            </div>
                            {/* Event info */}
                            <div style={{ flex: 1, paddingTop: '1px' }}>
                              <div style={{ fontSize: '0.82rem', color: '#1A1A1A', fontWeight: 500, lineHeight: 1.3 }}>
                                {evt.label}
                              </div>
                              <span style={{
                                fontSize: '0.62rem', fontWeight: 'bold',
                                color: evt.type === 'scope' ? '#2563EB' : '#D97706',
                                letterSpacing: '0.5px',
                              }}>
                                {evt.type === 'scope' ? 'SCOPE VISIT' : 'DEADLINE'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setPage('SCHEDULE')} style={{ ...btnSecondary, marginTop: '14px', width: '100%', fontSize: '0.78rem', padding: '7px', textAlign: 'center' as const }}>
                      View full schedule →
                    </button>
                  </div>

                  {/* AI Placeholder */}
                  <div style={{ ...card, padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                      <IcoSparkle color="#9CA3AF" />
                      <span style={{ fontSize: '0.67rem', fontWeight: 'bold', color: '#9CA3AF', letterSpacing: '1px' }}>LANTELL INTELLIGENCE</span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: '#9CA3AF', lineHeight: 1.5 }}>
                      Vendor insights and performance analytics are on the way.
                    </p>
                    <span style={{
                      display: 'inline-block', fontSize: '0.62rem', fontWeight: 'bold',
                      color: '#9CA3AF', border: '1px solid #E5E3DF',
                      padding: '2px 8px', borderRadius: '8px', letterSpacing: '0.5px',
                    }}>
                      COMING SOON
                    </span>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* MY JOBS */}
          {page === 'MY_JOBS' && (
            <div>

              {/* Connection requests */}
              {pendingInvites.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={sectionLabel}>Connection Requests ({pendingInvites.length})</div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {pendingInvites.map(invite => (
                      <div key={invite.id} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#1A1A1A' }}>{invite.pmProfile?.company_name || 'Unknown Company'}</p>
                          <p style={{ margin: '3px 0 0 0', color: '#6B7280', fontSize: '0.8rem' }}>{invite.pmProfile?.full_name}</p>
                          <p style={{ margin: '4px 0 0 0', color: '#D97706', fontSize: '0.72rem' }}>wants to add you to their vendor network</p>
                        </div>
                        <button onClick={() => acceptInvite(invite.id)} disabled={acceptingId === invite.id} style={{ ...btnPrimary, whiteSpace: 'nowrap' as const }}>
                          {acceptingId === invite.id ? 'Accepting…' : 'Accept'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter bar */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
                {(['ALL', 'PENDING_ACCEPTANCE', 'PENDING_QUOTE', 'QUOTE_SUBMITTED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'QUOTE_DECLINED', 'DECLINED', 'DISPUTED'] as const).map(f => {
                  const count = f === 'ALL' ? jobs.length : jobs.filter(j => j.status === f).length;
                  const isActive = jobFilter === f;
                  return (
                    <button key={f} onClick={() => setJobFilter(f)} style={{
                      padding: '5px 12px', borderRadius: '16px', cursor: 'pointer',
                      fontSize: '0.74rem', fontFamily: 'sans-serif', fontWeight: isActive ? 600 : 'normal',
                      background: isActive ? '#2563EB' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : '#6B7280',
                      border: `1px solid ${isActive ? '#2563EB' : '#E5E3DF'}`,
                    }}>
                      {f === 'ALL' ? 'All' : STATUS_LABELS[f] || f}{count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>

              {/* Work orders header */}
              <div style={sectionLabel}>Work Orders ({filteredJobs.length})</div>

              {/* Empty state */}
              {filteredJobs.length === 0 ? (
                <div style={{ border: '1px dashed #E5E3DF', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
                  {jobs.length === 0
                    ? 'No jobs yet. Accept a connection request and a PM will assign work to you.'
                    : 'No jobs match this filter.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px' }}>
                  {filteredJobs.map(job => {
                    const statusColor = STATUS_COLORS[job.status] || '#6B7280';
                    const statusLabel = STATUS_LABELS[job.status] || job.status;
                    const deadlinePassed = job.deadline && new Date(job.deadline) < new Date();

                    return (
                      <div key={job.id} style={{ ...card, borderLeft: `4px solid ${statusColor}`, padding: '20px' }}>

                        {/* Card header row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '0.7rem', letterSpacing: '1px', border: `1px solid ${statusColor}33`, padding: '2px 8px', borderRadius: '10px', background: `${statusColor}11` }}>
                              {statusLabel.toUpperCase()}
                            </span>
                            {deadlinePassed && !['PENDING_VERIFICATION', 'DISPUTED'].includes(job.status) && (
                              <span style={{ fontSize: '0.68rem', color: '#DC2626', border: '1px solid #FEE2E2', padding: '2px 6px', borderRadius: '10px', background: '#FEF2F2' }}>⚠ PAST DEADLINE</span>
                            )}
                          </div>
                          <span style={{ color: '#9CA3AF', fontSize: '0.7rem', flexShrink: 0 }}>#{job.id.slice(0, 8)}</span>
                        </div>

                        {/* Location + description */}
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: '#1A1A1A' }}>{job.locations?.label || 'Unknown Location'}</h3>
                        <p style={{ margin: '0 0 3px 0', color: '#6B7280', fontSize: '0.85rem', lineHeight: 1.4 }}>{job.description}</p>
                        {job.locations?.address && <p style={{ margin: '0 0 3px 0', color: '#9CA3AF', fontSize: '0.75rem' }}>{job.locations.address}</p>}
                        {job.deadline && (
                          <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: deadlinePassed ? '#DC2626' : '#9CA3AF' }}>
                            Deadline: {new Date(job.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}

                        {/* Objectives */}
                        {job.objectives && (
                          <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.63rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' }}>OBJECTIVES</div>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280', lineHeight: 1.4 }}>{job.objectives}</p>
                          </div>
                        )}

                        {/* Job photos */}
                        {job.photo_urls?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.63rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>JOB PHOTOS ({job.photo_urls.length})</div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {job.photo_urls.map((url: string, idx: number) => (
                                <a key={idx} href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '76px', height: '76px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E5E3DF', flexShrink: 0 }}>
                                  <img src={url} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Scope visit block ── */}
                        {job.scope_requested && job.status === 'PENDING_QUOTE' && (
                          <div style={{ marginBottom: '12px', padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.63rem', color: '#D97706', letterSpacing: '1px', marginBottom: '6px', fontWeight: 'bold' }}>SCOPE VISIT</div>
                            {job.scope_status === 'confirmed' && (
                              <div style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 600 }}>✓ Confirmed: {formatScopeDate(job.scope_proposed_datetime)}</div>
                            )}
                            {job.scope_status === 'proposed' && (
                              <div style={{ fontSize: '0.82rem', color: '#D97706' }}>
                                Proposed: {formatScopeDate(job.scope_proposed_datetime)} — awaiting PM confirmation
                              </div>
                            )}
                            {job.scope_status === 'countered' && job.scope_counter_datetime && (
                              <div>
                                <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: '2px' }}>Your proposal: {formatScopeDate(job.scope_proposed_datetime)}</div>
                                <div style={{ fontSize: '0.82rem', color: '#D97706', fontWeight: 600, marginBottom: '10px' }}>PM countered: {formatScopeDate(job.scope_counter_datetime)}</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <button onClick={() => confirmScopeCounter(job)} style={{ ...btnPrimary, fontSize: '0.75rem', padding: '5px 12px' }}>
                                    Confirm This Time
                                  </button>
                                  <button
                                    onClick={() => { setScopeJob(job); setScopeDatetime(new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)); }}
                                    style={{ ...btnSecondary, fontSize: '0.75rem', padding: '5px 12px' }}
                                  >
                                    Propose Different Time
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quote submitted display */}
                        {job.status === 'QUOTE_SUBMITTED' && job.quote_amount && (
                          <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.63rem', color: '#7C3AED', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' }}>YOUR QUOTE</div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#7C3AED' }}>${job.quote_amount}</div>
                            {job.quote_timeframe && <div style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: '2px' }}>Timeframe: {job.quote_timeframe}</div>}
                            <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '4px' }}>Awaiting client approval</div>
                          </div>
                        )}

                        {/* ── Action buttons ── */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>

                          {job.status === 'PENDING_ACCEPTANCE' && (
                            <>
                              <button onClick={() => acceptJob(job.id)} style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 16px' }}>Accept Job</button>
                              <button onClick={() => declineJob(job.id)} style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 14px', color: '#DC2626', borderColor: '#FEE2E2' }}>Decline</button>
                            </>
                          )}

                          {job.status === 'PENDING_QUOTE' && (
                            <>
                              <button
                                onClick={() => { setQuotingJob(job); setQuoteAmount(''); setQuoteTimeframe(''); setQuoteNote(''); }}
                                style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 16px' }}
                              >
                                Submit Quote
                              </button>
                              {!job.scope_requested && (
                                <button onClick={() => openScopeModal(job)} style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 14px' }}>
                                  Request Scope Visit
                                </button>
                              )}
                            </>
                          )}

                          {job.status === 'IN_PROGRESS' && (
                            <button onClick={() => markWorkDone(job)} style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 16px', background: '#16A34A' }}>
                              Mark Work Complete
                            </button>
                          )}

                          {job.status === 'DECLINED' && (
                            <span style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>You declined this job.</span>
                          )}

                          {job.status === 'QUOTE_DECLINED' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                              <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', fontSize: '0.82rem', color: '#DC2626' }}>
                                Your quote was declined. Submit a revised quote or withdraw from this job.
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => { setQuotingJob(job); setQuoteAmount(job.quote_amount?.toString() || ''); setQuoteTimeframe(job.quote_timeframe || ''); setQuoteNote(job.vendor_note || ''); }}
                                  style={{ ...btnPrimary, fontSize: '0.8rem', padding: '7px 16px' }}
                                >
                                  Submit Revised Quote
                                </button>
                                <button onClick={() => withdrawFromJob(job)} style={{ ...btnSecondary, fontSize: '0.8rem', padding: '7px 14px', color: '#DC2626', borderColor: '#FEE2E2' }}>
                                  Withdraw
                                </button>
                              </div>
                            </div>
                          )}

                          {job.status === 'PENDING_VERIFICATION' && (
                            <span style={{ fontSize: '0.8rem', color: '#D97706', fontStyle: 'italic' }}>Waiting for client to verify work.</span>
                          )}

                          {job.status === 'DISPUTED' && (
                            <span style={{ fontSize: '0.8rem', color: '#DC2626', fontStyle: 'italic' }}>This job is under dispute.</span>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SCHEDULE */}
          {page === 'SCHEDULE' && (
            <div>
              <div style={{ marginBottom: '22px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A' }}>Schedule</h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF' }}>
                  Confirmed scope visits and upcoming job deadlines
                </p>
              </div>
              <div style={{ ...card, padding: '24px' }}>
                <ScheduleCalendar jobs={jobs} />
              </div>
            </div>
          )}

          {/* EARNINGS */}
          {page === 'EARNINGS' && (() => {
            const totalEarned = verifiedJobsEarnings.reduce((s, j) => s + (j.quote_amount || 0), 0);
            const totalJobs = verifiedJobsEarnings.length;
            const avgJob = totalJobs > 0 ? totalEarned / totalJobs : 0;
            return (
              <div>
                <div style={{ marginBottom: '24px' }}>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A' }}>Earnings</h2>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF' }}>All verified jobs and payments</p>
                </div>

                {/* Summary stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
                  {[
                    { label: 'TOTAL EARNED', value: `$${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, accent: '#2563EB' },
                    { label: 'VERIFIED JOBS', value: totalJobs.toString(), accent: '#16A34A' },
                    { label: 'AVG PER JOB', value: `$${avgJob.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, accent: '#7C3AED' },
                  ].map(({ label, value, accent }) => (
                    <div key={label} style={{ ...card, padding: '18px 20px' }}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 'bold', letterSpacing: '1.2px', color: '#9CA3AF', marginBottom: '8px' }}>{label}</div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Monthly breakdown */}
                {monthlyChartData.some(m => m.amount > 0) && (
                  <div style={{ ...card, padding: '20px', marginBottom: '24px' }}>
                    <div style={sectionLabel}>Monthly Breakdown (Last 6 Months)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {monthlyChartData.map(({ label, amount }) => {
                        const pct = totalEarned > 0 ? (amount / totalEarned) * 100 : 0;
                        return (
                          <div key={label}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>{label}</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1A1A' }}>
                                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#2563EB', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Verified jobs list */}
                <div style={{ ...card, padding: '20px' }}>
                  <div style={sectionLabel}>Verified Jobs</div>
                  {verifiedJobsEarnings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF', fontSize: '0.85rem' }}>
                      No verified jobs yet. Earnings appear here once a PM verifies your completed work.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      {/* Header row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '8px 0', borderBottom: '1px solid #E5E3DF' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 'bold', letterSpacing: '1px', color: '#9CA3AF' }}>JOB</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 'bold', letterSpacing: '1px', color: '#9CA3AF', textAlign: 'right' as const }}>DATE</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 'bold', letterSpacing: '1px', color: '#9CA3AF', textAlign: 'right' as const, minWidth: '80px' }}>AMOUNT</span>
                      </div>
                      {verifiedJobsEarnings.map((job: any) => (
                        <div key={job.id} style={{
                          display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px',
                          padding: '11px 0', borderBottom: '1px solid #F3F4F6', alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontSize: '0.84rem', color: '#1A1A1A', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {job.description?.slice(0, 60) || '—'}
                            </div>
                            {job.locations?.label && (
                              <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: '2px' }}>{job.locations.label}</div>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', whiteSpace: 'nowrap', textAlign: 'right' as const }}>
                            {job.verified_at ? new Date(job.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#16A34A', textAlign: 'right' as const, minWidth: '80px' }}>
                            {job.quote_amount != null ? `$${Number(job.quote_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                        </div>
                      ))}
                      {/* Total row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', padding: '12px 0 0 0', marginTop: '4px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1A1A1A' }}>Total</span>
                        <span />
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2563EB', textAlign: 'right' as const, minWidth: '80px' }}>
                          ${totalEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* VAULT */}
          {page === 'VAULT' && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A' }}>Vault</h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF' }}>Completed and verified job history, grouped by location</p>
              </div>

              {vaultLoading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: '0.85rem' }}>Loading vault…</div>
              ) : vaultByLocation.length === 0 ? (
                <div style={{ ...card, padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>
                  No verified jobs yet. Once a PM verifies your completed work, it will appear here.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {vaultByLocation.map(({ locId, label: locLabel, address, jobs: locJobs }) => {
                    const isCollapsed = collapsedLocations.has(locId);
                    const locTotal = locJobs.reduce((s: number, j: any) => s + (j.quote_amount || 0), 0);
                    return (
                      <div key={locId} style={card}>
                        {/* Location header */}
                        <button
                          onClick={() => setCollapsedLocations(prev => {
                            const next = new Set(prev);
                            if (next.has(locId)) next.delete(locId); else next.add(locId);
                            return next;
                          })}
                          style={{
                            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left' as const, borderBottom: isCollapsed ? 'none' : '1px solid #E5E3DF',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1A1A1A' }}>{locLabel}</div>
                            {address && <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: '2px' }}>{address}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' as const }}>
                              <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{locJobs.length} job{locJobs.length !== 1 ? 's' : ''}</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#16A34A' }}>
                                ${locTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                            <span style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>{isCollapsed ? '▶' : '▼'}</span>
                          </div>
                        </button>

                        {/* Job rows */}
                        {!isCollapsed && (
                          <div style={{ padding: '8px 0' }}>
                            {locJobs.map((job: any, idx: number) => {
                              const report = job.service_reports?.[0];
                              const photos: string[] = report?.photo_urls || [];
                              const dispute = job.disputes?.[0];
                              return (
                                <div key={job.id} style={{
                                  padding: '14px 20px',
                                  borderBottom: idx < locJobs.length - 1 ? '1px solid #F3F4F6' : 'none',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '0.85rem', color: '#1A1A1A', fontWeight: 500, marginBottom: '3px' }}>
                                        {job.description?.slice(0, 80) || '—'}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{
                                          fontSize: '0.68rem', fontWeight: 'bold', letterSpacing: '0.5px',
                                          color: '#16A34A', background: '#F0FDF4', border: '1px solid #BBF7D0',
                                          padding: '2px 7px', borderRadius: '4px',
                                        }}>VERIFIED</span>
                                        {job.verified_at && (
                                          <span style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>
                                            {new Date(job.verified_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </span>
                                        )}
                                        {dispute && (
                                          <span style={{
                                            fontSize: '0.68rem', fontWeight: 'bold', letterSpacing: '0.5px',
                                            color: dispute.resolution === 'resolved' ? '#16A34A' : '#D97706',
                                            background: dispute.resolution === 'resolved' ? '#F0FDF4' : '#FFFBEB',
                                            border: `1px solid ${dispute.resolution === 'resolved' ? '#BBF7D0' : '#FDE68A'}`,
                                            padding: '2px 7px', borderRadius: '4px',
                                          }}>
                                            {dispute.resolution === 'resolved' ? 'DISPUTE RESOLVED' : 'DISPUTE'}
                                          </span>
                                        )}
                                      </div>
                                      {/* Completion notes */}
                                      {report?.notes && (
                                        <div style={{ marginTop: '8px', padding: '8px 10px', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '6px', fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.5 }}>
                                          <span style={{ fontSize: '0.62rem', fontWeight: 'bold', letterSpacing: '1px', color: '#9CA3AF', display: 'block', marginBottom: '3px' }}>COMPLETION NOTES</span>
                                          {report.notes}
                                        </div>
                                      )}
                                      {/* Photo thumbnails */}
                                      {photos.length > 0 && (
                                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                          {photos.slice(0, 4).map((url: string, pi: number) => (
                                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                              <img
                                                src={url} alt={`Photo ${pi + 1}`}
                                                style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '5px', border: '1px solid #E5E3DF', cursor: 'pointer' }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                              />
                                            </a>
                                          ))}
                                          {photos.length > 4 && (
                                            <div style={{ width: '52px', height: '52px', borderRadius: '5px', border: '1px solid #E5E3DF', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#6B7280', fontWeight: 600 }}>
                                              +{photos.length - 4}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    {job.quote_amount != null && (
                                      <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#16A34A' }}>
                                          ${Number(job.quote_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '2px' }}>earned</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {page === 'SETTINGS' && editVendor && (
            <div>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A' }}>Settings</h2>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF' }}>Manage your profile and connections</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', alignItems: 'start' }}>

                {/* ── Profile form ── */}
                <div style={{ ...card, padding: '24px' }}>
                  <div style={sectionLabel}>Company Profile</div>

                  <label style={labelStyle}>COMPANY NAME</label>
                  <input
                    style={inputStyle}
                    value={editVendor.company_name || ''}
                    onChange={e => setEditVendor(v => v ? { ...v, company_name: e.target.value } : v)}
                    placeholder="Your company name"
                  />

                  <label style={labelStyle}>CONTACT NAME</label>
                  <input
                    style={inputStyle}
                    value={editVendor.full_name || ''}
                    onChange={e => setEditVendor(v => v ? { ...v, full_name: e.target.value } : v)}
                    placeholder="Your name"
                  />

                  <label style={labelStyle}>SERVICE TYPE</label>
                  <input
                    style={inputStyle}
                    value={editVendor.service_type || ''}
                    onChange={e => setEditVendor(v => v ? { ...v, service_type: e.target.value } : v)}
                    placeholder="e.g. Plumbing, HVAC, Landscaping"
                  />

                  <label style={labelStyle}>BUSINESS ADDRESS</label>
                  <input
                    style={inputStyle}
                    value={editVendor.address || ''}
                    onChange={e => setEditVendor(v => v ? { ...v, address: e.target.value } : v)}
                    placeholder="Street, City, State"
                  />

                  <label style={labelStyle}>CONTACT EMAIL</label>
                  <input
                    style={{ ...inputStyle, marginBottom: '22px' }}
                    type="email"
                    value={editVendor.contact_email || ''}
                    onChange={e => setEditVendor(v => v ? { ...v, contact_email: e.target.value } : v)}
                    placeholder="email@company.com"
                  />

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={async () => {
                        if (!editVendor) return;
                        setSavingProfile(true);
                        const { error: e } = await supabase.from('vendors').update({
                          company_name: editVendor.company_name,
                          full_name: editVendor.full_name,
                          service_type: editVendor.service_type,
                          address: editVendor.address,
                          contact_email: editVendor.contact_email,
                        }).eq('id', editVendor.id);
                        setSavingProfile(false);
                        if (e) { alert('Save failed: ' + e.message); return; }
                        setVendor(editVendor);
                        setProfileSaved(true);
                        setTimeout(() => setProfileSaved(false), 2500);
                      }}
                      disabled={savingProfile}
                      style={{ ...btnPrimary, opacity: savingProfile ? 0.6 : 1 }}
                    >
                      {savingProfile ? 'Saving…' : 'Save Changes'}
                    </button>
                    {profileSaved && (
                      <span style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 500 }}>✓ Saved</span>
                    )}
                  </div>
                </div>

                {/* ── Right column ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Invite link */}
                  <div style={{ ...card, padding: '24px' }}>
                    <div style={sectionLabel}>Client Invite Link</div>
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '16px', lineHeight: 1.5 }}>
                      Share this link with property managers to connect with you on Lantell. Each link is single-use and expires after 7 days.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          if (!vendor) return;
                          setGeneratingInvite(true);
                          const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
                          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                          await supabase.from('vendor_invite_tokens').insert({
                            vendor_id: vendor.id, token, expires_at: expiresAt, used: false,
                          });
                          const link = `${window.location.origin}/connect/vendor/${token}`;
                          await navigator.clipboard.writeText(link).catch(() => {});
                          setGeneratingInvite(false);
                          setInviteLinkCopied(true);
                          setTimeout(() => setInviteLinkCopied(false), 3000);
                        }}
                        disabled={generatingInvite}
                        style={{ ...btnPrimary, opacity: generatingInvite ? 0.6 : 1 }}
                      >
                        {generatingInvite ? 'Generating…' : inviteLinkCopied ? '✓ Link Copied!' : 'Generate & Copy Link'}
                      </button>
                    </div>
                  </div>

                  {/* Client connections */}
                  <div style={{ ...card, padding: '24px' }}>
                    <div style={sectionLabel}>Client Connections ({clientConnections.length})</div>
                    {clientConnections.length === 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#9CA3AF', padding: '8px 0' }}>
                        No connected clients yet. Generate an invite link above and share it with a property manager.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {clientConnections.map((conn, i) => (
                          <div key={conn.pmId} style={{
                            padding: '12px 0',
                            borderBottom: i < clientConnections.length - 1 ? '1px solid #F3F4F6' : 'none',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                background: '#EFF6FF', color: '#2563EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 'bold',
                              }}>
                                {(conn.pmProfile?.company_name || conn.pmProfile?.full_name || 'PM')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1A1A1A' }}>
                                  {conn.pmProfile?.company_name || 'Unknown Company'}
                                </div>
                                {conn.pmProfile?.full_name && (
                                  <div style={{ fontSize: '0.72rem', color: '#9CA3AF' }}>{conn.pmProfile.full_name}</div>
                                )}
                              </div>
                            </div>
                            {conn.locations.length > 0 && (
                              <div style={{ marginLeft: '38px' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.8px', color: '#9CA3AF', marginBottom: '4px' }}>ASSIGNED LOCATIONS</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                  {conn.locations.map((loc: any) => (
                                    <span key={loc.id} style={{
                                      fontSize: '0.72rem', color: '#6B7280',
                                      background: '#F9FAFB', border: '1px solid #E5E3DF',
                                      padding: '2px 8px', borderRadius: '4px',
                                    }}>
                                      {loc.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sign out */}
                  <div style={{ ...card, padding: '20px' }}>
                    <div style={sectionLabel}>Account</div>
                    <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '14px' }}>
                      Signed in as <strong style={{ color: '#1A1A1A' }}>{vendor?.contact_email}</strong>
                    </p>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Sign out of Lantell?')) return;
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                      }}
                      style={{
                        background: 'transparent', color: '#DC2626', border: '1px solid #FEE2E2',
                        padding: '8px 18px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '0.85rem', fontFamily: 'sans-serif',
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '60px', background: '#FFFFFF', borderTop: '1px solid #E5E3DF',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          zIndex: 50, padding: '0 4px',
        }}>
          {([
            { p: 'DASHBOARD', label: 'Home', icon: (c: string) => <IcoDashboard color={c} /> },
            { p: 'MY_JOBS',   label: 'Jobs',     icon: (c: string) => <IcoJobs color={c} /> },
            { p: 'SCHEDULE',  label: 'Schedule', icon: (c: string) => <IcoCalendar color={c} /> },
            { p: 'EARNINGS',  label: 'Earnings', icon: (c: string) => <IcoEarnings color={c} /> },
            { p: 'VAULT',     label: 'Vault',    icon: (c: string) => <IcoVault color={c} /> },
          ] as { p: Page; label: string; icon: (c: string) => React.ReactNode }[]).map(({ p, label, icon }) => {
            const active = page === p;
            const c = active ? '#2563EB' : '#9CA3AF';
            return (
              <button key={p} onClick={() => setPage(p)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px', background: 'none', border: 'none',
                cursor: 'pointer', padding: '4px 0', color: c, fontSize: '0.6rem', fontWeight: active ? 600 : 'normal',
              }}>
                {icon(c)}
                {label}
              </button>
            );
          })}
        </nav>
      )}

      {/* ── SCOPE REQUEST MODAL ───────────────────────────────────────── */}
      {scopeJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>REQUEST SCOPE VISIT</h3>
                <p style={modalSub}>{scopeJob.locations?.label}</p>
              </div>
              <button onClick={() => setScopeJob(null)} style={modalClose}>✕</button>
            </div>
            <div style={modalJobPreview}>
              <div style={microLabel}>JOB</div>
              <p style={{ margin: 0, color: '#1A1A1A', fontSize: '0.88rem', lineHeight: 1.4 }}>{scopeJob.description}</p>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#6B7280', marginBottom: '18px', lineHeight: 1.5 }}>
              Propose a date and time to visit the property before submitting your quote. The PM can confirm or suggest an alternative.
            </p>
            <label style={labelStyle}>PROPOSED DATE & TIME *</label>
            <input type="datetime-local" value={scopeDatetime} min={minDatetime} onChange={e => setScopeDatetime(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setScopeJob(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button onClick={submitScopeRequest} disabled={submittingScope || !scopeDatetime} style={{ ...btnPrimary, flex: 1, opacity: !scopeDatetime ? 0.5 : 1 }}>
                {submittingScope ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUOTE SUBMISSION MODAL ────────────────────────────────────── */}
      {quotingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={modalCard}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>SUBMIT QUOTE</h3>
                <p style={modalSub}>{quotingJob.locations?.label}</p>
              </div>
              <button onClick={() => setQuotingJob(null)} style={modalClose}>✕</button>
            </div>
            <div style={modalJobPreview}>
              <div style={microLabel}>JOB</div>
              <p style={{ margin: 0, color: '#1A1A1A', fontSize: '0.88rem', lineHeight: 1.4 }}>{quotingJob.description}</p>
              {quotingJob.deadline && (
                <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>
                  Client deadline: {new Date(quotingJob.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <label style={labelStyle}>YOUR PRICE ($) *</label>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={quoteAmount} onChange={e => setQuoteAmount(e.target.value)} style={inputStyle} />
            <label style={labelStyle}>TIMEFRAME *</label>
            <input placeholder="e.g. 2–3 days, 1 week, same day" value={quoteTimeframe} onChange={e => setQuoteTimeframe(e.target.value)} style={inputStyle} />
            <label style={labelStyle}>NOTE TO CLIENT <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <textarea placeholder="Any caveats, assumptions, or context the client should know…" value={quoteNote} onChange={e => setQuoteNote(e.target.value)} style={{ ...inputStyle, height: '70px', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setQuotingJob(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button onClick={submitQuote} disabled={submittingQuote} style={{ ...btnPrimary, flex: 1 }}>
                {submittingQuote ? 'Submitting…' : 'Send Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK COMPLETE MODAL ───────────────────────────────────────── */}
      {completingJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ ...modalCard, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>COMPLETE JOB</h3>
                <p style={modalSub}>{completingJob.locations?.label}</p>
              </div>
              <button onClick={() => setCompletingJob(null)} style={modalClose}>✕</button>
            </div>
            <div style={modalJobPreview}>
              <div style={microLabel}>JOB</div>
              <p style={{ margin: 0, color: '#1A1A1A', fontSize: '0.88rem', lineHeight: 1.4 }}>{completingJob.description}</p>
            </div>
            <label style={labelStyle}>WORK COMPLETED *</label>
            <textarea
              placeholder="Describe the work completed, any issues encountered, and anything the client should know…"
              value={completionNotes} onChange={e => setCompletionNotes(e.target.value)}
              style={{ ...inputStyle, height: '100px', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 }}
            />
            <label style={labelStyle}>
              PHOTO EVIDENCE <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none', letterSpacing: 0 }}>(optional, up to 5)</span>
            </label>
            <div style={{ marginBottom: '24px' }}>
              <PhotoUpload bucket="job-photos" folder={completingJob.id} maxPhotos={5} onUploadComplete={(urls) => setCompletionPhotos(urls)} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCompletingJob(null)} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button
                onClick={submitCompletion}
                disabled={submittingCompletion || !completionNotes.trim()}
                style={{ ...btnPrimary, flex: 1, background: '#16A34A', opacity: !completionNotes.trim() ? 0.5 : 1 }}
              >
                {submittingCompletion ? 'Submitting…' : 'Submit & Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATION PANEL ────────────────────────────────────────── */}
      {showNotifPanel && (
        <>
          <div onClick={() => setShowNotifPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 900 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh',
            background: '#FFFFFF', borderLeft: '1px solid #E5E3DF',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', zIndex: 901,
            display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif',
            animation: '__lt_slideIn 0.2s ease-out',
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E3DF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '1.5px', color: '#1A1A1A' }}>NOTIFICATIONS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {unreadCount > 0 && (
                  <button onClick={markNotificationsRead} style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#2563EB', cursor: 'pointer', padding: 0, fontFamily: 'sans-serif' }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setShowNotifPanel(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.85rem' }}>No notifications yet</div>
              ) : notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={async () => {
                    if (!notif.read) {
                      await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
                      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                    }
                  }}
                  style={{
                    padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
                    borderLeft: notif.read ? '3px solid transparent' : '3px solid #2563EB',
                    backgroundColor: notif.read ? '#FFFFFF' : '#F8FBFF',
                    cursor: notif.read ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: notif.read ? 'normal' : 600, color: '#1A1A1A', marginBottom: '3px' }}>{notif.title}</div>
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

// ─── Style constants ──────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = { background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.3px', fontFamily: 'sans-serif' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'sans-serif' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '11px 14px', marginBottom: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'sans-serif' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.68rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '7px', fontWeight: 'bold' };
const vaultLabel: React.CSSProperties = { fontSize: '0.63rem', color: '#9CA3AF', letterSpacing: '1px', textTransform: 'uppercase' as const, marginBottom: '5px' };

// Modal helpers
const modalCard: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '10px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontFamily: 'sans-serif' };
const modalHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' };
const modalTitle: React.CSSProperties = { margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1A1A1A', letterSpacing: '0.5px' };
const modalSub: React.CSSProperties = { margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.8rem' };
const modalClose: React.CSSProperties = { background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 };
const modalJobPreview: React.CSSProperties = { marginBottom: '18px', padding: '12px 14px', background: '#F9FAFB', border: '1px solid #E5E3DF', borderRadius: '8px' };
const microLabel: React.CSSProperties = { fontSize: '0.63rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '4px', fontWeight: 'bold' };

// Card / section helpers (used in page content)
const card: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const sectionLabel: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 'bold', color: '#9CA3AF', letterSpacing: '1.5px', marginBottom: '14px', textTransform: 'uppercase' as const };

export default VendorDashboard;