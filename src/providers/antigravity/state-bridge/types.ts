/**
 * State Bridge Types
 * Based on TDD v1.0 specifications
 */

export interface AGSessionMetadata {
    sessionId: string;
    filePath: string;
    timestamp: Date;
    sizeBytes: number;
    ageString?: string;
}

export interface ParsedSession {
    sessionId: string;
    goal: string;
    planSteps: PlanStep[];
    currentStep: number;
    completedSteps: PlanStep[];
    pendingSteps: PlanStep[];
    filesModified: string[];
    variables: Record<string, any>;
    timestamp?: Date;
}

export interface PlanStep {
    id: string;
    action: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    artifacts?: string[];
    output?: string;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: {
        source?: string;
        sessionId?: string;
        injectedAt?: string;
    };
}

export interface FormatDetector {
    canParse(obj: any): boolean;
    parse(obj: any): ParsedSession;
}

export class SessionParseError extends Error {
    constructor(message: string, public readonly filePath?: string) {
        super(message);
        this.name = 'SessionParseError';
    }
}

export class SessionNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionNotFoundError';
    }
}
