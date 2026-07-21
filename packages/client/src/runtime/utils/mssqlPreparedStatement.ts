import type { Sql } from '@prisma-lossless/client-runtime-utils'

// Generate something like: SELECT * FROM User WHERE name = @P1 AND email = @P2 ...
export const mssqlPreparedStatement = (sql: Sql) => {
  return sql.strings.reduce((acc, str, idx) => `${acc}@P${idx}${str}`)
}
