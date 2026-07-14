import React from 'react';
import ConvertForm from '../components/ConvertForm';
import ConversionResults from '../components/ConversionResults';
import { useConversionContext } from '../context/ConversionContext';

const ConvertPage = () => {
  const { currentConversion } = useConversionContext();

  return (
    <div className="max-w-3xl mx-auto w-full flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Convertir</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          De documento a Markdown
        </h1>
        <p className="text-ink-500 dark:text-ink-400">
          Convierte documentos PDF, DOCX, PPTX, XLSX y EPUB a Markdown o HTML.
        </p>
      </div>

      <ConvertForm />

      {currentConversion && <ConversionResults />}
    </div>
  );
};

export default ConvertPage;
