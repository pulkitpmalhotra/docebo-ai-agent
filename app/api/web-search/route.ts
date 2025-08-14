// app/api/web-search/route.ts - Web search wrapper using built-in tools
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    
    if (!query) {
      return NextResponse.json({
        error: 'Query is required'
      }, { status: 400 });
    }

    console.log(`🔍 Web search request: "${query}"`);

    // For now, return a structured response that the chat endpoint can handle
    // In a real implementation, this would use web_search tools
    const mockResults = [
      {
        title: `Search Results for "${query}"`,
        url: `https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,
        snippet: `Please visit the Docebo help center to search for "${query}".`,
        description: `Search results for "${query}" on help.docebo.com`
      }
    ];

    return NextResponse.json({
      results: mockResults,
      query: query,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Web search error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Web search endpoint',
    usage: 'POST with {"query": "search terms"}'
  });
}
