#!/usr/bin/env node

/**
 * OneSaaS CLI Setup Script
 *
 * 사용법:
 *   npx onesaas-setup
 *   또는
 *   node scripts/setup.mjs
 */

import { createInterface } from 'readline'
import { execSync, spawn } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✕${colors.reset} ${msg}`),
  step: (num, msg) => console.log(`\n${colors.cyan}[${num}]${colors.reset} ${colors.bright}${msg}${colors.reset}`),
  dim: (msg) => console.log(`${colors.gray}${msg}${colors.reset}`),
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.yellow}?${colors.reset} ${prompt}`, (answer) => {
      resolve(answer.trim())
    })
  })
}

function questionSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(`${colors.yellow}?${colors.reset} ${prompt}`)

    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let password = ''

    stdin.on('data', function handler(ch) {
      ch = ch.toString()

      switch (ch) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false)
          stdin.removeListener('data', handler)
          console.log()
          resolve(password)
          break
        case '\u0003':
          process.exit()
          break
        case '\u007F': // backspace
          if (password.length > 0) {
            password = password.slice(0, -1)
            process.stdout.clearLine(0)
            process.stdout.cursorTo(0)
            process.stdout.write(`${colors.yellow}?${colors.reset} ${prompt}${'*'.repeat(password.length)}`)
          }
          break
        default:
          password += ch
          process.stdout.write('*')
          break
      }
    })
  })
}

