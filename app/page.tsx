'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Zap, Users, BookOpen, BarChart3, Settings, ChevronRight, Sparkles, Lightbulb, Search, Bell, FileText, FolderOpen, UserPlus, AlertCircle, CheckCircle, ExternalLink, Download, Calendar, Target, TrendingUp } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  intent?: string;
  userRole?: string;
  success?: boolean;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
  requiresInput?: {
    field: string;
    message: string;
    type: 'text' | 'email' | 'date' | 'select';
    options?: string[];
  };
  data?: any;
}

const roleConfigs = {
  superadmin: {
    name: 'Super Administrator',
    icon: <Settings className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Full enrollment and system management',
    capabilities: [
      'Enroll/unenroll any users',
      'Manage group enrollments',
      'Access all enrollment statistics',
      'Set priorities and due dates',
      'Override enrollment restrictions'
    ]
  },
  power_user: {
    name: 'Power User',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
    description: 'Advanced enrollment and course management',
    capabilities: [
      'Enroll users in courses/plans',
      'View enrollment statistics',
      'Search all users and courses',
      'Manage learning paths'
    ]
  },
  user_manager: {
    name: 'User Manager',
    icon: <Users className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    description: 'Team enrollment and progress tracking',
    capabilities: [
      'View team enrollments',
      'Track team progress',
      'Generate team reports',
      'Search team members'
    ]
  },
  user: {
    name: 'User',
    icon: <User className="w-6 h-6" />,
    color: 'from-gray-500 to-slate-500',
    description: 'View personal enrollments and browse catalog',
    capabilities: [
      'View own enrollments',
      'Browse course catalog',
      'Check progress',
      'Search available courses'
    ]
  }
};

const exampleQueries = {
  superadmin: [
    "Enroll john@company.com in Python Programming with high priority due 2024-12-31",
    "Who is enrolled in Leadership Training course?",
    "Enroll the sales team group in Customer Service training",
    "Show completion stats for all courses in Q4 2024",
    "Update jane@company.com's enrollment priority to urgent"
  ],
  power_user: [
    "Is sarah@test.com enrolled in Excel Advanced course?",
    "Enroll marketing team in Data Analysis training",
    "Show enrollment statistics for JavaScript courses",
    "Find users who completed SQL fundamentals"
  ],
  user_manager: [
    "Show my team's enrollment progress",
    "Who in my team is enrolled in Project Management?",
    "Get completion rates for my direct reports"
  ],
  user: [
    "What courses am I enrolled in?",
    "Show my learning progress",
    "Find Excel training courses",
    "What's my completion status?"
  ]
};

