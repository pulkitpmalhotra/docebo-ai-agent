'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Search, BookOpen, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  success?: boolean;
  action?: string;
  error?: string;
}

interface QuickAction {
  id: string;
  title: string;
  icon: JSX.Element;
  example: string;
  description: string;
}

export default function DoceboChat() {
  // Initialize state with hydration-safe values
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Quick actions defined inside component to avoid hydration issues
  const quickActions: QuickAction[] = [
    {
      id: 'find_user',
      title: 'Find User',
      icon: <User className="w-5 h-5" />,
      example: 'Find user mike@company.com',
      description: 'Look up user details and information'
    },
    {
      id: 'find_course', 
      title: 'Find Course',
      icon: <BookOpen className="w-5 h-5" />,
      example: 'Find Python courses',
      description: 'Search for courses by name or keyword'
    },
    {
      id: 'find_learning_plan',
      title: 'Find Learning Plans',
      icon: <Users className="w-5 h-5" />,
      example: 'Find Python learning plans',
      description: 'Search for learning paths and programs'
    },
    {
      id: 'find_session',
      title: 'Find Sessions',
      icon: <CheckCircle className="w-5 h-5" />,
      example: 'Find Python sessions',
      description: 'Look up training sessions and workshops'
    },
    {
      id: 'find_material',
      title: 'Find Materials',
      icon: <Search className="w-5 h-5" />,
      example: 'Find Python training materials',
      description: 'Search for training resources and documents'
    },
    {
      id: 'docebo_help',
      title: 'Docebo Help',
      icon: <AlertCircle className="w-5 h-5" />,
      example: 'How to enroll users in Docebo',
      description: 'Get help with Docebo functionality'
    }
  ];

  // Handle client-side hydration
  useEffect(() => {
    setIsClient(true);
    isMountedRef.current = true;
    
    // Initialize messages only on client side to avoid hydration mismatch
    setMessages([{
      id: 'welcome',
      content: 'Welcome to Docebo Assistant - Comprehensive Learning Management\n\nI help you manage and understand Docebo with natural language commands.\n\nClick any action below or type directly:',
      type: 'assistant',
      timestamp: new Date()
    }]);
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (isClient && isMountedRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isClient]);

  const formatMessageContent = (content: string) => {
    const cleanContent = content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '');

    return cleanContent.split('\n').map((line, index) => (
      <div key={`line-${index}`} className="mb-1">
        {line.includes('**') ? (
          <span className="font-bold">{line.replace(/\*\*/g, '')}</span>
        ) : (
          line
        )}
      </div>
    ));
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || loading || !isMountedRef.current) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageText.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    if (isMountedRef.current) {
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);
      setInput('');
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!isMountedRef.current) return;
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: data.response || 'No response received.',
        type: 'assistant',
        timestamp: new Date(),
        success: data.success,
        action: data.action,
        error: data.error
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (!isMountedRef.current) return;

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `Connection Error: ${error instanceof Error ? error.message : 'Network error'}. Check your internet connection and try again.`,
        type: 'assistant',
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  };

  const handleQuickAction = (example: string) => {
    if (isMountedRef.current) {
      setInput(example);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getMessageStatusColor = (message: Message): string => {
    if (message.success === true) return 'border-green-200 bg-green-50';
    if (message.success === false) return 'border-red-200 bg-red-50';
    return 'border-gray-200 bg-white';
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Docebo Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Docebo Assistant</h1>
          <p className="text-gray-600 mb-4">Comprehensive Learning Management & Help System</p>
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600">Live & Ready</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.example)}
                className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                    {action.icon}
                  </div>
                  <span className="font-medium text-gray-800 text-sm">{action.title}</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{action.description}</p>
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  {action.example.length > 40 ? `${action.example.substring(0, 40)}...` : action.example}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-lg ${message.type === 'user' ? 'order-first' : ''}`}>
                  <div className={`p-4 rounded-xl ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white ml-auto'
                      : getMessageStatusColor(message)
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      {formatMessageContent(message.content)}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                    {message.timestamp.toLocaleTimeString()}
                    {message.success === true && (
                      <>
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-green-600">Success</span>
                      </>
                    )}
                    {message.success === false && (
                      <>
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-red-600">Failed</span>
                      </>
                    )}
                    {message.action && (
                      <span className="text-blue-600">Action: {message.action}</span>
                    )}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-gray-600 text-sm">Processing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  if (isMountedRef.current) {
                    setInput(e.target.value);
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Type your command... (e.g., 'Find user mike@company.com' or 'How to enroll users')"
                className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Sending...' : 'Send'}
              </button>
            </form>
            
            <div className="mt-3 text-xs text-gray-500">
              <strong>Examples: </strong>
              "Find user mike@company.com" • "Find Python courses" • "Learning plan info Advanced Programming" • "How to enroll users in Docebo"
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="text-xs text-gray-500">
            <Search className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            Smart Search
          </div>
          <div className="text-xs text-gray-500">
            <Zap className="w-4 h-4 text-green-500 mx-auto mb-1" />
            Instant Results
          </div>
          <div className="text-xs text-gray-500">
            <BookOpen className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            All Content Types
          </div>
          <div className="text-xs text-gray-500">
            <AlertCircle className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            Help & Guidance
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8">
          Docebo Assistant - Comprehensive Learning Management • Data Search • Official Help Integration
        </div>
      </div>
    </div>
  );
}
