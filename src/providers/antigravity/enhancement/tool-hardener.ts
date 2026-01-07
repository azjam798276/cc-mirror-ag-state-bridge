/**
 * Tool Hallucination Prevention (Mirrowel 4-Layer Pattern)
 * Per TDD v1.0 Module 8
 *
 * Layers:
 * 1. Schema Hardening - additionalProperties: false
 * 2. Signature Injection - unique ID per tool call
 * 3. System Prompt Prepending - explicit allowed tool list
 * 4. Namespace Prefixing - prefix tool names to avoid collisions
 */

import { ToolSchema, HardenedTool, ToolHardenerConfig, ToolCallValidation } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Hardener Class
// ─────────────────────────────────────────────────────────────────────────────

export class ToolHardener {
    private registeredTools: Map<string, HardenedTool> = new Map();
    private config: Required<ToolHardenerConfig>;

    constructor(config: ToolHardenerConfig = {}) {
        this.config = {
            namespace: config.namespace ?? 'ccm',
            strictMode: config.strictMode ?? true,
            maxRetries: config.maxRetries ?? 2,
        };
    }

    /**
     * Layer 1: Schema Hardening
     * Ensures additionalProperties: false to prevent extra fields
     * Time: O(p) where p = number of properties
     * Space: O(p) for copied schema
     */
    hardenSchema(schema: ToolSchema): ToolSchema {
        const hardened: ToolSchema = {
            ...schema,
            parameters: schema.parameters
                ? {
                    ...schema.parameters,
                    additionalProperties: false,
                }
                : undefined,
        };
        return hardened;
    }

