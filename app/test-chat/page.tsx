'use client';

import { useState } from 'react';

export default function TestChat() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const testQueries = [
    'Find users named John',
    'Show me Python courses',
    'What are john.smith@company.com enrollments?',
    'Enroll sarah@company.com in Excel training',
    'Help me understand learning paths',
    'Show me enrollment statistics'
  ];

  const sendMessage = async (msg: string) => {
    setLoading(true);
    setMessage(msg);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Chat API Test Interface</h1>
        
        {/* Quick Test Buttons */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Tests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {testQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => sendMessage(query)}
                disabled={loading}
                className="text-left p-3 bg-blue-50 hover:bg-blue-100 rounded border transition-colors disabled:opacity-50"
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Custom Query</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message..."
              className="flex-1 p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(message)}
            />
            <button
              onClick={() => sendMessage(message)}
              disabled={loading || !message.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        {/* Response */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Response</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {response || 'No response yet. Click a test button or send a custom message.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
