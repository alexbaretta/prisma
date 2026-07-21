import { PrismaPg } from '@prisma-lossless/adapter-pg'

import { PrismaClient } from './generated/client'

const adapter = new PrismaPg({
  connectionString: process.env['TEST_E2E_POSTGRES_URI']!,
})
const db = new PrismaClient({ adapter })

export { db }
