import { next } from '@vercel/edge';

export default function middleware(req: Request) {
  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    const auth = authHeader.split(' ')[1];
    const [user, pwd] = atob(auth).split(':');

    // 🔑 Set your desired credentials here
    if (user === 'admin' && pwd === 'Workbench1!') {
      return next();
    }
  }

  return new Response('Authentication Required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  });
}