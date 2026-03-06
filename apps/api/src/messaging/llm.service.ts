import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface LlmTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | any[];
}

export interface ToolResult {
  text: string;
  respondToUser?: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    this.client = new Anthropic();
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  async chat(
    systemPrompt: string,
    conversationHistory: LlmMessage[],
    tools: LlmTool[],
    toolHandler: (name: string, input: Record<string, any>) => Promise<ToolResult>,
  ): Promise<{ response: string; updatedHistory: LlmMessage[] }> {
    const history = [...conversationHistory];

    // Loop to handle tool use cycles
    for (let i = 0; i < 5; i++) {
      const result = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: history,
        tools: tools as any,
      });

      // Build the assistant message content
      const assistantContent: any[] = [];
      let textResponse = '';
      const toolUses: Array<{ id: string; name: string; input: any }> = [];

      for (const block of result.content) {
        if (block.type === 'text') {
          textResponse += block.text;
          assistantContent.push(block);
        } else if (block.type === 'tool_use') {
          toolUses.push({ id: block.id, name: block.name, input: block.input as any });
          assistantContent.push(block);
        }
      }

      history.push({ role: 'assistant', content: assistantContent });

      // If no tool use, we're done
      if (result.stop_reason !== 'tool_use' || toolUses.length === 0) {
        return { response: textResponse, updatedHistory: history };
      }

      // Execute tools and collect results
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        try {
          this.logger.debug(`LLM calling tool: ${tu.name}(${JSON.stringify(tu.input)})`);
          const toolResult = await toolHandler(tu.name, tu.input);

          // If the tool wants to short-circuit the response
          if (toolResult.respondToUser) {
            textResponse = toolResult.respondToUser;
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: toolResult.text,
          });
        } catch (err) {
          this.logger.error(`Tool ${tu.name} failed: ${err}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          });
        }
      }

      history.push({ role: 'user', content: toolResults });
    }

    // Shouldn't reach here normally
    return {
      response: "I'm having trouble processing that. Could you try again?",
      updatedHistory: history,
    };
  }
}
