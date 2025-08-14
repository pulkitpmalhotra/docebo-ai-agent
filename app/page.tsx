'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  User, 
  BookOpen, 
  Users, 
  CheckCircle, 
  Search, 
  AlertCircle, 
  Zap,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  success?: boolean;
  helpRequest?: boolean;
  totalCount?: number;
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  example: string;
  description: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `🎯 **Welcome to Docebo AI Assistant**

I can help you with:

• **👥 Find Users**: "Find user mike@company.com"
• **📚 Find Courses**: "Find Python courses"  
• **📋 Find Learning Plans**: "Find Python learning plans"
• **🌐 Docebo Help**: "How to enroll users in Docebo"

What would you like to do today?`,
      timestamp: new Date(),
      success: true
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      id: 'learning_plan_info',
      title: 'Learning Plan Info',
      icon: <CheckCircle className="w-5 h-5" />,
      example: 'Learning plan info Associate Memory Network',
      description: 'Get detailed information about a learning plan'
    },
    {
      id: 'find_session',
      title: 'Find Sessions',
      icon: <Search className="w-5 h-5" />,
      example: 'Search for sessions in course id 944',
      description: 'Look up training sessions in courses'
    },
    {
      id: 'find_material',
      title: 'Find Materials',
      icon: <AlertCircle className="w-5 h-5" />,
      example: 'Search for materials in course Python Programming',
      description: 'Search for training resources and documents'
    },
    {
      id: 'docebo_help',
      title: 'Docebo Help',
      icon: <Zap className="w-5 h-5" />,
      example: 'How to enroll users in Docebo',
      description: 'Get help with Docebo functionality'
    }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.example);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        success: data.success,
        helpRequest: data.helpRequest,
        totalCount: data.totalCount
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '❌ **Connection Error**: Unable to connect to the server. Please try again.',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Convert markdown-style formatting to HTML
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Docebo AI Assistant</h1>
            <p className="text-sm text-gray-600">AI-powered Docebo administration helper</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-600">Online</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
              title={action.description}
            >
              <div className="text-blue-600 mb-1 group-hover:text-blue-700">
                {action.icon}
              </div>
              <span className="text-xs text-gray-600 text-center font-medium">
                {action.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl px-4 py-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.success === false
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
              />
              
              {message.type === 'assistant' && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.success !== undefined && (
                      <span className={message.success ? 'text-green-600' : 'text-red-600'}>
                        {message.success ? '✅ Success' : '❌ Error'}
                      </span>
                    )}
                    {message.totalCount && (
                      <span className="text-blue-600">
                        📊 {message.totalCount} results
                      </span>
                    )}
                    {message.helpRequest && (
                      <span className="text-purple-600">
                        🆘 Help Request
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(message.content)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Copy message"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about users, courses, learning plans, or Docebo help..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            <div className="mt-3 text-xs text-gray-500">
              <strong>Examples: </strong>
              "Find user mike@company.com" • "Find Python courses" • "Find Python learning plans" • "Learning plan info Associate Memory Network" • "How to enroll users"
            </div>
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-6 py-2 text-center">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
          <span>Docebo AI Assistant v1.0</span>
          <span>•</span>
          <a 
            href="https://help.docebo.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-1 hover:text-blue-600 transition-colors"
          >
            <span>Docebo Help Center</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <span>AI-powered LMS assistance</span>
        </div>
      </div>
    </div>
  );
}
