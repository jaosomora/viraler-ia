import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 gap-4">
      <span className="eyebrow">Error 404</span>
      <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
        Esta página no existe.
      </h1>
      <p className="text-ink-500 dark:text-ink-400 max-w-md">
        O nunca existió, o se movió a otro lugar. Lo importante: tus herramientas siguen donde siempre.
      </p>
      <Link to="/" className="btn btn-primary mt-4">
        Volver al estudio →
      </Link>
    </div>
  );
};

export default NotFound;
