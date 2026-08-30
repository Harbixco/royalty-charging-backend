/**
 * The single source of truth for the initial price list. This is only
 * used to seed the PricingConfig collection the first time the app
 * runs — after that, prices live in the database and are edited via
 * the Pricing page / PUT /api/pricing/:id.
 */
export const DEFAULT_PRICING = [
  {
    key: 'PHONE_WITH_CHARGER',
    gadgetType: 'Phone',
    optionLabel: 'With Charger',
    price: 200,
  },
  {
    key: 'PHONE_WITHOUT_CHARGER',
    gadgetType: 'Phone',
    optionLabel: 'Without Charger',
    price: 300,
  },
  {
    key: 'LAPTOP_STANDARD',
    gadgetType: 'Laptop',
    optionLabel: 'Standard',
    price: 500,
  },
  {
    key: 'DESKTOP_STANDARD',
    gadgetType: 'Desktop',
    optionLabel: 'Standard',
    price: 200,
  },
  {
    key: 'LAMP_STANDARD',
    gadgetType: 'Lamp',
    optionLabel: 'Standard',
    price: 200,
  },
  {
    key: 'POWERBANK_20000',
    gadgetType: 'Power Bank',
    optionLabel: '20,000mAh',
    price: 500,
  },
  {
    key: 'POWERBANK_30000',
    gadgetType: 'Power Bank',
    optionLabel: '30,000mAh',
    price: 800,
  },
];
