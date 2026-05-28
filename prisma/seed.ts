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

  console.log('\nSeed complete.')
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
