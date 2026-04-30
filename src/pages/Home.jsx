import React from 'react';
import TranscriptionForm from '../components/TranscriptionForm';
import TranscriptionResults from '../components/TranscriptionResults';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const Home = () => {
  const { currentTranscription } = useTranscriptionContext();

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-2">
          Transcribir Video o Audio
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Transcribe videos de YouTube, Instagram, TikTok y Facebook, o sube tus propios audios (MP3, audios de WhatsApp) y archivos de video
        </p>
      </div>
      
      <TranscriptionForm />
      
      {currentTranscription && <TranscriptionResults />}
    </div>
  );
};

export default Home;