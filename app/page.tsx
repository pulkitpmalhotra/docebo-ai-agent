'use client';

import React, { useState } from 'react';
import { Send, User, Bot, UserPlus, Search, BookOpen, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  success?: boolean;
  action?: string;
  missing_fields?: string[];
  examples?: string[];
  available_actions?: Array<{
    name: string;
    description: string;
    examples: string[];
  }>;
}

const QUICK_ACTIONS = [
  {
    id: 'enroll_user',
    title: 'Enroll User',
    icon: <UserPlus className="w-5 h-5" />,
    example: 'Enroll john@company.com in Python Programming',
    description: 'Add a user to a course instantly',
    requiredFields: ['email', 'course']
  },
  {
    id: 'get_user_courses', 
    title: 'User\'s Courses',
    icon: <User className="w-5 h-5" />,
    example: 'What courses is sarah@test.com enrolled in?',
    description: 'See all courses for a user',
    requiredFields: ['email']
  },
  {
    id: 'get_course_users',
    title: 'Course Enrollments', 
    icon: <Users className="w-5 h-5" />,
    example: 'Who is enrolled in Excel Training?',
    description: 'See who is taking a course',
    requiredFields: ['course']
  },
  {
    id: 'find_user',
    title: 'Find User',
    icon: <Search className="w-5 h-5" />,
    example: 'Find user mike@company.com',
    description: 'Look up user details',
    requiredFields: ['email']
  },
  {
    id: 'find_course',
    title: 'Find Course',
    icon: <BookOpen className="w-5 h-5" />,
    example: 'Find course JavaScript',
    description: 'Search for courses',
    requiredFields: ['course']
  }
];

export default function SimpleDoceboChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `🎯 **Welcome to Simple Docebo Assistant**

I do exactly what you ask, immediately. No complex AI, no confusion.

Click any action below or type directly:`,
      type: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'No response received.',
        type: 'assistant',
        timestamp: new Date(),
        success: data.success,
        action: data.action,
        missing_fields: data.missing_fields,
        examples: data.examples,
        available_actions: data.available_actions
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ **Connection Error**: ${error instanceof Error ? error.message : 'Network error'}\n\nCheck your internet connection and try again.`,
        type: 'assistant',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (example: string) => {
    setInput(example);
  };

  const handleSubmit = () => {
    sendMessage(input);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <div key={i}>
        {line.includes('**') ? (
          <div dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/❌/g, '<span style="color: #ef4444;">❌</span>')
              .replace(/✅/g, '<span style="color: #10b981;">✅</span>')
              .replace(/🎯|📚|👥|👤|🔍/g, '<span>$&</span>')
          }} />
        ) : (
          line
        )}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Simple Docebo Assistant
          </h1>
          <p className="text-gray-600">
            Fast, direct actions. No complexity. Just works.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Zap className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-600">Live & Ready</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.example)}
                className="p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors">
                    {action.icon}
                  </div>
                  <span className="font-medium text-gray-800">{action.title}</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                <div className="text-xs text-gray-500 mb-2">
                  <strong>Needs:</strong> {action.requiredFields.join(', ')}
                </div>
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  "{action.example}"
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
                  <div
                    className={`p-4 rounded-xl ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white ml-auto'
                        : message.success === false
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {formatMessage(message.content)}
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
                    <span className="text-gray-600 text-sm">Working...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type exactly what you want to do... (e.g., 'Enroll john@company.com in Python')"
                className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            
            {/* Examples */}
            <div className="mt-3 text-xs text-gray-500">
              <strong>Examples:</strong> "Enroll sarah@test.com in Excel Training" • "Who is enrolled in Python?" • "Find user mike@company.com"
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="text-xs text-gray-500">
            <CheckCircle className="w-4 h-4 text-green-500 mx-auto mb-1" />
            Direct Actions
          </div>
          <div className="text-xs text-gray-500">
            <Zap className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            Instant Results
          </div>
          <div className="text-xs text-gray-500">
            <UserPlus className="w-4 h-4 text-purple-500 mx-auto mb-1" />
            Real Enrollments
          </div>
          <div className="text-xs text-gray-500">
            <Search className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            Live Data
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-8">
          Simple Docebo Assistant • Direct API Connection • No AI Overhead
        </div>
      </div>
    </div>
  );
}
