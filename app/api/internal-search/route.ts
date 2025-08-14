import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    
    // This is where you'd call Claude's actual web_search tool
    // const results = await web_search(query);
    
    // For now, return empty results until web_search is available
    return NextResponse.json({
      results: [],
      message: 'Web search tool not yet integrated'
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
