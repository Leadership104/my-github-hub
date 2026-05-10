import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';

interface Props {
  onBack: () => void;
}

interface BusinessListing {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'restaurant', label: '🍽️ Restaurant / Food' },
  { value: 'retail', label: '🛍️ Retail / Shop' },
  { value: 'service', label: '🔧 Service / Professional' },
  { value: 'hotel', label: '🏨 Hotel / Lodging' },
  { value: 'finance', label: '💳 Finance / ATM' },
  { value: 'health', label: '🏥 Health / Medical' },
  { value: 'entertainment', label: '🎭 Entertainment' },
  { value: 'other', label: '📌 Other' },
];

function AuthGate({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-1 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <span className="ms text-2xl text-foreground">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-foreground">Business Account</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-kipita-navy/10 flex items-center justify-center">
          <span className="text-3xl">💼</span>
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-foreground mb-1">Sign In Required</h2>
          <p className="text-sm text-muted-foreground">Create an account or sign in to register your business on Kipita.</p>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event('kip-open-auth'))}
          className="bg-kipita-red text-white font-bold px-6 py-3 rounded-kipita text-sm"
        >
          Sign In / Create Account
        </button>
      </div>
    </div>
  );
}

function VerifyGate({ onBack }: { onBack: () => void }) {
  const [resent, setResent] = useState(false);

  const resendEmail = async () => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.resend({ type: 'signup', email: '' });
      setResent(true);
    } catch {
      setResent(true);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-1 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <span className="ms text-2xl text-foreground">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-foreground">Business Account</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-3xl">✉️</span>
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-foreground mb-1">Verify Your Email</h2>
          <p className="text-sm text-muted-foreground">You must verify your email address before registering a business listing.</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-kipita-sm p-4 text-xs text-amber-800 text-left w-full max-w-xs">
          <p className="font-bold mb-1">Why verification?</p>
          <p>Verified accounts help us maintain trust and quality in our business directory. Check your inbox for a confirmation link.</p>
        </div>
        {resent ? (
          <p className="text-xs text-emerald-600 font-semibold">Verification email sent! Check your inbox.</p>
        ) : (
          <button onClick={resendEmail} className="text-kipita-red font-semibold text-sm underline">
            Resend verification email
          </button>
        )}
      </div>
    </div>
  );
}