async function confirm(prompt) {
  const answer = await question(`${prompt} (y/n): `)
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

function printBanner() {
  console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ${colors.bright}OneSaaS CLI Setup${colors.reset}${colors.green}                                      ║
║   ${colors.gray}SaaS 프로젝트를 자동으로 설정합니다${colors.green}                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`)
}

function printStep(current, total, description) {
  const progress = '█'.repeat(current) + '░'.repeat(total - current)
  console.log(`\n${colors.cyan}[${progress}]${colors.reset} Step ${current}/${total}: ${description}`)
  console.log('─'.repeat(50))
}

async function checkGitHub(token) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const data = await response.json()
      return { success: true, username: data.login }
    }
    return { success: false, error: 'Invalid token' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function createGitHubRepo(token, repoName, username, isPrivate = true) {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description: `${repoName} - Created with OneSaaS`,
        private: isPrivate,
        auto_init: false,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return { success: true, url: data.html_url, cloneUrl: data.clone_url }
    }

    const error = await response.json()
    if (error.errors?.[0]?.message?.includes('name already exists')) {
      return { success: false, error: '이미 같은 이름의 저장소가 존재합니다' }
    }
    return { success: false, error: error.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function checkSupabase(token) {
  try {
    const response = await fetch('https://api.supabase.com/v1/organizations', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const orgs = await response.json()
      if (orgs.length > 0) {
        return { success: true, orgId: orgs[0].id, orgName: orgs[0].name }
      }
      return { success: false, error: '조직이 없습니다' }
    }
    return { success: false, error: 'Invalid token' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function createSupabaseProject(token, orgId, projectName) {
  try {
    const dbPassword = generatePassword(24)

    const response = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        organization_id: orgId,
        region: 'ap-south-1',
        plan: 'free',
        db_pass: dbPassword,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const databaseUrl = `postgresql://postgres.${data.id}:${dbPassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
      return {
        success: true,
        projectId: data.id,
        databaseUrl,
        dashboardUrl: `https://supabase.com/dashboard/project/${data.id}`
      }
    }

    const error = await response.json()
    return { success: false, error: error.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function checkVercel(token) {
  try {
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const data = await response.json()
      return { success: true, username: data.user.username }
    }
    return { success: false, error: 'Invalid token' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function createVercelProject(token, projectName, repoName, githubUsername) {
  try {
    const response = await fetch('https://api.vercel.com/v10/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        framework: 'nextjs',
        gitRepository: {
          type: 'github',
          repo: `${githubUsername}/${repoName}`,
        },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return {
        success: true,
        projectId: data.id,
        deployUrl: `https://${data.name}.vercel.app`,
        dashboardUrl: `https://vercel.com/${data.accountId}/${data.name}`
      }
    }

    const error = await response.json()
    return { success: false, error: error.error?.message || error.message }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function setVercelEnv(token, projectId, key, value) {
  try {
    const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        value,
        type: 'encrypted',
        target: ['production', 'preview', 'development'],
      }),
    })
    return response.ok
  } catch (e) {
    return false
  }
}

// ═══════════════════════════════════════════════════════════
// Domain Functions
// ═══════════════════════════════════════════════════════════

async function checkDomainAvailability(token, domain) {
  try {
    const response = await fetch(`https://api.vercel.com/v4/domains/status?name=${domain}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const data = await response.json()
      return { success: true, available: data.available }
    }
    return { success: false, error: 'Failed to check domain' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function getDomainPrice(token, domain) {
  try {
    const response = await fetch(`https://api.vercel.com/v4/domains/price?name=${domain}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.ok) {
      const data = await response.json()
      return { success: true, price: data.price, period: data.period }
    }
    return { success: false, error: 'Failed to get price' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function purchaseDomain(token, domain) {
  try {
    const response = await fetch('https://api.vercel.com/v5/domains/buy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })
    if (response.ok) {
      return { success: true }
    }
    const error = await response.json()
    return { success: false, error: error.error?.message || 'Purchase failed' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

async function addDomainToProject(token, projectId, domain) {
  try {
    const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })
    if (response.ok) {
      return { success: true }
    }
    const error = await response.json()
    return { success: false, error: error.error?.message || 'Failed to add domain' }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

function generatePassword(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ═══════════════════════════════════════════════════════════
// Prerequisite Checks
// ═══════════════════════════════════════════════════════════

function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getCommandVersion(command) {
  try {
    const version = execSync(`${command} --version`, { encoding: 'utf-8' }).trim()
    return version.split('\n')[0]
  } catch {
    return null
  }
}

function getPlatform() {
  const platform = process.platform
  if (platform === 'darwin') return 'mac'
  if (platform === 'win32') return 'windows'
  return 'linux'
}

function printInstallGuide(tool, platform) {
  const guides = {
    node: {
      mac: 'brew install node  또는  https://nodejs.org',
      windows: 'https://nodejs.org 에서 다운로드',
      linux: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs'
    },
    git: {
      mac: 'brew install git  또는  Xcode Command Line Tools 설치',
      windows: 'https://git-scm.com/download/win 에서 다운로드',
      linux: 'sudo apt-get install git'
    },
    pnpm: {
      mac: 'npm install -g pnpm  또는  brew install pnpm',
      windows: 'npm install -g pnpm',
      linux: 'npm install -g pnpm'
    }
  }

  const guide = guides[tool]?.[platform]
  if (guide) {
    console.log(`  ${colors.cyan}${guide}${colors.reset}`)
  }
}

async function checkPrerequisites() {
  console.log(`\n${colors.bright}필수 도구 확인 중...${colors.reset}\n`)

  const platform = getPlatform()
  const checks = []
  let hasError = false

  // Check Node.js
  if (checkCommand('node')) {
    const version = getCommandVersion('node')
    log.success(`Node.js: ${version}`)
    checks.push({ tool: 'node', installed: true })
  } else {
    log.error('Node.js가 설치되어 있지 않습니다')
    console.log(`${colors.bright}설치 방법:${colors.reset}`)
    printInstallGuide('node', platform)
    hasError = true
  }

  // Check Git
  if (checkCommand('git')) {
    const version = getCommandVersion('git')
    log.success(`Git: ${version}`)
    checks.push({ tool: 'git', installed: true })
  } else {
    log.error('Git이 설치되어 있지 않습니다')
    console.log(`${colors.bright}설치 방법:${colors.reset}`)
    printInstallGuide('git', platform)
    hasError = true
  }

  // Check pnpm (optional but recommended)
  if (checkCommand('pnpm')) {
    const version = getCommandVersion('pnpm')
    log.success(`pnpm: ${version}`)
  } else {
    log.warn('pnpm이 설치되어 있지 않습니다 (권장)')
    console.log(`${colors.bright}설치 방법:${colors.reset}`)
    printInstallGuide('pnpm', platform)
    console.log()
  }

  if (hasError) {
    console.log(`\n${colors.red}필수 도구가 설치되어 있지 않습니다.${colors.reset}`)
    console.log('위 안내에 따라 설치 후 다시 실행해주세요.')
    return false
  }

  console.log()
  return true
}

function saveEnvFile(envVars) {
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  writeFileSync('.env.local', envContent)
  log.success('.env.local 파일이 생성되었습니다')
}

async function main() {
  printBanner()

  // Check prerequisites first
  const prerequisitesOk = await checkPrerequisites()
  if (!prerequisitesOk) {
    rl.close()
    process.exit(1)
  }

  // 상위 프로젝트 (조직/그룹)
  const parentProject = await question('상위 프로젝트 이름 (예: my-company): ')

  if (!parentProject) {
    log.error('상위 프로젝트 이름이 필요합니다')
    process.exit(1)
  }

  // 하위 프로젝트 (실제 SaaS)
  const subProject = await question('하위 프로젝트 이름 (예: saas-app): ')

  if (!subProject) {
    log.error('하위 프로젝트 이름이 필요합니다')
    process.exit(1)
  }

  const parentName = parentProject.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const subName = subProject.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const repoName = `${parentName}-${subName}`
  const projectName = `${parentName}/${subName}`

  console.log(`\n${colors.bright}프로젝트 구조:${colors.reset}`)
  console.log(`  ${colors.cyan}${parentName}${colors.reset}`)
  console.log(`  └── ${colors.green}${subName}${colors.reset}`)
  console.log(`\n${colors.bright}저장소 이름:${colors.reset} ${repoName}`)
  console.log(`${colors.bright}개발 AI:${colors.reset} Claude Code`)

  if (!await confirm('\n진행하시겠습니까?')) {
    log.warn('취소되었습니다')
    process.exit(0)
  }

  const tokens = {}
  const results = {}

  // ═══════════════════════════════════════════════════════════
  // Step 1: GitHub
  // ═══════════════════════════════════════════════════════════
  printStep(1, 6, 'GitHub 저장소 생성')

  log.dim('GitHub Fine-grained Personal Access Token이 필요합니다')
  log.dim('발급: https://github.com/settings/personal-access-tokens/new')
  log.dim('권한: Repository access → All repositories, Contents: Read and write')
  console.log()

  tokens.github = await questionSecret('GitHub Token: ')

  log.info('토큰 확인 중...')
  const githubCheck = await checkGitHub(tokens.github)

  if (!githubCheck.success) {
    log.error(`GitHub 토큰 오류: ${githubCheck.error}`)
    process.exit(1)
  }

  log.success(`GitHub 계정: ${githubCheck.username}`)

  // Ask for repository visibility
  console.log(`\n${colors.bright}저장소 공개 설정:${colors.reset}`)
  console.log('  1. Private (비공개) - 기본값')
  console.log('  2. Public (공개)')
  const visibilityChoice = await question('선택 (1 또는 2, Enter=Private): ')
  const isPrivate = visibilityChoice !== '2'

  log.info(`${isPrivate ? 'Private' : 'Public'} 저장소 생성 중...`)
  const githubResult = await createGitHubRepo(tokens.github, repoName, githubCheck.username, isPrivate)

  if (!githubResult.success) {
    log.error(`저장소 생성 실패: ${githubResult.error}`)
    process.exit(1)
  }

  log.success(`저장소 생성 완료: ${githubResult.url}`)
  results.github = { ...githubResult, username: githubCheck.username }

  // ═══════════════════════════════════════════════════════════
  // Step 2: Supabase
  // ═══════════════════════════════════════════════════════════
  printStep(2, 6, 'Supabase 데이터베이스 생성')

  log.dim('Supabase Access Token이 필요합니다')
  log.dim('발급: https://supabase.com/dashboard/account/tokens')
  console.log()

  tokens.supabase = await questionSecret('Supabase Token: ')

  log.info('토큰 확인 중...')
  const supabaseCheck = await checkSupabase(tokens.supabase)

  if (!supabaseCheck.success) {
    log.error(`Supabase 토큰 오류: ${supabaseCheck.error}`)
    process.exit(1)
  }

  log.success(`Supabase 조직: ${supabaseCheck.orgName}`)

  log.info('프로젝트 생성 중... (1-2분 소요)')
  const supabaseResult = await createSupabaseProject(tokens.supabase, supabaseCheck.orgId, repoName)

  if (!supabaseResult.success) {
    log.error(`프로젝트 생성 실패: ${supabaseResult.error}`)
    process.exit(1)
  }

  log.success(`프로젝트 생성 완료: ${supabaseResult.dashboardUrl}`)
  results.supabase = supabaseResult

  // ═══════════════════════════════════════════════════════════
  // Step 3: Vercel
  // ═══════════════════════════════════════════════════════════
  printStep(3, 6, 'Vercel 배포')

  log.dim('Vercel Token이 필요합니다')
  log.dim('발급: https://vercel.com/account/tokens')
  console.log()

  tokens.vercel = await questionSecret('Vercel Token: ')

  log.info('토큰 확인 중...')
  const vercelCheck = await checkVercel(tokens.vercel)

  if (!vercelCheck.success) {
    log.error(`Vercel 토큰 오류: ${vercelCheck.error}`)
    process.exit(1)
  }

  log.success(`Vercel 계정: ${vercelCheck.username}`)

  log.info('프로젝트 생성 중...')
  const vercelResult = await createVercelProject(tokens.vercel, repoName, repoName, results.github.username)

  if (!vercelResult.success) {
    log.error(`프로젝트 생성 실패: ${vercelResult.error}`)
    process.exit(1)
  }

  log.success(`프로젝트 생성 완료`)

  // Set environment variable
  log.info('환경 변수 설정 중...')
  const envSet = await setVercelEnv(tokens.vercel, vercelResult.projectId, 'DATABASE_URL', results.supabase.databaseUrl)

  if (envSet) {
    log.success('DATABASE_URL 환경 변수 설정 완료')
  } else {
    log.warn('환경 변수 설정 실패 - 수동으로 설정해주세요')
  }

  results.vercel = vercelResult

  // ═══════════════════════════════════════════════════════════
  // Step 4: Vercel AI Gateway
  // ═══════════════════════════════════════════════════════════
  printStep(4, 6, 'Vercel AI Gateway 설정')

  console.log(`\n${colors.bright}AI 프로바이더 선택 (다중 선택 가능):${colors.reset}`)
  console.log('  1. OpenAI (GPT-4, GPT-3.5)')
  console.log('  2. Anthropic (Claude)')
  console.log('  3. Google (Gemini)')
  console.log('  4. Groq (Llama, Mixtral)')
  console.log('  5. 모두 선택')

  const aiProviderChoice = await question('선택 (1-5, 쉼표로 구분, Enter=모두): ')

  const selectedProviders = []
  const providerEnvs = {}

  const providers = {
    '1': { name: 'openai', envKey: 'OPENAI_API_KEY', label: 'OpenAI' },
    '2': { name: 'anthropic', envKey: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
    '3': { name: 'google', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY', label: 'Google' },
    '4': { name: 'groq', envKey: 'GROQ_API_KEY', label: 'Groq' },
  }

  let choices = aiProviderChoice.split(',').map(c => c.trim())
  if (!aiProviderChoice || aiProviderChoice === '5') {
    choices = ['1', '2', '3', '4']
  }

  for (const choice of choices) {
    const provider = providers[choice]
    if (provider) {
      selectedProviders.push(provider)
      const apiKey = await questionSecret(`${provider.label} API Key (Enter=나중에): `)
      providerEnvs[provider.envKey] = apiKey || ''
    }
  }

  // Vercel AI Gateway 환경변수 설정
  log.info('Vercel AI Gateway 환경변수 설정 중...')

  for (const [key, value] of Object.entries(providerEnvs)) {
    if (value) {
      const envSet = await setVercelEnv(tokens.vercel, vercelResult.projectId, key, value)
      if (envSet) {
        log.success(`${key} 설정 완료`)
      }
    }
  }

  results.aiProviders = selectedProviders.map(p => p.name)
  log.success(`AI Gateway 설정 완료: ${selectedProviders.map(p => p.label).join(', ')}`)

  // ═══════════════════════════════════════════════════════════
  // Step 5: Custom Domain (Optional)
  // ═══════════════════════════════════════════════════════════
  printStep(5, 6, '커스텀 도메인 설정 (선택)')

  console.log(`\n${colors.bright}커스텀 도메인 옵션:${colors.reset}`)
  console.log(`  ${colors.gray}현재 무료 도메인: ${results.vercel.deployUrl}${colors.reset}`)
  console.log('  1. 커스텀 도메인 없이 진행 (기본값)')
  console.log('  2. 새 도메인 구매 (Vercel에서 구매)')
  console.log('  3. 기존 도메인 연결 (이미 보유한 도메인)')

  const domainChoice = await question('선택 (1, 2, 또는 3, Enter=Skip): ')

  if (domainChoice === '2') {
    // Purchase new domain
    const desiredDomain = await question('구매할 도메인 이름 (예: myapp.com): ')

    if (desiredDomain) {
      log.info(`도메인 확인 중: ${desiredDomain}`)

      const availability = await checkDomainAvailability(tokens.vercel, desiredDomain)

      if (availability.success && availability.available) {
        const priceInfo = await getDomainPrice(tokens.vercel, desiredDomain)

        if (priceInfo.success) {
          console.log(`\n${colors.bright}도메인 정보:${colors.reset}`)
          console.log(`  도메인: ${desiredDomain}`)
          console.log(`  가격: $${priceInfo.price}/년`)

          if (await confirm('\n이 도메인을 구매하시겠습니까?')) {
            log.info('도메인 구매 중...')
            const purchaseResult = await purchaseDomain(tokens.vercel, desiredDomain)

            if (purchaseResult.success) {
              log.success(`도메인 구매 완료: ${desiredDomain}`)

              log.info('프로젝트에 도메인 연결 중...')
              const addResult = await addDomainToProject(tokens.vercel, vercelResult.projectId, desiredDomain)

              if (addResult.success) {
                log.success(`도메인 연결 완료: https://${desiredDomain}`)
                results.domain = desiredDomain
              } else {
                log.warn(`도메인 연결 실패: ${addResult.error}`)
                log.dim('Vercel 대시보드에서 수동으로 연결해주세요')
              }
            } else {
              log.error(`도메인 구매 실패: ${purchaseResult.error}`)
              log.dim('Vercel 대시보드에서 직접 구매해주세요: https://vercel.com/domains')
            }
          }
        }
      } else {
        log.warn(`도메인을 사용할 수 없습니다: ${desiredDomain}`)
        log.dim('다른 도메인을 선택하거나 Vercel 대시보드에서 검색해주세요')
      }
    }
  } else if (domainChoice === '3') {
    // Connect existing domain
    const existingDomain = await question('연결할 도메인 (예: myapp.com): ')

    if (existingDomain) {
      log.info('프로젝트에 도메인 연결 중...')
      const addResult = await addDomainToProject(tokens.vercel, vercelResult.projectId, existingDomain)

      if (addResult.success) {
        log.success(`도메인 연결 완료: ${existingDomain}`)
        results.domain = existingDomain

        console.log(`\n${colors.yellow}⚠ DNS 설정 필요:${colors.reset}`)
        console.log(`  도메인 등록업체에서 다음 DNS 레코드를 추가하세요:`)
        console.log(`  ${colors.cyan}A    @    76.76.21.21${colors.reset}`)
        console.log(`  ${colors.cyan}CNAME www  cname.vercel-dns.com${colors.reset}`)
      } else {
        log.error(`도메인 연결 실패: ${addResult.error}`)
      }
    }
  } else {
    log.info('커스텀 도메인 설정을 건너뜁니다')
  }

  // ═══════════════════════════════════════════════════════════
  // Complete
  // ═══════════════════════════════════════════════════════════
  console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ${colors.bright}설정 완료!${colors.reset}${colors.green}                                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`)

  console.log(`${colors.bright}GitHub 저장소:${colors.reset}`)
  console.log(`  ${colors.cyan}${results.github.url}${colors.reset}`)

  console.log(`\n${colors.bright}Supabase 대시보드:${colors.reset}`)
  console.log(`  ${colors.cyan}${results.supabase.dashboardUrl}${colors.reset}`)

  console.log(`\n${colors.bright}배포 URL:${colors.reset}`)
  console.log(`  ${colors.green}${results.vercel.deployUrl}${colors.reset}`)

  if (results.domain) {
    console.log(`\n${colors.bright}커스텀 도메인:${colors.reset}`)
    console.log(`  ${colors.green}https://${results.domain}${colors.reset}`)
  }

  console.log(`\n${colors.bright}DATABASE_URL:${colors.reset}`)
  console.log(`  ${colors.gray}${results.supabase.databaseUrl.substring(0, 50)}...${colors.reset}`)

  // Save .env.local
  saveEnvFile({
    DATABASE_URL: results.supabase.databaseUrl,
  })

  // ═══════════════════════════════════════════════════════════
  // Step 5: Claude Code + MCP 설치
  // ═══════════════════════════════════════════════════════════
  printStep(6, 6, 'Claude Code & MCP 설치')

  log.info('Claude Code 설치 확인 중...')

  let claudeInstalled = false
  try {
    execSync('which claude', { stdio: 'pipe' })
    claudeInstalled = true
    log.success('Claude Code가 이미 설치되어 있습니다')
  } catch {
    log.info('Claude Code 설치 중...')
    try {
      execSync('npm install -g @anthropic-ai/claude-code', { stdio: 'inherit' })
      claudeInstalled = true
      log.success('Claude Code 설치 완료')
    } catch (e) {
      log.warn('Claude Code 설치 실패 - 수동으로 설치해주세요: npm install -g @anthropic-ai/claude-code')
    }
  }

  // MCP 서버 설치
  if (claudeInstalled) {
    log.info('MCP 서버 설치 중...')

    const mcpServers = [
      { name: 'filesystem', package: '@anthropic-ai/mcp-server-filesystem' },
      { name: 'github', package: '@anthropic-ai/mcp-server-github' },
      { name: 'postgres', package: '@anthropic-ai/mcp-server-postgres' },
      { name: 'context7', package: '@anthropic-ai/mcp-server-context7' },
      { name: 'fetch', package: '@anthropic-ai/mcp-server-fetch' },
      { name: 'memory', package: '@anthropic-ai/mcp-server-memory' },
      { name: 'brave-search', package: '@anthropic-ai/mcp-server-brave-search' },
    ]

    for (const server of mcpServers) {
      try {
        execSync(`npm install -g ${server.package}`, { stdio: 'pipe' })
        log.success(`MCP ${server.name} 설치 완료`)
      } catch {
        log.dim(`MCP ${server.name} 설치 건너뜀`)
      }
    }

    // Claude Code 스킬 설치
    log.info('Claude Code 스킬 설치 중...')

    const skills = [
      'anthropics/claude-code-base-skills',
      'anthropics/claude-code-git-skills',
      'anthropics/claude-code-web-skills',
      'anthropics/claude-code-db-skills',
      'anthropics/claude-code-nextjs-skills',
      'anthropics/claude-code-react-skills',
      'anthropics/claude-code-typescript-skills',
      'anthropics/claude-code-tailwind-skills',
      'anthropics/claude-code-prisma-skills',
    ]

    for (const skill of skills) {
      try {
        execSync(`claude skill install ${skill}`, { stdio: 'pipe' })
        log.success(`스킬 ${skill.split('/')[1]} 설치 완료`)
      } catch {
        log.dim(`스킬 ${skill.split('/')[1]} 설치 건너뜀`)
      }
    }

    // Next.js 보일러플레이트 설정
    log.info('Next.js 보일러플레이트 설정 중...')

    // CLAUDE.md 생성 (프로젝트 컨텍스트)
    const claudeMd = `# ${repoName}

## 프로젝트 개요
- **스택**: Next.js 14, TypeScript, Tailwind CSS, Prisma, Supabase
- **배포**: Vercel
- **개발 AI**: Claude Code

## 주요 디렉토리
- \`src/app\` - Next.js App Router 페이지
- \`src/components\` - React 컴포넌트
- \`src/lib\` - 유틸리티 함수
- \`prisma\` - 데이터베이스 스키마

## 명령어
- \`pnpm dev\` - 개발 서버
- \`pnpm build\` - 프로덕션 빌드
- \`pnpm db:push\` - DB 스키마 적용
- \`pnpm db:studio\` - Prisma Studio

## 환경 변수
- \`DATABASE_URL\` - Supabase 연결 문자열

## 개발 규칙
- TypeScript strict 모드 사용
- Tailwind CSS 유틸리티 우선
- Server Components 기본 사용
- 클라이언트 컴포넌트는 'use client' 명시
`

    try {
      writeFileSync('CLAUDE.md', claudeMd)
      log.success('CLAUDE.md 생성 완료')
    } catch {
      log.dim('CLAUDE.md 생성 건너뜀')
    }

    // .cursorrules 생성 (다른 AI도 지원)
    const cursorRules = `# 프로젝트 규칙

## 기술 스택
- Next.js 14 App Router
- TypeScript (strict)
- Tailwind CSS
- Prisma + Supabase
- pnpm

## 코딩 규칙
- 한국어 주석 사용
- 컴포넌트는 함수형으로 작성
- Server Components 우선
- 클라이언트는 'use client' 필수
- import 경로는 @/ 사용

## 파일 구조
\`\`\`
src/
├── app/          # 페이지
├── components/   # UI 컴포넌트
├── lib/          # 유틸리티
└── types/        # 타입 정의
\`\`\`
`

    try {
      writeFileSync('.cursorrules', cursorRules)
      log.success('.cursorrules 생성 완료')
    } catch {
      log.dim('.cursorrules 생성 건너뜀')
    }

    // 기본 디렉토리 구조 생성
    const dirs = ['src/components', 'src/lib', 'src/types', 'src/hooks']
    for (const dir of dirs) {
      try {
        execSync(`mkdir -p ${dir}`, { stdio: 'pipe' })
      } catch {
        // 이미 존재하면 무시
      }
    }

    // 기본 유틸리티 파일 생성
    const utilsContent = `import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`

    try {
      writeFileSync('src/lib/utils.ts', utilsContent)
      log.success('유틸리티 파일 생성 완료')
    } catch {
      log.dim('유틸리티 파일 생성 건너뜀')
    }

    // 기본 타입 파일 생성
    const typesContent = `// 공통 타입 정의

export interface User {
  id: string
  email: string
  name?: string
  createdAt: Date
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
`

    try {
      writeFileSync('src/types/index.ts', typesContent)
      log.success('타입 파일 생성 완료')
    } catch {
      log.dim('타입 파일 생성 건너뜀')
    }

    // AI SDK 설정 파일 생성
    const aiConfigContent = `import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Vercel AI Gateway를 통한 프로바이더 설정
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

// 기본 모델 설정
export const defaultModel = openai('gpt-4o-mini')
export const smartModel = openai('gpt-4o')
export const claudeModel = anthropic('claude-3-5-sonnet-20241022')
export const geminiModel = google('gemini-1.5-pro')
`

    try {
      writeFileSync('src/lib/ai.ts', aiConfigContent)
      log.success('AI SDK 설정 파일 생성 완료')
    } catch {
      log.dim('AI SDK 설정 파일 생성 건너뜀')
    }

    // AI API 라우트 생성
    const aiRouteContent = `import { streamText } from 'ai'
import { defaultModel } from '@/lib/ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: defaultModel,
    messages,
  })

  return result.toDataStreamResponse()
}
`

    try {
      execSync('mkdir -p src/app/api/chat', { stdio: 'pipe' })
      writeFileSync('src/app/api/chat/route.ts', aiRouteContent)
      log.success('AI API 라우트 생성 완료')
    } catch {
      log.dim('AI API 라우트 생성 건너뜀')
    }

    log.success('Next.js 보일러플레이트 설정 완료')

    // Claude Code 설정 파일 생성
    const claudeConfig = {
      mcpServers: {
        filesystem: {
          command: 'mcp-server-filesystem',
          args: [process.cwd()]
        },
        github: {
          command: 'mcp-server-github',
          env: { GITHUB_TOKEN: tokens.github }
        },
        postgres: {
          command: 'mcp-server-postgres',
          env: { DATABASE_URL: results.supabase.databaseUrl }
        },
        context7: {
          command: 'mcp-server-context7'
        },
        fetch: {
          command: 'mcp-server-fetch'
        },
        memory: {
          command: 'mcp-server-memory'
        },
        'brave-search': {
          command: 'mcp-server-brave-search',
          env: { BRAVE_API_KEY: '' }
        }
      },
      skills: [
        'anthropics/claude-code-base-skills',
        'anthropics/claude-code-git-skills',
        'anthropics/claude-code-web-skills',
        'anthropics/claude-code-db-skills',
        'anthropics/claude-code-nextjs-skills',
        'anthropics/claude-code-react-skills',
        'anthropics/claude-code-typescript-skills',
        'anthropics/claude-code-tailwind-skills',
        'anthropics/claude-code-prisma-skills'
      ],
      hooks: {
        'pre-commit': 'pnpm run lint && pnpm run typecheck',
        'post-push': 'echo "Deployed to Vercel!"'
      },
      settings: {
        autoCommit: false,
        autoPush: false,
        theme: 'dark'
      }
    }

    // .env.local에 API 키 템플릿 추가
    const envAdditions = `
# MCP API Keys (선택사항)
OPENAI_API_KEY=
GOOGLE_API_KEY=
BRAVE_API_KEY=
`
    try {
      const currentEnv = readFileSync('.env.local', 'utf-8')
      writeFileSync('.env.local', currentEnv + envAdditions)
    } catch {
      // 파일이 없으면 무시
    }

    try {
      writeFileSync('.claude/settings.json', JSON.stringify(claudeConfig, null, 2))
      log.success('Claude Code MCP 설정 완료')
    } catch {
      // .claude 디렉토리가 없으면 생성
      try {
        execSync('mkdir -p .claude', { stdio: 'pipe' })
        writeFileSync('.claude/settings.json', JSON.stringify(claudeConfig, null, 2))
        log.success('Claude Code MCP 설정 완료')
      } catch {
        log.dim('MCP 설정 파일 생성 건너뜀')
      }
    }
  }

  console.log(`
${colors.bright}다음 단계:${colors.reset}
  1. 이 디렉토리의 코드를 GitHub에 푸시:
     ${colors.gray}git remote add origin ${results.github.cloneUrl}
     git push -u origin main${colors.reset}

  2. Vercel이 자동으로 배포합니다

  3. Claude Code로 개발 시작:
     ${colors.cyan}claude${colors.reset}

  4. ${results.vercel.deployUrl} 에서 확인하세요!
`)

  rl.close()
}

main().catch((error) => {
  log.error(`오류 발생: ${error.message}`)
  process.exit(1)
})
