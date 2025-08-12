'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, UserPlus, Search, BookOpen, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react';

// Properly typed interfaces
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
  error?: string;
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  example: string;
  description: string;
  requiredFields: string[];
}

// Quick Actions for Phase 1 MVP
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'enroll_user',
    title: 'Enroll User',
    icon: <UserPlus className="w-5 h-5" />,
    example: 'Enroll john@company.com in Python Programming',
    description: 'Add a single user to a course',
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
    example: 'Find Python courses',
    description: 'Search for courses',
    requiredFields: ['course']
  }
];

export default function DoceboChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `🎯 **Welcome to Docebo Assistant - Phase 1 MVP**

I help you manage Docebo enrollments with natural language commands.

**What I can do**:
• ✅ **Enroll users** in courses
• 📚 **Find courses** and users  
• 👥 **Check enrollments** and progress
• 🔍 **Search** your Docebo data

Click any action below or type directly:`,
      type: 'assistant',
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

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
        available_actions: data.available_actions,
        error: data.error
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ **Connection Error**: ${error instanceof Error ? error.message : 'Network error'}\n\nCheck your internet connection and try again.`,
        type: 'assistant',
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (example: string) => {
    setInput(example);
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

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <div key={i}>
        {line.includes('**') ? (
          <div dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/❌/g, '<span style="color: #ef4444;">❌</span>')
              .replace(/✅/g, '<span style="color: #10b981;">✅</span>')
              .replace(/🎯|📚|👥|👤|🔍|⭕|📊/g, '<span>const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'enroll_user',
    title: 'Enroll User',
    icon: <UserPlus className="w-5 h-5" />,</span>')
          }} />
        ) : (
          line
        )}
      </div>
    ));
  };

  const getMessageStatusColor = (message: Message): string => {
    if (message.success === true) return 'border-green-200 bg-green-50';
    if (message.success === false) return 'border-red-200 bg-red-50';
    return 'border-gray-200 bg-white';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Docebo Assistant
          </h1>
          <p className="text-gray-600 mb-4">
            Phase 1 MVP - Natural Language Enrollment Management
          </p>
          <div className="flex items-center justify-center gap-2">
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
                <div className="text-xs text-gray-500 mb-2">
                  <strong>Needs:</strong> {action.requiredFields.length > 0 ? action.requiredFields.join(', ') : 'nothing'}
                </div>
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  "{action.example.length > 50 ? `${action.example.substring(0, 50)}...` : action.example}"
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Examples */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-4">🚀 Advanced Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-blue-700 mb-2">Enrollment with Options:</h3>
              <div className="space-y-1 text-sm text-blue-600">
                <button 
                  className="block w-full text-left bg-white p-2 rounded cursor-pointer hover:bg-blue-50 transition-colors" 
                  onClick={() => handleQuickAction('Enroll john@company.com in Python Programming level 2')}
                  disabled={loading}
                >
                  "Enroll john@company.com in Python Programming level 2"
                </button>
                <button 
                  className="block w-full text-left bg-white p-2 rounded cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => handleQuickAction('Add sarah@test.com to Excel Training as mandatory due 2025-12-31')}
                  disabled={loading}
                >
                  "Add sarah@test.com to Excel Training as mandatory due 2025-12-31"
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-blue-700 mb-2">Search and Discovery:</h3>
              <div className="space-y-1 text-sm text-blue-600">
                <button 
                  className="block w-full text-left bg-white p-2 rounded cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => handleQuickAction('Find Python courses')}
                  disabled={loading}
                >
                  "Find Python courses"
                </button>
                <button 
                  className="block w-full text-left bg-white p-2 rounded cursor-pointer hover:bg-blue-50 transition-colors"
                  onClick={() => handleQuickAction('Who is enrolled in Leadership Training?')}
                  disabled={loading}
                >
                  "Who is enrolled in Leadership Training?"
                </button>
              </div>
            </div>
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
                        : getMessageStatusColor(message)
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
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your command... (e.g., 'Enroll john@company.com in Python')"
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
          Docebo Assistant - Phase 1 MVP • Direct API Connection • Natural Language Processing
        </div>
      </div>
    </div>
  );
}
