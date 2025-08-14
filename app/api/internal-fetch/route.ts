import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    // This is where you'd call Claude's actual web_fetch tool
    // const content = await web_fetch(url);
    
    // For now, return empty content until web_fetch is available
    return NextResponse.json({
      content: '',
      message: 'Web fetch tool not yet integrated'
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
