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
  Settings,
  Calendar,
  MapPin,
  Clock,
  Award,
  TrendingUp,
  BarChart3,
  FileText,
  Link as LinkIcon,
  RefreshCw,
  Filter
} from 'lucide-react';

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
  hasMore?: boolean;
  loadMoreCommand?: string;
  isCSVOperation?: boolean;
  backgroundProcessing?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  example: string;
  description: string;
  category: 'bulk' | 'individual' | 'search' | 'info' | 'csv' | 'ilt' | 'advanced';
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

// Enhanced CSV Upload Component (placeholder - you'd implement the full logic)
const CSVUpload: React.FC<{onProcessCSV: (data: any) => void; isProcessing: boolean}> = ({ onProcessCSV, isProcessing }) => (
  <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300">
    <div className="text-center">
      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p className="text-sm text-gray-600">CSV Upload functionality would go here</p>
      <p className="text-xs text-gray-500 mt-1">Support for course enrollment, learning plan enrollment, and unenrollment templates</p>
    </div>
  </div>
);

export default function ChatInterface() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Initialize with enhanced welcome message
  useEffect(() => {
    setMounted(true);
    
    const welcomeMessage: Message = {
      id: '1',
      type: 'assistant',
      content: `🎯 **Welcome to Docebo AI Assistant v5.0**

I can help you with comprehensive Docebo management:

**🆕 NEW: ILT Session Management**
• **Create Sessions**: Schedule instructor-led training sessions with events
• **Manage Enrollment**: Enroll individuals or bulk users in ILT sessions  
• **Track Attendance**: Mark attendance and completion status for sessions

**🚀 Core Features:**
• **CSV Upload**: Bulk operations via spreadsheet upload with validity dates
• **Individual Operations**: Single user enrollment management
• **Bulk Operations**: Multiple users via command or team references
• **Search & Discovery**: Find users, courses, learning plans, and sessions
• **Status Checking**: Verify enrollment status and progress
• **Background Processing**: Handle large datasets without timeouts

**💡 Enhanced Features:**
• **Load More**: Paginated results for large datasets
• **Clickable Links**: All URLs are automatically clickable
• **Performance Optimized**: Smart caching and timeout handling
• **Validity Dates**: Support for enrollment start/end dates

**🎓 New ILT Commands:**
• "Create ILT session for course Python Programming on 2025-02-15"
• "Enroll john@co.com,sarah@co.com in session 'Advanced Training'"
• "Mark user@co.com as attended in session 123"

Select a category from the sidebar to explore all available commands!`,
      timestamp: new Date(),
      success: true
    };
    
    setMessages([welcomeMessage]);
  }, []);

  // Load favorites and recent commands from localStorage
  useEffect(() => {
    if (!mounted) return;
    
    const savedFavorites = localStorage.getItem('docebo-favorites');
    const savedRecent = localStorage.getItem('docebo-recent');
    
    if (savedFavorites) {
      try {
        setFavoriteCommands(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Error parsing saved favorites:', error);
      }
    }
    if (savedRecent) {
      try {
        setRecentCommands(JSON.parse(savedRecent));
      } catch (error) {
        console.error('Error parsing saved recent commands:', error);
      }
    }
  }, [mounted]);

  // Enhanced quick actions with all backend features
  const allQuickActions: QuickAction[] = [
    // CSV Operations
    {
      id: 'csv_upload',
      title: 'Upload CSV File',
      icon: <Upload className="w-4 h-4" />,
      example: 'Upload CSV for bulk operations',
      description: 'Upload CSV file for bulk enrollment operations with validity dates',
      category: 'csv'
    },
    {
      id: 'csv_course_template',
      title: 'Course Enrollment Template',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      example: 'Download course enrollment CSV template with validity dates',
      description: 'Download CSV template for course enrollments (supports start/end validity)',
      category: 'csv'
    },
    {
      id: 'csv_lp_template',
      title: 'Learning Plan Template',
      icon: <Database className="w-4 h-4" />,
      example: 'Download learning plan CSV template with validity dates',
      description: 'Download CSV template for learning plan enrollments (supports validity dates)',
      category: 'csv'
    },
    {
      id: 'csv_unenroll_template',
      title: 'Unenrollment Template',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Download unenrollment CSV template',
      description: 'Download CSV template for bulk unenrollment operations',
      category: 'csv'
    },

    // ILT Session Operations
    {
      id: 'create_ilt_session',
      title: 'Create ILT Session',
      icon: <Calendar className="w-4 h-4" />,
      example: 'Create ILT session for course Python Programming on 2025-02-15 from 9:00 to 17:00',
      description: 'Schedule new instructor-led training sessions with events',
      category: 'ilt'
    },
    {
      id: 'create_ilt_with_instructor',
      title: 'Create Session with Instructor',
      icon: <User className="w-4 h-4" />,
      example: 'Create session "Advanced Python" for course 2420 with instructor trainer@company.com',
      description: 'Create ILT session and assign instructor',
      category: 'ilt'
    },
    {
      id: 'enroll_ilt_individual',
      title: 'Enroll in ILT Session',
      icon: <UserPlus className="w-4 h-4" />,
      example: 'Enroll john@company.com in ILT session 123',
      description: 'Enroll single user in instructor-led training session',
      category: 'ilt'
    },
    {
      id: 'enroll_ilt_bulk',
      title: 'Bulk Enroll in ILT Session',
      icon: <Users className="w-4 h-4" />,
      example: 'Enroll john@co.com,sarah@co.com,mike@co.com in session "Python Workshop"',
      description: 'Enroll multiple users in ILT session at once',
      category: 'ilt'
    },
    {
      id: 'mark_attendance',
      title: 'Mark Session Attendance',
      icon: <CheckCircle className="w-4 h-4" />,
      example: 'Mark john@company.com as attended in session 123',
      description: 'Mark attendance and completion status for ILT sessions',
      category: 'ilt'
    },
    {
      id: 'mark_bulk_attendance',
      title: 'Bulk Attendance Marking',
      icon: <Award className="w-4 h-4" />,
      example: 'Mark john@co.com,sarah@co.com as completed in session "Advanced Training"',
      description: 'Mark attendance for multiple users simultaneously',
      category: 'ilt'
    },
    {
      id: 'unenroll_ilt',
      title: 'Unenroll from ILT Session',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Remove user@company.com from ILT session 123',
      description: 'Remove users from instructor-led training sessions',
      category: 'ilt'
    },

    // Enhanced Bulk Operations
    {
      id: 'bulk_enroll_course',
      title: 'Bulk Course Enrollment',
      icon: <UserPlus className="w-4 h-4" />,
      example: 'Enroll alice@co.com,bob@co.com,charlie@co.com in course Python Programming',
      description: 'Enroll multiple users in a course at once',
      category: 'bulk'
    },
    {
      id: 'bulk_enroll_course_dates',
      title: 'Bulk Enrollment with Validity Dates',
      icon: <Calendar className="w-4 h-4" />,
      example: 'Enroll team@co.com,lead@co.com in course Security Training as mandatory from 2025-01-01 to 2025-12-31',
      description: 'Bulk enroll with assignment type and validity dates',
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
      id: 'bulk_enroll_lp_dates',
      title: 'LP Enrollment with Dates',
      icon: <Clock className="w-4 h-4" />,
      example: 'Enroll team@co.com,manager@co.com in learning plan 274 as recommended from 2025-02-01',
      description: 'Bulk learning plan enrollment with validity dates',
      category: 'bulk'
    },
    {
      id: 'bulk_unenroll',
      title: 'Bulk Unenrollment',
      icon: <UserMinus className="w-4 h-4" />,
      example: 'Remove alice@co.com,bob@co.com from course Old Training',
      description: 'Remove multiple users from courses or learning plans',
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
    
    // Enhanced Individual Operations
    {
      id: 'enroll_user_course',
      title: 'Enroll User in Course',
      icon: <BookOpen className="w-4 h-4" />,
      example: 'Enroll john@company.com in course Python Programming',
      description: 'Enroll a single user in a course',
      category: 'individual'
    },
    {
      id: 'enroll_user_course_dates',
      title: 'Enroll with Validity Dates',
      icon: <Calendar className="w-4 h-4" />,
      example: 'Enroll sarah@company.com in course Data Science as mandatory from 2025-01-15 to 2025-06-15',
      description: 'Enroll user with assignment type and validity period',
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
      id: 'enroll_user_lp_dates',
      title: 'LP Enrollment with Dates',
      icon: <Clock className="w-4 h-4" />,
      example: 'Enroll user@company.com in learning plan 190 as optional from 2025-03-01 to 2025-12-31',
      description: 'Learning plan enrollment with validity dates',
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
      title: 'Intelligent LP Unenrollment',
      icon: <Zap className="w-4 h-4" />,
      example: 'Remove user@company.com from learning plan Leadership',
      description: 'Smart unenrollment that preserves course progress',
      category: 'individual'
    },
    {
      id: 'check_enrollment',
      title: 'Check Enrollment Status',
      icon: <CheckCircle className="w-4 h-4" />,
      example: 'Check if sarah@company.com is enrolled in course Data Science',
      description: 'Verify user enrollment status and progress',
      category: 'individual'
    },
    
    // Enhanced Search Operations
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
    {
      id: 'search_ilt_sessions',
      title: 'Find ILT Sessions',
      icon: <Calendar className="w-4 h-4" />,
      example: 'Find ILT sessions for course Python Programming',
      description: 'Search for instructor-led training sessions',
      category: 'search'
    },
    
    // Enhanced Info & Status Operations
    {
      id: 'user_enrollments',
      title: 'User Enrollments Overview',
      icon: <Eye className="w-4 h-4" />,
      example: 'User enrollments mike@company.com',
      description: 'Show all enrollments for a user (paginated)',
      category: 'info'
    },
    {
      id: 'user_summary',
      title: 'User Summary',
      icon: <BarChart3 className="w-4 h-4" />,
      example: 'User summary sarah@company.com',
      description: 'Quick overview with enrollment counts and basic info',
      category: 'info'
    },
    {
      id: 'recent_enrollments',
      title: 'Recent Enrollments',
      icon: <TrendingUp className="w-4 h-4" />,
      example: 'Recent enrollments mike@company.com',
      description: 'Show user\'s most recent enrollment activity',
      category: 'info'
    },
    {
      id: 'load_more_enrollments',
      title: 'Load More Results',
      icon: <RefreshCw className="w-4 h-4" />,
      example: 'Load more enrollments for john@company.com',
      description: 'Load additional results for paginated data',
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
      id: 'ilt_session_info',
      title: 'ILT Session Details',
      icon: <Calendar className="w-4 h-4" />,
      example: 'Session details for session 123',
      description: 'Get information about ILT sessions',
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

    // Advanced Operations
    {
      id: 'background_processing',
      title: 'Background Processing',
      icon: <Database className="w-4 h-4" />,
      example: 'Load all enrollments in background for john@company.com',
      description: 'Process heavy datasets without timeout limits',
      category: 'advanced'
    },
    {
      id: 'system_status',
      title: 'System Status',
      icon: <Settings className="w-4 h-4" />,
      example: 'Check system status',
      description: 'Check API connectivity and system health',
      category: 'advanced'
    }
  ];

  // Enhanced suggestions with new features
  const smartSuggestions: Suggestion[] = [
    // ILT Session suggestions
    { text: 'Create ILT session for course Python Programming on 2025-02-15', category: 'ilt' },
    { text: 'Enroll development team in ILT session "Advanced Training"', category: 'ilt' },
    { text: 'Mark john@co.com,sarah@co.com as completed in session 123', category: 'ilt' },
    
    // CSV suggestions
    { text: 'Upload CSV for bulk course enrollment with validity dates', category: 'csv' },
    { text: 'Download learning plan enrollment template', category: 'csv' },
    
    // Enhanced bulk operations
    { text: 'Enroll alice@co.com,bob@co.com in course Security Training as mandatory', category: 'bulk' },
    { text: 'Bulk enroll marketing team in learning plan Digital Marketing from 2025-01-01', category: 'bulk' },
    { text: 'Remove support team from course Old Process Training', category: 'bulk' },
    
    // Individual with dates
    { text: 'Enroll john@company.com in course Python Programming as required from 2025-02-01 to 2025-12-31', category: 'individual' },
    { text: 'Enroll sarah@company.com in learning plan 274 as optional', category: 'individual' },
    
    // Enhanced info commands
    { text: 'User summary mike@company.com', category: 'info' },
    { text: 'Recent enrollments sarah@company.com', category: 'info' },
    { text: 'Load more enrollments for john@company.com', category: 'info' },
    { text: 'Background processing for user@company.com', category: 'advanced' },
    
    // Search
    { text: 'Find courses about leadership', category: 'search' },
    { text: 'Find ILT sessions for course Data Science', category: 'search' },
    { text: 'Find learning plans for new employees', category: 'search' },
    
    // Help
    { text: 'How to create ILT sessions with multiple events', category: 'info' },
    { text: 'How to use validity dates in enrollments', category: 'info' }
  ];

  // Initialize menu categories with all features
  useEffect(() => {
    if (!mounted) return;
    
    const categories: MenuCategory[] = [
      {
        id: 'csv',
        name: 'CSV Operations',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        description: 'Upload and process CSV files with validity date support',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'csv')
      },
      {
        id: 'ilt',
        name: 'ILT Sessions',
        icon: <Calendar className="w-5 h-5" />,
        description: 'Instructor-led training session management',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'ilt')
      },
      {
        id: 'bulk',
        name: 'Bulk Operations',
        icon: <UserPlus className="w-5 h-5" />,
        description: 'Manage multiple users at once with validity dates',
        isOpen: true,
        actions: allQuickActions.filter(action => action.category === 'bulk')
      },
      {
        id: 'individual',
        name: 'Individual Operations',
        icon: <User className="w-5 h-5" />,
        description: 'Manage single users with advanced options',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'individual')
      },
      {
        id: 'search',
        name: 'Search & Discovery',
        icon: <Search className="w-5 h-5" />,
        description: 'Find users, courses, learning plans, and ILT sessions',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'search')
      },
      {
        id: 'info',
        name: 'Information & Status',
        icon: <AlertCircle className="w-5 h-5" />,
        description: 'Get information and check status with pagination',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'info')
      },
      {
        id: 'advanced',
        name: 'Advanced Features',
        icon: <Settings className="w-5 h-5" />,
        description: 'Background processing and system management',
        isOpen: false,
        actions: allQuickActions.filter(action => action.category === 'advanced')
      }
    ];
    setMenuCategories(categories);
  }, [mounted]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    } else if (action.id.includes('_template')) {
      // Handle template downloads
      const templateType = action.id.includes('course') ? 'course_enrollment' : 
                          action.id.includes('lp') ? 'lp_enrollment' : 'unenrollment';
      window.open(`/api/chat/csv?action=template&operation=${templateType}`, '_blank');
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
        id: `csv-${Date.now()}`,
        type: 'assistant',
        content: result.response || 'CSV processing completed.',
        timestamp: new Date(),
        success: result.success,
        totalCount: result.totalCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        isBulkOperation: true,
        isCSVOperation: true
      };

      setMessages(prev => [...prev, assistantMessage]);
      addToRecent(`CSV ${data.operation}: ${data.data.validRows?.length || 0} rows processed`);

    } catch (error) {
      console.error('CSV processing error:', error);
      const errorMessage: Message = {
        id: `csv-error-${Date.now()}`,
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
    if (!mounted) return;
    const newFavorites = [...favoriteCommands, command].slice(0, 10);
    setFavoriteCommands(newFavorites);
    localStorage.setItem('docebo-favorites', JSON.stringify(newFavorites));
  };

  const addToRecent = (command: string) => {
    if (!mounted) return;
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
      content: message.content,
      isBulkOperation: message.isBulkOperation,
      isCSVOperation: message.isCSVOperation,
      backgroundProcessing: message.backgroundProcessing
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docebo-results-${message.timestamp.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadMore = (loadMoreCommand: string) => {
    if (!loadMoreCommand || isLoading) return;
    
    console.log('🔄 Executing load more command:', loadMoreCommand);
    setInputValue(loadMoreCommand);
    
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !mounted) return;

    const messageId = `user-${Date.now()}`;
    const userMessage: Message = {
      id: messageId,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    addToRecent(inputValue);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: currentInput }),
      });

      const data = await response.json();

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        type: 'assistant',
        content: data.response || 'Sorry, I encountered an error.',
        timestamp: new Date(),
        success: data.success,
        helpRequest: data.helpRequest,
        totalCount: data.totalCount,
        successCount: data.successCount,
        failureCount: data.failureCount,
        isBulkOperation: data.successCount !== undefined || data.failureCount !== undefined,
        hasMore: data.hasMore,
        loadMoreCommand: data.loadMoreCommand,
        isCSVOperation: data.isCSVOperation,
        backgroundProcessing: data.backgroundProcessing
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
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

  // Enhanced message formatting with clickable links
  const formatMessage = (content: string) => {
    return content
      // Make URLs clickable
      .replace(
        /(https?:\/\/[^\s<>"]{2,200})/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1">$1 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>'
      )
      // Make email addresses clickable
      .replace(
        /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
        '<a href="mailto:$1" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
      )
      // Enhanced text formatting
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800 border">$1</code>')
      // Convert markdown-style links [text](url)
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1">$1 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>'
      )
      // Convert line breaks
      .replace(/\n/g, '<br />');
  };

  // Format timestamp to avoid hydration mismatch
  const formatTimestamp = (timestamp: Date) => {
    if (!mounted) return '';
    return timestamp.toLocaleTimeString();
  };

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-gray-600 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading Docebo AI Assistant...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Enhanced Sidebar Menu */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
        sidebarOpen ? 'w-80' : 'w-16'
      } flex flex-col shadow-sm`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Commands</h2>
                <p className="text-xs text-gray-500">Click to use examples • All features included</p>
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
                      className="w-full text-left text-xs bg-yellow-50 hover:bg-yellow-100 px-2 py-1 rounded text-yellow-700 truncate transition-colors"
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
                      className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded text-gray-700 truncate transition-colors"
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

        {/* Enhanced Accordion Menu */}
        <div className="flex-1 overflow-y-auto">
          {sidebarOpen ? (
            <div className="p-2">
              {menuCategories.map((category) => (
                <div key={category.id} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`${
                        category.id === 'csv' ? 'text-purple-600' :
                        category.id === 'ilt' ? 'text-indigo-600' :
                        category.id === 'bulk' ? 'text-blue-600' :
                        category.id === 'individual' ? 'text-green-600' :
                        category.id === 'search' ? 'text-orange-600' :
                        category.id === 'advanced' ? 'text-red-600' :
                        'text-gray-600'
                      } group-hover:scale-105 transition-transform`}>
                        {category.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 text-sm">{category.name}</div>
                        <div className="text-xs text-gray-500 leading-tight">{category.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                        {category.actions.length}
                      </span>
                      {category.isOpen ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>
                  
                  {category.isOpen && (
                    <div className="mt-2 ml-6 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {category.actions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
                          title={`${action.description}\n\nExample: ${action.example}`}
                        >
                          <div className="flex items-start space-x-2">
                            <div className="text-gray-400 group-hover:text-gray-600 mt-0.5 group-hover:scale-110 transition-all">
                              {action.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                {action.title}
                              </div>
                              <div className="text-xs text-gray-500 group-hover:text-gray-600 truncate">
                                {action.description}
                              </div>
                              {action.id.includes('template') && (
                                <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                  <Download className="w-3 h-3" />
                                  Click to download
                                </div>
                              )}
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
                  className="w-full p-3 rounded-lg hover:bg-gray-50 transition-colors flex justify-center relative group"
                  title={category.name}
                >
                  <div className={`${
                    category.id === 'csv' ? 'text-purple-600' :
                    category.id === 'ilt' ? 'text-indigo-600' :
                    category.id === 'bulk' ? 'text-blue-600' :
                    category.id === 'individual' ? 'text-green-600' :
                    category.id === 'search' ? 'text-orange-600' :
                    category.id === 'advanced' ? 'text-red-600' :
                    'text-gray-600'
                  } group-hover:scale-110 transition-transform`}>
                    {category.icon}
                  </div>
                  <span className="absolute -top-1 -right-1 bg-gray-200 text-gray-600 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {category.actions.length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Docebo AI Assistant v5.0</h1>
              <p className="text-sm text-gray-600">
                Enhanced with ILT Sessions • Validity Dates • Background Processing • Clickable Links
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 font-medium">Online</span>
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {messages.length} messages
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced CSV Upload Modal */}
        {showCSVUpload && (
          <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">CSV Bulk Operations</h3>
                <p className="text-sm text-gray-600">Now supports validity dates and enhanced templates</p>
              </div>
              <button
                onClick={() => setShowCSVUpload(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CSVUpload onProcessCSV={handleCSVUpload} isProcessing={isCSVProcessing} />
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Validity dates supported
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3 h-3" />
                Assignment types included
              </span>
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Enhanced templates available
              </span>
            </div>
          </div>
        )}

        {/* Enhanced Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-4xl px-4 py-3 rounded-lg shadow-sm ${
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
                      <span suppressHydrationWarning>{formatTimestamp(message.timestamp)}</span>
                      {message.success !== undefined && (
                        <span className={`flex items-center gap-1 ${message.success ? 'text-green-600' : 'text-red-600'}`}>
                          {message.success ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {message.success ? 'Success' : 'Error'}
                        </span>
                      )}
                      {message.isBulkOperation && (
                        <span className="text-purple-600 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Bulk: {message.successCount || 0}/{(message.successCount || 0) + (message.failureCount || 0)}
                        </span>
                      )}
                      {message.isCSVOperation && (
                        <span className="text-purple-600 flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3" />
                          CSV Operation
                        </span>
                      )}
                      {message.backgroundProcessing && (
                        <span className="text-indigo-600 flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          Background
                        </span>
                      )}
                      {message.totalCount && !message.isBulkOperation && (
                        <span className="text-blue-600 flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {message.totalCount} results
                        </span>
                      )}
                      {message.helpRequest && (
                        <span className="text-purple-600 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          Help
                        </span>
                      )}
                      {message.hasMore && (
                        <span className="text-orange-600 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3" />
                          More data available
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {message.loadMoreCommand && (
                        <button
                          onClick={() => handleLoadMore(message.loadMoreCommand!)}
                          disabled={isLoading}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full font-medium flex items-center gap-1"
                          title="Load more results"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          {isLoading ? 'Loading...' : 'Load More'}
                        </button>
                      )}
                      {(message.isBulkOperation || message.totalCount || message.isCSVOperation) && (
                        <button
                          onClick={() => exportResults(message)}
                          className="text-gray-400 hover:text-green-600 transition-colors p-1 hover:bg-green-50 rounded"
                          title="Export results to JSON"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
                        title="Copy message content"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Enhanced add to favorites for user messages */}
                {message.type === 'user' && !favoriteCommands.includes(message.content) && (
                  <div className="mt-2 pt-2 border-t border-blue-500">
                    <button
                      onClick={() => addToFavorites(message.content)}
                      className="text-blue-200 hover:text-white transition-colors text-xs flex items-center space-x-1 hover:bg-blue-500 px-2 py-1 rounded"
                      title="Add to favorites for quick access"
                    >
                      <Star className="w-3 h-3" />
                      <span>Add to favorites</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Enhanced loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">AI is processing your request...</span>
                  <div className="text-xs text-gray-400">
                    {isCSVProcessing ? 'Processing CSV data' : 'Analyzing command'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Enhanced Input with Suggestions */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          {showSuggestions && suggestions.length > 0 && (
            <div className="mb-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 text-sm text-gray-700 mb-2 font-medium">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Smart Suggestions:
              </div>
              <div className="grid grid-cols-1 gap-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestion(suggestion)}
                    className="text-left text-sm text-gray-700 hover:text-blue-600 hover:bg-white px-3 py-2 rounded transition-colors border border-transparent hover:border-blue-200 group"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex-1">{suggestion.text}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded ml-2 group-hover:bg-blue-100 group-hover:text-blue-600">
                        {suggestion.category}
                      </span>
                    </div>
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
                placeholder="Ask me about ILT sessions, CSV uploads, bulk enrollments, validity dates, individual users, courses, learning plans, or get help with Docebo..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
                disabled={isLoading}
              />
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  <strong>Enhanced Features:</strong> ILT Sessions • Validity Dates • Clickable Links
                </span>
                <span className="flex items-center gap-1">
                  <LinkIcon className="w-3 h-3 text-green-500" />
                  All URLs are automatically clickable
                </span>
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 shadow-sm"
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

        {/* Enhanced Footer */}
        <div className="bg-gray-100 px-6 py-3 text-center border-t">
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 flex-wrap gap-2">
            <span className="font-medium">Docebo AI Assistant v5.0</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              ILT Session Management
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Validity Dates Support
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <LinkIcon className="w-3 h-3" />
              Clickable Links
            </span>
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
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              CSV + Bulk + Individual + Background Processing
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
