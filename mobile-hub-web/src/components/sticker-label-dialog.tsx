'use client';

import { useState } from 'react';
import { money, type Product } from '@/lib/api';

interface StickerSettings {
  printer: 'dymo' | 'other';
  width: string;
  height: string;
  copies: string;
}

const defaults: StickerSettings = {
  printer: 'dymo',
  width: '36',
  height: '25',
  copies: '1'
};

function loadSettings(): StickerSettings {
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = window.localStorage.getItem('mobile-hub-sticker-settings');
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Partial<StickerSettings>;
    if (parsed.printer !== 'dymo' && parsed.printer !== 'other') {
      throw new Error('Saved printer type is invalid.');
    }
    return {
      printer: parsed.printer,
      width: parsed.width || defaults.width,
      height: parsed.height || defaults.height,
      copies: parsed.copies || defaults.copies
    };
  } catch (error) {
    console.error('Could not load saved sticker printer settings:', error instanceof Error ? error.message : 'Unknown settings error.');
    return defaults;
  }
}

export function StickerLabelDialog({
  product,
  onClose
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<StickerSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const width = Number(settings.width);
  const height = Number(settings.height);
  const copies = Number(settings.copies);
  const validDimensions = Number.isFinite(width) && width >= 10 && width <= 150 &&
    Number.isFinite(height) && height >= 10 && height <= 150;
  const validCopies = Number.isInteger(copies) && copies >= 1 && copies <= 100;

  function saveSettings() {
    if (!validDimensions || !validCopies) return;
    setSettingsError('');
    try {
      window.localStorage.setItem('mobile-hub-sticker-settings', JSON.stringify(settings));
      setSaved(true);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Could not save printer settings.');
    }
  }

  return (
    <div className="modal-backdrop sticker-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="product-dialog sticker-dialog" role="dialog" aria-modal="true" aria-labelledby="sticker-dialog-title">
        <div className="modal-close-row">
          <div><div className="eyebrow">PRODUCT LABELS</div><h2 id="sticker-dialog-title">{product ? 'Print product sticker.' : 'Sticker printer setup.'}</h2></div>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="sticker-printer-help">
          {settings.printer === 'dymo'
            ? 'DYMO printers are selected in your computer’s print dialog. Connect the printer and choose its label stock there.'
            : 'Choose your label printer in your computer’s print dialog after saving these label settings.'}
        </p>
        {product && (
          <div className="sticker-preview">
            <b>{[product.brand, product.name].filter(Boolean).join(' ')}</b>
            <span>{product.productCode ? `Code: ${product.productCode}` : ''}</span>
            <span>SKU: {product.sku}</span>
            {product.barcode && <span>Barcode: {product.barcode}</span>}
            <strong>{money(product.sellingPriceMinor, product.currency)}</strong>
          </div>
        )}
        <div className="sticker-settings-grid">
          <label>PRINTER<select value={settings.printer} onChange={event => setSettings(current => ({ ...current, printer: event.target.value as StickerSettings['printer'] }))}><option value="dymo">DYMO label printer</option><option value="other">Other label printer</option></select></label>
          <label>LABEL WIDTH (MM)<input type="number" min="10" max="150" step="1" value={settings.width} onChange={event => setSettings(current => ({ ...current, width: event.target.value }))} /></label>
          <label>LABEL HEIGHT (MM)<input type="number" min="10" max="150" step="1" value={settings.height} onChange={event => setSettings(current => ({ ...current, height: event.target.value }))} /></label>
          {product && <label>NUMBER OF COPIES<input type="number" min="1" max="100" step="1" value={settings.copies} onChange={event => setSettings(current => ({ ...current, copies: event.target.value }))} /></label>}
        </div>
        <p className="sticker-print-note">For accurate sticker sizing, choose the matching label stock in the print dialog and set scaling to 100% / Actual size.</p>
        {settingsError && <p className="notice notice-error" role="alert">{settingsError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Close</button>
          <button type="button" className="button button-quiet" onClick={saveSettings}>Save printer settings</button>
          {saved && <span className="sticker-saved">Settings saved</span>}
          {product && <button type="button" className="button" disabled={!validDimensions || !validCopies} onClick={() => window.print()}>Print sticker ↗</button>}
        </div>
        {product && validDimensions && validCopies && (
          <>
            <style>{`@media print{@page{size:${width}mm ${height}mm;margin:0}}`}</style>
            <div className="sticker-print-sheet" aria-hidden="true">
              {Array.from({ length: copies }, (_, index) => (
                <div className="sticker-print-label" key={index} style={{ width: `${width}mm`, height: `${height}mm` }}>
                  <b>{[product.brand, product.name].filter(Boolean).join(' ')}</b>
                  {product.productCode && <span>Code: {product.productCode}</span>}
                  <span>SKU: {product.sku}</span>
                  {product.barcode && <span>Barcode: {product.barcode}</span>}
                  <strong>{money(product.sellingPriceMinor, product.currency)}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
