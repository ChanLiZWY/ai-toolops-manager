import path from 'node:path'
import { cwdPath, exists, listFiles, readJson, readText, timestamp, toRelative } from '../utils.js'

export function scanProject() {
  const packageJsonPath = cwdPath('package.json')
  const packageJson = readJson(packageJsonPath, {}) || {}
  const files = listFiles(process.cwd(), { maxDepth: 3 })
  const relFiles = files.map(toRelative)

  const framework = detectFramework(packageJson, relFiles)
  const packageManager = detectPackageManager(packageJson, relFiles)
  const agents = detectAgents(relFiles)
  const mcp = detectMcp(relFiles)
  const docs = detectDocs(relFiles)
  const architecture = detectArchitecture(relFiles)
  const scripts = packageJson.scripts || {}

  return {
    generatedAt: timestamp(),
    root: process.cwd(),
    name: packageJson.name || path.basename(process.cwd()),
    packageManager,
    framework,
    scripts,
    agents,
    mcp,
    docs,
    architecture,
    directories: detectDirectories(relFiles),
    recommendations: buildRecommendations({ framework, packageManager, agents, architecture, scripts, relFiles })
  }
}

function detectFramework(packageJson, relFiles) {
  const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) }
  const has = (name) => Boolean(deps[name])
  const labels = []
  if (has('@dcloudio/uni-app') || relFiles.includes('pages.json')) labels.push('uni-app')
  if (has('vue')) labels.push('Vue')
  if (has('react')) labels.push('React')
  if (has('next')) labels.push('Next.js')
  if (has('vite')) labels.push('Vite')
  if (has('pinia')) labels.push('Pinia')
  if (has('typescript') || relFiles.some((file) => file.endsWith('tsconfig.json'))) labels.push('TypeScript')
  return labels.length ? labels : ['unknown']
}

function detectPackageManager(packageJson, relFiles) {
  if (packageJson.packageManager) return packageJson.packageManager
  if (relFiles.includes('pnpm-lock.yaml')) return 'pnpm'
  if (relFiles.includes('yarn.lock')) return 'yarn'
  if (relFiles.includes('package-lock.json')) return 'npm'
  return 'unknown'
}

function detectAgents(relFiles) {
  const result = []
  if (relFiles.includes('AGENTS.md')) result.push({ name: 'AGENTS.md', type: 'generic-agent-rules', path: 'AGENTS.md' })
  if (relFiles.includes('CLAUDE.md')) result.push({ name: 'Claude Code', type: 'agent-rules', path: 'CLAUDE.md' })
  if (relFiles.some((file) => file.includes('.roo'))) result.push({ name: 'Roo Code', type: 'agent-config', path: '.roo' })
  if (relFiles.some((file) => file.includes('.codex'))) result.push({ name: 'Codex', type: 'agent-config', path: '.codex' })
  if (relFiles.includes('.cursorrules')) result.push({ name: 'Cursor', type: 'agent-rules', path: '.cursorrules' })
  return result
}

function detectMcp(relFiles) {
  return relFiles.filter((file) => file.endsWith('mcp.json') || file.includes('/mcp/') || file.includes('.mcp'))
}

function detectDocs(relFiles) {
  return relFiles.filter((file) => /(^README\.md$|^DOCS\.md$|docs\/|architecture\/|ai\/agent-rules\/)/.test(file)).slice(0, 80)
}

function detectArchitecture(relFiles) {
  const markers = ['architecture/modules.summary.yaml', 'architecture/modules.yaml', 'AGENTS.md', 'ai/tooling.config.json']
  return markers.filter((marker) => relFiles.includes(marker)).map((marker) => ({ path: marker, present: true }))
}

function detectDirectories(relFiles) {
  const interesting = ['src', 'src/pages', 'src/components', 'src/modules', 'src/shared', 'src/store', 'src/api', 'docs', 'architecture', 'ai', 'uniCloud-alipay']
  return interesting.filter((dir) => relFiles.some((file) => file === dir || file.startsWith(`${dir}/`)))
}

function buildRecommendations(ctx) {
  const recommendations = []
  recommendations.push({ capability: 'exact_search', tool: 'rg', priority: 'required', reason: '精确定位文件、函数、引用，低成本。' })
  if (ctx.framework.some((item) => ['Vue', 'React', 'uni-app'].includes(item))) {
    recommendations.push({ capability: 'build_validation', tool: 'package scripts', priority: 'required', reason: '前端项目必须保留 lint/build/test 验证入口。' })
  }
  if (ctx.architecture.length > 0) {
    recommendations.push({ capability: 'architecture_context', tool: 'project architecture docs', priority: 'required', reason: '项目已有架构索引，应作为 AI 读取入口。' })
  }
  recommendations.push({ capability: 'code_graph', tool: 'codebase-memory-mcp', priority: 'recommended', reason: '跨模块任务、调用链分析、架构重构时可减少重复读取。' })
  recommendations.push({ capability: 'agent_compatibility', tool: 'compatibility-layer', priority: 'recommended', reason: '避免 Codex、Claude、Roo 分别维护规则。' })
  recommendations.push({ capability: 'human_confirmation', tool: 'askhuman', priority: 'optional', reason: '需要用户确认、收集选项或人工审核时使用。' })
  return recommendations
}

export function buildProjectDna(profile) {
  return {
    version: 1,
    updatedAt: timestamp(),
    project: {
      name: profile.name,
      root: profile.root,
      packageManager: profile.packageManager,
      framework: profile.framework,
      directories: profile.directories
    },
    ai: {
      agents: profile.agents,
      mcp: profile.mcp,
      docs: profile.docs.slice(0, 30),
      architecture: profile.architecture
    },
    policies: {
      localFirst: true,
      noCloudUploadByDefault: true,
      noBackgroundScanByDefault: true,
      businessCodeReadOnlyDuringInit: true,
      preferCapabilityOverTool: true
    }
  }
}
