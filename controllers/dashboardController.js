import ChargingRecord from '../models/ChargingRecord.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../middleware/asyncHandler.js';
import { getTodayRange } from '../utils/queryHelpers.js';

// GET /api/dashboard/stats
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { start, end } = getTodayRange();

  const [
    totalRecords,
    revenueAgg,
    activeCharging,
    completedRecords,
    todayRecords,
    todayRevenueAgg,
    recentActive,
  ] = await Promise.all([
    ChargingRecord.countDocuments(),
    ChargingRecord.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    ChargingRecord.countDocuments({ status: { $in: ['Pending', 'Charging'] } }),
    ChargingRecord.countDocuments({ status: 'Completed' }),
    ChargingRecord.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ChargingRecord.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    ChargingRecord.find({ status: { $in: ['Pending', 'Charging'] } })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const stats = {
    totalRecords,
    totalRevenue: revenueAgg[0]?.total || 0,
    activeCharging,
    completedRecords,
    todayRecords,
    todayRevenue: todayRevenueAgg[0]?.total || 0,
    recentActive,
  };

  res.status(200).json(new ApiResponse(200, stats, 'Dashboard stats retrieved'));
});
