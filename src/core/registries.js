import { timestamp } from '../utils.js'

export function defaultCapabilities() {
  return {
    version: 2,
    updatedAt: timestamp(),
    capabilities: {
      exact_search: {
        label: '精确搜索',
        workflowStage: 'project_retrieval',
        relationGroup: 'file_lookup',
        slotType: 'exclusive_priority',
        category: 'external_tool',
        contract: ['按文件名/关键词定位', '输出可验证路径', '低 token 成本'],
        usePolicy: ['目标文件明确、IDE 已定位、用户点名文件或只需关键词确认时使用。', '不要把跨文件阅读误判成跨文件检索。'],
        loadLevel: 'L0',
        defaultTool: 'rg',
        fallback: []
      },
      semantic_search: {
        label: '语义搜索',
        workflowStage: 'project_retrieval',
        relationGroup: 'file_lookup',
        slotType: 'exclusive_priority',
        category: 'external_tool',
        contract: ['查找相似实现', '候选结果需要再用精确搜索确认'],
        usePolicy: ['只有入口不明确、调用链不明确、确实需要在未知文件中定位实现/调用/影响面时，才优先使用。', 'Semble 无结果或需要精确路径校验时，再用 rg 兜底。'],
        loadLevel: 'L1',
        defaultTool: 'semble',
        fallback: ['rg']
      },
      code_graph: {
        label: '代码图谱',
        workflowStage: 'project_retrieval',
        relationGroup: 'code_structure',
        slotType: 'exclusive_priority',
        category: 'external_tool',
        contract: ['查询调用链', '查询模块依赖', '查询页面入口', '查询跨文件引用'],
        loadLevel: 'L2',
        defaultTool: 'codebase-memory-mcp',
        fallback: ['rg', 'project-architecture-docs']
      },
      architecture_context: {
        label: '架构上下文',
        workflowStage: 'project_context',
        relationGroup: 'repo_context',
        slotType: 'project_context',
        category: 'project_builtin',
        contract: ['提供模块 ownership', '提供读取入口', '减少全量扫描'],
        loadLevel: 'L1',
        defaultTool: 'project-architecture-docs',
        fallback: ['README', 'AGENTS']
      },
      build_validation: {
        label: '构建验证',
        workflowStage: 'validation',
        relationGroup: 'validation',
        slotType: 'project_context',
        category: 'project_builtin',
        contract: ['运行 lint/test/build', '输出失败原因', '不自动修复无关问题'],
        loadLevel: 'L1',
        defaultTool: 'package-scripts',
        fallback: []
      },
      agent_compatibility: {
        label: 'Agent 兼容层',
        workflowStage: 'agent_rules',
        relationGroup: 'agent_rules',
        slotType: 'internal_adapter',
        category: 'agent_adapter',
        contract: ['生成不同 Agent 的配置补丁', '保持中立配置为源头', '不被人工确认工具替代'],
        loadLevel: 'L1',
        defaultTool: 'codex-adapter',
        fallback: []
      },
      human_confirmation: {
        label: '人工确认',
        workflowStage: 'feedback',
        relationGroup: 'human_loop',
        slotType: 'exclusive_priority',
        category: 'interaction_tool',
        contract: ['需要用户确认时提问', '支持选项和推荐理由', '不承担多 Agent 规则适配'],
        loadLevel: 'L1',
        defaultTool: 'askhuman',
        fallback: []
      }
    }
  }
}

