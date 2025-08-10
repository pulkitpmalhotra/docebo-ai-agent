export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Docebo AI Assistant
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Main page is now working!
        </p>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-sm text-gray-500">
            Build time: {new Date().toISOString()}
          </p>
        </div>
      </div>
    </div>
  );
}
