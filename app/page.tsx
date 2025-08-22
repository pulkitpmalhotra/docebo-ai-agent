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
  ExternalLink,
  Download,
  History,
  Star,
  Sparkles,
  UserPlus,
  UserMinus,
  Upload,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronRight,
  Menu,
  HelpCircle,
  Database,
  Eye,
  Settings
} from 'lucide-react';
import CSVUpload from '../components/CSVUpload';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  success?: boolean;
  helpRequest?: boolean;
  totalCount?: number;
  successCount?: number;
  failureCount?: number;
  isBulkOperation?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  example: string;
  description: string;
  category: 'bulk' | 'individual' | 'search' | 'info' | 'csv';
}

interface Suggestion {
  text: string;
  category: string;
}

interface MenuCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  isOpen: boolean;
  actions: QuickAction[];
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `🎯 **Welcome to Docebo AI Assistant**

I can help you with comprehensive enrollment management:

**🚀 Key Features:**
• **CSV Upload**: Bulk operations via spreadsheet upload
• **Individual Operations**: Single user enrollment management
• **Bulk Operations**: Multiple users via command or team references
• **Search & Discovery**: Find users, courses, and learning plans
• **Status Checking**: Verify enrollment status and progress

**💡 Quick Start:**
• Use the left sidebar to explore available commands
• Try: "Find user john@company.com"
• Or: "Enroll alice@co.com,bob@co.com in course Python Programming"

Select a category from the sidebar to see available commands!`,
      timestamp: new Date(),
      success: true
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [favoriteCommands, setFavoriteCommands] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [isCSVProcessing, setIsCSVProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Properly categorized quick actions
  const allQuickActions: QuickAction[] = [
    // CSV Operations
    {
      id: 'csv_upload',
      title: 'Upload CSV File',
      icon: <Upload className="w-4 h-4" />,
      example: 'Upload CSV for bulk operations',
      description: 'Upload CSV file for bulk enrollment operations',
      category: 'csv'
    },
    {
      id: 'csv_course_template',
      title: 'Course Enrollment Template',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      example: 'Download course enrollment CSV template',
      description: 'Download CSV template for course enrollments',
      category: 'csv'
    },
    {
      id: 'csv_lp_template',
      title: 'Learning Plan Template',
      icon: <Database className="w-4 h-4" />,
      example: 'Download learning plan CSV template',
      description: 'Download CSV template for learning plan enrollments',
      category: 'csv'
    },

    // Bulk Operations
    {
      id: 'bulk_enroll_course',
      title: 'Bulk Course Enrollment',
      icon: <UserPlus className="w-4 h-4" />,
      example: 'Enroll alice@co.com,bob@co.com,charlie@co.com in course Python Programming',
      description: 'Enroll multiple users in a course at once',
      category: 'bulk'
    },
    {
      id: 'bulk_enroll_lp',
      title: 'Bulk Learning Plan Enrollment',
      icon: <Users className="w-4 h-4" />,
      example: 'Enroll marketing team in learning plan Leadership Development',
      description: 'Enroll multiple users in a learning plan',
      category: 'bulk'
    },
    {
      id: 'bulk_unenroll_course',
      title: 'Bulk Course Unenrollment',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Remove alice@co.com,bob@co.com from course Old Training',
      description: 'Remove multiple users from courses',
      category: 'bulk'
    },
    {
      id: 'bulk_unenroll_lp',
      title: 'Bulk Learning Plan Unenrollment',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Remove marketing team from learning plan Outdated Program',
      description: 'Remove multiple users from learning plans',
      category: 'bulk'
    },
    {
      id: 'team_enrollment',
      title: 'Team-based Enrollment',
      icon: <Users className="w-4 h-4" />,
      example: 'Enroll sales team in course Customer Service Excellence',
      description: 'Enroll entire teams using team references',
      category: 'bulk'
    },
    
    // Individual Operations
    {
      id: 'enroll_user_course',
      title: 'Enroll User in Course',
      icon: <BookOpen className="w-4 h-4" />,
      example: 'Enroll john@company.com in course Python Programming',
      description: 'Enroll a single user in a course',
      category: 'individual'
    },
    {
      id: 'enroll_user_lp',
      title: 'Enroll User in Learning Plan',
      icon: <Users className="w-4 h-4" />,
      example: 'Enroll sarah@company.com in learning plan Data Science',
      description: 'Enroll a single user in a learning plan',
      category: 'individual'
    },
    {
      id: 'unenroll_user_course',
      title: 'Unenroll from Course',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Unenroll mike@company.com from course Excel Training',
      description: 'Remove a user from a course',
      category: 'individual'
    },
    {
      id: 'unenroll_user_lp',
      title: 'Unenroll from Learning Plan',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Remove user@company.com from learning plan Leadership',
      description: 'Remove a user from a learning plan',
      category: 'individual'
    },
    {
      id: 'check_enrollment',
      title: 'Check Enrollment Status',
      icon: <CheckCircle className="w-4 h-4" />,
      example: 'Check if sarah@company.com is enrolled in course Data Science',
      description: 'Verify user enrollment status',
      category: 'individual'
    },
    
    // Search Operations
    {
      id: 'find_user',
      title: 'Find User',
      icon: <User className="w-4 h-4" />,
      example: 'Find user mike@company.com',
      description: 'Look up user details and information',
      category: 'search'
    },
    {
      id: 'find_course', 
      title: 'Find Course',
      icon: <BookOpen className="w-4 h-4" />,
      example: 'Find Python courses',
      description: 'Search for courses by name or keyword',
      category: 'search'
    },
    {
      id: 'find_learning_plan',
      title: 'Find Learning Plans',
      icon: <Database className="w-4 h-4" />,
      example: 'Find Python learning plans',
      description: 'Search for learning paths and programs',
      category: 'search'
    },
    {
      id: 'search_users_advanced',
      title: 'Advanced User Search',
      icon: <Search className="w-4 h-4" />,
      example: 'Find users in marketing department',
      description: 'Search users by department, role, or criteria',
      category: 'search'
    },
    
    // Info & Status Operations
    {
      id: 'user_enrollments',
      title: 'User Enrollments Overview',
      icon: <Eye className="w-4 h-4" />,
      example: 'User enrollments mike@company.com',
      description: 'Show all enrollments for a user',
      category: 'info'
    },
    {
      id: 'course_info',
      title: 'Course Information',
      icon: <BookOpen className="w-4 h-4" />,
      example: 'Course info Python Programming',
      description: 'Get detailed information about a course',
      category: 'info'
    },
    {
      id: 'learning_plan_info',
      title: 'Learning Plan Information',
      icon: <Database className="w-4 h-4" />,
      example: 'Learning plan info Data Science Program',
      description: 'Get detailed information about a learning plan',
      category: 'info'
    },
    {
      id: 'enrollment_status',
      title: 'Check Completion Status',
      icon: <CheckCircle className="w-4 h-4" />,
      example: 'Has sarah@company.com completed learning plan Data Science?',
      description: 'Check if user has completed courses or learning plans',
      category: 'info'
    },
    {
      id: 'docebo_help',
      title: 'Docebo Help',
      icon: <HelpCircle className="w-4 h-4" />,
      example: 'How to enroll users in Docebo',
      description: 'Get help with Docebo functionality',
      category: 'info'
    },
    {
      id: 'system_status',
      title: 'System Status',
      icon: <Settings className="w-4 h-4" />,
      example: 'Check system status',
      description: 'Check API connectivity and system health',
      category: 'info'
    }
  ];

  // Initialize menu categories
  useEffect(() => {
    const categories: MenuCategory[] = [
      {
        id: 'csv',
        name: 'CSV Operations',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        description: 'Upload and process CSV files for bulk operations',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'csv')
      },
      {
        id: 'bulk',
        name: 'Bulk Operations',
        icon: <UserPlus className="w-5 h-5" />,
        description: 'Manage multiple users at once',
        isOpen: true, // Default open
        actions: allQuickActions.filter(action => action.category === 'bulk')
      },
      {
        id: 'individual',
        name: 'Individual Operations',
        icon: <User className="w-5 h-5" />,
        description: 'Manage single users',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'individual')
      },
      {
        id: 'search',
        name: 'Search & Discovery',
        icon: <Search className="w-5 h-5" />,
        description: 'Find users, courses, and learning plans',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'search')
      },
      {
        id: 'info',
        name: 'Information & Status',
        icon: <AlertCircle className="w-5 h-5" />,
        description: 'Get information and check status',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'info')
      }
    ];
    setMenuCategories(categories);
  }, []);

  const smartSuggestions: Suggestion[] = [
    { text: 'Upload CSV for bulk course enrollment', category: 'csv' },
    { text: 'Enroll alice@co.com,bob@co.com in course Security Training', category: 'bulk' },
    { text: 'Bulk enroll marketing team in learning plan Digital Marketing', category: 'bulk' },
    { text: 'Remove support team from course Old Process Training', category: 'bulk' },
    { text: 'Enroll john@company.com in course Python Programming', category: 'individual' },
    { text: 'Check if sarah@company.com completed course Data Science', category: 'individual' },
    { text: 'User enrollments mike@company.com', category: 'info' },
    { text: 'Find courses about leadership', category: 'search' },
    { text: 'Find learning plans for new employees', category: 'search' },
    { text: 'How to create bulk enrollments from CSV', category: 'info' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Load favorites and recent commands from localStorage
    const savedFavorites = localStorage.getItem('docebo-favorites');
    const savedRecent = localStorage.getItem('docebo-recent');
    
    if (savedFavorites) {
      setFavoriteCommands(JSON.parse(savedFavorites));
    }
    if (savedRecent) {
      setRecentCommands(JSON.parse(savedRecent));
    }
  }, []);

  const toggleCategory = (categoryId: string) => {
    setMenuCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, isOpen: !cat.isOpen }
        : cat
    ));
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.id === 'csv_upload') {
      setShowCSVUpload(!showCSVUpload);
    } else {
      setInputValue(action.example);
      inputRef.current?.focus();
    }
  };

  const handleCSVUpload = async (data: { operation: string; data: any }) => {
    setIsCSVProcessing(true);
    setShowCSVUpload(false);

    try {
      const response = await fetch('/api/chat/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: data.operation,
          csvData: data.data
        }),
      });

      const result = await response.json();

      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.response || 'CSV processing completed.',
        timestamp: new Date(),
        success: result.success,
        totalCount: result.totalCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        isBulkOperation: true
      };

      setMessages(prev => [...prev, assistantMessage]);
      addToRecent(`CSV ${data.operation}: ${data.data.validRows.length} rows processed`);

    } catch (error) {
      console.error('CSV processing error:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: '❌ **CSV Processing Error**: Failed to process CSV file. Please try again.',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsCSVProcessing(false);
    }
  };

  const handleSuggestion = (suggestion: Suggestion) => {
    setInputValue(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const addToFavorites = (command: string) => {
    const newFavorites = [...favoriteCommands, command].slice(0, 10);
    setFavoriteCommands(newFavorites);
    localStorage.setItem('docebo-favorites', JSON.stringify(newFavorites));
  };

  const addToRecent = (command: string) => {
    const newRecent = [command, ...recentCommands.filter(cmd => cmd !== command)].slice(0, 5);
    setRecentCommands(newRecent);
    localStorage.setItem('docebo-recent', JSON.stringify(newRecent));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const exportResults = (message: Message) => {
    const data = {
      timestamp: message.timestamp,
      success: message.success,
      totalCount: message.totalCount,
      successCount: message.successCount,
      failureCount: message.failureCount,
      content: message.content
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docebo-results-${message.timestamp.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    addToRecent(inputValue);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        success: data.success,
        helpRequest: data.helpRequest,
        totalCount: data.totalCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
        isBulkOperation: data.successCount !== undefined || data.failureCount !== undefined
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    if (value.length > 2) {
      setShowSuggestions(true);
      setSuggestions(smartSuggestions.filter(s => 
        s.text.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5));
    } else {
      setShowSuggestions(false);
    }
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Menu */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
        sidebarOpen ? 'w-80' : 'w-16'
      } flex flex-col`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Commands</h2>
                <p className="text-xs text-gray-500">Click to use examples</p>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Recent & Favorites */}
        {sidebarOpen && (recentCommands.length > 0 || favoriteCommands.length > 0) && (
          <div className="p-4 border-b border-gray-200 space-y-3">
            {favoriteCommands.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium text-gray-700">Favorites</span>
                </div>
                <div className="space-y-1">
                  {favoriteCommands.slice(0, 2).map((command, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(command)}
                      className="w-full text-left text-xs bg-yellow-50 hover:bg-yellow-100 px-2 py-1 rounded text-yellow-700 truncate"
                      title={command}
                    >
                      {command.length > 35 ? command.substring(0, 35) + '...' : command}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {recentCommands.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <History className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-700">Recent</span>
                </div>
                <div className="space-y-1">
                  {recentCommands.slice(0, 2).map((command, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(command)}
                      className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded text-gray-700 truncate"
                      title={command}
                    >
                      {command.length > 35 ? command.substring(0, 35) + '...' : command}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Accordion Menu */}
        <div className="flex-1 overflow-y-auto">
          {sidebarOpen ? (
            <div className="p-2">
              {menuCategories.map((category) => (
                <div key={category.id} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`${
                        category.id === 'csv' ? 'text-purple-600' :
                        category.id === 'bulk' ? 'text-blue-600' :
                        category.id === 'individual' ? 'text-green-600' :
                        category.id === 'search' ? 'text-orange-600' :
                        'text-gray-600'
                      }`}>
                        {category.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 text-sm">{category.name}</div>
                        <div className="text-xs text-gray-500">{category.description}</div>
                      </div>
                    </div>
                    {category.isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  {category.isOpen && (
                    <div className="mt-2 ml-6 space-y-1">
                      {category.actions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                          title={action.description}
                        >
                          <div className="flex items-start space-x-2">
                            <div className="text-gray-400 group-hover:text-gray-600 mt-0.5">
                              {action.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                {action.title}
                              </div>
                              <div className="text-xs text-gray-500 group-hover:text-gray-600 truncate">
                                {action.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {menuCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSidebarOpen(true);
                    toggleCategory(category.id);
                  }}
                  className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors flex justify-center"
                  title={category.name}
                >
                  <div className={`${
                    category.id === 'csv' ? 'text-purple-600' :
                    category.id === 'bulk' ? 'text-blue-600' :
                    category.id === 'individual' ? 'text-green-600' :
                    category.id === 'search' ? 'text-orange-600' :
                    'text-gray-600'
                  }`}>
                    {category.icon}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Docebo AI Assistant</h1>
              <p className="text-sm text-gray-600">AI-powered enrollment management with CSV upload support</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-600">Online</span>
            </div>
          </div>
        </div>

        {/* CSV Upload Modal */}
        {showCSVUpload && (
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">CSV Bulk Operations</h3>
              <button
                onClick={() => setShowCSVUpload(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CSVUpload onProcessCSV={handleCSVUpload} isProcessing={isCSVProcessing} />
          </div>
        )}

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
                      {message.isBulkOperation && (
                        <span className="text-purple-600">
                          🔄 Bulk: {message.successCount || 0}/{(message.successCount || 0) + (message.failureCount || 0)}
                        </span>
                      )}
                      {message.totalCount && !message.isBulkOperation && (
                        <span className="text-blue-600">
                          📊 {message.totalCount} results
                        </span>
                      )}
                      {message.helpRequest && (
                        <span className="text-purple-600">
                          🆘 Help Request
                        </span>
                      )}
                      {message.hasMore && (
                        <span className="text-orange-600">
                          🔄 Has More Data
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {message.loadMoreCommand && (
                        <button
                          onClick={() => setInputValue(message.loadMoreCommand)}
                          className="text-blue-600 hover:text-blue-800 transition-colors text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded"
                          title="Load more results"
                        >
                          Load More
                        </button>
                      )}
                      {(message.isBulkOperation || message.totalCount) && (
                        <button
                          onClick={() => exportResults(message)}
                          className="text-gray-400 hover:text-green-600 transition-colors"
                          title="Export results"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy message"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Add to favorites button for user messages */}
                {message.type === 'user' && !favoriteCommands.includes(message.content) && (
                  <div className="mt-2 pt-2 border-t border-blue-500">
                    <button
                      onClick={() => addToFavorites(message.content)}
                      className="text-blue-200 hover:text-white transition-colors text-xs flex items-center space-x-1"
                      title="Add to favorites"
                    >
                      <Star className="w-3 h-3" />
                      <span>Add to favorites</span>
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
                  <span className="text-sm">AI is processing your request...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input with Suggestions */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          {showSuggestions && suggestions.length > 0 && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 mb-2 font-medium">Suggestions:</div>
              <div className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestion(suggestion)}
                    className="block w-full text-left text-sm text-gray-700 hover:text-blue-600 hover:bg-white px-2 py-1 rounded transition-colors"
                  >
                    {suggestion.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about CSV uploads, bulk enrollments, individual users, courses, learning plans, or get help with Docebo..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={isLoading}
              />
              <div className="mt-2 text-xs text-gray-500">
                <strong>💡 Quick Tip:</strong> Use the left sidebar to explore available commands or type naturally like "Find user john@company.com"
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
            <span>Docebo AI Assistant v4.0 - Enhanced UI with Sidebar Navigation</span>
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
            <span>CSV upload + Bulk + Individual enrollment management</span>
          </div>
        </div>
      </div>
    </div>
  );
}
