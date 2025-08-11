'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Zap, Users, BookOpen, BarChart3, Settings, ChevronRight, Sparkles, Lightbulb, Search, Bell, FileText, FolderOpen, UserPlus, AlertCircle, CheckCircle, ExternalLink, Download } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  intent?: string;
  userRole?: string;
  suggestions?: string[];
  actions?: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary';
    action: string;
  }>;
}

interface ActionForm {
  id: string;
  title: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'email' | 'select' | 'textarea';
    placeholder?: string;
    options?: string[];
    required?: boolean;
  }>;
}

const roleConfigs = {
  superadmin: {
    name: 'Super Administrator',
    icon: <Settings className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    description: 'Full system access and administration'
  },
  power_user: {
    name: 'Power User',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
    description: 'Course and user management capabilities'
  },
  user_manager: {
    name: 'User Manager',
    icon: <Users className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    description: 'Team analytics and reporting access'
  },
  user: {
    name: 'User',
    icon: <User className="w-6 h-6" />,
    color: 'from-gray-500 to-slate-500',
    description: 'Basic reporting access'
  }
};

const actionForms: Record<string, ActionForm> = {
  search_user_form: {
    id: 'search_user',
    title: 'Search for User',
    fields: [
      { name: 'searchType', label: 'Search By', type: 'select', options: ['Email', 'Name', 'User ID'], required: true },
      { name: 'searchValue', label: 'Search Value', type: 'text', placeholder: 'Enter email, name, or ID...', required: true }
    ]
  },
  user_status_form: {
    id: 'user_status',
    title: 'Check User Status',
    fields: [
      { name: 'userEmail', label: 'User Email', type: 'email', placeholder: 'user@company.com', required: true }
    ]
  },
  search_course_form: {
    id: 'search_course',
    title: 'Search Courses',
    fields: [
      { name: 'courseName', label: 'Course Name', type: 'text', placeholder: 'Enter course name or keyword...', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['All Categories', 'Compliance', 'Skills', 'Leadership', 'Technical'] }
    ]
  },
  enroll_user_form: {
    id: 'enroll_user',
    title: 'Enroll User in Course',
    fields: [
      { name: 'userEmail', label: 'User Email', type: 'email', placeholder: 'user@company.com', required: true },
      { name: 'courseName', label: 'Course Name', type: 'text', placeholder: 'Enter course name...', required: true },
      { name: 'enrollmentType', label: 'Enrollment Type', type: 'select', options: ['Immediate', 'Scheduled'], required: true }
    ]
  },
  user_report_form: {
    id: 'user_report',
    title: 'Generate User Report',
    fields: [
      { name: 'reportType', label: 'Report Type', type: 'select', options: ['User Activity', 'Completion Status', 'Learning Progress'], required: true },
      { name: 'timeframe', label: 'Timeframe', type: 'select', options: ['Last 7 days', 'Last 30 days', 'Last quarter', 'Custom'], required: true },
      { name: 'userFilter', label: 'User Filter', type: 'text', placeholder: 'All users or specific email...' }
    ]
  }
};