export default function BusinessScreen({ onBack }: Props) {
  const { user } = useAuth();

  const [listings, setListings] = useState<BusinessListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('restaurant');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isVerified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (!user || !isVerified) { setLoadingListings(false); return; }
    (async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase
          .from('business_listings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setListings((data as BusinessListing[]) || []);
      } catch { /* ignore */ } finally {
        setLoadingListings(false);
      }
    })();
  }, [user, isVerified]);

  const resetForm = () => {
    setFormName('');
    setFormCategory('restaurant');
    setFormAddress('');
    setFormPhone('');
    setFormWebsite('');
    setFormDescription('');
    setFormError(null);
    setEditingId(null);
  };

  const openNewForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (listing: BusinessListing) => {
    setFormName(listing.name);
    setFormCategory(listing.category);
    setFormAddress(listing.address);
    setFormPhone(listing.phone || '');
    setFormWebsite(listing.website || '');
    setFormDescription(listing.description || '');
    setFormError(null);
    setEditingId(listing.id);
    setShowForm(true);
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (d?.[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
      return null;
    } catch { return null; } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!formName.trim()) { setFormError('Business name is required.'); return; }
    if (!formAddress.trim()) { setFormError('Address is required.'); return; }

    setFormSaving(true);
    setFormError(null);

    const coords = await geocodeAddress(formAddress.trim());

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const payload = {
        user_id: user.id,
        name: formName.trim(),
        category: formCategory,
        address: formAddress.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        phone: formPhone.trim() || null,
        website: formWebsite.trim() || null,
        description: formDescription.trim() || null,
        status: 'pending',
      };

      if (editingId) {
        const { error } = await supabase.from('business_listings').update(payload).eq('id', editingId);
        if (error) throw error;
        setListings(prev => prev.map(l => l.id === editingId ? { ...l, ...payload } as BusinessListing : l));
        showToast('Listing updated!');
      } else {
        const { data, error } = await supabase.from('business_listings').insert(payload).select().single();
        if (error) throw error;
        setListings(prev => [data as BusinessListing, ...prev]);
        showToast('Business listed! Under review.');
      }
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save. Please try again.');
    }
    setFormSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.from('business_listings').delete().eq('id', id);
      setListings(prev => prev.filter(l => l.id !== id));
      setDeleteConfirm(null);
      showToast('Listing removed.');
    } catch { showToast('Failed to delete.'); }
  };

  if (!user) return <AuthGate onBack={onBack} />;
  if (!isVerified) return <VerifyGate onBack={onBack} />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-1 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <span className="ms text-2xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Business Account</h1>
          <p className="text-xs text-muted-foreground">List & manage your locations</p>
        </div>
        {!showForm && (
          <button
            onClick={openNewForm}
            className="flex items-center gap-1 text-xs text-white font-semibold bg-kipita-red px-3 py-2 rounded-full"
          >
            <span className="ms text-sm">add</span>
            Add Listing
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[400] bg-kipita-navy text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg max-w-[90%] text-center">
          {toast}
        </div>
      )}

      {showForm ? (
        /* ── Registration / Edit Form ── */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-muted-foreground text-sm flex items-center gap-1">
              <span className="ms text-base">arrow_back</span> Cancel
            </button>
            <h2 className="text-sm font-extrabold text-foreground ml-auto">{editingId ? 'Edit Listing' : 'New Business Listing'}</h2>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-kipita-sm">{formError}</div>
          )}

          {/* Business Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Business Name *</label>
            <input
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g. The Coffee House"
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Category *</label>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Address *</label>
            <input
              value={formAddress}
              onChange={e => setFormAddress(e.target.value)}
              placeholder="123 Main St, City, State, ZIP"
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red"
            />
            {geocoding && <p className="text-[10px] text-muted-foreground mt-1">Locating address on map…</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Phone <span className="normal-case font-normal">(optional)</span></label>
            <input
              value={formPhone}
              onChange={e => setFormPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              type="tel"
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red"
            />
          </div>

          {/* Website */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Website <span className="normal-case font-normal">(optional)</span></label>
            <input
              value={formWebsite}
              onChange={e => setFormWebsite(e.target.value)}
              placeholder="https://yourbusiness.com"
              type="url"
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Description <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Brief description of your business…"
              rows={3}
              className="w-full bg-muted rounded-kipita-sm px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-kipita-red resize-none"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-kipita-sm p-3 text-xs text-amber-800">
            <span className="font-bold">Note:</span> New listings are reviewed before going live on the map. Expect 1–2 business days.
          </div>

          <div className="flex gap-2 pb-4">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 py-3 rounded-kipita-sm bg-muted text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={formSaving || geocoding}
              className="flex-1 py-3 rounded-kipita-sm bg-kipita-red text-white text-sm font-bold disabled:opacity-50"
            >
              {formSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Submit Listing'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Listings Dashboard ── */
        <div className="flex-1 overflow-y-auto p-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-3 bg-kipita-navy/5 border border-kipita-navy/20 rounded-kipita-sm mb-4">
            <span className="text-xl flex-shrink-0">💼</span>
            <p className="text-xs text-foreground font-medium">
              Add your business location so travelers on Kipita can discover you. You must be a <strong>verified user</strong> to list.
            </p>
          </div>

          {loadingListings ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-kipita-red border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Loading your listings…</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🏪</div>
              <p className="text-sm font-semibold">No listings yet</p>
              <p className="text-xs mt-1">Tap <strong>Add Listing</strong> above to put your business on the map.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
              {listings.map(listing => (
                <div key={listing.id} className="bg-card border border-border rounded-kipita-sm overflow-hidden">
                  <div className="p-3 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-kipita-navy/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{CATEGORIES.find(c => c.value === listing.category)?.label.split(' ')[0] || '📌'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground truncate">{listing.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          listing.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          listing.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {listing.status === 'active' ? 'Live' : listing.status === 'rejected' ? 'Rejected' : 'Under Review'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{listing.address}</p>
                      {listing.phone && <p className="text-xs text-muted-foreground">{listing.phone}</p>}
                    </div>
                  </div>
                  <div className="border-t border-border flex">
                    <button
                      onClick={() => openEditForm(listing)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-kipita-navy hover:bg-muted transition-colors"
                    >
                      <span className="ms text-sm">edit</span> Edit
                    </button>
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => setDeleteConfirm(listing.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-kipita-red hover:bg-red-50 transition-colors"
                    >
                      <span className="ms text-sm">delete</span> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[300]" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-card rounded-2xl shadow-2xl z-[301] p-5 text-center">
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="text-base font-extrabold mb-1">Remove Listing?</h3>
            <p className="text-xs text-muted-foreground mb-4">This will permanently remove your business listing from Kipita.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-muted rounded-kipita-sm text-sm font-semibold">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-kipita-red text-white rounded-kipita-sm text-sm font-bold">Remove</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