export function defaultToolRegistry(profile) {
  return {
    version: 2,
    updatedAt: timestamp(),
    tools: {
      rg: {
        label: 'ripgrep',
        type: 'external_tool',
        status: 'external-required',
        capabilities: ['exact_search'],
        installScope: 'system-or-dev-env',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '请在本机安装 ripgrep，并确保 rg 命令可用。',
        useWhen: ['目标文件明确但需要命令行定位路径', '按精确关键词、类名、函数名、路由名查找', 'Semble 无结果后的兜底确认'],
        avoidWhen: ['用户已经点名具体文件且可直接查看', '需要语义相似实现、未知入口或未知影响面时不要先全量 rg'],
        uninstall: '移除系统或开发环境中的 rg；项目配置无需清理。',
        score: { installConvenience: 5, uninstallConvenience: 5, aiEfficiencyGain: 5, tokenSaving: 5, stability: 5, projectFit: 5, maintenanceCost: 1 }
      },
      semble: {
        label: 'Semble',
        type: 'external_tool',
        status: 'optional',
        capabilities: ['semantic_search'],
        installScope: 'local-or-agent-env',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '请按当前 Agent 环境安装 Semble，并确保 semble 命令或项目内能力可用。',
        useWhen: ['入口不明确', '调用链不明确', '需要在未知文件中定位实现、调用或影响面', '需要找相似实现或模式'],
        avoidWhen: ['目标文件明确', 'IDE 已定位', '用户已点名文件', '已知组件或依赖关系明确且可直接跨文件阅读'],
        uninstall: '从对应 Agent/本地工具配置中移除即可。',
        score: { installConvenience: 3, uninstallConvenience: 4, aiEfficiencyGain: 4, tokenSaving: 4, stability: 3, projectFit: 4, maintenanceCost: 2 }
      },
      'codebase-memory-mcp': {
        label: 'Codebase Memory MCP',
        type: 'external_tool',
        status: 'recommended-on-demand',
        capabilities: ['code_graph'],
        installScope: 'local-agent-config',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        autoBackgroundScan: false,
        installHint: '请安装本地 MCP server，并只接入本地 Agent 客户端配置。不要默认开启上传、后台扫描或自动同步。',
        useWhen: ['跨模块影响分析', '调用链查询', '架构重构', '大功能接手前'],
        avoidWhen: ['单文件小改', '纯样式修改', '已知路径修改'],
        uninstall: '卸载 MCP server，并删除对应 Agent 本地 MCP 配置；保留 .ai-toolops 历史记录可选。',
        score: { installConvenience: 3, uninstallConvenience: 4, aiEfficiencyGain: 5, tokenSaving: 5, stability: 4, projectFit: 5, maintenanceCost: 3 }
      },
      'project-architecture-docs': {
        label: '项目架构文档',
        type: 'project_context',
        status: profile.architecture?.length ? 'project-provided' : 'missing',
        capabilities: ['architecture_context'],
        installScope: 'repo-docs',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '复用项目已有 README、AGENTS、architecture 或 docs 文档；它不是外部工具，也不需要安装。',
        uninstall: '不建议删除；这是项目自身文档能力。',
        score: { installConvenience: 5, uninstallConvenience: 3, aiEfficiencyGain: 5, tokenSaving: 5, stability: 5, projectFit: 5, maintenanceCost: 2 }
      },
      'package-scripts': {
        label: 'Package Scripts',
        type: 'project_context',
        status: Object.keys(profile.scripts || {}).length ? 'project-provided' : 'missing',
        capabilities: ['build_validation'],
        installScope: 'repo-package-json',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '复用 package.json 中已有 lint/test/build 脚本；它是项目内置验证入口。',
        uninstall: '不建议删除；复用项目已有 scripts。',
        score: { installConvenience: 5, uninstallConvenience: 3, aiEfficiencyGain: 4, tokenSaving: 3, stability: 5, projectFit: 5, maintenanceCost: 1 }
      },
      'compatibility-layer': {
        label: 'Compatibility Layer',
        type: 'internal_adapter',
        status: 'built-in',
        capabilities: ['agent_compatibility'],
        installScope: 'ai-toolops-generated',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '由 AI ToolOps 生成不同 Agent 的配置补丁；它不应和 AskHuman 放在同一互斥槽位。',
        uninstall: '运行 ai-toolops rollback 或删除 .ai-toolops/adapters 输出。',
        score: { installConvenience: 4, uninstallConvenience: 5, aiEfficiencyGain: 4, tokenSaving: 4, stability: 4, projectFit: 4, maintenanceCost: 2 }
      },
      'codex-adapter': {
        label: 'Codex Adapter',
        type: 'internal_adapter',
        status: 'built-in',
        capabilities: ['agent_compatibility'],
        installScope: 'ai-toolops-generated',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '由 AI ToolOps 生成 .ai-toolops/generated/CODEX.toolops.md 与项目 AGENTS.md 引用块。',
        useWhen: ['项目使用 Codex 或 AGENTS.md 作为规则入口'],
        avoidWhen: ['不使用 Codex 的项目可在 adapters.json 中关闭'],
        uninstall: '运行 ai-toolops adapters disable codex。',
        score: { installConvenience: 5, uninstallConvenience: 5, aiEfficiencyGain: 4, tokenSaving: 4, stability: 4, projectFit: 4, maintenanceCost: 1 }
      },
      'claude-adapter': {
        label: 'Claude Code Adapter',
        type: 'internal_adapter',
        status: 'built-in',
        capabilities: ['agent_compatibility'],
        installScope: 'ai-toolops-generated',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '由 AI ToolOps 生成 .ai-toolops/generated/CLAUDE.toolops.md，供 CLAUDE.md 按需引用。',
        useWhen: ['项目使用 Claude Code'],
        avoidWhen: ['不使用 Claude Code 的项目可在 adapters.json 中关闭'],
        uninstall: '运行 ai-toolops adapters disable claude。',
        score: { installConvenience: 5, uninstallConvenience: 5, aiEfficiencyGain: 4, tokenSaving: 4, stability: 4, projectFit: 4, maintenanceCost: 1 }
      },
      'roo-adapter': {
        label: 'Roo Code Adapter',
        type: 'internal_adapter',
        status: 'built-in',
        capabilities: ['agent_compatibility'],
        installScope: 'ai-toolops-generated',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '由 AI ToolOps 生成 .ai-toolops/generated/ROO.toolops.md，供 Roo Code 规则或 mode 引用。',
        useWhen: ['项目使用 Roo Code'],
        avoidWhen: ['不使用 Roo Code 的项目可在 adapters.json 中关闭'],
        uninstall: '运行 ai-toolops adapters disable roo。',
        score: { installConvenience: 5, uninstallConvenience: 5, aiEfficiencyGain: 4, tokenSaving: 4, stability: 4, projectFit: 4, maintenanceCost: 1 }
      },
      askhuman: {
        label: 'AskHuman',
        type: 'interaction_tool',
        status: 'optional',
        capabilities: ['human_confirmation'],
        installScope: 'agent-or-dev-env',
        localFirst: true,
        cloudUpload: false,
        autoUpdate: false,
        installHint: '请按 AskHuman 的官方方式安装，并确保 AskHuman.exe 或 askhuman 命令可用。它用于人工确认，不用于 Agent 规则兼容。',
        useWhen: ['问题会影响实现范围、数据来源、交互行为、接口契约、验收标准或高风险操作', '本次请求结束前请求用户反馈'],
        avoidWhen: ['小改动', '明确修复', '普通状态同步', '可以安全默认处理的问题'],
        uninstall: '从对应 Agent/本地工具配置中移除 AskHuman，并运行 ai-toolops unequip human_confirmation。',
        score: { installConvenience: 3, uninstallConvenience: 4, aiEfficiencyGain: 4, tokenSaving: 3, stability: 4, projectFit: 4, maintenanceCost: 2 }
      }
    }
  }
}

