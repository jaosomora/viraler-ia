import React from 'react';
import SavedTranscriptions from '../components/SavedTranscriptions';

const MyResults = () => {
  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Mis Resultados
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Aquí encontrarás todas tus transcripciones guardadas para acceder fácilmente a ellas cuando lo necesites
        </p>
      </div>
      
      <SavedTranscriptions />
    </div>
  );
};

export default MyResults;