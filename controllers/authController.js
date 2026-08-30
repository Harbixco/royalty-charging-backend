import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';

const generateToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'royalty_charging_jwt_secret_key_987654321',
    { expiresIn: '7d' }
  );
};

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim()) {
    throw new ApiError(400, 'Username is required');
  }
  if (!password) {
    throw new ApiError(400, 'Password is required');
  }

  const cleanUsername = username.trim().toLowerCase();
  const envUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD || 'admin123';

  let admin = await Admin.findOne({ username: cleanUsername });

  // If no admin exists in DB yet, seed from .env if matching
  if (!admin) {
    if (cleanUsername === envUsername && password === envPassword) {
      admin = await Admin.create({
        username: envUsername,
        password: envPassword,
        name: 'System Admin',
        role: 'admin',
      });
    } else {
      throw new ApiError(401, 'Invalid username or password');
    }
  } else {
    const isMatch = await admin.comparePassword(password);
    // Also allow env password fallback if admin changed password in .env
    const isEnvMatch = cleanUsername === envUsername && password === envPassword;

    if (!isMatch && !isEnvMatch) {
      throw new ApiError(401, 'Invalid username or password');
    }

    // If env password was used and differed from DB hash, update DB hash
    if (!isMatch && isEnvMatch) {
      admin.password = envPassword;
      await admin.save();
    }
  }

  const token = generateToken({
    id: admin._id,
    username: admin.username,
    role: admin.role,
    name: admin.name,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: admin._id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
        },
        token,
      },
      'Logged in successfully'
    )
  );
});

// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: req.admin,
      },
      'Current user profile retrieved'
    )
  );
});
