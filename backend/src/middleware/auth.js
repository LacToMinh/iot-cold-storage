import jwt from 'jsonwebtoken';

export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'super_secret_iot_cold_storage_jwt_token_2026';

    jwt.verify(token, secret, (err, user) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn.' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, message: 'Yêu cầu mã xác thực Token (Authorization Bearer)!' });
  }
};
