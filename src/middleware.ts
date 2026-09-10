import { NextRequest, NextResponse } from 'next/server';

// CORS Middleware with complete header permissions including Localtunnel bypass headers
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS for API & JB Activity routes
  if (pathname.startsWith('/api/') || pathname.startsWith('/jb-activity/')) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, bypass-tunnel-reminder, Bypass-Tunnel-Reminder, x-workspace-key, X-Workspace-Key, *',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, val]) => {
      response.headers.set(key, val);
    });
    return response;
  }

  // Redirect legacy auth routes to dashboard
  if (pathname === '/login' || pathname === '/signup') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
