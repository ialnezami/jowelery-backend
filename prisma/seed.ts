import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const hash = (pw: string) => bcrypt.hash(pw, 10)

  // Upsert accounts (safe to re-run)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@jowelery.com' },
    update: {},
    create: {
      email: 'admin@jowelery.com',
      password: await hash('admin123'),
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  })
  console.log('✓ SUPER_ADMIN:', superAdmin.email)

  const shopAdmin = await prisma.user.upsert({
    where: { email: 'shop1@jowelery.com' },
    update: {},
    create: {
      email: 'shop1@jowelery.com',
      password: await hash('shop123'),
      name: 'Shop Admin',
      role: 'SHOP_ADMIN',
    },
  })
  console.log('✓ SHOP_ADMIN:', shopAdmin.email)

  const client = await prisma.user.upsert({
    where: { email: 'client@jowelery.com' },
    update: {},
    create: {
      email: 'client@jowelery.com',
      password: await hash('base123'),
      name: 'Test Client',
      role: 'CLIENT',
    },
  })
  console.log('✓ CLIENT:', client.email)

  // Seed default gold rates for all karats
  const defaultRates = [
    { karat: 'K24', rate: 85 },
    { karat: 'K22', rate: 77.9 },
    { karat: 'K21', rate: 74.4 },
    { karat: 'K18', rate: 63.8 },
    { karat: 'K14', rate: 49.6 },
  ]
  for (const { karat, rate } of defaultRates) {
    const exists = await prisma.goldRate.findFirst({ where: { karat: karat as any }, orderBy: { timestamp: 'desc' } })
    if (!exists) {
      await prisma.goldRate.create({ data: { karat: karat as any, rate, currency: 'USD' } })
      console.log(`✓ Gold rate seeded (${karat} $${rate}/g)`)
    }
  }

  // Seed SystemConfig if missing
  const config = await prisma.systemConfig.findFirst()
  if (!config) {
    await prisma.systemConfig.create({
      data: {
        key: 'main_config',
        singleShopMode: false,
      },
    })
    console.log('✓ SystemConfig seeded')
  }

  // Seed shop
  const existingShop = await prisma.shop.findFirst({ where: { adminId: shopAdmin.id } })
  const shop = existingShop ?? await prisma.shop.create({
    data: {
      name: 'Levant Gold',
      adminId: shopAdmin.id,
      description: 'Premium gold jewelry crafted for every occasion.',
      address: '12 Al Hamra Street',
      city: 'Kuwait City',
      country: 'Kuwait',
      phone: '+965 2200 0001',
      email: 'shop1@jowelery.com',
      status: 'ACTIVE',
      commissionRate: 0.10,
      shippingMethods: ['PICKUP', 'DELIVERY'],
    },
  })
  console.log(existingShop ? '~ Shop already exists:' : '✓ Shop seeded:', shop.name)

  // Gold rates (KWD per gram)
  const rates: Record<string, number> = {
    K24: 26.1,
    K22: 23.9,
    K21: 22.9,
    K18: 19.6,
    K14: 15.2,
  }

  // finalPrice = (rate × weight) + (makingCharges × weight)
  const price = (karat: string, weight: number, making: number) =>
    parseFloat(((rates[karat] * weight) + (making * weight)).toFixed(2))

  const products = [
    {
      sku: 'LG-RING-22K-001',
      name: 'Classic Solitaire Ring',
      nameTranslations: { en: 'Classic Solitaire Ring', ar: 'خاتم سوليتير كلاسيكي' },
      category: 'RINGS' as const,
      karat: 'K22' as const,
      weight: 4.5,
      makingCharges: 1.5,
      description: 'Elegant 22K gold solitaire ring, perfect for daily wear.',
    },
    {
      sku: 'LG-RING-18K-002',
      name: 'Diamond Band Ring',
      nameTranslations: { en: 'Diamond Band Ring', ar: 'خاتم ذهبي بتصميم النطاق' },
      category: 'RINGS' as const,
      karat: 'K18' as const,
      weight: 3.8,
      makingCharges: 2.0,
      description: 'Modern 18K gold band with intricate engravings.',
    },
    {
      sku: 'LG-NECK-21K-001',
      name: 'Layered Chain Necklace',
      nameTranslations: { en: 'Layered Chain Necklace', ar: 'قلادة سلسلة متعددة الطبقات' },
      category: 'NECKLACES' as const,
      karat: 'K21' as const,
      weight: 9.2,
      makingCharges: 1.2,
      description: '21K gold layered chain, 45cm length.',
    },
    {
      sku: 'LG-NECK-24K-002',
      name: 'Figaro Chain Necklace',
      nameTranslations: { en: 'Figaro Chain Necklace', ar: 'قلادة فيغارو ذهبية' },
      category: 'NECKLACES' as const,
      karat: 'K24' as const,
      weight: 12.0,
      makingCharges: 1.0,
      description: 'Pure 24K gold Figaro chain, 50cm length.',
    },
    {
      sku: 'LG-BRAC-22K-001',
      name: 'Rope Bracelet',
      nameTranslations: { en: 'Rope Bracelet', ar: 'سوار حبل ذهبي' },
      category: 'BRACELETS' as const,
      karat: 'K22' as const,
      weight: 7.5,
      makingCharges: 1.3,
      description: '22K gold rope bracelet, 19cm length.',
    },
    {
      sku: 'LG-BRAC-18K-002',
      name: 'Tennis Bracelet',
      nameTranslations: { en: 'Tennis Bracelet', ar: 'سوار تنس ذهبي' },
      category: 'BRACELETS' as const,
      karat: 'K18' as const,
      weight: 6.0,
      makingCharges: 2.5,
      description: '18K gold tennis bracelet with geometric links.',
    },
    {
      sku: 'LG-EAR-21K-001',
      name: 'Hoop Earrings',
      nameTranslations: { en: 'Hoop Earrings', ar: 'أقراط حلقية ذهبية' },
      category: 'EARRINGS' as const,
      karat: 'K21' as const,
      weight: 3.2,
      makingCharges: 1.8,
      description: '21K gold classic hoop earrings, 2cm diameter.',
    },
    {
      sku: 'LG-EAR-18K-002',
      name: 'Drop Earrings',
      nameTranslations: { en: 'Drop Earrings', ar: 'أقراط معلقة ذهبية' },
      category: 'EARRINGS' as const,
      karat: 'K18' as const,
      weight: 2.8,
      makingCharges: 2.2,
      description: '18K gold elegant drop earrings with filigree detail.',
    },
    {
      sku: 'LG-BAR-24K-001',
      name: '5g Gold Bar',
      nameTranslations: { en: '5g Gold Bar', ar: 'سبيكة ذهب 5 غرام' },
      category: 'BARS' as const,
      karat: 'K24' as const,
      weight: 5.0,
      makingCharges: 0.5,
      description: 'LBMA-certified 24K gold bar, 5 grams.',
    },
    {
      sku: 'LG-BAR-24K-010',
      name: '10g Gold Bar',
      nameTranslations: { en: '10g Gold Bar', ar: 'سبيكة ذهب 10 غرام' },
      category: 'BARS' as const,
      karat: 'K24' as const,
      weight: 10.0,
      makingCharges: 0.4,
      description: 'LBMA-certified 24K gold bar, 10 grams.',
    },
    {
      sku: 'LG-COIN-22K-001',
      name: 'Arabian Gold Coin',
      nameTranslations: { en: 'Arabian Gold Coin', ar: 'عملة ذهبية عربية' },
      category: 'COINS' as const,
      karat: 'K22' as const,
      weight: 8.0,
      makingCharges: 0.8,
      description: '22K commemorative gold coin with traditional arabesque motif.',
    },
    {
      sku: 'LG-COIN-24K-002',
      name: 'Kuwait Gold Dinar Coin',
      nameTranslations: { en: 'Kuwait Gold Dinar Coin', ar: 'عملة الدينار الكويتي الذهبية' },
      category: 'COINS' as const,
      karat: 'K24' as const,
      weight: 6.5,
      makingCharges: 0.6,
      description: 'Pure 24K collectible gold coin, Kuwait edition.',
    },
  ]

  let seededCount = 0
  for (const p of products) {
    const exists = await prisma.product.findUnique({ where: { sku: p.sku } })
    if (!exists) {
      await prisma.product.create({
        data: {
          shopId: shop.id,
          name: p.name,
          nameTranslations: p.nameTranslations,
          category: p.category,
          karat: p.karat,
          weight: p.weight,
          makingCharges: p.makingCharges,
          basePricePerGram: rates[p.karat],
          finalPrice: price(p.karat, p.weight, p.makingCharges),
          description: p.description,
          sku: p.sku,
          stockQuantity: 10,
          isActive: true,
          images: [],
        },
      })
      seededCount++
    }
  }
  console.log(`✓ Products seeded: ${seededCount} new (${products.length - seededCount} already existed)`)

  console.log('\nSeed complete.')
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
