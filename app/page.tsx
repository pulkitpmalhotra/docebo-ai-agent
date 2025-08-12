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
    icon: React.createElement(UserPlus, { className: "w-5 h-5" }),
    example: 'Enroll john@company.com in Python Programming',
    description: 'Add a single user to a course'
  },
  {
    id: 'get_user_courses', 
    title: 'User Courses',
    icon: React.createElement(User, { className: "w-5 h-5" }),
    example: 'What courses is sarah@test.com enrolled in?',
    description: 'See all courses for a user'
  },
  {
    id: 'get_course_users',
    title: 'Course Enrollments', 
    icon: React.createElement(Users, { className: "w-5 h-5" }),
    example: 'Who is enrolled in Excel Training?',
    description: 'See who is taking a course'
  },
  {
    id: 'find_user',
    title: 'Find User',
    icon: React.createElement(Search, { className: "w-5 h-5" }),
    example: 'Find user mike@company.com',
    description: 'Look up user details'
  },
  {
    id: 'find_course',
    title: 'Find Course',
    icon: React.createElement(BookOpen, { className: "w-5 h-5" }),
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
  
  // Add a ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Add AbortController ref for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Set mounted flag to true on mount
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false on unmount
    return () => {
      isMountedRef.current = false;
      // Cancel any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Safe text formatting function
  const formatMessageContent = (content: string) => {
    // Clean up any problematic characters
    const cleanContent = content
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '');

    const lines = cleanContent.split('\n');
    
    return lines.map((line, index) => {
      const key = `line-${index}`;
      
      if (line.includes('**')) {
        const boldText = line.replace(/\*\*/g, '');
        return React.createElement('div', { key, className: 'mb-1' },
          React.createElement('span', { className: 'font-bold' }, boldText)
        );
      }
      
      return React.createElement('div', { key, className: 'mb-1' }, line);
    });
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || loading || !isMountedRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageText.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);
      setInput('');
    }

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
        signal: abortControllerRef.current.signal, // Add abort signal
      });

      // Check if component is still mounted before processing response
      if (!isMountedRef.current) {
        return; // Exit early if component unmounted
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Double-check mounted status before updating state
      if (!isMountedRef.current) {
        return;
      }
      
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
      // Check if the error is due to abort (user navigated away)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return; // Don't show error message for aborted requests
      }

      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

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
      // Only update loading state if component is still mounted
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

  return React.createElement('div', { className: 'min-h-screen bg-gray-50' },
    React.createElement('div', { className: 'max-w-4xl mx-auto p-6' },
      // Header
      React.createElement('div', { className: 'text-center mb-8' },
        React.createElement('h1', { className: 'text-3xl font-bold text-gray-800 mb-2' }, 'Docebo Assistant'),
        React.createElement('p', { className: 'text-gray-600 mb-4' }, 'Phase 1 MVP - Natural Language Enrollment Management'),
        React.createElement('div', { className: 'flex items-center justify-center gap-2' },
          React.createElement(Zap, { className: 'w-4 h-4 text-green-500' }),
          React.createElement('span', { className: 'text-sm text-green-600' }, 'Live & Ready')
        )
      ),

      // Quick Actions
      React.createElement('div', { className: 'bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6' },
        React.createElement('h2', { className: 'text-lg font-semibold text-gray-800 mb-4' }, 'Quick Actions'),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
          ...QUICK_ACTIONS.map((action) =>
            React.createElement('button', {
              key: action.id,
              onClick: () => handleQuickAction(action.example),
              className: 'p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500',
              disabled: loading
            },
              React.createElement('div', { className: 'flex items-center gap-3 mb-2' },
                React.createElement('div', { className: 'p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors' }, action.icon),
                React.createElement('span', { className: 'font-medium text-gray-800 text-sm' }, action.title)
              ),
              React.createElement('p', { className: 'text-xs text-gray-600 mb-2' }, action.description),
              React.createElement('p', { className: 'text-xs text-blue-600 bg-blue-50 p-2 rounded' },
                action.example.length > 50 ? `${action.example.substring(0, 50)}...` : action.example
              )
            )
          )
        )
      ),

      // Chat Interface
      React.createElement('div', { className: 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden' },
        // Messages
        React.createElement('div', { className: 'h-96 overflow-y-auto p-6 bg-gray-50' },
          ...messages.map((message) =>
            React.createElement('div', {
              key: message.id,
              className: `mb-6 flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`
            },
              message.type === 'assistant' && React.createElement('div', { className: 'w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0' },
                React.createElement(Bot, { className: 'w-4 h-4 text-white' })
              ),
              
              React.createElement('div', { className: `max-w-lg ${message.type === 'user' ? 'order-first' : ''}` },
                React.createElement('div', {
                  className: `p-4 rounded-xl ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white ml-auto'
                      : getMessageStatusColor(message)
                  }`
                },
                  React.createElement('div', { className: 'prose prose-sm max-w-none' }, formatMessageContent(message.content))
                ),
                
                React.createElement('div', { className: 'text-xs text-gray-500 mt-2 flex items-center gap-2' },
                  message.timestamp.toLocaleTimeString(),
                  message.success === true && React.createElement(React.Fragment, null,
                    React.createElement(CheckCircle, { className: 'w-3 h-3 text-green-500' }),
                    React.createElement('span', { className: 'text-green-600' }, 'Success')
                  ),
                  message.success === false && React.createElement(React.Fragment, null,
                    React.createElement(AlertCircle, { className: 'w-3 h-3 text-red-500' }),
                    React.createElement('span', { className: 'text-red-600' }, 'Failed')
                  ),
                  message.action && React.createElement('span', { className: 'text-blue-600' }, `Action: ${message.action}`)
                )
              ),

              message.type === 'user' && React.createElement('div', { className: 'w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0' },
                React.createElement(User, { className: 'w-4 h-4 text-white' })
              )
            )
          ),
          
          loading && React.createElement('div', { className: 'flex gap-3 mb-6' },
            React.createElement('div', { className: 'w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center' },
              React.createElement(Bot, { className: 'w-4 h-4 text-white' })
            ),
            React.createElement('div', { className: 'bg-white border border-gray-200 rounded-xl p-4' },
              React.createElement('div', { className: 'flex items-center gap-2' },
                React.createElement('div', { className: 'flex gap-1' },
                  React.createElement('div', { className: 'w-2 h-2 bg-blue-500 rounded-full animate-bounce' }),
                  React.createElement('div', { className: 'w-2 h-2 bg-blue-500 rounded-full animate-bounce', style: { animationDelay: '0.1s' } }),
                  React.createElement('div', { className: 'w-2 h-2 bg-blue-500 rounded-full animate-bounce', style: { animationDelay: '0.2s' } })
                ),
                React.createElement('span', { className: 'text-gray-600 text-sm' }, 'Processing...')
              )
            )
          ),
          
          React.createElement('div', { ref: messagesEndRef })
        ),
        
        // Input Area
        React.createElement('div', { className: 'p-4 bg-white border-t border-gray-200' },
          React.createElement('form', { onSubmit: handleSubmit, className: 'flex gap-3' },
            React.createElement('input', {
              type: 'text',
              value: input,
              onChange: (e) => {
                if (isMountedRef.current) {
                  setInput(e.target.value);
                }
              },
              onKeyPress: handleKeyPress,
              placeholder: 'Type your command... (e.g., \'Enroll john@company.com in Python\')',
              className: 'flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed',
              disabled: loading,
              maxLength: 500
            }),
            React.createElement('button', {
              type: 'submit',
              disabled: loading || !input.trim(),
              className: 'px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2'
            },
              React.createElement(Send, { className: 'w-4 h-4' }),
              loading ? 'Sending...' : 'Send'
            )
          ),
          
          React.createElement('div', { className: 'mt-3 text-xs text-gray-500' },
            React.createElement('strong', null, 'Examples: '),
            '"Enroll sarah@test.com in Excel Training" • "Who is enrolled in Python?" • "Find user mike@company.com"'
          )
        )
      ),

      // Benefits
      React.createElement('div', { className: 'mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center' },
        React.createElement('div', { className: 'text-xs text-gray-500' },
          React.createElement(CheckCircle, { className: 'w-4 h-4 text-green-500 mx-auto mb-1' }),
          'Direct Actions'
        ),
        React.createElement('div', { className: 'text-xs text-gray-500' },
          React.createElement(Zap, { className: 'w-4 h-4 text-blue-500 mx-auto mb-1' }),
          'Instant Results'
        ),
        React.createElement('div', { className: 'text-xs text-gray-500' },
          React.createElement(UserPlus, { className: 'w-4 h-4 text-purple-500 mx-auto mb-1' }),
          'Real Enrollments'
        ),
        React.createElement('div', { className: 'text-xs text-gray-500' },
          React.createElement(Search, { className: 'w-4 h-4 text-orange-500 mx-auto mb-1' }),
          'Live Data'
        )
      ),

      // Footer
      React.createElement('div', { className: 'text-center text-xs text-gray-400 mt-8' },
        'Docebo Assistant - Phase 1 MVP • Direct API Connection • Natural Language Processing'
      )
    )
  );
}
