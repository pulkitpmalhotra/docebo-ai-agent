export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold mb-4 text-center text-gray-800">
          Docebo AI Agent
        </h1>
        <p className="text-lg mb-8 text-center text-gray-600">
          AI-powered Docebo administration assistant
        </p>
        
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">System Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Next.js App:</span>
              <span className="text-green-600 font-medium">✓ Running</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Vercel Deployment:</span>
              <span className="text-green-600 font-medium">✓ Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">API Routes:</span>
              <span className="text-yellow-600 font-medium">⚠ Testing</span>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Ready to test API endpoints
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
