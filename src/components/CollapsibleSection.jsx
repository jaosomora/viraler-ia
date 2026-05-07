import React, { useState, useEffect } from 'react';

/**
 * Sección colapsable con persistencia en localStorage. Reduce el scroll del editor
 * agrupando controles relacionados.
 */
const CollapsibleSection = ({ id, title, icon, badge, defaultOpen = true, children }) => {
  const storageKey = `clipeditor.section.${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return defaultOpen;
      return stored === '1';
    } catch { return defaultOpen; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, open ? '1' : '0'); } catch {}
  }, [open, storageKey]);

  return (
    <section className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
      >
        {icon && <span className="text-base shrink-0">{icon}</span>}
        <h4 className="text-xs uppercase tracking-wide text-gray-700 dark:text-gray-300 font-semibold flex-1">
          {title}
        </h4>
        {badge && <span className="text-[10px] text-gray-500">{badge}</span>}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
          {children}
        </div>
      )}
    </section>
  );
};

export default CollapsibleSection;
