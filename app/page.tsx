// Update for app/page.tsx - Add learning plan info quick action

// Add this to the quickActions array in the component:
const quickActions: QuickAction[] = [
  {
    id: 'find_user',
    title: 'Find User',
    icon: <User className="w-5 h-5" />,
    example: 'Find user mike@company.com',
    description: 'Look up user details and information'
  },
  {
    id: 'find_course', 
    title: 'Find Course',
    icon: <BookOpen className="w-5 h-5" />,
    example: 'Find Python courses',
    description: 'Search for courses by name or keyword'
  },
  {
    id: 'find_learning_plan',
    title: 'Find Learning Plans',
    icon: <Users className="w-5 h-5" />,
    example: 'Find Python learning plans',
    description: 'Search for learning paths and programs'
  },
  {
    id: 'learning_plan_info',
    title: 'Learning Plan Info',
    icon: <CheckCircle className="w-5 h-5" />,
    example: 'Learning plan info Associate Memory Network',
    description: 'Get detailed information about a learning plan'
  },
  {
    id: 'find_session',
    title: 'Find Sessions',
    icon: <Search className="w-5 h-5" />,
    example: 'Find Python sessions',
    description: 'Look up training sessions and workshops'
  },
  {
    id: 'find_material',
    title: 'Find Materials',
    icon: <AlertCircle className="w-5 h-5" />,
    example: 'Find Python training materials',
    description: 'Search for training resources and documents'
  },
  {
    id: 'docebo_help',
    title: 'Docebo Help',
    icon: <Zap className="w-5 h-5" />,
    example: 'How to enroll users in Docebo',
    description: 'Get help with Docebo functionality'
  }
];

// Also update the examples at the bottom:
<div className="mt-3 text-xs text-gray-500">
  <strong>Examples: </strong>
  "Find user mike@company.com" • "Find Python courses" • "Find Python learning plans" • "Learning plan info Associate Memory Network" • "How to enroll users"
</div>
