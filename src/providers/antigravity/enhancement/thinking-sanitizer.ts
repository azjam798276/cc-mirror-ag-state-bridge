import { ThinkingSanitizerConfig, SanitizedResponse } from './types';

/**
 * ThinkingSanitizer
 * 
 * Responsible for detecting and stripping <thinking> tags from model responses
 * to prevent context pollution and mode confusion.
 */
export class ThinkingSanitizer {
    private config: Required<ThinkingSanitizerConfig>;

    constructor(config: ThinkingSanitizerConfig = {}) {
        this.config = {
            stripThinking: config.stripThinking ?? true,
            logThinking: config.logThinking ?? false
        };
    }

    /**
     * Sanitizes the input text by removing thinking blocks if configured to do so.
     * @param text The raw response text from the model
     * @returns A SanitizedResponse object containing the cleaned content and extracted thinking
     */
    sanitize(text: string): SanitizedResponse {
        if (!text) {
            return { content: '' };
        }

        const thinking = this.extractThinking(text);

        if (!this.config.stripThinking) {
            return { content: text, thinking };
        }

        const cleanContent = this.cleanThinking(text);

        return {
            content: cleanContent,
            thinking: thinking || undefined
        };
    }

    /**
     * Removes content within <thinking> tags.
     * Handles multiline tags and multiple occurrences.
     */
    cleanThinking(text: string): string {
        // Regex to match <thinking>...</thinking> including newlines (s flag dotAll equivalent via [\s\S])
        // We use non-greedy capture *? to handle multiple blocks
        return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
    }

    /**
     * Extracts content within <thinking> tags for logging/debugging.
     * Returns concatenated thinking blocks if multiple exist.
     */
    extractThinking(text: string): string | undefined {
        const matches = text.match(/<thinking>([\s\S]*?)<\/thinking>/gi);

        if (!matches) {
            return undefined;
        }

        // Extract inner content from each match
        const content = matches.map(block => {
            const inner = block.replace(/<\/?thinking>/gi, '');
            return inner.trim();
        }).join('\n\n');

        return content;
    }
}
