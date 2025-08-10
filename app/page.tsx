'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Shield, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  intent?: string;
  entities?: any;
}

export default function DoceboAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `👋 **Welcome to your Docebo AI Assistant!**

I can help you with:
- **🔍 Search Users & Courses** - "Find users named John" or "Show me Python courses"
- **📊 View Enrollments** - "What are john@company.com's enrollments?"
- **✅ Enroll Users** - "Enroll sarah@company.com in Excel training" 
- **📈 Get Statistics** - "Show me enrollment statistics"
- **❓ Get Help** - "Help me understand learning paths"

**Currently running in demo mode with sample data. Ready to assist you!**

What would you like to do?`,
      type: 'assistant',
      timestamp: new Date(),
    },
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userM