export function buildEquipment(profile) {
  return {
    version: 2,
    updatedAt: timestamp(),
    project: profile.name,
    slots: {
      exact_search: { label: '精确搜索', workflowStage: 'project_retrieval', relationGroup: 'file_lookup', slotType: 'exclusive_priority', category: 'external_tool', tools: ['rg'], active: 'rg', fallback: [], loadLevel: 'L0', autoLoad: true, enabled: true, health: 'ok', recommendedTool: 'rg' },
      semantic_search: { label: '语义搜索', workflowStage: 'project_retrieval', relationGroup: 'file_lookup', slotType: 'exclusive_priority', category: 'external_tool', tools: ['semble'], active: 'semble', fallback: ['rg'], loadLevel: 'L1', autoLoad: 'on_demand', enabled: true, health: 'optional', recommendedTool: 'semble' },
      code_graph: { label: '代码图谱', workflowStage: 'project_retrieval', relationGroup: 'code_structure', slotType: 'exclusive_priority', category: 'external_tool', tools: ['codebase-memory-mcp'], active: 'codebase-memory-mcp', fallback: ['rg', 'project-architecture-docs'], loadLevel: 'L2', autoLoad: false, enabled: false, health: 'recommended', recommendedTool: 'codebase-memory-mcp' },
      architecture_context: { label: '架构上下文', workflowStage: 'project_context', relationGroup: 'repo_context', slotType: 'project_context', category: 'project_builtin', tools: ['project-architecture-docs'], active: null, fallback: ['README', 'AGENTS'], loadLevel: 'L1', autoLoad: true, enabled: true, health: profile.architecture?.length ? 'ok' : 'missing', recommendedTool: 'project-architecture-docs' },
      build_validation: { label: '构建验证', workflowStage: 'validation', relationGroup: 'validation', slotType: 'project_context', category: 'project_builtin', tools: ['package-scripts'], active: null, fallback: [], loadLevel: 'L1', autoLoad: false, enabled: true, health: Object.keys(profile.scripts || {}).length ? 'ok' : 'missing', recommendedTool: 'package-scripts' },
      agent_compatibility: { label: 'Agent 兼容层', workflowStage: 'agent_rules', relationGroup: 'agent_rules', slotType: 'internal_adapter', category: 'agent_adapter', tools: ['codex-adapter', 'claude-adapter', 'roo-adapter'], active: null, fallback: [], loadLevel: 'L1', autoLoad: true, enabled: true, health: 'ok', recommendedTool: 'codex-adapter' },
      human_confirmation: { label: '人工确认', workflowStage: 'feedback', relationGroup: 'human_loop', slotType: 'exclusive_priority', category: 'interaction_tool', tools: ['askhuman'], active: 'askhuman', fallback: [], loadLevel: 'L1', autoLoad: 'on_demand', enabled: false, health: 'optional', recommendedTool: 'askhuman' }
    },
    policies: {
      heavyToolsOnDemand: true,
      noAutoCloudUpload: true,
      noAutoBackgroundScan: true,
      preferLightToolsForKnownPaths: true
    }
  }
}
