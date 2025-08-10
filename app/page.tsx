'use client';

import { useState } from 'react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  intent?: string;
  userRole?: string;
}

export default function DoceboAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState('superadmin');

  // Initialize with role-specific welcome message
  useState(() => {
    const welcomeMessage = {
      id: '1',
      content: getWelcomeMessage(userRole),
      type: 'assistant' as const,
    };
    setMessages([welcomeMessage]);
  });

  function getWelcomeMessage(role: string) {
    switch (role) {
      case 'superadmin':
        return `👑 **Welcome, Super Administrator!**

You have full access to:
- 🔍 User account status checking
- 📚 Course and learning plan management  
- ✅ User and group enrollments
- 📊 Complete analytics and reporting
- ⚙️ System settings and notifications
- 🎯 All administrative functions

Try: "Check user john@company.com status" or "Find course Python Advanced"`;

      case 'power_user':
        return `⚡ **Welcome, Power User!**

You can:
- 🔍 Search courses and learning plans
- ✅ Enroll users in training
- 📊 View analytics for managed content
- ⚙️ Modify course settings

Try: "Search course Excel Training" or "Enroll sarah@company.com in Python course"`;

      case 'user_manager':
        return `👥 **Welcome, User Manager!**

You can:
- 📊 View statistics for your managed users
- 📈 Generate completion reports
- 👀 Monitor team progress

Try: "Show completion stats for my team" or "Generate Q4 training report"`;

      default:
        return `👋 **Welcome to Docebo AI Assistant!**

Please contact your administrator for appropriate access permissions.`;
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setLoading(true);

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
        intent: data.intent,
        userRole: data.userRole
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Error: Could not process your request.',
        type: 'assistant',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRole: string) => {
    setUserRole(newRole);
    setMessages([{
      id: '1',
      content: getWelcomeMessage(newRole),
      type: 'assistant',
    }]);
  };

  const getRoleQuickActions = () => {
    switch (userRole) {
      case 'superadmin':
        return [
          "Check user john@company.com status",
          "Find course 'Python Advanced'",
          "Show completion stats for course ID 101",
          "Enroll Marketing group in Safety Training"
        ];
      case 'power_user':
        return [
          "Search course 'Excel Training'",
          "Enroll sarah@company.com in Python course",
          "Check if course ID 25 is published"
        ];
      case 'user_manager':
        return [
          "Show completion stats for my team",
          "Generate Q4 training report"
        ];
      default:
        return [];
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Role Selector */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h2>Select Your Role:</h2>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          {['superadmin', 'power_user', 'user_manager'].map(role => (
            <button
              key={role}
              onClick={() => handleRoleChange(role)}
              style={{
                padding: '8px 16px',
                backgroundColor: userRole === role ? '#007bff' : '#e9ecef',
                color: userRole === role ? 'white' : 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {role.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Current Role: <strong>{userRole.replace('_', ' ').toUpperCase()}</strong>
        </div>
      </div>

      <h1>Docebo AI Assistant - Enhanced</h1>
      <p>Role-based LMS administration with advanced capabilities</p>
      
      {/* Chat Interface */}
      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        height: '400px', 
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Messages */}
        <div style={{ 
          flex: 1, 
          padding: '10px', 
          overflowY: 'auto',
          backgroundColor: '#f9f9f9'
        }}>
          {messages.map((message) => (
            <div 
              key={message.id}
              style={{
                marginBottom: '10px',
                padding: '10px',
                borderRadius: '6px',
                backgroundColor: message.type === 'user' ? '#007bff' : '#e9ecef',
                color: message.type === 'user' ? 'white' : 'black',
                marginLeft: message.type === 'user' ? '50px' : '0',
                marginRight: message.type === 'user' ? '0' : '50px',
              }}
            >
              <strong>{message.type === 'user' ? 'You' : 'AI Assistant'}:</strong>
              {message.intent && (
                <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '10px' }}>
                  [{message.intent}]
                </span>
              )}
              <div style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>
            </div>
          ))}
          
          {loading && (
            <div style={{ padding: '10px', fontStyle: 'italic', color: '#666' }}>
              AI is processing your request...
            </div>
          )}
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ padding: '10px', borderTop: '1px solid #ccc' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask me anything (as ${userRole.replace('_', ' ')})...`}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Role-Specific Quick Actions */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Quick Actions for {userRole.replace('_', ' ').toUpperCase()}:</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {getRoleQuickActions().map((action, index) => (
            <button 
              key={index}
              onClick={() => setInput(action)}
              style={{ 
                padding: '8px 12px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
        Enhanced Docebo AI Assistant • Role-Based Access Control • Powered by Gemini AI
      </div>
    </div>
  );
}
