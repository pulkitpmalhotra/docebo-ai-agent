// Create this as app/api/test-user/route.ts to debug the API directly:

import { NextRequest, NextResponse } from 'next/server';
import { DoceboAPI } from '../chat/docebo-api';
import { getConfig } from '../chat/utils/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'pulkitpmalhotra@gmail.com';
    
    console.log(`🧪 Testing user lookup for: ${email}`);
    
    const config = getConfig();
    const api = new DoceboAPI(config);
    
    // Test direct API call
    const users = await api.searchUsers(email, 10);
    console.log(`📊 Search users returned:`, users);
    
    // Test direct user details
    try {
      const userDetails = await api.getUserDetails(email);
      console.log(`👤 User details:`, userDetails);
      
      return NextResponse.json({
        success: true,
        email: email,
        searchResults: users,
        userDetails: userDetails,
        timestamp: new Date().toISOString()
      });
    } catch (userError) {
      console.error(`❌ getUserDetails failed:`, userError);
      
      return NextResponse.json({
        success: false,
        email: email,
        searchResults: users,
        error: userError instanceof Error ? userError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
