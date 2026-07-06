export const WORKFLOW_STAGES = [
  { key: 'agent_rules', label: '规则入口 / Agent 适配', description: '先同步并读取 ToolOps 规则，让不同 Agent 遵守同一套能力配置。' },
  { key: 'prompt_intake', label: '需求理解 / 提示词优化', description: '整理用户需求、约束和验收标准；必要时生成更清晰的任务提示。' },
  { key: 'project_context', label: '项目上下文', description: '读取 README、AGENTS、架构文档、配置和项目画像，建立最小必要上下文。' },
  { key: 'project_retrieval', label: '项目检索', description: '目标明确先直读文件；入口或影响面不明时再使用 Semble / rg / 代码图谱。' },
  { key: 'thinking_strategy', label: '思考策略', description: '选择轻量或重型分析策略，控制 token 成本和工具调用范围。' },
  { key: 'planning', label: '列计划', description: '把需求拆成阶段、文件范围、接口范围、风险点和验收项。' },
  { key: 'execution', label: '执行修改', description: '按计划修改代码、配置、文档或工具接入，不越权改动。' },
  { key: 'validation', label: '验证', description: '运行 lint、test、build 或项目脚本，确认改动结果。' },
  { key: 'feedback', label: '反馈 / 人工确认', description: '需要用户确认、风险选择或结束反馈时，通过人工确认通道处理。' }
]

export const WORKFLOW_STAGE_KEYS = new Set(WORKFLOW_STAGES.map((stage) => stage.key))

export const DEFAULT_SLOT_STAGE = {
  agent_compatibility: 'agent_rules',
  architecture_context: 'project_context',
  exact_search: 'project_retrieval',
  semantic_search: 'project_retrieval',
  code_graph: 'project_retrieval',
  build_validation: 'validation',
  human_confirmation: 'feedback'
}

export function normalizeWorkflowStage(value, slotKey = '') {
  const stage = String(value || '').trim()
  if (WORKFLOW_STAGE_KEYS.has(stage)) return stage
  return DEFAULT_SLOT_STAGE[slotKey] || 'execution'
}

export function workflowStageLabel(stageKey) {
  return WORKFLOW_STAGES.find((stage) => stage.key === stageKey)?.label || stageKey
}
