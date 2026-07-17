import os from 'node:os';
import { z } from 'zod';
import { eventBus } from '../../core/eventBus.js';
import { appendTrace } from '../traces/traceStore.js';

export type ToolContext = {
  requestId: string;
  sessionId: string;
};

export type ToolResult = {
  success: boolean;
  data?: unknown;
  message?: string;
};

export type AlfredTool<TInput = unknown> = {
  name: string;
  description: string;
  schema: z.ZodType<TInput>;
  requiresConfirmation: boolean;
  execute(input: TInput, context: ToolContext): Promise<ToolResult>;
};

const tools = new Map<string, AlfredTool>();

function registerTool<TInput>(tool: AlfredTool<TInput>) {
  tools.set(tool.name, tool as AlfredTool);
}

registerTool({
  name: 'system.status',
  description: 'Returns local system resource status.',
  schema: z.object({}),
  requiresConfirmation: false,
  async execute() {
    return {
      success: true,
      data: {
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        freeMemoryBytes: os.freemem(),
        totalMemoryBytes: os.totalmem(),
        uptimeSeconds: os.uptime(),
      },
    };
  },
});

export function listTools() {
  return Array.from(tools.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    requiresConfirmation: tool.requiresConfirmation,
  }));
}

export async function executeTool(name: string, input: unknown, context: ToolContext) {
  const tool = tools.get(name);
  if (!tool) {
    return {
      success: false,
      message: `Herramienta no registrada: ${name}`,
    };
  }

  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Parametros invalidos para la herramienta.',
      data: parsed.error.flatten(),
    };
  }

  const startedAt = performance.now();
  const result = await tool.execute(parsed.data, context);
  const durationMs = Math.round(performance.now() - startedAt);
  eventBus.emit('tool.executed', {
    requestId: context.requestId,
    sessionId: context.sessionId,
    tool: name,
    success: result.success,
    durationMs,
  });
  await appendTrace({
    kind: 'tool.execution',
    requestId: context.requestId,
    sessionId: context.sessionId,
    durationMs,
    success: result.success,
    input: { tool: name, parameters: parsed.data },
    output: result,
  });

  return result;
}
