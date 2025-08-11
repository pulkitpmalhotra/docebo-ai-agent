                  import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Zap, Users, BookOpen, BarChart3, Settings, ChevronRight, Sparkles, Clock, CheckCircle, AlertCircle, Lightbulb, Search, Filter, Star } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  intent?: string;
  userRole?: string;
  actionable?: boolean;
}

interface ScenarioStep {
  id: string;
  title: string;
  description: string;
  inputs: Array<{
    name: string;
    type: 'text' | 'select' | 'email';
    placeholder?: string;
    options?: string[];
    required?: boolean;
  }>;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  steps: ScenarioStep[];
  requiredRole: string[];
}

const scenarios: Scenario[] = [
  {
    id: 'user_lookup',
    title: 'Find User Information',
    description: 'Look up user details, status, and enrollment history',
    icon: <Search className="w-5 h-5" />,
    category: 'User Management',
    requiredRole: ['superadmin', 'power_user'],
    steps: [
      {
        id: 'search_criteria',
        title: 'Search Criteria',
        description: 'How would you like to find the user?',
        inputs: [
          {
            name: 'searchType',
            type: 'select',
            options: ['Email Address', 'Full Name', 'User ID'],
            required: true
          },
          {
            name: 'searchValue',
            type: 'text',
            placeholder: 'Enter email, name, or ID...',
            required: true
          }
        ]
      }
    ]
  },
  {
    id: 'course_enrollment',
    title: 'Enroll User in Course',
    description: 'Add a user to a specific training course',
    icon: <BookOpen className="w-5 h-5" />,
    category: 'Training Management',
    requiredRole: ['superadmin', 'power_user'],
    steps: [
      {
        id: 'user_selection',
        title: 'Select User',
        description: 'Who do you want to enroll?',
        inputs: [
          {
            name: 'userEmail',
            type: 'email',
            placeholder: 'user@company.com',
            required: true
          }
        ]
      },
      {
        id: 'course_selection',
        title: 'Select Course',
        description: 'Which course should they be enrolled in?',
        inputs: [
          {
            name: 'courseName',
            type: 'text',
            placeholder: 'Search course name...',
            required: true
          },
          {
            name: 'enrollmentType',
            type: 'select',
            options: ['Immediate', 'Scheduled'],
            required: true
          }
        ]
      }
    ]
  },
  {
    id: 'analytics_report',
    title: 'Generate Analytics Report',
    description: 'Create detailed training and performance reports',
    icon: <BarChart3 className="w-5 h-5" />,
    category: 'Analytics',
    requiredRole: ['superadmin', 'user_manager'],
    steps: [
      {
        id: 'report_type',
        title: 'Report Type',
        description: 'What kind of report do you need?',
        inputs: [
          {
            name: 'reportType',
            type: 'select',
            options: ['User Completion Stats', 'Course Performance', 'Department Overview', 'System Usage'],
            required: true
          },
          {
            name: 'timeframe',
            type: 'select',
            options: ['Last 7 days', 'Last 30 days', 'Last quarter', 'Custom range'],
            required: true
          }
        ]
      }
    ]
  }
];

const roleConfigs = {
  superadmin: {
    name: 'Super Administrator',
    icon: <Settings className="w-6 h-6" />,
    color: 'from-purple-500 to-pink-500',
    quickActions: [
      'Check user john@company.com status',
      'Find course "Python Advanced"',
      'Show system analytics overview',
      'Generate quarterly report',
      'List inactive users',
      'Show enrollment statistics'
    ]
  },
  power_user: {
    name: 'Power User',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-blue-500 to-cyan-500',
    quickActions: [
      'Search course "Excel Training"',
      'Enroll sarah@company.com in Safety Training',
      'Check course completion rates',
      'Find users in Engineering department',
      'Show my managed courses'
    ]
  },
  user_manager: {
    name: 'User Manager',
    icon: <Users className="w-6 h-6" />,
    color: 'from-green-500 to-emerald-500',
    quickActions: [
      'Show my team completion stats',
      'Generate team progress report',
      'Check team member status',
      'View department analytics'
    ]
  }
};

