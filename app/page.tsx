export default function Home() {
  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          🤖 NEW Docebo AI Chat Interface
        </h1>
        <p className="text-xl text-gray-600">
          This should be the NEW page! If you see this, the update worked.
        </p>
        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <p className="text-sm text-gray-500">
            Updated: {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
