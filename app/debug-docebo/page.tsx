'use client';

import { useState } from 'react';

export default function DoceboDebugPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('Content Administration');

  const testEndpoint = async (action: string, search?: string) => {
    setLoading(true);
    try {
      const url = `/api/debug-docebo?action=${action}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      console.log('🔧 Testing endpoint:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('🔧 Response data:', data);
      setResults({ action, data, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('🔧 Test error:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const tests = [
    { label: 'Test Users API', action: 'users', description: 'Get sample users to see response structure' },
    { label: 'Test Courses API', action: 'courses', description: 'Get sample courses to see response structure' },
    { label: 'Search Specific Course', action: 'search_course', needsSearch: true, description: 'Search for a specific course' },
    { label: 'Search Users', action: 'search_user', needsSearch: true, description: 'Search for users' },
    { label: 'Full Overview', action: 'overview', description: 'Get both users and courses' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Docebo API Debug Interface</h1>
        <p className="text-gray-600 mb-8">
          This page helps debug the actual response structure from your Docebo API. 
          Check the browser console and server logs for detailed response structures.
        </p>

        {/* Search Input */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Search Term</h2>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter search term (e.g., Content Administration)"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-2">
            This will be used for course and user search tests
          </p>
        </div>

        {/* Test Buttons */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">API Tests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tests.map((test) => (
              <button
                key={test.action}
                onClick={() => testEndpoint(test.action, test.needsSearch ? searchTerm : undefined)}
                disabled={loading}
                className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <div className="font-medium text-blue-600">{test.label}</div>
                <div className="text-sm text-gray-600 mt-1">{test.description}</div>
                {test.needsSearch && (
                  <div className="text-xs text-orange-600 mt-2">
                    Will use: "{searchTerm}"
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-blue-700">Testing Docebo API...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">
              Results for: {results.action || 'Error'}
            </h2>
            
            {results.error ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="text-red-700 font-medium">Error</div>
                <div className="text-red-600 mt-1">{results.error}</div>
              </div>
            ) : (
              <div>
                <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
                  <pre className="text-sm text-gray-800">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                </div>
                
                {/* Response Analysis */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-medium">Response Analysis</h3>
                  
                  {results.data?.users && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-800">Users Data Structure</h4>
                      <div className="text-sm text-blue-700 mt-2">
                        {results.data.users.data?.items ? (
                          <div>
                            <div>✅ Found users array at: data.items</div>
                            <div>📊 Sample user fields: {Object.keys(results.data.users.data.items[0] || {}).join(', ')}</div>
                          </div>
                        ) : (
                          <div>❌ Users array not found at expected path</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {results.data?.courses && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-800">Courses Data Structure</h4>
                      <div className="text-sm text-green-700 mt-2">
                        {results.data.courses.data?.items ? (
                          <div>
                            <div>✅ Found courses array at: data.items</div>
                            <div>📊 Sample course fields: {Object.keys(results.data.courses.data.items[0] || {}).join(', ')}</div>
                          </div>
                        ) : (
                          <div>❌ Courses array not found at expected path</div>
                        )}
                      </div>
                    </div>
                  )}

                  {results.data?.course_search && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium text-purple-800">Course Search Structure</h4>
                      <div className="text-sm text-purple-700 mt-2">
                        {results.data.course_search.data?.items ? (
                          <div>
                            <div>✅ Found search results at: data.items</div>
                            <div>📊 Results count: {results.data.course_search.data.items.length}</div>
                            {results.data.course_search.data.items.length > 0 && (
                              <div>📊 Sample fields: {Object.keys(results.data.course_search.data.items[0]).join(', ')}</div>
                            )}
                          </div>
                        ) : (
                          <div>❌ Course search results not found at expected path</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Instructions</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Run the tests above to see actual API response structures</li>
            <li>• Check your browser console for detailed logs</li>
            <li>• Check your server console for raw API responses</li>
            <li>• Look for field names like 'name' vs 'course_name' vs 'title'</li>
            <li>• Note the exact path to arrays (e.g., data.items vs items vs data)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
