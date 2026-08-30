import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import chargingRoutes from './routes/chargingRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// CLIENT_ORIGIN may be a comma-separated list for multiple environments
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Royalty Charging API is running' });
});

// Public Authentication Route
app.use('/api/auth', authRoutes);

// Protected Admin API Routes (Token required)
app.use('/api/charging', protect, chargingRoutes);
app.use('/api/pricing', protect, pricingRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
