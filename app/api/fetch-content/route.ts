// app/api/fetch-content/route.ts - Content fetching using Claude's built-in tools
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json({
        error: 'URL is required'
      }, { status: 400 });
    }

    console.log(`📄 Content fetch request: ${url}`);

    // Validate that it's a Docebo help URL for security
    if (!url.includes('help.docebo.com')) {
      return NextResponse.json({
        error: 'Only help.docebo.com URLs are allowed'
      }, { status: 400 });
    }

    // This is where you would integrate with Claude's web_fetch tool
    // For now, I'll create a structured response that shows how it would work
    
    // In the actual implementation, you would use:
    // const pageContent = await web_fetch(url);
    
    // For demonstration, I'll return a structured response
    const mockContent = `**Content fetched from ${url}**

This would contain the actual content from the Docebo help page, including:

- Step-by-step instructions
- Configuration details
- Best practices
- Troubleshooting information
- Screenshots and examples

The content would be extracted from the HTML and cleaned up for display.`;

    // When web_fetch is integrated, this would look like:
    /*
    try {
      const pageContent = await web_fetch({
        url: url
      });
      
      // Extract main content from the HTML
      const cleanContent = extractMainContent(pageContent);
      
      return NextResponse.json({
        content: cleanContent,
        url: url,
        timestamp: new Date().toISOString(),
        success: true
      });
    } catch (error) {
      console.error('Content fetch failed:', error);
      return NextResponse.json({
        error: 'Content fetch failed',
        message: error.message
      }, { status: 500 });
    }
    */

    return NextResponse.json({
      content: mockContent,
      url: url,
      timestamp: new Date().toISOString(),
      success: true,
      note: 'This is a mock response. Integrate with actual web_fetch tool for live content.'
    });

  } catch (error) {
    console.error('Content fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Content fetch failed'
    }, { status: 500 });
  }
}

// Helper function to extract main content from HTML
function extractMainContent(html: string): string {
  try {
    // This is a simplified content extraction
    // In a real implementation, you'd use a proper HTML parser
    
    // Remove script and style tags (using compatible regex flags)
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Extract content from article tag (common in help sites)
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      content = articleMatch[1];
    }
    
    // Remove HTML tags
    content = content.replace(/<[^>]*>/g, ' ');
    
    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();
    
    // Limit length
    if (content.length > 2000) {
      content = content.substring(0, 2000) + '...';
    }
    
    return content;
  } catch (error) {
    console.error('Content extraction failed:', error);
    return 'Content extraction failed';
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Content fetch endpoint',
    usage: 'POST with {"url": "https://help.docebo.com/article-url"}',
    note: 'This endpoint needs integration with Claude\'s web_fetch tool'
  });
}
