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
  X
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
  category: 'individual' | 'bulk' | 'search' | 'info';
}

interface Suggestion {
  text: string;
  category: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `🎯 **Welcome to Docebo AI Assistant**

I can help you with individual and bulk enrollment management:

**🚀 Bulk Operations:**
• **CSV Upload**: Upload spreadsheets for bulk operations
• **Bulk Enrollment**: "Enroll alice@co.com,bob@co.com,charlie@co.com in course Python Programming"
• **Team Management**: "Enroll marketing team in learning plan Leadership Development"

**👤 Individual Operations:**
• **Find Users**: "Find user mike@company.com"
• **Enroll Users**: "Enroll john@company.com in course Data Science"
• **Check Status**: "Check if sarah@company.com is enrolled in course Excel Training"

**📊 Search & Info:**
• **Find Courses**: "Find Python courses"  
• **Find Learning Plans**: "Find Python learning plans"
• **Get Help**: "How to enroll users in Docebo"

What would you like to do today?`,
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
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [isCSVProcessing, setIsCSVProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quickActions: QuickAction[] = [
    // CSV Upload
    {
      id: 'csv_upload',
      title: 'CSV Upload',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      example: 'Upload CSV for bulk operations',
      description: 'Upload CSV file for bulk enrollment operations',
      category: 'bulk'
    },
    
    // Bulk Operations
    {
      id: 'bulk_enroll_course',
      title: 'Bulk Course Enrollment',
      icon: <UserPlus className="w-5 h-5" />,
      example: 'Enroll alice@co.com,bob@co.com,charlie@co.com in course Python Programming',
      description: 'Enroll multiple users in a course at once',
      category: 'bulk'
    },
    {
      id: 'bulk_enroll_lp',
      title: 'Bulk LP Enrollment',
      icon: <Users className="w-5 h-5" />,
      example: 'Enroll marketing team in learning plan Leadership Development',
      description: 'Enroll multiple users in a learning plan',
      category: 'bulk'
    },
    {
      id: 'bulk_unenroll',
      title: 'Bulk Unenrollment',
      icon: <UserMinus className="w-5 h-5" />,
      example: 'Remove alice@co.com,bob@co.com from course Old Training',
      description: 'Remove multiple users from courses/learning plans',
      category: 'bulk'
    },
    
    // Individual Operations
    {
      id: 'find_user',
      title: 'Find User',
      icon: <User className="w-5 h-5" />,
      example: 'Find user mike@company.com',
      description: 'Look up user details and information',
      category: 'individual'
    },
    {
      id: 'enroll_user',
      title: 'Enroll User',
      icon: <BookOpen className="w-5 h-5" />,
      example: 'Enroll john@company.com in course Python Programming',
      description: 'Enroll a single user in a course',
      category: 'individual'
    },
    {
      id: 'check_enrollment',
      title: 'Check Enrollment',
      icon: <CheckCircle className="w-5 h-5" />,
      example: 'Check if sarah@company.com is enrolled in course Data Science',
      description: 'Verify user enrollment status',
      category: 'individual'
    },
    
    // Search Operations
    {
      id: 'find_course', 
      title: 'Find Course',
      icon: <BookOpen className="w-5 h-5" />,
      example: 'Find Python courses',
      description: 'Search for courses by name or keyword',
      category: 'search'
    },
    {
      id: 'find_learning_plan',
      title: 'Find Learning Plans',
      icon: <Users className="w-5 h-5" />,
      example: 'Find Python learning plans',
      description: 'Search for learning paths and programs',
      category: 'search'
    },
    
    // Info Operations
    {
      id: 'user_enrollments',
      title: 'User Enrollments',
      icon: <Search className="w-5 h-5" />,
      example: 'User enrollments mike@company.com',
      description: 'Show all enrollments for a user',
      category: 'info'
    },
    {
      id: 'docebo_help',
      title: 'Docebo Help',
      icon: <Zap className="w-5 h-5" />,
      example: 'How to enroll users in Docebo',
      description: 'Get help with Docebo functionality',
      category: 'info'
    }
  ];

  const smartSuggestions: Suggestion[] = [
    { text: 'Upload CSV for bulk course enrollment', category: 'bulk' },
    { text: 'Enroll alice@co.com,bob@co.com in course Security Training', category: 'bulk' },
    { text: 'Bulk enroll marketing team in learning plan Digital Marketing', category: 'bulk' },
    { text: 'Remove support team from course Old Process Training', category: 'bulk' },
    { text: 'Enroll john@company.com in course Python Programming', category: 'individual' },
    { text: 'Check if sarah@company.com completed course Data Science', category: 'individual' },
    { text: 'User enrollments mike@company.com', category: 'individual' },
    { text: 'Find courses about leadership', category: 'search' },
    { text: 'Find learning plans for new employees', category: 'search' },
    { text: 'How to create bulk enrollments from CSV', category: 'help' }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'bulk', name: 'Bulk Ops', icon: <UserPlus className="w-4 h-4" /> },
    { id: 'individual', name: 'Individual', icon: <User className="w-4 h-4" /> },
    { id: 'search', name: 'Search', icon: <Search className="w-4 h-4" /> },
    { id: 'info', name: 'Info', icon: <AlertCircle className="w-4 h-4" /> }
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

      // Add to recent commands
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
    const newFavorites = [...favoriteCommands, command].slice(0, 10); // Keep only 10 favorites
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

  const filteredActions = activeCategory === 'all' 
    ? quickActions 
    : quickActions.filter(action => action.category === activeCategory);

  const filteredSuggestions = activeCategory === 'all' 
    ? smartSuggestions 
    : smartSuggestions.filter(suggestion => suggestion.category === activeCategory);

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
    
    // Show suggestions when typing
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
            <p className="text-sm text-gray-600">AI-powered bulk and individual enrollment management with CSV upload</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-600">Online</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center space-x-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === category.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {category.icon}
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {filteredActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
              title={action.description}
            >
              <div className={`mb-1 group-hover:text-blue-700 ${
                action.category === 'bulk' ? 'text-purple-600' :
                action.category === 'individual' ? 'text-blue-600' :
                action.category === 'search' ? 'text-green-600' :
                'text-orange-600'
              }`}>
                {action.icon}
              </div>
              <span className="text-xs text-gray-600 text-center font-medium">
                {action.title}
              </span>
            </button>
          ))}
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

      {/* Recent and Favorites */}
      {(recentCommands.length > 0 || favoriteCommands.length > 0) && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center space-x-6">
            {recentCommands.length > 0 && (
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Recent:</span>
                <div className="flex space-x-1">
                  {recentCommands.slice(0, 3).map((command, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(command)}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 truncate max-w-40"
                      title={command}
                    >
                      {command.length > 30 ? command.substring(0, 30) + '...' : command}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {favoriteCommands.length > 0 && (
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-gray-500 font-medium">Favorites:</span>
                <div className="flex space-x-1">
                  {favoriteCommands.slice(0, 2).map((command, index) => (
                    <button
                      key={index}
                      onClick={() => setInputValue(command)}
                      className="text-xs bg-yellow-50 hover:bg-yellow-100 px-2 py-1 rounded text-yellow-700 truncate max-w-40"
                      title={command}
                    >
                      {command.length > 25 ? command.substring(0, 25) + '...' : command}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                  </div>
                  <div className="flex items-center space-x-2">
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
              
              {/* Add to favorites button - FIXED VERSION */}
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
              placeholder="Ask me about CSV uploads, bulk enrollments, individual users, courses, learning plans, or Docebo help..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            <div className="mt-3 text-xs text-gray-500">
              <strong>🆕 CSV Upload Available! </strong>
              Click "CSV Upload" for spreadsheet-based bulk operations • 
              <strong>Bulk Examples: </strong>
              "Enroll alice@co.com,bob@co.com,charlie@co.com in course Python Programming" • "Bulk enroll marketing team in learning plan Leadership"
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
          <span>Docebo AI Assistant v3.0 - Now with CSV Upload!</span>
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
  );
}
