/**
 * ContextInjector - Build context messages from parsed sessions
 */

import { ParsedSession, Message } from './types';
import { SecurityUtils } from './security-utils';

const MAX_CONTEXT_CHARS = 50000;

export class ContextInjector {
    buildContextMessage(session: ParsedSession): string {
        const MAX_GOAL_LENGTH = 5000;
        const MAX_FILES_SHOWN = 50;

        const header = '# 🔄 CONTINUING FROM ANTIGRAVITY SESSION\n\n';

        let staleWarning = '';
        if (session.timestamp) {
            const ageHours = (Date.now() - session.timestamp.getTime()) / (1000 * 60 * 60);
            if (ageHours > 24) {
                staleWarning = `> ⚠️ **Note:** This session is ${Math.floor(ageHours)} hours old. Context may be outdated.\n\n`;
            }
        }

        let goalText = SecurityUtils.scrub(session.goal || '');
        if (goalText.length > MAX_GOAL_LENGTH) {
            goalText = goalText.substring(0, MAX_GOAL_LENGTH) + '... (truncated)';
        }
        const goalSection = `## Original Goal\n${goalText}\n\n`;

        let filesSection = '';
        if (session.filesModified && session.filesModified.length > 0) {
            const files = session.filesModified.slice(0, MAX_FILES_SHOWN);
            filesSection = '## Files Modified by Antigravity\n' +
                files.map(f => `- ${f}`).join('\n') + '\n';
            if (session.filesModified.length > MAX_FILES_SHOWN) {
                filesSection += `... and ${session.filesModified.length - MAX_FILES_SHOWN} more files.\n`;
            }
            filesSection += '\n';
        }

        let variablesSection = '';
        if (session.variables && Object.keys(session.variables).length > 0) {
            variablesSection = '## Session Variables\n```json\n' +
                SecurityUtils.scrub(JSON.stringify(session.variables, null, 2)) +
                '\n```\n\n';
        }

        const footer = '## Your Task\nContinue from where Antigravity left off. Review the context above and proceed with the user\'s request.\n';

        const fixedContentSize = header.length + staleWarning.length + goalSection.length + filesSection.length + variablesSection.length + footer.length;
        const availableBudget = MAX_CONTEXT_CHARS - fixedContentSize - 500;

        const completedCount = session.completedSteps ? session.completedSteps.length : 0;
        const totalCount = session.planSteps ? session.planSteps.length : 0;
        const progressSection = `## Progress: ${completedCount}/${totalCount} steps completed\n\n`;

        const combinedSteps: string[] = [];
        if (session.completedSteps) {
            session.completedSteps.forEach((s, i) => combinedSteps.push(`${i + 1}. ✅ ${s.action}`));
        }
        if (session.pendingSteps) {
            session.pendingSteps.forEach((s, i) => combinedSteps.push(`${completedCount + i + 1}. ${i === 0 ? '🔄' : '⧗'} ${s.action}`));
        }

        let stepsContent = '';
        if (combinedSteps.length > 0) {
            const chosenSteps: string[] = [];
            let currentStepsSize = 0;
            let truncatedAtStart = 0;

            for (let i = combinedSteps.length - 1; i >= 0; i--) {
                const stepLine = combinedSteps[i] + '\n';
                if (currentStepsSize + stepLine.length < availableBudget) {
                    chosenSteps.unshift(stepLine);
                    currentStepsSize += stepLine.length;
                } else {
                    truncatedAtStart = i + 1;
                    break;
                }
            }

            stepsContent = '## Recent Steps\n';
            if (truncatedAtStart > 0) {
                stepsContent += `(${truncatedAtStart} earlier steps omitted for brevity)\n\n`;
            }
            stepsContent += chosenSteps.join('') + '\n';
        }

        const finalMessage = header + staleWarning + goalSection + progressSection + stepsContent + variablesSection + filesSection + footer;

        if (finalMessage.length > MAX_CONTEXT_CHARS) {
            return finalMessage.substring(0, MAX_CONTEXT_CHARS - 50) + '\n... (truncated to fit model budget)';
        }

        return finalMessage;
    }

    injectContext(messages: Message[], session: ParsedSession): Message[] {
        const contextMsg: Message = {
            role: 'system',
            content: this.buildContextMessage(session),
            metadata: {
                source: 'antigravity-session',
                sessionId: session.sessionId,
                injectedAt: new Date().toISOString()
            }
        };

        return [contextMsg, ...messages];
    }
}

export { ParsedSession, Message };
