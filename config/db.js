import mongoose from 'mongoose';
import Admin from '../models/Admin.js';

export const ensureAdminUser = async () => {
  try {
    const rawUsername = process.env.ADMIN_USERNAME || 'ROYALTYPOWERBANK';
    const envUsername = rawUsername.trim().toLowerCase();
    const envPassword = process.env.ADMIN_PASSWORD || 'Royalty@0903921';

    let admin = await Admin.findOne({ username: envUsername });
    if (!admin) {
      // Remove any old/stale admin accounts
      await Admin.deleteMany({});
      admin = await Admin.create({
        username: envUsername,
        password: envPassword,
        name: 'ROYALTY POWERBANK Admin',
        role: 'admin',
      });
      console.log(`Admin user "${rawUsername}" seeded in MongoDB successfully.`);
    } else {
      const isMatch = await admin.comparePassword(envPassword);
      if (!isMatch) {
        admin.password = envPassword;
        await admin.save();
        console.log(`Admin user "${rawUsername}" password updated in MongoDB.`);
      }
    }
  } catch (err) {
    console.error('Failed to initialize admin user:', err.message);
  }
};

/**
 * Connects to MongoDB using the URI supplied via environment variables.
 * The process exits if the connection cannot be established, since the
 * API is useless without a database.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('MONGODB_URI is not defined. Please set it in your .env file.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    await ensureAdminUser();
  } catch (error) {
    console.error(`Failed to connect to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
