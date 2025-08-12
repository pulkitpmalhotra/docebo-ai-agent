'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, UserPlus, Search, BookOpen, Users, CheckCircle, AlertCircle, Zap } from 'lucide-react';

// Properly typed interfaces
interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  success?: boolean;
  action?: string;
  missing_fields?: string[];
  examples?: string[];
  available_actions?: Array<{
    name: string;
    description: string;
    examples: string[];
  }>;
  error?: string;
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ReactNode;
  example: string;
  description: string;
  requiredFields: string[];
}

// Quick Actions for Phase 1 MVP
const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'enroll_user',
    title: 'Enroll User',
    icon: <UserPlus className="w-5 h-5" />,