export default function ImprovedChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<keyof typeof roleConfigs>('superadmin');
  const [activeForm, setActiveForm] = useState<ActionForm | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roleConfig = roleConfigs[userRole];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      content: '',
      type: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    
    // Send initial context message
    handleInitialMessage();
  }, [userRole]);

  const handleInitialMessage = async () => {
    await sendMessage('What can you help me with?', false);
  };

  const sendMessage = async (messageText: string, addToChat: boolean = true) => {
    if (!messageText.trim() || loading) return;

    if (addToChat) {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: messageText.trim(),
        type: 'user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
    }

    setLoading(true);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: messageText,
          userRole: userRole,
          userId: 'demo-user'
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Sorry, no response received.',
        type: 'assistant',
        timestamp: new Date(),
        intent: data.intent,
        userRole: data.userRole,
        suggestions: data.suggestions || [],
        actions: data.actions || []
      };

      setMessages(prev => {
        if (addToChat) {
          return [...prev, assistantMessage];
        } else {
          // Replace the welcome message
          return [assistantMessage];
        }
      });
    } catch (error) {
      console.error('Chat API Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ **Error**: ${error instanceof Error ? error.message : 'Network error'}\n\nPlease try again or contact support if the problem persists.`,
        type: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => addToChat ? [...prev, errorMessage] : [errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    await sendMessage(input, true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleActionClick = (action: { id: string; label: string; type: string; action: string }) => {
    console.log('Action clicked:', action);
    
    if (action.action.endsWith('_form')) {
      const form = actionForms[action.action];
      if (form) {
        setActiveForm(form);
        setFormData({});
      }
    } else if (action.action.endsWith('_query')) {
      // Direct query actions
      const queries: Record<string, string> = {
        'list_users_query': 'Show me all users',
        'course_stats_query': 'Show course statistics',
        'enrollment_report_query': 'Generate enrollment report'
      };
      const query = queries[action.action] || `Execute ${action.label}`;
      setInput(query);
    } else {
      // Category selection
      const categoryQueries: Record<string, string> = {
        'category_user_management': 'Help with user management',
        'category_course_management': 'Help with course management',
        'category_enrollments': 'Help with enrollments',
        'category_reports': 'Help with reports'
      };
      const query = categoryQueries[action.action] || `Help with ${action.label}`;
      setInput(query);
    }
  };

  const handleFormSubmit = () => {
    if (!activeForm) return;
    
    // Generate natural language query from form data
    let query = '';
    
    switch (activeForm.id) {
      case 'search_user':
        query = `Search for user by ${formData.searchType}: ${formData.searchValue}`;
        break;
      case 'user_status':
        query = `Check status of user ${formData.userEmail}`;
        break;
      case 'search_course':
        query = `Search for courses: ${formData.courseName}${formData.category && formData.category !== 'All Categories' ? ` in ${formData.category} category` : ''}`;
        break;
      case 'enroll_user':
        query = `Enroll ${formData.userEmail} in course "${formData.courseName}" with ${formData.enrollmentType} enrollment`;
        break;
      case 'user_report':
        query = `Generate ${formData.reportType} report for ${formData.timeframe}${formData.userFilter ? ` for user ${formData.userFilter}` : ''}`;
        break;
      default:
        query = 'Execute form action';
    }
    
    setInput(query);
    setActiveForm(null);
    setFormData({});
  };

  const handleRoleChange = (newRole: keyof typeof roleConfigs) => {
    setUserRole(newRole);
    setMessages([]);
    setActiveForm(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Docebo AI Assistant</h1>
              <p className="text-slate-600">Intelligent LMS management with contextual guidance</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500">Version 2.0</div>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Role Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Select Your Role</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(roleConfigs).map(([role, config]) => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role as keyof typeof roleConfigs)}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                    userRole === role
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${config.color}`}>
                      <div className="text-white">{config.icon}</div>
                    </div>
                    <span className="font-medium text-slate-800">{config.name}</span>
                  </div>
                  <p className="text-sm text-slate-600">{config.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Interface */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Action Form Modal */}
          {activeForm && (
            <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">{activeForm.title}</h3>
                <button
                  onClick={() => setActiveForm(null)}
                  className="text-slate-400 hover:text-slate-600 text-xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                {activeForm.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      >
                        <option value="">Select {field.label}...</option>
                        {field.options?.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={field.placeholder}
                        rows={3}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type={field.type}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setActiveForm(null)}
                    className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    Execute
                  </button>
                </div>
              </div>
            </div>
          )}

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
                        : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      {message.content.split('\n').map((line, i) => (
                        <div key={i} className={message.type === 'user' ? 'text-white' : ''}>
                          {line.includes('**') ? (
                            <div dangerouslySetInnerHTML={{
                              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }} />
                          ) : (
                            line
                          )}
                        </div>
                      ))}
                    </div>
                    
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
                            {action.action.includes('search') && <Search className="w-3 h-3" />}
                            {action.action.includes('enroll') && <UserPlus className="w-3 h-3" />}
                            {action.action.includes('report') && <FileText className="w-3 h-3" />}
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
                      <div className="text-xs text-slate-500 mb-2">Suggested actions:</div>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.slice(0, 3).map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs hover:bg-slate-200 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                    {message.intent && (
                      <span className="ml-2 px-2 py-1 bg-slate-100 rounded-full">
                        {message.intent}
                      </span>
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
                    <span className="text-slate-600 text-sm">AI is thinking...</span>
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
                placeholder={`Ask me anything as ${roleConfig.name}...`}
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
            
            {/* Quick Start */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => handleSuggestionClick('What can you help me with?')}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                What can you do?
              </button>
              <button
                onClick={() => handleSuggestionClick('Help with user management')}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <Users className="w-3 h-3" />
                User Management
              </button>
              <button
                onClick={() => handleSuggestionClick('Help with course management')}
                className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                Course Management
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
