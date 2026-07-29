import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * The standard admin modal.
 *
 * Wraps Radix Dialog rather than hand-rolling: Escape handling, overlay click,
 * focus trap, focus restore, scroll lock and the ARIA wiring all come with it.
 * Hand-written focus traps get tab order, shift-tab at the boundary and focus
 * restoration subtly wrong, and that fight is already won.
 *
 * Radix is used headless here — it ships unstyled and is painted with the
 * existing `.modal-overlay` / `.modal-card` rules in styles.css. It brings no
 * Tailwind and no shadcn with it.
 *
 * Every modal gets both a header X and a footer Cancel: on a tall form the
 * header X scrolls out of view, which used to leave no visible way out.
 */
interface ModalProps {
  /**
   * Drive this rather than conditionally rendering the whole Modal. Unmounting
   * it to close tears the dialog down in a single commit, and Radix then never
   * sees the open→closed transition it restores focus on — the trigger loses
   * focus to <body>. Closed renders nothing, so keeping it mounted is free.
   */
  open: boolean;
  onClose: () => void;
  title: string;
  /** Sub-heading under the title, for context the form itself cannot carry. */
  description?: ReactNode;
  /** Action buttons. Cancel is appended automatically — do not pass one. */
  footer?: ReactNode;
  /** Overrides the default `.modal-card` width, e.g. 'min(720px, 100%)'. */
  width?: string;
  /**
   * Delete confirmations: a click on the backdrop no longer dismisses, so the
   * choice has to be made deliberately. Escape still closes — see below.
   */
  destructive?: boolean;
  cancelLabel?: string;
  children: ReactNode;
}

/**
 * Whether an event target sits inside a printed-document overlay.
 *
 * Guards against a non-Element target (Radix passes the original event target,
 * which can be the document itself on some interactions).
 */
function isInsideDocumentOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('.doc-overlay');
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  width,
  destructive = false,
  cancelLabel = 'Cancel',
  children,
}: ModalProps) {
  // Radix hands focus back to its <Dialog.Trigger> on close. These modals are
  // opened from wherever the user happened to be — a row's Edit button, a
  // toolbar action — so there is no Trigger to hand it to, and focus would
  // otherwise land on <body>: a keyboard user closing the dialog gets dropped
  // at the top of the page instead of back at the control they came from.
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        {/*
          Content sits inside Overlay so the existing `place-items: center` grid
          keeps centring it. As siblings they would need new positioning CSS,
          and the rendered result has to stay identical to the markup this
          replaces.
        */}
        <Dialog.Overlay className="modal-overlay">
          <Dialog.Content
            className="modal-card"
            style={width ? { width } : undefined}
            // A destructive dialog is confirmed or cancelled explicitly, never
            // dismissed by a stray click on the backdrop. Escape still closes:
            // it resolves to Cancel, which is the safe direction, and screen
            // reader users expect a dialog to yield to it.
            //
            // The document overlay is the other case. It renders above this
            // dialog (z-index 200 against 100) but portals to <body>, so Radix
            // counts every click inside it — Print, Close, selecting text — as
            // an interaction *outside* the dialog and dismisses the form
            // underneath. A user who opened an invoice from a half-filled deal
            // lost everything they had typed. It is on top of the dialog, not
            // outside it, and the guard lives here rather than at each call site
            // so a modal added later cannot forget it.
            onInteractOutside={(e) => {
              if (isInsideDocumentOverlay(e.target)) { e.preventDefault(); return; }
              if (destructive) e.preventDefault();
            }}
            // Same reasoning for Escape: while a document is open, Escape
            // belongs to the document — it closes that and leaves the form
            // behind it intact. DocumentView handles its own.
            onEscapeKeyDown={(e) => {
              if (document.querySelector('.doc-overlay')) e.preventDefault();
            }}
            // Fires before focus moves inside, so this is still the control the
            // user opened the dialog from.
            onOpenAutoFocus={() => { restoreFocusTo.current = document.activeElement as HTMLElement | null; }}
            onCloseAutoFocus={(e) => { e.preventDefault(); restoreFocusTo.current?.focus(); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <Dialog.Title style={{ margin: 0, fontSize: 'var(--fs-500)' }}>{title}</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close" style={{ background: 'transparent', border: 0, padding: 4, cursor: 'pointer', color: 'inherit', flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>

            {description && (
              <Dialog.Description style={{ fontSize: 'var(--fs-200)', color: 'var(--ws-fg-muted)', margin: 0 }}>
                {description}
              </Dialog.Description>
            )}

            {children}

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Dialog.Close asChild>
                <button type="button" className="btn-ghost">
                  {cancelLabel}
                </button>
              </Dialog.Close>
              {footer}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
