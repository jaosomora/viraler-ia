import React from 'react';

const sizes = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

/**
 * Wordmark de marca: "AlgoSentido" (Sentido en azul) + sufijo ESTUDIO.
 * Única fuente de verdad del logo — no recrear a mano en otros componentes.
 */
const Wordmark = ({ size = 'md', suffix = 'Estudio', className = '' }) => (
  <span className={`inline-flex items-baseline gap-2 select-none ${className}`}>
    <span className={`font-display font-semibold tracking-tight leading-none ${sizes[size] || sizes.md}`}>
      Algo<span className="text-accent dark:text-accent-bright">Sentido</span>
    </span>
    {suffix && (
      <span className="text-[0.62em] font-semibold uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400 leading-none">
        {suffix}
      </span>
    )}
  </span>
);

export default Wordmark;
