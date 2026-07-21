import { defineConfig } from '@prisma-lossless/config'

export default defineConfig({
  datasource: {
    url: 'prisma://aws-us-east-1.prisma-data.com/?api_key=MY_API_KEY',
  },
})
