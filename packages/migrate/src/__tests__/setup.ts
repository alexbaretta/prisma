import { agentMatchers } from '../utils/ai-safety'

const originalEnv = { ...process.env }
const originalCwd = process.cwd()
const aiAgentEnvVars = [
  ...new Set(agentMatchers.flatMap((matcher) => matcher.envVars)),
  'PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION',
]

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key]
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function clearAiAgentEnv() {
  for (const key of aiAgentEnvVars) {
    delete process.env[key]
  }
}

beforeEach(() => {
  process.chdir(originalCwd)
  restoreEnv()
  clearAiAgentEnv()
  // To avoid the loading spinner prints in local cli output snapshot tests
  process.env.CI = 'true'
})

afterEach(() => {
  process.chdir(originalCwd)
  restoreEnv()
})
