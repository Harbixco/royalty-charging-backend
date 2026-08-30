import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import PricingConfig from '../models/PricingConfig.js';
import ChargingRecord from '../models/ChargingRecord.js';
import { DEFAULT_PRICING } from '../utils/defaultPricing.js';

const SAMPLE_CUSTOMERS = [
  { customerName: 'Chinedu Okafor', tagNumber: 'ROY-001', pricingKey: 'PHONE_WITH_CHARGER', status: 'Charging' },
  { customerName: 'Aisha Bello', tagNumber: 'ROY-002', pricingKey: 'LAPTOP_STANDARD', status: 'Charging' },
  { customerName: 'Emeka Nwosu', tagNumber: 'ROY-003', pricingKey: 'PHONE_WITHOUT_CHARGER', status: 'Completed' },
  { customerName: 'Funmilayo Adeyemi', tagNumber: 'ROY-004', pricingKey: 'POWERBANK_30000', status: 'Charging' },
  { customerName: 'Ibrahim Musa', tagNumber: 'ROY-005', pricingKey: 'DESKTOP_STANDARD', status: 'Pending' },
  { customerName: 'Ngozi Eze', tagNumber: 'ROY-006', pricingKey: 'LAMP_STANDARD', status: 'Completed' },
  { customerName: 'Tunde Bakare', tagNumber: 'ROY-007', pricingKey: 'POWERBANK_20000', status: 'Completed' },
  { customerName: 'Blessing Udo', tagNumber: 'ROY-008', pricingKey: 'PHONE_WITH_CHARGER', status: 'Charging' },
  { customerName: 'Yusuf Abdullahi', tagNumber: 'ROY-009', pricingKey: 'LAPTOP_STANDARD', status: 'Completed' },
  { customerName: 'Chiamaka Obi', tagNumber: 'ROY-010', pricingKey: 'PHONE_WITHOUT_CHARGER', status: 'Charging' },
];

// Spread creation timestamps across the last few days so "today" stats
// have something to show while older records populate the table too.
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const CREATED_OFFSETS_HOURS = [1, 3, 30, 5, 50, 75, 100, 2, 120, 8];

const run = async () => {
  await connectDB();

  console.log('Clearing existing PricingConfig and ChargingRecord collections...');
  await PricingConfig.deleteMany({});
  await ChargingRecord.deleteMany({});

  console.log('Seeding pricing configuration...');
  const pricingDocs = await PricingConfig.insertMany(DEFAULT_PRICING);
  const pricingByKey = Object.fromEntries(pricingDocs.map((p) => [p.key, p]));

  console.log('Seeding sample charging records...');
  const records = SAMPLE_CUSTOMERS.map((sample, i) => {
    const pricing = pricingByKey[sample.pricingKey];
    const createdAt = hoursAgo(CREATED_OFFSETS_HOURS[i] ?? 10);
    return {
      customerName: sample.customerName,
      tagNumber: sample.tagNumber,
      gadgetType: pricing.gadgetType,
      pricingKey: pricing.key,
      option: pricing.optionLabel,
      amount: pricing.price,
      status: sample.status,
      createdAt,
      updatedAt: createdAt,
      completedAt: sample.status === 'Completed' ? createdAt : null,
    };
  });

  await ChargingRecord.insertMany(records);

  console.log(`Seed complete: ${pricingDocs.length} pricing entries, ${records.length} charging records.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
