export default function middleware(req: Request) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const auth = authHeader.split(' ')[1];
    const [user, pwd] = atob(auth).split(':');

    // 🔑 Set your credentials here
    if (user === 'admin' && pwd === 'bodyshop360') {
      return new Response(null, {
        status: 200,
        headers: { 'x-middleware-next': '1' },
      });
    }
  }

  return new Response('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: '/:path*',
};