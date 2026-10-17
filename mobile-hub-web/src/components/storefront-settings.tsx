'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { api, type StorefrontHours, type StorefrontProfile } from '@/lib/api';

const days = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']
] as const;

type DayKey = typeof days[number][0];
type WeeklySchedule = Record<DayKey, StorefrontHours>;

const defaultSchedule = (): WeeklySchedule => Object.fromEntries(
  days.map(([key]) => [key, { open: '10:00', close: '19:00', closed: key === 'sun' }])
) as WeeklySchedule;

function scheduleFrom(profile: StorefrontProfile): WeeklySchedule {
  const fallback = defaultSchedule();
  return Object.fromEntries(days.map(([key]) => {
    const hours = profile.branding.openingHours?.[key];
    return [key, hours && typeof hours === 'object' ? { ...fallback[key], ...hours } : fallback[key]];
  })) as WeeklySchedule;
}

export function StorefrontSettings({
  tenantId,
  shop,
  ecommerceEnabled,
  onSaved
}: {
  tenantId: string;
  shop: StorefrontProfile;
  ecommerceEnabled: boolean;
  onSaved: (shop: StorefrontProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(shop.branding.displayName || shop.name);
  const [logoUrl, setLogoUrl] = useState(shop.branding.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(shop.branding.primaryColor || '#155c47');
  const [secondaryColor, setSecondaryColor] = useState(shop.branding.secondaryColor || '#182521');
  const [contactPhone, setContactPhone] = useState(shop.branding.contactPhone || '');
  const [contactEmail, setContactEmail] = useState(shop.branding.contactEmail || '');
  const [address, setAddress] = useState(shop.branding.address || '');
  const [currency, setCurrency] = useState(shop.businessSettings?.currency || 'GBP');
  const [timeZone, setTimeZone] = useState(shop.businessSettings?.timeZone || 'Europe/London');
  const [description, setDescription] = useState(shop.branding.storefrontContent?.description || '');
  const [announcement, setAnnouncement] = useState(shop.branding.storefrontContent?.announcement || '');
  const [enabled, setEnabled] = useState(shop.branding.storefrontContent?.enabled !== false);
  const [socialLinks, setSocialLinks] = useState({
    facebook: shop.branding.storefrontContent?.socialLinks?.facebook || '',
    instagram: shop.branding.storefrontContent?.socialLinks?.instagram || '',
    tiktok: shop.branding.storefrontContent?.socialLinks?.tiktok || ''
  });
  const [schedule, setSchedule] = useState(() => scheduleFrom(shop));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const result = await api<{ shop: StorefrontProfile }>('shop/profile', {
        method: 'PATCH',
        headers: { 'x-tenant-id': tenantId },
        body: JSON.stringify({
          displayName,
          logoUrl,
          primaryColor,
          secondaryColor,
          contactPhone,
          contactEmail,
          address,
          currency,
          timeZone,
          description,
          announcement,
          storefrontEnabled: enabled,
          socialLinks,
          openingHours: schedule
        })
      });
      onSaved(result.shop);
      setMessage('Your shop settings are saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save shop settings.');
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day: DayKey, patch: Partial<StorefrontHours>) {
    setSchedule(current => ({ ...current, [day]: { ...current[day], ...patch } }));
  }

  return (
    <section className="storefront-settings">
      <div className="storefront-settings-heading">
        <div><div className="eyebrow">YOUR PUBLIC SHOP PAGE</div><h2>Make it feel like your shop.</h2><p>Set the details customers see when they browse your public catalogue.</p></div>
        <Link className="button button-small" href={`/shop/${shop.slug}`} target="_blank">Preview storefront ↗</Link>
      </div>
      {!ecommerceEnabled && <div className="notice notice-error">The storefront is hidden until the ecommerce feature is included in your active plan.</div>}
      <form onSubmit={saveSettings} className="storefront-settings-form">
        <div className="storefront-settings-card">
          <h3>Shop identity</h3>
          <div className="storefront-settings-grid">
            <label>Public shop name<input required minLength={2} maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
            <label>Logo image URL<input type="url" maxLength={2048} value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="https://…" /></label>
            <label>Primary brand colour<span className="storefront-color-input"><input type="color" value={primaryColor} onChange={event => setPrimaryColor(event.target.value)} /><input value={primaryColor} onChange={event => setPrimaryColor(event.target.value)} pattern="#[0-9a-fA-F]{6}" /></span></label>
            <label>Secondary brand colour<span className="storefront-color-input"><input type="color" value={secondaryColor} onChange={event => setSecondaryColor(event.target.value)} /><input value={secondaryColor} onChange={event => setSecondaryColor(event.target.value)} pattern="#[0-9a-fA-F]{6}" /></span></label>
          </div>
        </div>

        <div className="storefront-settings-card">
          <h3>Customer information</h3>
          <div className="storefront-settings-grid">
            <label>Phone number<input maxLength={40} value={contactPhone} onChange={event => setContactPhone(event.target.value)} placeholder="+44 7700 900000" /></label>
            <label>Contact email<input type="email" maxLength={254} value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="hello@example.com" /></label>
            <label>Shop address<input maxLength={300} value={address} onChange={event => setAddress(event.target.value)} placeholder="Street, town or city" /></label>
            <label>Default product currency<input required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} placeholder="GBP" /><small>Used for new products; existing products keep their current currency.</small></label>
            <label>Shop time zone<input required maxLength={100} value={timeZone} onChange={event => setTimeZone(event.target.value)} placeholder="Europe/London" /><small>Use an IANA name, such as Europe/London or Asia/Karachi.</small></label>
            <label className="storefront-field-wide">A short introduction<textarea maxLength={1000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Tell customers what makes your shop special." /></label>
            <label className="storefront-field-wide">Announcement<textarea maxLength={240} rows={2} value={announcement} onChange={event => setAnnouncement(event.target.value)} placeholder="An update or offer customers should know about." /></label>
          </div>
        </div>

        <div className="storefront-settings-card">
          <h3>Shop hours</h3>
          <p className="storefront-settings-hint">Shown on the public shop page using {timeZone || 'your shop time zone'}. Use 24-hour clock.</p>
          <div className="storefront-hours-editor">
            {days.map(([key, label]) => (
              <div className="storefront-hours-row" key={key}>
                <b>{label}</b>
                <label className="storefront-open-toggle"><input type="checkbox" checked={!schedule[key].closed} onChange={event => updateDay(key, { closed: !event.target.checked })} /> Open</label>
                <input aria-label={`${label} opening time`} type="time" disabled={schedule[key].closed} value={schedule[key].open} onChange={event => updateDay(key, { open: event.target.value })} />
                <span>to</span>
                <input aria-label={`${label} closing time`} type="time" disabled={schedule[key].closed} value={schedule[key].close} onChange={event => updateDay(key, { close: event.target.value })} />
                {schedule[key].closed && <span className="storefront-closed-label">Closed all day</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="storefront-settings-card">
          <h3>Social links & visibility</h3>
          <div className="storefront-settings-grid">
            <label>Facebook URL<input type="url" maxLength={2048} value={socialLinks.facebook} onChange={event => setSocialLinks(value => ({ ...value, facebook: event.target.value }))} placeholder="https://facebook.com/…" /></label>
            <label>Instagram URL<input type="url" maxLength={2048} value={socialLinks.instagram} onChange={event => setSocialLinks(value => ({ ...value, instagram: event.target.value }))} placeholder="https://instagram.com/…" /></label>
            <label>TikTok URL<input type="url" maxLength={2048} value={socialLinks.tiktok} onChange={event => setSocialLinks(value => ({ ...value, tiktok: event.target.value }))} placeholder="https://tiktok.com/@…" /></label>
          </div>
          <label className="storefront-visibility"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span><b>Make my storefront public</b><small>When turned off, customers cannot access this public page.</small></span></label>
        </div>

        {error && <div className="dashboard-alert" role="alert"><span>!</span>{error}</div>}
        {message && <p className="storefront-saved" role="status">{message}</p>}
        <button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shop settings'} <span>↗</span></button>
      </form>
    </section>
  );
}