export default function EnhancedDoceboChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<keyof typeof roleConfigs>('superadmin');
  const [showCapabilities, setShowCapabilities] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roleConfig = roleConfigs[userRole];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Send welcome message when role changes
    handleInitialMessage();
  }, [userRole]);

  const handleInitialMessage = async () => {
    const welcomeMessages = {
      superadmin: "Welcome! I can help you with complete enrollment management. You can enroll users/groups, view statistics, update enrollments, and more. What would you like to do?",
      power_user: "Hi! I can help you manage enrollments and view course statistics. You can enroll users, check enrollment status, and search courses. How can I assist?",
      user_manager: "Hello! I can help you track your team's enrollment progress and generate reports. What team information do you need?",
      user: "Hi! I can help you view your enrollments and find available courses. What would you like to know about your learning progress?"
    };

    const welcomeMessage: Message = {
      id: Date.now().toString(),
      content: welcomeMessages[userRole],
      type: 'assistant',
      timestamp: new Date(),
      intent: 'welcome',
      suggestions: exampleQueries[userRole].slice(0, 3)
    };

    setMessages([welcomeMessage]);
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
      const response = await fetch('/api/chat-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText,
          userRole: userRole,
          userId: 'demo-user'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'No response received.',
        type: 'assistant',
        timestamp: new Date(),
        intent: data.intent,
        success: data.success,
        userRole: data.userRole,
        suggestions: data.suggestions || [],
        actions: data.actions || [],
        requiresInput: data.requires_input,
        data: data.data
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat API Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ **Error**: ${error instanceof Error ? error.message : 'Network error'}\n\nPlease try again or contact support if the problem persists.`,
        type: 'assistant',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    sendMessage(input);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleActionClick = (action: { id: string; label: string; type: string; action: string }) => {
    // Handle different action types
    if (action.action === 'retry_request') {
      // Retry the last user message
      const lastUserMessage = messages.filter(m => m.type === 'user').pop();
      if (lastUserMessage) {
        sendMessage(lastUserMessage.content);
      }
    } else if (action.action === 'show_help') {
      setInput('What can you help me with?');
    } else {
      // For other actions, convert to natural language query
      const actionQueries: Record<string, string> = {
        'bulk_enrollment_form': 'Help me with bulk enrollment',
        'show_analytics': 'Show me enrollment analytics',
        'enrollment_form': 'Help me enroll users',
        'team_analytics': 'Show my team analytics',
        'view_my_courses': 'What courses am I enrolled in?',
        'course_search': 'Help me search for courses',
        'export_user_enrollments': 'Export enrollment data'
      };
      
      const query = actionQueries[action.action] || `Help with ${action.label}`;
      setInput(query);
    }
  };

  const handleRoleChange = (newRole: keyof typeof roleConfigs) => {
    setUserRole(newRole);
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <div key={i}>
        {line.includes('**') ? (
          <div dangerouslySetInnerHTML={{
            __html: line
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/• /g, '• ')
              .replace(/❌/g, '<span style="color: #ef4444;">❌</span>')
              .replace(/✅/g, '<span style="color: #10b981;">✅</span>')
              .replace(/📚|👥|📊|🎯|⚡|🔧|💡/g, '<span>$&</span>')
          }} />
        ) : (
          line
        )}
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">
                Docebo Enrollment AI Assistant
              </h1>
              <p className="text-slate-600">
                Complete enrollment management with natural language processing
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCapabilities(!showCapabilities)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Lightbulb className="w-4 h-4" />
                Capabilities
              </button>
              <div className="text-sm text-slate-500">v2.0 Enhanced</div>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Capabilities Panel */}
          {showCapabilities && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
                🚀 Enhanced Capabilities
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Enrollment Management
                  </h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Enroll users in courses/plans/sessions</li>
                    <li>• Group enrollment management</li>
                    <li>• Set priorities and due dates</li>
                    <li>• Unenroll and update enrollments</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Statistics & Reports
                  </h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Enrollment statistics</li>
                    <li>• Completion rate tracking</li>
                    <li>• Progress monitoring</li>
                    <li>• Custom date range reports</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Smart Search
                  </h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• Natural language queries</li>
                    <li>• User/course/session search</li>
                    <li>• Group and learning plan discovery</li>
                    <li>• Intelligent entity extraction</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Role Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Select Your Role</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(roleConfigs).map(([role, config]) => (
                <div key={role} className="relative">
                  <button
                    onClick={() => handleRoleChange(role as keyof typeof roleConfigs)}
                    className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      userRole === role
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${config.color}`}>
                        <div className="text-white">{config.icon}</div>
                      </div>
                      <span className="font-medium text-slate-800">{config.name}</span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{config.description}</p>
                    <div className="space-y-1">
                      {config.capabilities.slice(0, 2).map((capability, idx) => (
                        <div key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {capability}
                        </div>
                      ))}
                      {config.capabilities.length > 2 && (
                        <div className="text-xs text-slate-400">
                          +{config.capabilities.length - 2} more...
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Messages */}
          <div className="h-96 overflow-y-auto p-6 bg-slate-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-2xl ${message.type === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`p-4 rounded-xl ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white ml-auto'
                        : message.success === false
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {formatMessageContent(message.content)}
                    </div>
                    
                    {/* Required Input */}
                    {message.requiresInput && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-sm font-medium text-yellow-800 mb-2">
                          Additional Information Required:
                        </div>
                        <div className="text-sm text-yellow-700">
                          {message.requiresInput.message}
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                              action.type === 'primary'
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {action.action.includes('enroll') && <UserPlus className="w-3 h-3" />}
                            {action.action.includes('stats') && <BarChart3 className="w-3 h-3" />}
                            {action.action.includes('search') && <Search className="w-3 h-3" />}
                            {action.action.includes('export') && <Download className="w-3 h-3" />}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-slate-500 mb-2">Try these:</div>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.slice(0, 3).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs hover:bg-slate-200 transition-colors"
                          >
                            {suggestion.length > 50 ? `${suggestion.substring(0, 50)}...` : suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                    {message.timestamp.toLocaleTimeString()}
                    {message.intent && (
                      <span className="px-2 py-1 bg-slate-100 rounded-full">
                        {message.intent}
                      </span>
                    )}
                    {message.success === true && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                    {message.success === false && (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3 mb-6">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-slate-600 text-sm">Processing enrollment request...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Ask about enrollments as ${roleConfig.name}... (e.g., "Enroll john@company.com in Python course")`}
                className="flex-1 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            
            {/* Quick Start Examples */}
            <div className="mt-3 flex flex-wrap gap-2">
              {exampleQueries[userRole].slice(0, 3).map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(example)}
                  className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm hover:bg-slate-200 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  {example.length > 40 ? `${example.substring(0, 40)}...` : example}
                </button>
              ))}
            </div>
            
            {/* Feature Highlights */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserPlus className="w-3 h-3 text-blue-500" />
                Bulk Enrollment
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Target className="w-3 h-3 text-green-500" />
                Set Priorities
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="w-3 h-3 text-purple-500" />
                Due Dates
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp className="w-3 h-3 text-orange-500" />
                Live Statistics
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <div className="flex items-center justify-center gap-4">
            <span>✨ Natural Language Processing</span>
            <span>🔒 Role-Based Security</span>
            <span>⚡ Real-Time Docebo Integration</span>
            <span>📊 Comprehensive Analytics</span>
          </div>
          <div className="mt-2">
            Powered by Enhanced Docebo API • AI-Driven Enrollment Management
          </div>
        </div>
      </div>
    </div>
  );
}
