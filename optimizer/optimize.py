#!/usr/bin/env python3
"""
CC-Mirror State Bridge Optimizer: Main CLI Entry Point

Runs DSPy optimization on TypeScript CLI projects using the Gemini CLI.
Uses COPRO to autonomously refine adapter.md instructions.
"""

import argparse
import difflib
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Optional

import dspy

from optimizer.skill_adapters import get_adapter_for_skill
from optimizer.skill_metrics import get_metric_for_skill
from optimizer.example_loader import load_examples_from_dir, examples_to_demos


class CLIReflectionLM(dspy.LM):
    """Adapter to use Gemini CLI as a DSPy LM for COPRO reflection.
    
    Handles COPRO's expected JSON format with proposed_instruction field.
    """
    
    def __init__(self, binary_path="gemini", model="gemini-cli", timeout=120):
        super().__init__(model=model)
        self.binary_path = binary_path
        self.timeout = timeout

    def basic_request(self, prompt: str, **kwargs):
        pass

    def __call__(self, prompt=None, messages=None, **kwargs):
        return self.forward(prompt, messages=messages, **kwargs)

    def forward(self, prompt=None, messages=None, **kwargs):
        prompt_str = prompt or ""
        if not prompt_str and messages:
            prompt_str = str(messages[-1]) if isinstance(messages, list) else str(messages)

        # Detect if this is a COPRO instruction generation request
        is_copro_request = "proposed_instruction" in prompt_str.lower() or "instruction" in prompt_str.lower()
        
        try:
            # Add explicit JSON guidance for COPRO requests
            if is_copro_request:
                enhanced_prompt = f"""{prompt_str}

IMPORTANT: You MUST respond with valid JSON containing these fields:
{{
  "proposed_instruction": "Your improved instruction text here",
  "proposed_prefix_for_output_field": ""
}}
Only output the JSON object, nothing else."""
            else:
                enhanced_prompt = prompt_str
            
            cli_args = [self.binary_path, "-p", enhanced_prompt]
            model_env = os.environ.get("GEMINI_MODEL")
            if model_env:
                cli_args.extend(["--model", model_env])
            
            process = subprocess.Popen(
                cli_args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
                text=True
            )
            
            stdout, stderr = process.communicate(timeout=self.timeout)
            content = stdout.strip()
            
            # Try to extract JSON from response
            if content:
                import re
                # Look for JSON in the response
                json_match = re.search(r'\{[^{}]*"proposed_instruction"[^{}]*\}', content, re.DOTALL)
                if json_match:
                    content = json_match.group(0)
                elif is_copro_request:
                    # Generate fallback COPRO response using the output as instruction
                    import json
                    content = json.dumps({
                        "proposed_instruction": content[:2000] if content else "Follow the task requirements.",
                        "proposed_prefix_for_output_field": ""
                    })
            
            if not content:
                # Provide minimal valid COPRO response
                import json
                content = json.dumps({
                    "proposed_instruction": "Follow the task requirements carefully.",
                    "proposed_prefix_for_output_field": ""
                })
            
            return [content]

        except Exception as e:
            print(f"[ERROR] CLI LM Exception: {e}")
            # Return fallback for COPRO
            import json
            return [json.dumps({
                "proposed_instruction": "Follow the task requirements.",
                "proposed_prefix_for_output_field": ""
            })]


def load_baseline_skill(skill_dir: Path) -> tuple[str, str]:
    """Load baseline skill, returning (instruction, target_filename).
    
    Follows the adapter.md pattern:
    - If adapter.md exists, load it (mutable instruction for optimization)
    - Otherwise fall back to SKILL.md content (after frontmatter)
    """
    adapter_path = skill_dir / "adapter.md"
    skill_path = skill_dir / "SKILL.md"
    
    if adapter_path.exists():
        return adapter_path.read_text(), "adapter.md"
    
    if skill_path.exists():
        content = skill_path.read_text()
        import re
        match = re.match(r'^---\s*\n.*?\n---\s*\n(.*)', content, re.DOTALL)
        if match:
            return match.group(1).strip(), "adapter.md"
        return content, "adapter.md"
    
    raise FileNotFoundError(f"Skill not found: {skill_dir}")


