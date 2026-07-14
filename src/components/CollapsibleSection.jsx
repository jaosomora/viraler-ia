import React, { useState, useEffect } from 'react';

/**
 * Sección colapsable con persistencia en localStorage. Reduce el scroll del editor
 * agrupando controles relacionados.
 */
const CollapsibleSection = ({ id, title, icon, badge, defaultOpen = true, open: controlledOpen, onToggle, children }) => {
  const isControlled = controlledOpen !== undefined;
  const storageKey = `clipeditor.section.${id}`;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return defaultOpen;
      return stored === '1';
    } catch { return defaultOpen; }
  });
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  useEffect(() => {
    if (isControlled) return;
    try { localStorage.setItem(storageKey, uncontrolledOpen ? '1' : '0'); } catch {}
  }, [uncontrolledOpen, storageKey, isControlled]);

  const handleClick = () => {
    if (isControlled) { onToggle?.(); }
    else { setUncontrolledOpen(!uncontrolledOpen); }
  };

  return (
    <section className="border hairline rounded-xl overflow-hidden bg-white dark:bg-ink-900/50">
      <button
        type="button"
        onClick={handleClick}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-ink-100/60 dark:hover:bg-ink-800/40 transition-colors text-left"
      >
        {icon && <span className="text-base shrink-0">{icon}</span>}
        <h4 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold flex-1">
          {title}
        </h4>
        {badge && <span className="text-[10px] font-mono tabular-nums text-ink-400 dark:text-ink-500">{badge}</span>}
        <svg
          className={`w-4 h-4 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 py-4 border-t hairline">
          {children}
        </div>
      )}
    </section>
  );
};

export default CollapsibleSection;
