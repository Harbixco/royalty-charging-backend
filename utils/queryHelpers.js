/**
 * Builds a Mongoose filter object for the charging-records list
 * endpoint from validated query params.
 */
export const buildChargingFilter = (query) => {
  const filter = {};

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ customerName: regex }, { tagNumber: regex }];
  }

  if (query.tagNumber) {
    filter.tagNumber = new RegExp(`^${query.tagNumber.trim()}$`, 'i');
  }

  if (query.gadgetType) {
    filter.gadgetType = query.gadgetType;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.paymentStatus) {
    filter.paymentStatus = query.paymentStatus;
  }

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  return filter;
};

export const getPagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};