def save_optimized_skill(
    instruction: str,
    baseline_instruction: str,
    skill_dir: Path,
    output_dir: Path,
    timestamp: str
) -> None:
    """Save optimized instruction to adapter.md and generate diff."""
    target_path = skill_dir / "adapter.md"
    target_path.write_text(instruction, encoding='utf-8')
    
    # Save version
    versions_dir = output_dir / "skill_versions"
    versions_dir.mkdir(parents=True, exist_ok=True)
    version_file = versions_dir / f"adapter_md_{timestamp}.md"
    version_file.write_text(instruction, encoding='utf-8')
    
    # Generate diff
    diffs_dir = skill_dir / "diffs"
    diffs_dir.mkdir(parents=True, exist_ok=True)
    
    diff = list(difflib.unified_diff(
        baseline_instruction.splitlines(keepends=True),
        instruction.splitlines(keepends=True),
        fromfile="baseline_adapter.md",
        tofile="optimized_adapter.md",
        lineterm=""
    ))
    
    if diff:
        diff_file = diffs_dir / f"run_{timestamp}.diff"
        diff_file.write_text("".join(diff), encoding='utf-8')
        print(f"[INFO] Diff saved to {diff_file}")
    
    print(f"[INFO] Optimized skill saved to {target_path}")


def load_stories(stories_dir: Path, category: Optional[str] = None) -> List[dict]:
    """Load stories from directory."""
    stories = []
    
    if category:
        search_dirs = [stories_dir / category]
    else:
        search_dirs = [d for d in stories_dir.iterdir() if d.is_dir()]
    
    for dir_path in search_dirs:
        if not dir_path.exists():
            continue
        for story_path in dir_path.glob("*.story.md"):
            stories.append({
                'path': story_path,
                'category': dir_path.name,
                'content': story_path.read_text()
            })
    
    return stories


