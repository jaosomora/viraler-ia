import React, { useState } from 'react';
import SavedTranscriptions from '../components/SavedTranscriptions';
import SavedConversions from '../components/SavedConversions';
import SavedClips from '../components/SavedClips';
import SavedReels from '../components/SavedReels';

const TABS = [
  { id: 'transcriptions', label: 'Transcripciones' },
  { id: 'clips', label: 'Clips' },
  { id: 'reels', label: 'Reels' },
  { id: 'conversions', label: 'Conversiones' },
];

const MyResults = () => {
  const [activeTab, setActiveTab] = useState('transcriptions');

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Mis Resultados
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Aqui encontraras todas tus transcripciones, clips y conversiones guardadas
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition ${
                activeTab === t.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'transcriptions' && <SavedTranscriptions />}
      {activeTab === 'clips' && <SavedClips />}
      {activeTab === 'reels' && <SavedReels />}
      {activeTab === 'conversions' && <SavedConversions />}
    </div>
  );
};

export default MyResults;
