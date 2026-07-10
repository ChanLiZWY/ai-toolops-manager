const CATEGORIES = [
  { key: 'figma', label: 'Figma 与原型', keywords: ['figma', 'figjam', 'code connect', 'design-to-code'] },
  { key: 'github', label: 'GitHub 与协作', keywords: ['github', 'pull request', 'code review', 'review comment', 'ci check', 'draft pr', 'yeet'] },
  { key: 'browser', label: '浏览器与自动化', keywords: ['browser', 'chrome', 'playwright', '网页操作', '浏览器'] },
  { key: 'office', label: '文档与办公', keywords: ['document', 'documents', 'docx', 'word', 'pdf', 'spreadsheet', 'excel', 'sheet', 'presentation', 'slides', 'google drive', 'google docs'] },
  { key: 'design', label: '设计与视觉', keywords: ['design', 'ui', 'ux', 'brand', 'banner', 'visual', 'image', 'icon', 'logo', '配色', '字体'] },
  { key: 'web_delivery', label: '网站与交付', keywords: ['website', 'landing page', 'site', 'sites', 'hosting', 'deploy', '网页', '网站'] },
  { key: 'agent_extension', label: 'Agent 与扩展', keywords: ['skill', 'plugin', 'prompt', 'openai', 'codex', 'claude', 'agent capability', '提示词'] },
  { key: 'planning', label: '规划与需求', keywords: ['plan', 'planning', 'requirements', 'brainstorm', 'grill', 'handoff', '需求', '计划'] },
  { key: 'engineering', label: '代码与工程', keywords: ['code', 'repository', 'refactor', 'debug', 'test', 'swiftui', 'module', 'implementation'] },
  { key: 'general', label: '通用能力', keywords: [] }
]

const TAG_RULES = [
  ['Figma', ['figma', 'figjam']],
  ['原型', ['prototype', 'diagram', '原型', 'diagram']],
  ['UI/UX', ['ui', 'ux', 'interface', 'accessibility']],
  ['品牌', ['brand', 'logo', 'identity']],
  ['视觉设计', ['design', 'visual', 'banner', 'icon']],
  ['图片生成', ['imagegen', 'image generation', 'generate image']],
  ['浏览器', ['browser', 'chrome', 'playwright']],
  ['自动化', ['automation', 'control', 'workflow']],
  ['GitHub', ['github', 'pull request', 'draft pr', 'yeet']],
  ['代码评审', ['review comment', 'code review', 'address comments']],
  ['CI', ['ci check', 'github actions', 'fix ci']],
  ['文档', ['document', 'docx', 'word', 'google docs']],
  ['PDF', ['pdf']],
  ['表格', ['spreadsheet', 'excel', 'sheets']],
  ['演示文稿', ['presentation', 'slides']],
  ['云盘', ['google drive']],
  ['Skill', ['agent skill', 'skill creator', 'skill installer', 'find skills']],
  ['插件', ['plugin creator', 'plugin directory', 'plugin manifest']],
  ['提示词', ['prompt']],
  ['规划', ['plan', 'planning']],
  ['需求澄清', ['requirements', 'grill', 'brainstorm']],
  ['代码实现', ['implementation', 'code', 'swiftui', 'module']],
  ['测试', ['test', 'debug', 'ci']],
  ['部署', ['hosting', 'deploy', 'publish']],
  ['OpenAI', ['openai', 'chatgpt', 'codex']],
  ['Claude', ['claude']],
  ['Roo', ['roo']]
]

function searchText(skill) {
  return [
    skill.name,
    skill.label,
    skill.description,
    ...(skill.useWhen || []),
    ...(skill.skipWhen || []),
    ...(skill.requiredTools || []),
    ...(skill.recommendedTools || [])
  ].filter(Boolean).join(' ').toLowerCase()
}

function hasKeyword(text, keyword) {
  const value = String(keyword || '').toLowerCase()
  if (!value) return false
  if (/[^\x00-\x7F]/.test(value)) return text.includes(value)
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[^a-z0-9]+')
  const plural = value.length > 3 && !value.endsWith('s') && !value.includes(' ') ? 's?' : ''
  return new RegExp(`(^|[^a-z0-9])${escaped}${plural}([^a-z0-9]|$)`, 'i').test(text)
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => hasKeyword(text, keyword))
}

function unique(values) {
  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))]
}

