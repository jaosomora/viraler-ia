import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Sistema de feedback de la casa: toasts + diálogo de confirmación.
 * Reemplaza alert()/confirm() nativos en toda la app.
 *
 *   const toast = useToast();
 *   toast('Clip regenerado', { type: 'ok' });
 *
 *   const confirmDialog = useConfirm();
 *   if (await confirmDialog({ title: '¿Eliminar clip?', message: 'No se puede deshacer.', danger: true })) { … }
 */

const FeedbackContext = createContext(null);

const TOAST_TTL = 4200;

const toastStyles = {
  info: 'border-ink-200 dark:border-ink-700',
  ok: 'border-ok/40 dark:border-ok-bright/40',
  warn: 'border-warn/40 dark:border-warn-bright/40',
  danger: 'border-danger/40 dark:border-danger-bright/40',
};

const toastDot = {
  info: 'bg-accent dark:bg-accent-bright',
  ok: 'bg-ok dark:bg-ok-bright',
  warn: 'bg-warn dark:bg-warn-bright',
  danger: 'bg-danger dark:bg-danger-bright',
};

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, { type = 'info', duration = TOAST_TTL } = {}) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    if (duration > 0) setTimeout(() => dismissToast(id), duration);
  }, [dismissToast]);

  const confirmDialog = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setConfirmState({
        title: opts.title || '¿Confirmas?',
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || (opts.danger ? 'Eliminar' : 'Confirmar'),
        cancelLabel: opts.cancelLabel || 'Cancelar',
        danger: Boolean(opts.danger),
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((prev) => {
      if (prev) prev.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmState) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  return (
    <FeedbackContext.Provider value={{ toast, confirmDialog }}>
      {children}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2.5rem)] sm:w-96">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`card animate-toast-in flex items-start gap-3 px-4 py-3 shadow-2xl border ${toastStyles[t.type] || toastStyles.info}`}
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${toastDot[t.type] || toastDot.info}`} />
              <p className="text-sm leading-snug flex-1">{t.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Cerrar aviso"
                className="text-ink-400 hover:text-ink-950 dark:hover:text-paper transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Diálogo de confirmación */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4 bg-ink-950/80 backdrop-blur-sm"
          onClick={() => closeConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.title}
            className="card w-full max-w-sm p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold tracking-tight">{confirmState.title}</h3>
            {confirmState.message && (
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{confirmState.message}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${confirmState.danger ? 'btn-danger' : 'btn-accent'}`}
                onClick={() => closeConfirm(true)}
                autoFocus
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useToast requiere <FeedbackProvider>');
  return ctx.toast;
};

export const useConfirm = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useConfirm requiere <FeedbackProvider>');
  return ctx.confirmDialog;
};