export default function EnhancedDoceboAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<keyof typeof roleConfigs>('superadmin');
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [scenarioStep, setScenarioStep] = useState(0);
  const [scenarioData, setScenarioData] = useState<Record<string, any>>({});
  const [showScenarios, setShowScenarios] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const roleConfig = roleConfigs[userRole];
  const availableScenarios = scenarios.filter(s => s.requiredRole.includes(userRole));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      content: getWelcomeMessage(userRole),
      type: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, [userRole]);

  function getWelcomeMessage(role: keyof typeof roleConfigs) {
    const config = roleConfigs[role];
    return `👋 **Welcome back, ${config.name}!**

I'm your AI assistant for Docebo LMS management. I can help you with:

🔍 **User Management** - Search, view status, manage accounts
📚 **Course Administration** - Find courses, manage content, track progress  
✅ **Enrollment Management** - Enroll users, manage assignments
📊 **Analytics & Reporting** - Generate insights, track performance
⚙️ **System Operations** - Monitor health, manage settings

**Quick tip:** Use the scenario builder below for guided workflows, or try one of the suggested prompts!`;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement> | React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput,
          userRole: userRole,
          userId: 'demo-user'
        }),
      });

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Sorry, no response received.',
        type: 'assistant',
        timestamp: new Date(),
        intent: data.intent,
        userRole: data.userRole,
        actionable: data.intent && ['user_status_check', 'course_search', 'statistics_request'].includes(data.intent)
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Error: Could not process your request. Please try again.',
        type: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setShowSuggestions(false);
  };

  const handleScenarioSelect = (scenario: Scenario) => {
    setActiveScenario(scenario);
    setScenarioStep(0);
    setScenarioData({});
    setShowScenarios(false);
  };

  const handleScenarioNext = () => {
    if (activeScenario && scenarioStep < activeScenario.steps.length - 1) {
      setScenarioStep(prev => prev + 1);
    } else {
      // Complete scenario
      executeScenario();
    }
  };

  const executeScenario = () => {
    if (!activeScenario) return;
    
    // Generate natural language query from scenario data
    let query = '';
    
    switch (activeScenario.id) {
      case 'user_lookup':
        query = `Check user ${scenarioData.searchValue} status`;
        break;
      case 'course_enrollment':
        query = `Enroll ${scenarioData.userEmail} in ${scenarioData.courseName}`;
        break;
      case 'analytics_report':
        query = `Show ${scenarioData.reportType} for ${scenarioData.timeframe}`;
        break;
    }
    
    setInput(query);
    setActiveScenario(null);
    setScenarioStep(0);
    setScenarioData({});
  };

  const handleRoleChange = (newRole: keyof typeof roleConfigs) => {
    setUserRole(newRole);
    setActiveScenario(null);
    setShowScenarios(false);
    setShowSuggestions(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Docebo AI Assistant</h1>
              <p className="text-slate-600">Intelligent LMS management powered by AI</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500">Version 2.0</div>
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Role Selector */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Select Your Role</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    
                {showSuggestions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roleConfig.quickActions.slice(0, 3).map((action, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickAction(action)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm hover:bg-slate-200 transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
                    <span className="font-medium text-slate-800">{config.name}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {role === 'superadmin' && 'Full system access and administration'}
                    {role === 'power_user' && 'Course and user management capabilities'}
                    {role === 'user_manager' && 'Team analytics and reporting access'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* Scenario Builder */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-800">Guided Workflows</h3>
              </div>
              <button
                onClick={() => setShowScenarios(!showScenarios)}
                className="w-full p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Start Workflow
              </button>
              
              {showScenarios && (
                <div className="mt-4 space-y-2">
                  {availableScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => handleScenarioSelect(scenario)}
                      className="w-full p-3 text-left border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {scenario.icon}
                        <span className="font-medium text-sm">{scenario.title}</span>
                      </div>
                      <p className="text-xs text-slate-600">{scenario.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {showSuggestions && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-slate-800">Quick Actions</h3>
                </div>
                <div className="space-y-2">
                  {roleConfig.quickActions.slice(0, 4).map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action)}
                      className="w-full p-2 text-left text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Role Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                {roleConfig.icon}
                <h3 className="font-semibold text-slate-800">Current Role</h3>
              </div>
              <div className={`p-3 rounded-lg bg-gradient-to-r ${roleConfig.color} text-white`}>
                <div className="font-medium">{roleConfig.name}</div>
                <div className="text-sm opacity-90 mt-1">
                  Access Level: {userRole === 'superadmin' ? 'Full' : userRole === 'power_user' ? 'Advanced' : 'Standard'}
                </div>
              </div>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Scenario Modal */}
              {activeScenario && (
                <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {activeScenario.icon}
                      <div>
                        <h3 className="font-semibold text-slate-800">{activeScenario.title}</h3>
                        <p className="text-sm text-slate-600">{activeScenario.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveScenario(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-2 mb-4">
                    {activeScenario.steps.map((_, index) => (
                      <div
                        key={index}
                        className={`h-2 flex-1 rounded-full ${
                          index <= scenarioStep ? 'bg-blue-500' : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Current Step */}
                  {activeScenario.steps[scenarioStep] && (
                    <div>
                      <h4 className="font-medium text-slate-800 mb-2">
                        {activeScenario.steps[scenarioStep].title}
                      </h4>
                      <p className="text-sm text-slate-600 mb-4">
                        {activeScenario.steps[scenarioStep].description}
                      </p>
                      
                      <div className="space-y-3">
                        {activeScenario.steps[scenarioStep].inputs.map((input) => (
                          <div key={input.name}>
                            {input.type === 'select' ? (
                              <select
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onChange={(e) => setScenarioData(prev => ({ ...prev, [input.name]: e.target.value }))}
                              >
                                <option value="">Select {input.name}...</option>
                                {input.options?.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={input.type}
                                placeholder={input.placeholder}
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onChange={(e) => setScenarioData(prev => ({ ...prev, [input.name]: e.target.value }))}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end mt-4">
                        <button
                          onClick={handleScenarioNext}
                          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                          {scenarioStep < activeScenario.steps.length - 1 ? 'Next' : 'Execute'}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
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
                        
                        {message.actionable && (
                          <div className="mt-3 flex gap-2">
                            <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs hover:bg-blue-200 transition-colors">
                              View Details
                            </button>
                            <button className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs hover:bg-green-200 transition-colors">
                              Take Action
                            </button>
                          </div>
                        )}
                      </div>
                      
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
                    onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                    placeholder={`Ask me anything as ${roleConfig.name}...`}
                    className="flex-1 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                  <button
                    onClick={(e) => handleSubmit(e)}
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
                
                {showSuggestions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roleConfig.quickActions.slice(0, 3).map((action, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm hover:bg-slate-200 transition-colors"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