function descriptionFor(category, text, skill) {
  const label = skill.label || skill.name
  if (String(skill.name || '').toLowerCase() === 'openai-docs') return `用于查询 OpenAI 与 Codex 官方文档，获取有来源、保持最新的产品和 API 使用说明。`
  if (category === 'office' && includesAny(text, ['spreadsheet', 'excel', 'sheets'])) return `用于创建、编辑、分析和校验表格数据，支持常见 Excel 与在线表格工作流。`
  if (category === 'office' && includesAny(text, ['presentation', 'slides'])) return `用于创建、编辑和检查演示文稿，帮助完成结构、内容与视觉交付。`
  if (category === 'office' && hasKeyword(text, 'pdf')) return `用于读取、生成、检查和验证 PDF，适合重视版式与交付质量的任务。`
  if (category === 'office' && includesAny(text, ['document', 'documents', 'docx', 'word'])) return `用于创建、编辑和审阅文档，并通过渲染检查保证排版质量。`
  if (category === 'github') return `用于 GitHub 仓库、Issue、Pull Request、评审意见或 CI 工作流。`
  if (category === 'browser') return `用于控制浏览器完成页面检查、点击、输入、截图或登录态相关操作。`
  if (category === 'figma') return `用于 Figma/FigJam 的设计、组件、图表、动效或设计到代码协作。`
  if (category === 'design' && includesAny(text, ['imagegen', 'image generation'])) return `用于生成或编辑图片素材，适合插画、视觉资产和图像变体任务。`
  if (category === 'agent_extension' && hasKeyword(text, 'prompt')) return `用于把模糊需求整理成结构清晰、约束明确、可复用的高质量提示词。`
  if (category === 'agent_extension' && hasKeyword(text, 'skill')) return `用于发现、创建、安装或审核 Agent Skill，扩展并治理 Agent 能力。`
  if (category === 'planning') return `用于需求澄清、方案拆解和执行计划，让复杂任务更容易验证和恢复。`
  if (category === 'web_delivery') return `用于构建、检查或发布网站，覆盖页面实现到托管交付。`
  const fallback = {
    design: '用于界面、品牌与视觉资产设计，提升可用性和视觉一致性。',
    engineering: '用于代码理解、实现、调试、测试或工程化交付。',
    agent_extension: '用于扩展和治理 Agent 能力、提示词与插件工作流。',
    planning: '用于澄清需求、制定计划并组织复杂任务的执行过程。',
    office: '用于文档、表格、演示和办公文件的创建与校验。',
    browser: '用于浏览器操作、网页验证和自动化工作流。',
    github: '用于代码托管、协作评审和持续集成工作流。',
    figma: '用于 Figma 设计、原型、组件和设计到代码协作。',
    web_delivery: '用于网站构建、验证和发布交付。',
    general: `用于 ${label} 相关任务；可切换到“原文”查看完整能力说明。`
  }
  return fallback[category] || fallback.general
}

export function skillCategories() {
  return CATEGORIES.map(({ key, label }) => ({ key, label }))
}

export function classifySkill(skill = {}) {
  const text = searchText(skill)
  const explicitCategory = CATEGORIES.find((item) => item.key === skill.category)
  const identity = [skill.name, skill.label].filter(Boolean).join(' ').toLowerCase()
  const scored = CATEGORIES.filter((item) => item.key !== 'general').map((item, index) => ({
    item,
    index,
    score: item.keywords.reduce((score, keyword) => score + (hasKeyword(identity, keyword) ? 5 : 0) + (hasKeyword(text, keyword) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score || a.index - b.index)
  const category = explicitCategory || (scored[0]?.score > 0 ? scored[0].item : CATEGORIES.at(-1))
  const inferredTags = TAG_RULES.filter(([, keywords]) => includesAny(text, keywords)).map(([label]) => label)
  if (hasKeyword(identity, 'skill') && !inferredTags.includes('Skill')) inferredTags.push('Skill')
  if (hasKeyword(identity, 'plugin') && !inferredTags.includes('插件')) inferredTags.push('插件')
  const agentTag = skill.agent ? ({ codex: 'Codex', claude: 'Claude', roo: 'Roo' }[String(skill.agent).toLowerCase()] || '') : ''
  const tags = unique([category.label, ...(skill.tags || []), ...inferredTags, agentTag]).slice(0, 8)
  return {
    category: category.key,
    categoryLabel: category.label,
    tags,
    descriptionZh: skill.descriptionZh || descriptionFor(category.key, text, skill)
  }
}
