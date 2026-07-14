import React from 'react';
import TranscriptionForm from '../components/TranscriptionForm';
import TranscriptionResults from '../components/TranscriptionResults';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const Home = () => {
  const { currentTranscription } = useTranscriptionContext();

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 py-4">
      <div className="flex flex-col items-start gap-3">
        <span className="eyebrow">De video a texto</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Transcribir video o audio
        </h1>
        <p className="text-ink-500 dark:text-ink-400">
          Transcribe videos de YouTube, Instagram, TikTok y Facebook (con opción de descargar
          el video original), o sube tus propios audios (MP3, audios de WhatsApp) y archivos de video.
        </p>
      </div>

      <TranscriptionForm />

      {currentTranscription && <TranscriptionResults />}
    </div>
  );
};

export default Home;
