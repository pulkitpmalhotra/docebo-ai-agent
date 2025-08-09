'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Clock, CheckCircle, AlertTriangle, Shield, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  intent?: string;
  entities?: any;
}

interface SystemStatus {
  gemini: boolean;
  docebo: boolean;
  mode: string;
}

export default function DoceboAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `👋 **Welcome to your Docebo AI Assistant!**

I can help you with:
- **🔍 Search Users & Courses** - "Find users named John" or "Show me Python courses"
- **📊 View Enrollments** - "What are john@company.com's enrollments?"
- **✅ Enroll Users** - "Enroll sarah@company.com in Excel training" 
- **📈 Get Statistics** - "Show me enrollment statistics"
- **❓ Get Help** - "Help me understand learning paths"

**Currently running in demo mode with sample data. Ready to assist you!**

What would you like to do?`,
      type: 'assistant',
      timestamp: new Date(),
    },
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    gemini: true,
    docebo: true,
    mode: 'Demo Mode'
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        type: 'assistant',
        timestamp: new Date(),
        intent: data.intent,
        entities: data.entities
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '❌ Sorry, I encountered an error. Please try again or contact your administrator.',
        type: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    "Find users named Sarah",
    "Show me JavaScript courses", 
    "Enrollment statistics",
    "Help with learning paths"
  ];

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg mb-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Shield className="text-blue-600" size={32} />
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Docebo AI Assistant</h1>
                  <p className="text-gray-600">Intelligent LMS automation and support</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-purple-100 px-3 py-1 rounded-full">
                <Sparkles className="text-purple-600" size={16} />
                <span className="text-purple-700 text-sm font-medium">Powered by Gemini AI</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-gray-500 mb-1">System Status</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">{systemStatus.mode}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-[600px]">
          {/* Chat Header */}
          <div className="p-4 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-blue-600" size={20} />
                <span className="font-medium text-gray-800">AI Assistant</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
              <div className="text-xs text-gray-500">
                {messages.length - 1} messages • Active now
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-2xl px-4 py-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white ml-4'
                      : 'bg-gray-100 text-gray-800 mr-4'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    {message.type === 'user' ? (
                      <User size={16} className="mt-1 flex-shrink-0" />
                    ) : (
                      <Bot size={16} className="mt-1 flex-shrink-0" />
                    )}
                    <div className="text-xs opacity-70">
                      {message.type === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                  </div>
                  
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </div>
                  
                  {message.intent && (
                    <div className="text-xs opacity-60 mt-2 border-t border-gray-300 pt-2">
                      Intent: {message.intent}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-60 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4 mr-4">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-gray-600 text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Queries */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t bg-gray-50">
              <div className="text-xs text-gray-500 mb-2">Try these examples:</div>
              <div className="flex flex-wrap gap-2">
                {suggestedQueries.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(query)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50 rounded-b-lg">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about Docebo... (e.g., 'Find users named John')"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Send size={16} />
                Send
              </button>
            </div>
            
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Press Enter to send • Powered by Google Gemini</span>
              <span>🔒 All interactions are logged and secured</span>
            </div>
          </form>
        </div>

        {/* Quick Actions Sidebar */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* System Status */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield size={16} className="text-green-500" />
              System Health
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>AI Engine</span>
                <span className="text-green-600 font-medium">●Online</span>
              </div>
              <div className="flex justify-between">
                <span>Mock Data</span>
                <span className="text-green-600 font-medium">●Active</span>
              </div>
              <div className="flex justify-between">
                <span>Processing</span>
                <span className="text-green-600 font-medium">●Ready</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Sample Users</span>
                <span className="font-medium">7 active</span>
              </div>
              <div className="flex justify-between">
                <span>Sample Courses</span>
                <span className="font-medium">8 available</span>
              </div>
              <div className="flex justify-between">
                <span>Demo Mode</span>
                <span className="text-blue-600 font-medium">Enabled</span>
              </div>
            </div>
          </div>

          {/* Help */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">Need Help?</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setInput("Help me understand the AI assistant")}
                className="w-full text-left text-sm p-2 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                📚 How to use this assistant
              </button>
              <button 
                onClick={() => setInput("What can you do?")}
                className="w-full text-left text-sm p-2 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                🤖 What can the AI do?
              </button>
              <button 
                onClick={() => setInput("Show me enrollment statistics")}
                className="w-full text-left text-sm p-2 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
              >
                📊 View system statistics
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>🔒 Running in secure demo mode with sample data • Built with Next.js, Gemini AI & Tailwind CSS</p>
          <p className="mt-1">Ready for production deployment with real Docebo API integration</p>
        </div>
      </div>
    </div>
  );
}
