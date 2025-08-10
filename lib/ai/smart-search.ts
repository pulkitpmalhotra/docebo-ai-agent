// lib/ai/smart-search.ts
export class SmartSearch {
  
  async findWithSuggestions(query: string, type: 'course' | 'learning_plan' | 'user' | 'group') {
    // Try exact match first
    const exactMatch = await this.findExact(query, type);
    if (exactMatch.found) return exactMatch;
    
    // Try fuzzy matching
    const suggestions = await this.findSimilar(query, type);
    
    if (suggestions.length > 0) {
      return {
        found: false,
        suggestions: suggestions,
        message: `No exact match found for "${query}". Did you mean one of these?`,
        suggestedActions: suggestions.map(s => `Use ID: ${s.id} or exact name: "${s.name}"`)
      };
    }
    
    return {
      found: false,
      message: `No matches found for "${query}". Please provide the exact ID or title name.`,
      hint: `Try searching with ${type} ID (numeric) or exact title name.`
    };
  }
}
