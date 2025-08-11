// app/test-enrollment/page.tsx - Simple Test Page
'use client';

import { useState } from 'react';

export default function SimpleEnrollmentTest() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState('51158');
  const [courseId, setCourseId] = useState('1');

  const runTest = async (testType: string) => {
    setLoading(true);
    try {
      const url = `/api/debug-enrollment-comprehensive?test=${testType}&userId=${userId}&courseId=${courseId}`;
      console.log('🔧 Testing:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      setResults({ testType, data, timestamp: new Date().toISOString() });
      console.log('🔧 Results:', data);
    } catch (error) {
      console.error('🔧 Test error:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">🔧 Quick Enrollment Test</h1>
        
        {/* Configuration */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">User ID</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a real user ID from your system"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Course ID</label>
              <input
                type="text"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a real course ID from your system"
              />
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Run Tests</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => runTest('comprehensive')}
              disabled={loading}
              className="bg-purple-500 text-white px-4 py-3 rounded hover:bg-purple-600 disabled:opacity-50"
            >
              🔍 Full Discovery
            </button>
            <button
              onClick={() => runTest('get')}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-3 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              📖 GET Tests
            </button>
            <button
              onClick={() => runTest('reports')}
              disabled={loading}
              className="bg-green-500 text-white px-4 py-3 rounded hover:bg-green-600 disabled:opacity-50"
            >
              📊 Reports
            </button>
            <button
              onClick={() => runTest('status')}
              disabled={loading}
              className="bg-orange-500 text-white px-4 py-3 rounded hover:bg-orange-600 disabled:opacity-50"
            >
              ⚡ Status Check
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-700">Testing endpoints...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Test Results: {results.testType || 'Error'}
            </h2>
            
            {results.error ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="text-red-700 font-medium">Error</div>
                <div className="text-red-600 mt-1">{results.error}</div>
              </div>
            ) : (
              <>
                {/* Summary */}
                {results.data?.summary && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                    <h3 className="font-medium text-green-800">Discovery Summary</h3>
                    <div className="text-green-700 mt-2">
                      <div>📊 Total Tested: {results.data.summary.total_tested}</div>
                      <div>✅ Successful: {results.data.summary.successful}</div>
                      <div>📈 Success Rate: {results.data.summary.success_rate}</div>
                    </div>
                  </div>
                )}

                {/* Working Endpoints */}
                {results.data?.successful_endpoints && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-4">
                    <h3 className="font-medium text-blue-800 mb-2">
                      ✅ Working Endpoints ({results.data.successful_endpoints.length})
                    </h3>
                    <div className="space-y-2">
                      {results.data.successful_endpoints.slice(0, 10).map((endpoint: any, index: number) => (
                        <div key={index} className="text-sm">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {endpoint.method} {endpoint.endpoint}
                          </span>
                          <span className="text-green-600 ml-2">({endpoint.status})</span>
                        </div>
                      ))}
                      {results.data.successful_endpoints.length > 10 && (
                        <div className="text-sm text-gray-500">
                          ... and {results.data.successful_endpoints.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw Results */}
                <details className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <summary className="font-medium cursor-pointer">📋 Full Results (Click to expand)</summary>
                  <pre className="text-xs mt-4 overflow-auto max-h-96 bg-white p-4 rounded border">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">🎯 What to do next:</h3>
          <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
            <li><strong>Run "Full Discovery"</strong> first to see what endpoints work</li>
            <li><strong>Check your browser console</strong> for detailed logs</li>
            <li><strong>Check your server console</strong> for raw API responses</li>
            <li><strong>Update your User/Course IDs</strong> with real values from your system</li>
            <li><strong>Note which endpoints return data</strong> - these are the ones we'll use</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
