import React, { useState } from 'react';

/**
 * Tooltip de ayuda inline. Se muestra como un "?" pequeño junto a labels;
 * al hacer hover aparece la explicación. Usar para conceptos no obvios
 * (qué hace cada control, por qué importa).
 */
const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      {children}
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-1 w-3.5 h-3.5 rounded-full bg-ink-200 dark:bg-ink-700 text-[9px] text-ink-500 dark:text-ink-300 flex items-center justify-center transition-colors hover:bg-accent-soft hover:text-accent dark:hover:bg-accent-deep dark:hover:text-accent-bright cursor-help"
        aria-label="ayuda"
        tabIndex={-1}
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-56 px-3 py-2 bg-ink-800 border border-ink-700 text-paper text-xs leading-snug rounded-xl shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
