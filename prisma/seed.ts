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

  // Seed a default gold rate
  const existing = await prisma.goldRate.findFirst({ orderBy: { timestamp: 'desc' } })
  if (!existing) {
    await prisma.goldRate.create({
      data: {
        rate: 85,
        karat: 'K24',
        currency: 'USD',
      },
    })
    console.log('✓ Gold rate seeded (K24 $85/g)')
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
