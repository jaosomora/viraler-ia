import React, { useState } from 'react';
import SavedTranscriptions from '../components/SavedTranscriptions';
import SavedConversions from '../components/SavedConversions';
import SavedClips from '../components/SavedClips';
import SavedReels from '../components/SavedReels';
import SavedIdeaMaps from '../components/SavedIdeaMaps';

const TABS = [
  { id: 'transcriptions', label: 'Transcripciones' },
  { id: 'clips', label: 'Clips' },
  { id: 'reels', label: 'Reels' },
  { id: 'idea_maps', label: 'Mapas de ideas' },
  { id: 'conversions', label: 'Conversiones' },
];

const MyResults = () => {
  const [activeTab, setActiveTab] = useState('transcriptions');

  return (
    <div className="flex flex-col space-y-8">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-2">
        <span className="eyebrow">Tus resultados</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Mis resultados
        </h1>
        <p className="text-ink-500 dark:text-ink-400">
          Todas tus transcripciones, clips, reels, mapas de ideas y conversiones en un solo lugar.
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        <div className="flex border-b border-ink-200 dark:border-ink-700 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? 'border-accent dark:border-accent-bright text-accent dark:text-accent-bright'
                  : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'transcriptions' && <SavedTranscriptions />}
      {activeTab === 'clips' && <SavedClips />}
      {activeTab === 'reels' && <SavedReels />}
      {activeTab === 'idea_maps' && <SavedIdeaMaps />}
      {activeTab === 'conversions' && <SavedConversions />}
    </div>
  );
};

export default MyResults;
