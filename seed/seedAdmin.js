import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Admin from '../models/Admin.js';

const seed = async () => {
  await connectDB();

  const rawUsername = process.env.ADMIN_USERNAME || 'ROYALTYPOWERBANK';
  const username = rawUsername.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Royalty@0903921';

  console.log(`Seeding admin user "${rawUsername}" into MongoDB...`);

  await Admin.deleteMany({});

  const admin = await Admin.create({
    username,
    password,
    name: 'ROYALTY POWERBANK Admin',
    role: 'admin',
  });

  console.log(`Admin user successfully created in MongoDB with ID: ${admin._id}`);
  console.log(`Username: ${rawUsername}`);
  console.log(`Password: ${password}`);

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Failed to seed admin:', err);
  process.exit(1);
});
