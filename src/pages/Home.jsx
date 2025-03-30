import React from 'react';
import TranscriptionForm from '../components/TranscriptionForm';
import TranscriptionResults from '../components/TranscriptionResults';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const Home = () => {
  const { currentTranscription } = useTranscriptionContext();

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Viraler IA
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Extrae transcripciones de videos de forma automática y genera contenido con inteligencia artificial
        </p>
      </div>
      
      <TranscriptionForm />
      
      {currentTranscription && <TranscriptionResults />}
    </div>
  );
};

export default Home;