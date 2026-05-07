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
        className="ml-1 w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-700 text-[9px] text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-purple-200 dark:hover:bg-purple-800 cursor-help"
        aria-label="ayuda"
        tabIndex={-1}
      >
        ?
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-56 px-2.5 py-1.5 bg-gray-900 dark:bg-black text-white text-[11px] leading-snug rounded-md shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
