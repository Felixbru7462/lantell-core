import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PhotoUpload } from '../../components/PhotoUpload';

interface SmartBookingProps {
  locationId: string;
  onClose: () => void;
  onJobCreated: () => void;
}

export function SmartBooking({ locationId, onClose, onJobCreated }: SmartBookingProps) {
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [deadline, setDeadline] = useState('');
  const [vendors, setVendors] = useState<any[]>([]);
  const [locationLabel, setLocationLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [locationId]);

  async function loadData() {
    setLoadingData(true);
    const { data: loc } = await supabase
      .from('locations').select('label').eq('id', locationId).single();
    if (loc) setLocationLabel(loc.label);

    // Only vendors assigned to this specific location via location_services
    const { data: lsData } = await supabase
      .from('location_services')
      .select(`vendors(id, company_name, full_name, service_type)`)
      .eq('location_id', locationId)
      .eq('status', 'accepted');

    if (lsData) {
      setVendors(lsData.map((ls: any) => ls.vendors).filter(Boolean));
    }
    setLoadingData(false);
  }

  async function handleCreate() {
    if (!description.trim()) return alert('Please describe the work to be done.');
    if (!selectedVendor) return alert('Please select a vendor to send this job to.');
    if (!deadline) return alert('Please set a deadline.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('jobs').insert({
        owner_id: user.id,
        location_id: locationId,
        vendor_id: selectedVendor,
        description: description.trim(),
        objectives: objectives.trim() || null,
        deadline,
        status: 'PENDING_ACCEPTANCE',
        payment_status: 'unpaid',
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      });
      if (error) throw error;

      // Notify vendor
      const { data: vendorData } = await supabase
        .from('vendors').select('owner_id').eq('id', selectedVendor).single();
      if (vendorData?.owner_id) {
        await supabase.from('notifications').insert({
          user_id: vendorData.owner_id,
          title: 'New Job Request',
          body: `You have a new job request at ${locationLabel}: "${description.trim().slice(0, 80)}${description.length > 80 ? '...' : ''}"`,
          link: '/vendor',
        });
      }

      onJobCreated();
    } catch (err: any) {
      alert('Failed to create job: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E3DF', borderRadius: '10px', padding: '30px', width: '100%', maxWidth: '520px', color: '#1A1A1A', fontFamily: 'sans-serif', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', letterSpacing: '1px', color: '#1A1A1A', fontWeight: 'bold' }}>NEW SERVICE REQUEST</h3>
            {locationLabel && <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.82rem' }}>{locationLabel}</p>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>✕</button>
        </div>

        {loadingData ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>Loading...</p>
        ) : (
          <>
            <label style={labelStyle}>SEND TO VENDOR *</label>
            {vendors.length === 0 ? (
              <div style={{ padding: '12px 14px', marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '6px', fontSize: '0.85rem', color: '#DC2626' }}>
                No vendors assigned to this location. Go to the Locations tab and assign a vendor first.
              </div>
            ) : (
              <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} style={inputStyle}>
                <option value="">— Select a vendor —</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.company_name || v.full_name}{v.service_type ? ` · ${v.service_type}` : ''}
                  </option>
                ))}
              </select>
            )}

            <label style={labelStyle}>JOB DESCRIPTION *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the work needed in detail. The vendor will use this to decide whether to accept and quote."
              style={{ ...inputStyle, height: '100px', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 }}
            />

            <label style={labelStyle}>
              OBJECTIVES / CHECKLIST{' '}
              <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={objectives}
              onChange={e => setObjectives(e.target.value)}
              placeholder="e.g. Fix leaking pipe under sink in unit 3, check water pressure throughout building..."
              style={{ ...inputStyle, height: '70px', resize: 'vertical', fontFamily: 'sans-serif', lineHeight: 1.5 }}
            />

            <label style={labelStyle}>DEADLINE *</label>
            <input
              type="date"
              value={deadline}
              min={today}
              onChange={e => setDeadline(e.target.value)}
              style={inputStyle}
            />
            <p style={{ margin: '-10px 0 20px 0', fontSize: '0.72rem', color: '#9CA3AF' }}>
              The vendor will see this when reviewing the request. They will provide their own timeframe with their quote.
            </p>

            <label style={labelStyle}>
              PHOTOS{' '}
              <span style={{ color: '#9CA3AF', fontWeight: 'normal', fontSize: '0.65rem', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <div style={{ marginBottom: '20px' }}>
              <PhotoUpload
                bucket="job-photos"
                folder={locationId}
                maxPhotos={5}
                onUploadComplete={(urls) => setPhotoUrls(urls)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button
                onClick={handleCreate}
                disabled={loading || vendors.length === 0}
                style={{ ...btnPrimary, flex: 1, opacity: vendors.length === 0 ? 0.5 : 1 }}
              >
                {loading ? 'Sending...' : 'Send to Vendor'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '11px 14px', marginBottom: '16px', background: '#FFFFFF', border: '1px solid #E5E3DF', color: '#1A1A1A', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.7rem', color: '#9CA3AF', letterSpacing: '1px', marginBottom: '7px', fontWeight: 'bold' };
const btnPrimary: React.CSSProperties = { background: '#2563EB', color: '#FFFFFF', border: 'none', padding: '11px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' };
const btnSecondary: React.CSSProperties = { background: 'transparent', color: '#6B7280', border: '1px solid #E5E3DF', padding: '11px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' };