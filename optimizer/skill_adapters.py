"""
Skill-specific adapters for cc-mirror State Bridge personas.

- TypeScriptCodeAdapter: For backend-engineer (outputs TypeScript code)
- TestDocAdapter: For qa-engineer (outputs test documentation/specs)
"""

import dspy
import subprocess
import os
import hashlib
from pathlib import Path
from typing import Optional, List
from datetime import datetime


class TypeScriptSignature(dspy.Signature):
    """Signature for TypeScript code generation tasks."""
    story_context = dspy.InputField(desc="The task/story context to implement")
    tech_stack = dspy.InputField(desc="Technology stack (TypeScript, Node.js, etc.)")
    code_output = dspy.OutputField(desc="Generated TypeScript code with proper module structure")
    reasoning = dspy.OutputField(desc="Agent's thought process")


class TestDocSignature(dspy.Signature):
    """Signature for test documentation tasks."""
    story_context = dspy.InputField(desc="The task/story context to create tests for")
    output_format = dspy.InputField(desc="Expected output format (Jest, markdown specs)")
    doc_output = dspy.OutputField(desc="Generated test documentation/specs")
    reasoning = dspy.OutputField(desc="Agent's thought process")


class TypeScriptCodeAdapter(dspy.Module):
    """Adapter for TypeScript code output (backend-engineer)."""
    
    def __init__(
        self,
        gemini_binary: str = "gemini",
        repo_root: Optional[Path] = None,
        timeout_seconds: int = 300,
        base_instruction: str = "",
        demos: List = None
    ):
        super().__init__()
        
        self.gemini_binary = gemini_binary
        self.repo_root = repo_root or Path.cwd()
        self.timeout_seconds = timeout_seconds
        self.demos = demos or []
        
        self.predictor = dspy.Predict(TypeScriptSignature)
        if base_instruction:
            self.predictor.signature = self.predictor.signature.with_instructions(base_instruction)
    
    def forward(
        self,
        story_context: str,
        tech_stack: str = "TypeScript, Node.js, Jest"
    ) -> dspy.Prediction:
        """Execute Gemini with TypeScript output signature."""
        
        rollout_id = self._generate_rollout_id()
        prompt = self._prepare_prompt(story_context, tech_stack)
        
        try:
            result = subprocess.run(
                [self.gemini_binary, "-p", prompt],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            
            code_output = self._extract_code(result.stdout)
            
            return dspy.Prediction(
                code_output=code_output,
                reasoning=self._extract_reasoning(result.stdout)
            )
            
        except Exception as e:
            return dspy.Prediction(
                code_output="",
                reasoning=f"Error: {str(e)}"
            )
    
    def _prepare_prompt(self, story_context: str, tech_stack: str) -> str:
        instructions = self.predictor.signature.instructions or ""
        
        demos_text = ""
        if self.demos:
            demos_text = "\n\n# Golden Examples\n" + "\n---\n".join(self.demos[:2])
        
        prompt = f"""# Instructions
{instructions}

# Technology Stack
{tech_stack}
{demos_text}

# Task
{story_context}

# Expected Output
TypeScript code implementing the requirements:
- Proper interfaces and types
- Error handling with typed errors
- Jest test stubs where appropriate
- JSDoc comments for public APIs
"""
        return prompt
    
    def _extract_code(self, stdout: str) -> str:
        import re
        code_blocks = re.findall(r'```(?:typescript|ts|javascript|js)?\n(.*?)```', stdout, re.DOTALL)
        if code_blocks:
            return "\n\n".join(code_blocks)
        return stdout
    
    def _extract_reasoning(self, stdout: str) -> str:
        import re
        reasoning = re.search(r'## Reasoning\n(.*?)(?=##|$)', stdout, re.DOTALL)
        return reasoning.group(1).strip() if reasoning else ""
    
    def _generate_rollout_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        hash_suffix = hashlib.md5(os.urandom(8)).hexdigest()[:6]
        return f"ts_rollout_{timestamp}_{hash_suffix}"


class TestDocAdapter(dspy.Module):
    """Adapter for test documentation output (qa-engineer)."""
    
    def __init__(
        self,
        gemini_binary: str = "gemini",
        repo_root: Optional[Path] = None,
        timeout_seconds: int = 300,
        base_instruction: str = "",
        demos: List = None
    ):
        super().__init__()
        
        self.gemini_binary = gemini_binary
        self.repo_root = repo_root or Path.cwd()
        self.timeout_seconds = timeout_seconds
        self.demos = demos or []
        
        self.predictor = dspy.Predict(TestDocSignature)
        if base_instruction:
            self.predictor.signature = self.predictor.signature.with_instructions(base_instruction)
    
    def forward(
        self,
        story_context: str,
        tech_stack: str = "Jest test documentation"
    ) -> dspy.Prediction:
        """Execute Gemini with test doc output signature."""
        
        prompt = self._prepare_prompt(story_context)
        
        try:
            result = subprocess.run(
                [self.gemini_binary, "-p", prompt],
                cwd=str(self.repo_root),
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            
            doc_output = result.stdout
            
            return dspy.Prediction(
                code_output=doc_output,
                doc_output=doc_output,
                reasoning=self._extract_reasoning(result.stdout)
            )
            
        except Exception as e:
            return dspy.Prediction(
                code_output="",
                doc_output="",
                reasoning=f"Error: {str(e)}"
            )
    
    def _prepare_prompt(self, story_context: str) -> str:
        instructions = self.predictor.signature.instructions or ""
        
        demos_text = ""
        if self.demos:
            demos_text = "\n\n# Golden Examples\n" + "\n---\n".join(self.demos[:2])
        
        prompt = f"""# Instructions
{instructions}
{demos_text}

# Task
{story_context}

# Expected Output
Test documentation with:
- Test suite structure (describe/it blocks)
- Given/When/Then format for test cases
- Coverage targets and edge cases
- Jest test examples where appropriate
"""
        return prompt
    
    def _extract_reasoning(self, stdout: str) -> str:
        import re
        reasoning = re.search(r'## Reasoning\n(.*?)(?=##|$)', stdout, re.DOTALL)
        return reasoning.group(1).strip() if reasoning else ""


def get_adapter_for_skill(
    skill_name: str,
    gemini_binary: str = "gemini",
    repo_root: Path = None,
    base_instruction: str = "",
    demos: List = None
):
    """Return appropriate adapter based on skill type."""
    if skill_name == 'backend-engineer':
        return TypeScriptCodeAdapter(
            gemini_binary=gemini_binary,
            repo_root=repo_root,
            base_instruction=base_instruction,
            demos=demos
        )
    elif skill_name == 'qa-engineer':
        return TestDocAdapter(
            gemini_binary=gemini_binary,
            repo_root=repo_root,
            base_instruction=base_instruction,
            demos=demos
        )
    else:
        # Default to TypeScript adapter
        return TypeScriptCodeAdapter(
            gemini_binary=gemini_binary,
            repo_root=repo_root,
            base_instruction=base_instruction,
            demos=demos
        )
