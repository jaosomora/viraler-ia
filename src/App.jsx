function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TranscriptionProvider>
        <Router>
          <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50">
            {/* <Header /> */}
            <header className="py-4 bg-white dark:bg-gray-800 shadow">
              <div className="container mx-auto">
                <h1 className="text-xl font-bold">Viraler IA</h1>
              </div>
            </header>
            <main className="flex-grow container mx-auto px-4 py-8">
              <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Aplicación en desarrollo</h2>
                <p>Versión simplificada para depuración</p>
              </div>
              {/* <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/mis-resultados" element={<MyResults />} />
                <Route path="*" element={<NotFound />} />
              </Routes> */}
            </main>
            {/* <Footer /> */}
            <footer className="py-4 bg-white dark:bg-gray-800 shadow-inner">
              <div className="container mx-auto text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">© 2025 Viraler IA</p>
              </div>
            </footer>
          </div>
        </Router>
      </TranscriptionProvider>
    </QueryClientProvider>
  );
}