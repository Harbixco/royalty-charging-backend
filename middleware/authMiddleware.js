import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from './asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Authentication token missing. Please log in.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'royalty_charging_jwt_secret_key_987654321');
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin && decoded.username) {
      // Fallback for env-based admin session
      req.admin = { id: decoded.id, username: decoded.username, role: 'admin', name: decoded.name || 'Admin' };
      return next();
    }

    if (!admin) {
      throw new ApiError(401, 'User account no longer exists.');
    }

    req.admin = admin;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired session. Please log in again.');
  }
});
