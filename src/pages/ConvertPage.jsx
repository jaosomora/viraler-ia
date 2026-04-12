import React from 'react';
import ConvertForm from '../components/ConvertForm';
import ConversionResults from '../components/ConversionResults';
import { useConversionContext } from '../context/ConversionContext';

const ConvertPage = () => {
  const { currentConversion } = useConversionContext();

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent pb-2">
          Algo Sentido Tools: Convertir
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Convierte documentos PDF, DOCX, PPTX, XLSX y EPUB a Markdown
        </p>
      </div>

      <ConvertForm />

      {currentConversion && <ConversionResults />}
    </div>
  );
};

export default ConvertPage;
