// lib/advanced-gemini.ts
export async function processComplexQuery(query: string, context?: any) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-pro', // For complex reasoning
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.8,
      maxOutputTokens: 2048,
    },
  });

  const enhancedPrompt = `
Context: ${context ? JSON.stringify(context) : 'No additional context'}

You are an expert Docebo administrator assistant. Analyze this complex query and provide:
1. Intent classification
2. Required data gathering steps
3. Potential automation actions
4. Risk assessment
5. Recommended approach

Query: "${query}"

Provide detailed analysis in JSON format.
`;

  const result = await model.generateContent(enhancedPrompt);
  return result.response.text();
}
