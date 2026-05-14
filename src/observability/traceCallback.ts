import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Serialized } from "@langchain/core/load/serializable";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import { insertTrace } from "../db/queries";

const MAX_PAYLOAD_CHARS = 4000;

function truncate(s: string): string {
  if (s.length <= MAX_PAYLOAD_CHARS) return s;
  return s.slice(0, MAX_PAYLOAD_CHARS) + `\n...[truncated ${s.length - MAX_PAYLOAD_CHARS} chars]`;
}

function safeJson(value: unknown): string {
  try {
    return truncate(typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export class AgentTraceHandler extends BaseCallbackHandler {
  name = "AgentTraceHandler";

  private stepIndex = 0;
  private toolStartTimes = new Map<string, number>();

  constructor(
    private workoutDate: string,
    private agent: "paper" | "video",
  ) {
    super();
  }

  private nextStep(): number {
    return ++this.stepIndex;
  }

  override async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
  ): Promise<void> {
    const toolName = (tool as { name?: string }).name ?? "unknown";
    this.toolStartTimes.set(runId, Date.now());
    const step = this.nextStep();
    insertTrace({
      workoutDate: this.workoutDate,
      agent: this.agent,
      stepIndex: step,
      event: "tool_call",
      toolName,
      input: safeJson(input),
    });
    console.log(`[${this.agent}Agent] ${toolName}(${truncate(input).slice(0, 120)}) ...`);
  }

  override async handleToolEnd(output: unknown, runId: string): Promise<void> {
    const started = this.toolStartTimes.get(runId);
    const latencyMs = started ? Date.now() - started : undefined;
    this.toolStartTimes.delete(runId);
    const step = this.nextStep();
    const outStr = safeJson(output);
    insertTrace({
      workoutDate: this.workoutDate,
      agent: this.agent,
      stepIndex: step,
      event: "tool_result",
      output: outStr,
      latencyMs,
    });
    console.log(`[${this.agent}Agent]   -> ${latencyMs ?? "?"}ms, ${outStr.length} chars`);
  }

  override async handleToolError(err: Error, runId: string): Promise<void> {
    const started = this.toolStartTimes.get(runId);
    const latencyMs = started ? Date.now() - started : undefined;
    this.toolStartTimes.delete(runId);
    const step = this.nextStep();
    insertTrace({
      workoutDate: this.workoutDate,
      agent: this.agent,
      stepIndex: step,
      event: "tool_result",
      output: `ERROR: ${err.message}`,
      latencyMs,
    });
    console.log(`[${this.agent}Agent]   -> ERROR ${err.message}`);
  }

  override async handleAgentAction(action: AgentAction): Promise<void> {
    const step = this.nextStep();
    insertTrace({
      workoutDate: this.workoutDate,
      agent: this.agent,
      stepIndex: step,
      event: "agent_action",
      toolName: action.tool,
      input: safeJson(action.toolInput),
      output: safeJson(action.log),
    });
  }

  override async handleAgentEnd(action: AgentFinish): Promise<void> {
    const step = this.nextStep();
    insertTrace({
      workoutDate: this.workoutDate,
      agent: this.agent,
      stepIndex: step,
      event: "agent_finish",
      output: safeJson(action.returnValues),
    });
    console.log(`[${this.agent}Agent] FINISHED after ${step} steps`);
  }
}