def run_optimization(
    skill_name: str,
    category: str,
    repo_root: Path,
    max_rollouts: int,
    output_dir: Path,
    gemini_binary: str = "gemini",
    verbose: bool = False
):
    """Run COPRO optimization loop for a skill."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Load skill - uses adapter.md pattern
    skill_dir = repo_root / "skills" / skill_name
    baseline_content, target_file = load_baseline_skill(skill_dir)
    print(f"[INFO] Loaded {target_file} for skill '{skill_name}' ({len(baseline_content)} chars)")
    
    # Load stories for category
    stories_dir = repo_root / "stories"
    stories = load_stories(stories_dir, category)
    
    if not stories:
        print(f"[ERROR] No stories found for category: {category}")
        return None
    
    # Load golden examples - map story category to example category
    category_map = {
        'state-bridge': 'backend',
        'oauth': 'security',
        'cli': 'backend',
        'translation': 'backend'
    }
    example_category = category_map.get(category, 'backend')
    
    examples_dir = repo_root / "golden-examples"
    examples = load_examples_from_dir(examples_dir, example_category)
    demos = examples_to_demos(examples[:3])
    
    print(f"[INFO] Loaded {len(stories)} stories and {len(examples)} examples for {category}->{example_category}")
    
    # Initialize LM for reflection
    if "GEMINI_API_KEY" in os.environ and os.environ["GEMINI_API_KEY"]:
        model = os.environ.get("GEMINI_MODEL", "gemini/gemini-2.0-flash")
        print(f"[INFO] Using Gemini API: {model}")
        lm = dspy.LM(model)
    else:
        print(f"[INFO] Using CLI LM via '{gemini_binary}'")
        lm = CLIReflectionLM(binary_path=gemini_binary)
    
    dspy.settings.configure(lm=lm)
    
    # Initialize skill-specific adapter
    adapter = get_adapter_for_skill(
        skill_name=skill_name,
        gemini_binary=gemini_binary,
        repo_root=repo_root,
        base_instruction=baseline_content,
        demos=demos
    )
    adapter.predictor.signature.instructions = baseline_content
    print(f"[INFO] Using adapter: {type(adapter).__name__}")
    
    # Initialize skill-specific metric
    metric = get_metric_for_skill(skill_name, verbose=verbose)
    print(f"[INFO] Using metric: {type(metric).__name__}")
    
    # Create training examples
    trainset = []
    for story in stories:
        example = dspy.Example(
            story_context=story['content'],
            tech_stack="TypeScript, Node.js, Jest"
        ).with_inputs('story_context', 'tech_stack')
        trainset.append(example)
    
    # Initialize optimizer (COPRO)
    optimizer = None
    optimizer_name = "None"
    
    try:
        from dspy.teleprompt import COPRO
        optimizer = COPRO(
            metric=metric,
            breadth=3,
            depth=2,
            verbose=verbose
        )
        optimizer_name = "COPRO"
    except ImportError:
        print("[ERROR] COPRO not available in DSPy installation")
        return None
    
    print(f"\n[INFO] Starting optimization with {optimizer_name} ({max_rollouts} runs)...")
    print(f"[INFO] Skill: {skill_name}")
    print(f"[INFO] Category: {category}")
    print("-" * 50)
    
    try:
        # Run optimization - COPRO will mutate adapter.predictor.signature.instructions
        optimized_adapter = optimizer.compile(
            adapter,
            trainset=trainset[:max_rollouts],
            eval_kwargs={}
        )
        
        # Extract the evolved instruction
        final_instruction = optimized_adapter.predictor.signature.instructions
        
        # Check if instruction was actually changed
        if final_instruction != baseline_content:
            print(f"\n[SUCCESS] Instruction evolved! ({len(final_instruction)} chars)")
            
            # Save optimized adapter.md
            save_optimized_skill(
                instruction=final_instruction,
                baseline_instruction=baseline_content,
                skill_dir=skill_dir,
                output_dir=output_dir,
                timestamp=timestamp
            )
        else:
            print("\n[INFO] Instruction unchanged (baseline optimal)")
        
        # Save results
        output_dir.mkdir(parents=True, exist_ok=True)
        results_path = output_dir / f"optimization_{skill_name}_{timestamp}.json"
        
        summary = {
            'skill': skill_name,
            'category': category,
            'optimizer': optimizer_name,
            'baseline_chars': len(baseline_content),
            'optimized_chars': len(final_instruction),
            'changed': final_instruction != baseline_content,
            'timestamp': timestamp
        }
        
        results_path.write_text(json.dumps(summary, indent=2))
        print(f"[INFO] Results saved to: {results_path}")
        
        return summary
        
    except Exception as e:
        print(f"[ERROR] Optimization failed: {e}")
        import traceback
        traceback.print_exc()
        raise


def main():
    parser = argparse.ArgumentParser(
        description="CC-Mirror State Bridge Optimizer: DSPy optimization for TypeScript CLI projects"
    )
    parser.add_argument(
        "--skill", "-s",
        required=True,
        help="Skill name (backend-engineer, qa-engineer)"
    )
    parser.add_argument(
        "--category", "-c",
        required=True,
        choices=['state-bridge', 'oauth', 'cli', 'translation'],
        help="Story category to optimize against"
    )
    parser.add_argument(
        "--repo-root", "-r",
        type=Path,
        default=Path(__file__).parent.parent,
        help="Repository root directory"
    )
    parser.add_argument(
        "--rollouts", "-n",
        type=int,
        default=10,
        help="Maximum number of rollouts (default: 10)"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=Path("optimization_results"),
        help="Output directory for results"
    )
    parser.add_argument(
        "--gemini-binary",
        default="gemini",
        help="Path to Gemini CLI binary"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate setup without running optimization"
    )
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("Dry run: validating setup...")
        skill_dir = args.repo_root / "skills" / args.skill
        adapter_path = skill_dir / "adapter.md"
        skill_path = skill_dir / "SKILL.md"
        
        if adapter_path.exists():
            print(f"✓ adapter.md found: {adapter_path} (mutable)")
        elif skill_path.exists():
            print(f"✓ SKILL.md found: {skill_path} (will create adapter.md)")
        else:
            print(f"✗ No skill found in: {skill_dir}")
            sys.exit(1)
        
        stories = load_stories(args.repo_root / "stories", args.category)
        print(f"✓ Found {len(stories)} stories in {args.category}")
        
        category_map = {
            'state-bridge': 'backend',
            'oauth': 'security',
            'cli': 'backend',
            'translation': 'backend'
        }
        example_category = category_map.get(args.category, 'backend')
        
        examples = load_examples_from_dir(
            args.repo_root / "golden-examples", example_category
        )
        print(f"✓ Found {len(examples)} golden examples in {example_category}")
        
        print("\nDry run complete. Ready to optimize.")
        return
    
    run_optimization(
        skill_name=args.skill,
        category=args.category,
        repo_root=args.repo_root,
        max_rollouts=args.rollouts,
        output_dir=args.output.resolve(),
        gemini_binary=args.gemini_binary,
        verbose=args.verbose
    )


if __name__ == "__main__":
    main()
