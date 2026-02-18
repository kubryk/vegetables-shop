import { NextRequest, NextResponse } from 'next/server';

export const config = {
    matcher: ['/466ed1254c89ccf77b8dab3da30f8692/:path*'],
};

export default function proxy(req: NextRequest) {
    const basicAuth = req.headers.get('authorization');
    const url = req.nextUrl;

    if (basicAuth) {
        const authValue = basicAuth.split(' ')[1];
        const [user, pwd] = atob(authValue).split(':');

        if (
            user === process.env.DASHBOARD_USER &&
            pwd === process.env.DASHBOARD_PASSWORD
        ) {
            return NextResponse.next();
        }
    }

    // Rewrite to the auth API route to handle the 401 response
    // Middleware/Proxy in Next.js 16 cannot return a response body directly
    url.pathname = '/api/auth';
    return NextResponse.rewrite(url);
}
