import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { NumberField } from './NumberField';
import { api, errorMessage } from '../lib/api';
import type { Contract } from '../types';

/**
 * Signature capture and placement for a contract.
 *
 * Placement is expressed as fractions of the page rather than points, and the
 * page here is drawn as a proportional outline rather than a rendered preview
 * of the real document — rendering the PDF would mean pulling in pdf.js, and
 * the bundle is already large. The server applies the same fractions to the
 * real page, so the placement is accurate even though the backdrop is
 * schematic.
 */

/** A4 aspect ratio, matching the most likely contract page shape. */
const PAGE_ASPECT = 297 / 210;

interface SignContractModalProps {
  open: boolean;
  contract: Contract | null;
  onClose: () => void;
  onSigned: () => void;
}

export function SignContractModal({ open, contract, onClose, onSigned }: SignContractModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [saveForNextTime, setSaveForNextTime] = useState(false);
  const [page, setPage] = useState(1);
  const [placement, setPlacement] = useState({ x: 0.6, y: 0.8 });
  const [widthFrac, setWidthFrac] = useState(0.25);
  const [signing, setSigning] = useState(false);

  // Offer the saved signature so a repeat signer need not redraw. Absence is
  // the normal case, not an error, so a failed lookup is silent.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.adminMySignature()
      .then((r) => { if (!cancelled) setSavedSignature(r.image); })
      .catch(() => { if (!cancelled) setSavedSignature(null); });
    return () => { cancelled = true; };
  }, [open]);

  // Reset between contracts so one signing never bleeds into the next.
  useEffect(() => {
    if (!open) return;
    setHasInk(false);
    setUsingSaved(false);
    setSaveForNextTime(false);
    setPage(1);
    setPlacement({ x: 0.6, y: 0.8 });
    setWidthFrac(0.25);
    clearCanvas();
  }, [open, contract?.id]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    // The canvas backing store is larger than its CSS box for a crisp line, so
    // pointer coordinates have to be scaled into backing-store space.
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'var(--ws-fg)';
  }

  function continueStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function endStroke() {
    drawing.current = false;
  }

  async function submit() {
    if (!contract) return;
    const image = usingSaved ? savedSignature : (hasInk ? canvasRef.current?.toDataURL('image/png') : null);
    if (!image) {
      toast.error('Draw a signature first');
      return;
    }
    setSigning(true);
    try {
      await api.adminSignContract(contract.id, {
        image,
        page,
        x: placement.x,
        y: placement.y,
        width_frac: widthFrac,
        // Re-saving an already-saved signature would be a no-op replace.
        save_signature: saveForNextTime && !usingSaved,
      });
      toast.success('Contract signed');
      onSigned();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not sign the contract'));
    } finally {
      setSigning(false);
    }
  }

  const previewImage = usingSaved ? savedSignature : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sign ${contract?.title ?? ''}`}
      description="Draw your signature, place it on the page, then sign. The unsigned document is kept as its own version."
      width="min(760px, 100%)"
      footer={
        <button type="button" onClick={submit} disabled={signing} className="primary" style={{ minHeight: '44px', padding: '0 20px' }}>
          {signing ? 'Signing…' : 'Sign contract'}
        </button>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px', gap: '16px', alignItems: 'start' }}>
        <div>
          <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Signature</label>
          {previewImage ? (
            <div style={{ border: '1px solid var(--ws-border-strong)', borderRadius: '6px', background: 'var(--ws-panel)', padding: '8px', textAlign: 'center' }}>
              <img src={previewImage} alt="Saved signature" style={{ maxWidth: '100%', maxHeight: '120px' }} />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={600}
              height={180}
              onPointerDown={startStroke}
              onPointerMove={continueStroke}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              style={{ width: '100%', height: '180px', border: '1px solid var(--ws-border-strong)', borderRadius: '6px', background: 'var(--ws-panel)', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
            />
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
            {!usingSaved && (
              <button type="button" onClick={clearCanvas} style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 12px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', cursor: 'pointer' }}>
                Clear
              </button>
            )}
            {savedSignature && (
              <button type="button" onClick={() => setUsingSaved((v) => !v)} style={{ background: 'var(--ws-canvas)', border: '1px solid var(--ws-border)', borderRadius: '4px', padding: '6px 12px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg)', cursor: 'pointer' }}>
                {usingSaved ? 'Draw a new one' : 'Use my saved signature'}
              </button>
            )}
            {!usingSaved && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>
                <input type="checkbox" checked={saveForNextTime} onChange={(e) => setSaveForNextTime(e.target.checked)} style={{ width: 'auto' }} />
                Save for next time
              </label>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Placement: click the page</label>
          {/* Schematic page, not a render of the document. The fractions taken
              from a click here are applied to the real page server-side. */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPlacement({
                x: Math.min(0.98, Math.max(0, (e.clientX - rect.left) / rect.width)),
                y: Math.min(0.98, Math.max(0, (e.clientY - rect.top) / rect.height)),
              });
            }}
            style={{ position: 'relative', width: '100%', aspectRatio: `1 / ${PAGE_ASPECT}`, border: '1px solid var(--ws-border-strong)', borderRadius: '4px', background: 'var(--ws-panel)', cursor: 'crosshair', overflow: 'hidden' }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${placement.x * 100}%`,
                top: `${placement.y * 100}%`,
                width: `${widthFrac * 100}%`,
                height: '14px',
                transform: 'translateY(-50%)',
                border: '1px dashed var(--ws-accent)',
                background: 'rgba(95,124,41,0.12)',
                borderRadius: '2px',
              }}
            />
          </div>
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Page</label>
            <NumberField min="1" step="1" value={page} onChange={setPage} style={{ fontSize: 'var(--fs-300)', padding: '8px 10px' }} />
          </div>
          <div style={{ marginTop: '6px' }}>
            <label style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)' }}>Width (% of page)</label>
            <NumberField
              min="5"
              max="90"
              value={Math.round(widthFrac * 100)}
              onChange={(pct) => setWidthFrac(Math.min(0.9, Math.max(0.05, pct / 100)))}
              style={{ fontSize: 'var(--fs-300)', padding: '8px 10px' }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
