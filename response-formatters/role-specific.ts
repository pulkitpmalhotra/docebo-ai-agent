// lib/response-formatters/role-specific.ts
export class RoleSpecificFormatter {
  
  formatResponse(data: any, intent: string, userRole: DoceboRole) {
    switch (userRole) {
      case DoceboRole.SUPERADMIN:
        return this.formatSuperAdminResponse(data, intent);
        
      case DoceboRole.USER_MANAGER:
        return this.formatManagerResponse(data, intent);
        
      default:
        return this.formatBasicResponse(data, intent);
    }
  }
  
  private formatSuperAdminResponse(data: any, intent: string) {
    // Include technical details, IDs, full access info
    return {
      summary: data.summary,
      technicalDetails: data.raw,
      possibleActions: this.getSuperAdminActions(data),
      directLinks: this.generateAdminLinks(data)
    };
  }
  
  private formatManagerResponse(data: any, intent: string) {
    // Focus on user management and reporting
    return {
      summary: data.summary,
      managedUsersOnly: this.filterManagedUsers(data),
      reportOptions: this.getReportOptions(data)
    };
  }
}
