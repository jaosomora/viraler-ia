import React, { useState } from 'react';
import SavedTranscriptions from '../components/SavedTranscriptions';
import SavedConversions from '../components/SavedConversions';

const MyResults = () => {
  const [activeTab, setActiveTab] = useState('transcriptions');

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Mis Resultados
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Aqui encontraras todas tus transcripciones y conversiones guardadas
        </p>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('transcriptions')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition ${
              activeTab === 'transcriptions'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Transcripciones
          </button>
          <button
            onClick={() => setActiveTab('conversions')}
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition ${
              activeTab === 'conversions'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Conversiones
          </button>
        </div>
      </div>

      {activeTab === 'transcriptions' ? <SavedTranscriptions /> : <SavedConversions />}
    </div>
  );
};

export default MyResults;
