import { PrismaPg } from '@prisma-lossless/adapter-pg'
import { PrismaClient } from '@prisma-lossless/client'
import { getEmail } from '@prisma-lossless/client/sql'

const adapter = new PrismaPg({
  connectionString: process.env['TEST_E2E_POSTGRES_URI'],
})
const prisma = new PrismaClient({ adapter })

beforeAll(async () => {
  await prisma.user.deleteMany()
  await prisma.user.create({ data: { id: 123, email: 'user@example.com' } })
})

test('basic functionality', async () => {
  const result = await prisma.$queryRawTyped(getEmail(123))
  expect(result).toMatchInlineSnapshot(`
[
  {
    "email": "user@example.com",
  },
]
`)
})

export {}
