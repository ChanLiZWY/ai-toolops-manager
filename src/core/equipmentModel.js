import { timestamp } from '../utils.js'
import { normalizeWorkflowStage } from './workflow.js'

export const SLOT_TYPES = new Set(['exclusive_priority', 'additive', 'project_context', 'internal_adapter'])

export function getSlotTools(slot = {}) {
  const raw = Array.isArray(slot.tools) ? slot.tools : []
  const fromActive = slot.active ? [slot.active] : []
  return uniqueStrings([...raw, ...fromActive])
}

export function getSlotType(slot = {}) {
  return SLOT_TYPES.has(slot.slotType) ? slot.slotType : 'exclusive_priority'
}

export function isPrioritySlot(slot = {}) {
  return getSlotType(slot) === 'exclusive_priority'
}

export function getEffectiveTool(slot = {}) {
  if (slot.enabled === false) return null
  const tools = getSlotTools(slot)
  if (!tools.length) return null
  if (!isPrioritySlot(slot)) return tools
  return tools[0]
}

export function setSlotTools(slot, tools) {
  const next = uniqueStrings(tools)
  slot.tools = next
  slot.active = isPrioritySlot(slot) ? (next[0] || null) : null
  slot.health = next.length ? (slot.health === 'empty' ? 'ok' : slot.health) : 'empty'
  slot.updatedAt = timestamp()
  return slot
}

export function promoteTool(slot, toolName) {
  const next = [toolName, ...getSlotTools(slot).filter((item) => item !== toolName)]
  return setSlotTools(slot, next)
}

export function reorderSlotTools(slot, orderedTools) {
  const existing = getSlotTools(slot)
  const ordered = uniqueStrings(orderedTools).filter((tool) => existing.includes(tool))
  const rest = existing.filter((tool) => !ordered.includes(tool))
  return setSlotTools(slot, [...ordered, ...rest])
}

function defaultSlot({ label, tools = [], fallback = [], loadLevel = 'L1', autoLoad = 'on_demand', enabled = true, health = 'ok', recommendedTool = '', slotType = 'exclusive_priority', category = 'external_tool', workflowStage, relationGroup = '' }) {
  const slot = { label, tools, fallback, loadLevel, autoLoad, enabled, health, recommendedTool, slotType, category, workflowStage, relationGroup, updatedAt: timestamp() }
  slot.workflowStage = normalizeWorkflowStage(slot.workflowStage, '')
  setSlotTools(slot, tools)
  return slot
}

function migrateLegacySlots(equipment) {
  const slots = equipment.slots || {}
  const legacy = slots.agent_adapter
  if (!legacy) return equipment

  const legacyTools = getSlotTools(legacy)
  const compatibilityTools = legacyTools.filter((tool) => ['compatibility-layer', 'codex-adapter', 'claude-adapter', 'roo-adapter'].includes(tool))
  const humanTools = legacyTools.filter((tool) => /askhuman/i.test(tool) || ['ask-human', 'human-confirmation'].includes(tool))
  const otherTools = legacyTools.filter((tool) => !compatibilityTools.includes(tool) && !humanTools.includes(tool))

  if (!slots.agent_compatibility) {
    slots.agent_compatibility = defaultSlot({
      label: 'Agent 兼容层',
      tools: compatibilityTools.length ? compatibilityTools : (otherTools.length ? otherTools : ['codex-adapter', 'claude-adapter', 'roo-adapter']),
      fallback: [],
      loadLevel: legacy.loadLevel || 'L1',
      autoLoad: legacy.autoLoad ?? true,
      enabled: legacy.enabled !== false,
      health: legacy.health || 'ok',
      recommendedTool: 'codex-adapter',
      slotType: 'internal_adapter',
      category: 'agent_adapter',
      workflowStage: 'agent_rules'
    })
  }

  if (humanTools.length && !slots.human_confirmation) {
    slots.human_confirmation = defaultSlot({
      label: '人工确认',
      tools: humanTools,
      fallback: [],
      loadLevel: 'L1',
      autoLoad: 'on_demand',
      enabled: legacy.enabled !== false,
      health: legacy.health || 'optional',
      recommendedTool: humanTools[0],
      slotType: 'exclusive_priority',
      category: 'interaction_tool',
      workflowStage: 'feedback'
    })
  }

  delete slots.agent_adapter
  return equipment
}

export function normalizeEquipment(equipment = {}) {
  equipment = equipment || {}
  equipment.slots ||= {}
  migrateLegacySlots(equipment)
  if (equipment.slots.agent_compatibility) {
    const slot = equipment.slots.agent_compatibility
    slot.slotType = 'internal_adapter'
    slot.category = 'agent_adapter'
    slot.workflowStage = 'agent_rules'
    slot.relationGroup ||= 'agent_rules'
    const tools = getSlotTools(slot)
    if (!tools.length || (tools.length === 1 && tools[0] === 'compatibility-layer')) {
      slot.tools = ['codex-adapter', 'claude-adapter', 'roo-adapter']
      slot.recommendedTool = 'codex-adapter'
      slot.active = null
    }
  }

  for (const [slotKey, slot] of Object.entries(equipment.slots)) {
    if (!slot.slotType) slot.slotType = 'exclusive_priority'
    if (!SLOT_TYPES.has(slot.slotType)) slot.slotType = 'exclusive_priority'
    if (!slot.category) slot.category = slot.slotType === 'project_context' ? 'project_builtin' : slot.slotType === 'internal_adapter' ? 'agent_adapter' : 'external_tool'
    slot.workflowStage = normalizeWorkflowStage(slot.workflowStage, slotKey)
    setSlotTools(slot, getSlotTools(slot))
    if (slot.enabled === undefined) slot.enabled = true
  }
  return equipment
}

export function uniqueStrings(values) {
  const result = []
  for (const value of values || []) {
    const text = String(value || '').trim()
    if (!text || result.includes(text)) continue
    result.push(text)
  }
  return result
}
