// src/pages/NewScriptPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getClientById } from '../services/clientService';
import { createScript } from '../services/scriptService';
import { transcribeVideo } from '../services/api';
import Spinner from '../components/Spinner';

const NewScriptPage = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [formData, setFormData] = useState({
    idea: '',
    inspirationUrl: '',
    cta: 'Ninguno',
    durationSeconds: 60,
    awarenessLevel: 0,
    additionalNotes: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [inspirationTranscript, setInspirationTranscript] = useState('');
  const [error, setError] = useState(null);

  // Cargar datos del cliente
  useEffect(() => {
    const fetchClient = async () => {
      try {
        setIsLoading(true);
        const clientData = await getClientById(clientId);
        setClient(clientData);
        setError(null);
      } catch (error) {
        setError('Error al cargar el cliente');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClient();
  }, [clientId]);

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Transcribir URL de inspiración
  const handleTranscribe = async () => {
    const { inspirationUrl } = formData;
    if (!inspirationUrl) return;
    
    try {
      setIsTranscribing(true);
      setError(null);
      const result = await transcribeVideo(inspirationUrl);
      setInspirationTranscript(result.transcript || '');
    } catch (error) {
      setError('Error al transcribir el video: ' + error.message);
      console.error(error);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Enviar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      
      // Preparar datos del guión
      const scriptData = {
        ...formData,
        durationSeconds: parseInt(formData.durationSeconds, 10),
        awarenessLevel: parseInt(formData.awarenessLevel, 10)
      };
      
      // Si hay transcripción, incluirla
      if (inspirationTranscript) {
        scriptData.inspirationTranscript = inspirationTranscript;
      }
      
      // Crear guión
      const createdScript = await createScript(clientId, scriptData);
      
      // Navegar al guión creado
      navigate(`/scripts/${createdScript.id}`);
    } catch (error) {
      setError('Error al crear el guión: ' + error.message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !client) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!client && error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p>{error}</p>
        <button
          onClick={() => navigate('/clientes')}
          className="mt-2 text-red-700 dark:text-red-400 underline"
        >
          Volver a la lista de clientes
        </button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Cliente no encontrado</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">El cliente que buscas no existe o ha sido eliminado.</p>
        <Link
          to="/clientes"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div>
        <Link
          to={`/clientes/${clientId}`}
          className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-2"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al cliente
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Nuevo guión viral</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Cliente: <span className="font-medium text-gray-900 dark:text-white">{client.name}</span>
        </p>
      </div>

      {/* Formulario */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Idea principal */}
          <div>
            <label htmlFor="idea" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Idea principal <span className="text-red-500">*</span>
            </label>
            <textarea
              id="idea"
              name="idea"
              rows="3"
              required
              placeholder="Describe la idea principal de tu guión"
              value={formData.idea}
              onChange={handleInputChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            ></textarea>
          </div>

          {/* URL de inspiración */}
          <div>
            <label htmlFor="inspirationUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL de inspiración (opcional)
            </label>
            <div className="flex space-x-2">
              <input
                id="inspirationUrl"
                name="inspirationUrl"
                type="text"
                placeholder="URL de un video de Instagram, TikTok o YouTube"
                value={formData.inspirationUrl}
                onChange={handleInputChange}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleTranscribe}
                disabled={!formData.inspirationUrl || isTranscribing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-70 flex items-center"
              >
                {isTranscribing ? <Spinner size="sm" className="mr-2" /> : null}
                Transcribir
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Añade una URL para inspirarte en contenido existente
            </p>
          </div>

          {/* Transcripción */}
          {inspirationTranscript && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Transcripción del video
              </label>
              <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700 max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                  {inspirationTranscript}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* CTA */}
            <div>
              <label htmlFor="cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Call to Action
              </label>
              <select
                id="cta"
                name="cta"
                value={formData.cta}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="Ninguno">Ninguno</option>
                <option value="Seguir">Seguir</option>
                <option value="Comentar">Comentar</option>
                <option value="Mencionar">Mencionar</option>
                <option value="Compartir">Compartir</option>
                <option value="Guardar">Guardar</option>
              </select>
            </div>

            {/* Duración */}
            <div>
              <label htmlFor="durationSeconds" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duración (segundos)
              </label>
              <input
                id="durationSeconds"
                name="durationSeconds"
                type="number"
                min="15"
                max="300"
                value={formData.durationSeconds}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Nivel de conciencia */}
            <div>
              <label htmlFor="awarenessLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nivel de conciencia
              </label>
              <select
                id="awarenessLevel"
                name="awarenessLevel"
                value={formData.awarenessLevel}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="0">Nivel 0 - No consciente</option>
                <option value="1">Nivel 1 - Consciente del problema</option>
                <option value="2">Nivel 2 - Buscando soluciones</option>
                <option value="3">Nivel 3 - Conoce la solución</option>
                <option value="4">Nivel 4 - Conoce el producto</option>
              </select>
            </div>
          </div>

          {/* Notas adicionales */}
          <div>
            <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas adicionales (opcional)
            </label>
            <textarea
              id="additionalNotes"
              name="additionalNotes"
              rows="3"
              placeholder="Añade cualquier instrucción o nota adicional para generar el guión"
              value={formData.additionalNotes}
              onChange={handleInputChange}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            ></textarea>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
              <p>{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3">
            <Link
              to={`/clientes/${clientId}`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-70 flex items-center gap-2"
            >
              {isLoading ? <Spinner size="sm" /> : null}
              {isLoading ? 'Generando guión...' : 'Generar guión viral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewScriptPage;
