/**
 * SessionParser - Parse AG session JSON files
 * Based on TDD v1.0 Module 2 specification
 */

import * as fs from 'fs-extra';
import { ParsedSession, PlanStep, FormatDetector, SessionParseError } from './types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export class SessionParser {
    private formatDetectors: FormatDetector[] = [];

    constructor() {
        // Register built-in format detectors
        this.formatDetectors.push(new V1FormatDetector());
        this.formatDetectors.push(new V2FormatDetector());
        this.formatDetectors.push(new GenericFormatDetector());
    }

    async parse(filePath: string): Promise<ParsedSession> {
        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size > MAX_FILE_SIZE) {
            throw new SessionParseError(`File exceeds 50MB limit: ${stats.size} bytes`, filePath);
        }

        // Read and parse JSON
        let raw: any;
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            raw = JSON.parse(content);
        } catch (e: any) {
            throw new SessionParseError(`Failed to parse JSON: ${e.message}`, filePath);
        }

        // Try each format detector
        for (const detector of this.formatDetectors) {
            if (detector.canParse(raw)) {
                return detector.parse(raw);
            }
        }

        // Should never reach here since GenericFormatDetector always returns true
        throw new SessionParseError('No format detector could parse the session', filePath);
    }

    registerFormat(detector: FormatDetector): void {
        // Insert before generic detector
        this.formatDetectors.splice(this.formatDetectors.length - 1, 0, detector);
    }
}

class V1FormatDetector implements FormatDetector {
    canParse(obj: any): boolean {
        return obj.hasOwnProperty('initialPrompt') && obj.hasOwnProperty('plan');
    }

    parse(obj: any): ParsedSession {
        const planSteps: PlanStep[] = (obj.plan || []).map((step: any) => ({
            id: step.id || step.stepId || '',
            action: step.description || step.action || '',
            status: this.normalizeStatus(step.status),
            artifacts: step.files || step.artifacts || []
        }));

        const completedSteps = planSteps.filter(s => s.status === 'completed');
        const pendingSteps = planSteps.filter(s => s.status !== 'completed');

        return {
            sessionId: obj.sessionId || 'unknown',
            goal: obj.initialPrompt || obj.goal || 'Unknown goal',
            planSteps,
            currentStep: obj.currentStepIndex || 0,
            completedSteps,
            pendingSteps,
            filesModified: this.extractFiles(obj),
            variables: obj.state?.variables || obj.variables || {}
        };
    }

    private normalizeStatus(status: string): PlanStep['status'] {
        const statusMap: Record<string, PlanStep['status']> = {
            'completed': 'completed',
            'done': 'completed',
            'executing': 'executing',
            'in_progress': 'executing',
            'pending': 'pending',
            'failed': 'failed'
        };
        return statusMap[status?.toLowerCase()] || 'pending';
    }

    private extractFiles(obj: any): string[] {
        const files: string[] = [];
        for (const step of obj.plan || []) {
            if (step.files) files.push(...step.files);
            if (step.artifacts) files.push(...step.artifacts);
        }
        return [...new Set(files)];
    }
}

class V2FormatDetector implements FormatDetector {
    canParse(obj: any): boolean {
        return obj.hasOwnProperty('goal') && obj.hasOwnProperty('steps') && obj.hasOwnProperty('execution');
    }

    parse(obj: any): ParsedSession {
        const planSteps: PlanStep[] = (obj.steps || []).map((step: any) => ({
            id: step.stepId || step.id || '',
            action: step.action || step.description || '',
            status: this.normalizePhase(step.phase),
            artifacts: step.artifacts || []
        }));

        const completed = obj.execution?.completed || [];
        const completedSteps = planSteps.filter(s => completed.includes(s.id) || s.status === 'completed');
        const pendingSteps = planSteps.filter(s => !completed.includes(s.id) && s.status !== 'completed');

        return {
            sessionId: obj.sessionId || 'unknown',
            goal: obj.goal || 'Unknown goal',
            planSteps,
            currentStep: planSteps.findIndex(s => s.id === obj.execution?.current) || 0,
            completedSteps,
            pendingSteps,
            filesModified: obj.filesModified || [],
            variables: obj.variables || {}
        };
    }

    private normalizePhase(phase: string): PlanStep['status'] {
        const phaseMap: Record<string, PlanStep['status']> = {
            'done': 'completed',
            'completed': 'completed',
            'running': 'executing',
            'pending': 'pending',
            'failed': 'failed'
        };
        return phaseMap[phase?.toLowerCase()] || 'pending';
    }
}

class GenericFormatDetector implements FormatDetector {
    canParse(_obj: any): boolean {
        return true; // Always true as fallback
    }

    parse(obj: any): ParsedSession {
        return {
            sessionId: 'unknown',
            goal: this.findGoal(obj),
            planSteps: this.findSteps(obj),
            currentStep: 0,
            completedSteps: [],
            pendingSteps: [],
            filesModified: this.findFiles(obj),
            variables: obj.variables || {}
        };
    }

    private findGoal(obj: any, depth = 0): string {
        if (depth > 3) return 'Unknown goal';

        const goalKeys = ['goal', 'task', 'prompt', 'initialPrompt', 'request', 'objective'];
        for (const key of goalKeys) {
            if (obj[key] && typeof obj[key] === 'string') {
                return obj[key];
            }
        }

        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                const result = this.findGoal(value, depth + 1);
                if (result !== 'Unknown goal') return result;
            }
        }

        return 'Unknown goal';
    }

    private findSteps(obj: any): PlanStep[] {
        const stepKeys = ['steps', 'plan', 'actions', 'tasks'];
        for (const key of stepKeys) {
            if (Array.isArray(obj[key])) {
                return obj[key].map((item: any, i: number) => ({
                    id: item.id || item.stepId || `step-${i}`,
                    action: item.action || item.description || item.name || String(item),
                    status: item.done || item.completed ? 'completed' : 'pending',
                    artifacts: item.files || item.artifacts || []
                }));
            }
        }
        return [];
    }

    private findFiles(obj: any, depth = 0): string[] {
        if (depth > 3) return [];

        const fileKeys = ['files', 'filesModified', 'modified', 'artifacts'];
        for (const key of fileKeys) {
            if (Array.isArray(obj[key])) {
                return obj[key].filter((f: any) => typeof f === 'string');
            }
        }

        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                const result = this.findFiles(value, depth + 1);
                if (result.length > 0) return result;
            }
        }

        return [];
    }
}

export { ParsedSession, SessionParseError };
