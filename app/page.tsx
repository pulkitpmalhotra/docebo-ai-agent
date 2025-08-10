'use client';

import { useState } from 'react';

export default function DoceboAIChat() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      content: 'Welcome to Docebo AI Assistant! Ask me anything.',
      type: 'assistant',
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });

      const data = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Sorry, no response received.',
        type: 'assistant',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Error: Could not process your request.',
        type: 'assistant',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Docebo AI Assistant</h1>
      <p>Demo mode - Ask me about users, courses, or enrollments</p>
      
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        height: '400px', 
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Messages */}
        <div style={{ 
          flex: 1, 
          padding: '10px', 
          overflowY: 'auto',
          backgroundColor: '#f9f9f9'
        }}>
          {messages.map((message) => (
            <div 
              key={message.id}
              style={{
                marginBottom: '10px',
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: message.type === 'user' ? '#007bff' : '#e9ecef',
                color: message.type === 'user' ? 'white' : 'black',
                marginLeft: message.type === 'user' ? '50px' : '0',
                marginRight: message.type === 'user' ? '0' : '50px',
              }}
            >
              <strong>{message.type === 'user' ? 'You' : 'AI'}:</strong>
              <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{ padding: '10px', fontStyle: 'italic', color: '#666' }}>
              AI is thinking...
            </div>
          )}
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Quick Test Buttons */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Quick Tests:</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button 
            onClick={() => setInput("Find users named John")}
            style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            Find users named John
          </button>
          <button 
            onClick={() => setInput("Show me Python courses")}
            style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            Show me Python courses
          </button>
          <button 
            onClick={() => setInput("Show me enrollment statistics")}
            style={{ padding: '8px 12px', backgroundColor: '#f8f9fa', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            Show enrollment statistics
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
        Demo mode with sample data • Powered by Gemini AI
      </div>
    </div>
  );
}
