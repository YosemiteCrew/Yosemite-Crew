import jwt  from 'jsonwebtoken';

interface RequestWithAuthHeader {
  headers: {
    authorization?: string;
    [key: string]: unknown;
  };
}

function getCognitoUserId(req: RequestWithAuthHeader) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('Missing authorization header');
  const token = authHeader.split(' ')[1];
  if (!token) throw new Error('Missing token');
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { username: string };
  return decoded.username;
}

export  { getCognitoUserId };