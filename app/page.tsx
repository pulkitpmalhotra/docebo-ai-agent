'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, UserPlus, Search, BookOpen, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react';

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
  icon: React.ReactNode;
  example: string;
  description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'enroll_user',
    title: 'Enroll User',
    icon: <UserPlus className="w-5 h-5" />,
    example: 'Enroll john@company.com in Python Programming',
    description: 'Add a single user to a course'
  },
  {
    id: 'get_user_courses', 
    title: 'User Courses',
    icon: <User className="w-5 h-5" />,
    example: 'What courses is sarah@test.com enrolled in?',
    description: 'See all courses for a user'
  },
  {
    id: 'get_course_users',
    title: 'Course Enrollments', 
    icon: <Users className="w-5 h-5" />,
    example: 'Who is enrolled in Excel Training?',
    description: 'See who is taking a course'
  },
  {
    id: 'find_user',
    title: 'Find User',
    icon: <Search className="w-5 h-5" />,
    example: 'Find user mike@company.com',
    description: 'Look up user details'
  },
  {
    id: 'find_course',
    title: 'Find Course',
    icon: <BookOpen className="w-5 h-5" />,
    example: 'Find Python courses',
    description: 'Search for courses'
  }
];

export default function DoceboChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to Docebo Assistant - Phase 1 MVP\n\nI help you manage Docebo enrollments with natural language commands.\n\nClick any action below or type directly:',
      type: 'assistant',
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simple text formatting without dangerouslySetInnerHTML
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Clean up any HTML entities that might cause issues
      const cleanLine = line
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]*>/g, ''); // Remove any HTML tags
      
      if (cleanLine.includes('**')) {
        return (
          <div key={index} className="mb-1">
            <span className="font-bold">{cleanLine.replace(/\*\*/g, '')}</span>
          </div>
        );
      } else {
        return (
          <div key={index} className="mb-1">
            {cleanLine}
          </div>
        );
      }
    });
  };

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
        error: data.error
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Connection Error: ${error instanceof Error ? error.message : 'Network error'}. Check your internet connection and try again.`,
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
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                  {action.example.length > 50 ? `${action.example.substring(0, 50)}...` : action.example}
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
                        : getMessageStatusColor(message)
                    }`}
                  >
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
