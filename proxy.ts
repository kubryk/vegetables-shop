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

    url.pathname = '/api/auth';

    return new NextResponse('Auth Required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Dashboard"',
        },
    });
}