    /**
     * Layer 2: Signature Injection
     * Generates unique signature for tool tracking
     */
    generateSignature(toolName: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${toolName}_${timestamp}_${random}`;
    }

    /**
     * Layer 3: System Prompt Prepending
     * Builds system prompt section listing allowed tools
     */
    buildToolSystemPrompt(): string {
        const toolNames = Array.from(this.registeredTools.keys());
        if (toolNames.length === 0) {
            return '';
        }

        const toolList = toolNames
            .map((name) => `- ${name}`)
            .join('\n');

        return `
## Available Tools

You may ONLY use the following tools. Any tool not listed here is NOT available:

${toolList}

IMPORTANT: Do NOT attempt to use tools that are not explicitly listed above.
If a task requires a tool that is not available, explain what tool would be needed.
`;
    }

    /**
     * Layer 4: Namespace Prefixing
     * Adds namespace prefix to tool names
     */
    prefixToolName(name: string): string {
        if (name.startsWith(`${this.config.namespace}__`)) {
            return name; // Already prefixed
        }
        return `${this.config.namespace}__${name}`;
    }

    /**
     * Register a tool with all 4 layers applied
     */
    registerTool(schema: ToolSchema): HardenedTool {
        const prefixedName = this.prefixToolName(schema.name);
        const hardenedSchema = this.hardenSchema({
            ...schema,
            name: prefixedName,
        });
        const signature = this.generateSignature(prefixedName);

        const hardened: HardenedTool = {
            name: prefixedName,
            schema: hardenedSchema,
            signature,
            namespace: this.config.namespace,
        };

        this.registeredTools.set(prefixedName, hardened);
        return hardened;
    }

    /**
     * Validate a tool call against registered tools
     */
    validateToolCall(
        toolName: string,
        args: Record<string, unknown>
    ): ToolCallValidation {
        const errors: string[] = [];

        // Check if tool is registered
        const tool = this.registeredTools.get(toolName);
        if (!tool) {
            // Try with namespace prefix
            const prefixedName = this.prefixToolName(toolName);
            const prefixedTool = this.registeredTools.get(prefixedName);

            if (!prefixedTool) {
                errors.push(
                    `Tool "${toolName}" is not registered. Available tools: ${Array.from(
                        this.registeredTools.keys()
                    ).join(', ')}`
                );
                return {
                    isValid: false,
                    errors,
                    recoveryAction: 'reject',
                };
            }
        }

        const registeredTool = tool ?? this.registeredTools.get(this.prefixToolName(toolName))!;

        // Validate against schema
        const schemaErrors = this.validateAgainstSchema(
            args,
            registeredTool.schema.parameters
        );
        errors.push(...schemaErrors);

        if (errors.length > 0) {
            return {
                isValid: false,
                errors,
                recoveryAction: this.config.strictMode ? 'reject' : 'retry',
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Get all registered tools in Google Gen AI format
     */
    getGoogleToolDeclarations(): Array<{
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    }> {
        return Array.from(this.registeredTools.values()).map((tool) => ({
            name: tool.schema.name,
            description: tool.schema.description,
            parameters: tool.schema.parameters,
        }));
    }

    /**
     * Error recovery logic
     */
    handleValidationFailure(
        validation: ToolCallValidation,
        retryCount: number
    ): { shouldRetry: boolean; message: string } {
        if (validation.recoveryAction === 'reject') {
            return {
                shouldRetry: false,
                message: `Tool call rejected: ${validation.errors.join('; ')}`,
            };
        }

        if (
            validation.recoveryAction === 'retry' &&
            retryCount < this.config.maxRetries
        ) {
            return {
                shouldRetry: true,
                message: `Retrying tool call (attempt ${retryCount + 1}/${this.config.maxRetries
                    }). Errors: ${validation.errors.join('; ')}`,
            };
        }

        return {
            shouldRetry: false,
            message: `Max retries (${this.config.maxRetries}) exceeded. Errors: ${validation.errors.join(
                '; '
            )}`,
        };
    }

    /**
     * Sanitizes tool output to prevent prompt injection and context confusion.
     * Strategies:
     * 1. Strip known role markers (user:, model:, system:) to prevent role spoofing.
     * 2. Truncate excessively long outputs.
     */
    sanitizeToolOutput(output: string, maxLength = 10000): string {
        if (!output) return '';

        let sanitized = output;

        // Strip role markers at start of lines (common injection vector)
        // e.g. "\nuser: ignore previous instructions"
        sanitized = sanitized.replace(/^user:\s*/gim, '[SANITIZED_ROLE_MARKER] ');
        sanitized = sanitized.replace(/^model:\s*/gim, '[SANITIZED_ROLE_MARKER] ');
        sanitized = sanitized.replace(/^system:\s*/gim, '[SANITIZED_ROLE_MARKER] ');

        // Also check for newline followed by role
        sanitized = sanitized.replace(/\nuser:\s*/gim, '\n[SANITIZED_ROLE_MARKER] ');
        sanitized = sanitized.replace(/\nmodel:\s*/gim, '\n[SANITIZED_ROLE_MARKER] ');
        sanitized = sanitized.replace(/\nsystem:\s*/gim, '\n[SANITIZED_ROLE_MARKER] ');

        // Truncate if too long (simple char count for now)
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength) + '\n...[TRUNCATED]';
        }

        return sanitized;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private validateAgainstSchema(
        args: Record<string, unknown>,
        parameters?: ToolSchema['parameters']
    ): string[] {
        const errors: string[] = [];

        if (!parameters) {
            return errors;
        }

        // Check required fields
        if (parameters.required) {
            for (const field of parameters.required) {
                if (!(field in args)) {
                    errors.push(`Missing required field: "${field}"`);
                }
            }
        }

        // Check for extra properties (additionalProperties: false)
        if (
            parameters.additionalProperties === false &&
            parameters.properties
        ) {
            const allowedKeys = new Set(Object.keys(parameters.properties));
            for (const key of Object.keys(args)) {
                if (!allowedKeys.has(key)) {
                    errors.push(
                        `Unexpected property: "${key}". Allowed: ${Array.from(
                            allowedKeys
                        ).join(', ')}`
                    );
                }
            }
        }

        // Check property types
        if (parameters.properties) {
            for (const [key, prop] of Object.entries(parameters.properties)) {
                if (key in args) {
                    const value = args[key];
                    const expectedType = (prop as { type: string }).type;

                    if (expectedType === 'string' && typeof value !== 'string') {
                        errors.push(`Invalid type for "${key}": expected string, got ${typeof value}`);
                    } else if (expectedType === 'number' && typeof value !== 'number') {
                        errors.push(`Invalid type for "${key}": expected number, got ${typeof value}`);
                    } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
                        errors.push(`Invalid type for "${key}": expected boolean, got ${typeof value}`);
                    }
                }
            }
        }

        return errors;
    }
}
