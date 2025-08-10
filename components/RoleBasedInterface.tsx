// components/RoleBasedInterface.tsx
export function RoleBasedInterface({ userRole, permissions }: RoleBasedProps) {
  const getQuickActions = () => {
    switch (userRole) {
      case DoceboRole.SUPERADMIN:
        return [
          "Check user john@company.com status",
          "Find course 'Python Advanced' and show status", 
          "Enroll Marketing group in course ID 101",
          "Show completion stats for learning plan 'Leadership'",
          "Create notification for course 'Safety Training'"
        ];
        
      case DoceboRole.POWER_USER:
        return [
          "Search course 'Excel Training'",
          "Check if learning plan ID 25 is published",
          "Enroll user sarah@company.com in Python course",
          "Show course outline for 'Data Analysis'"
        ];
        
      case DoceboRole.USER_MANAGER:
        return [
          "Show completion stats for my managed users",
          "Get learning plan statistics for Q4",
          "Generate completion report for 'Compliance Training'"
        ];
        
      default:
        return ["Contact your administrator for access"];
    }
  };
  
  return (
    <div className="role-specific-interface">
      <div className="role-badge">
        Role: {userRole} | Permissions: {permissions.length}
      </div>
      <QuickActions actions={getQuickActions()} />
      <ChatInterface userRole={userRole} />
    </div>
  );
}
