"""
Example Loader for cc-mirror State Bridge

Maps stories to golden examples by category.
Loads examples from golden-examples/{category}/ directory.
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Optional
import dspy


def parse_frontmatter(content: str) -> Dict[str, str]:
    """Parse YAML frontmatter from markdown file."""
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if not match:
        return {}
    
    frontmatter = {}
    for line in match.group(1).split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip().strip('"\'')
    
    return frontmatter


def load_examples_from_dir(
    examples_dir: Path,
    category: Optional[str] = None,
    story_id: Optional[str] = None
) -> List[dspy.Example]:
    """Load golden examples from directory.
    
    Args:
        examples_dir: Root directory containing category subdirectories
        category: Filter by category (backend, qa, security, devops)
        story_id: Filter by specific story ID
    
    Returns:
        List of dspy.Example objects
    """
    examples_dir = Path(examples_dir)
    examples = []
    
    # Determine directories to search
    if category:
        search_dirs = [examples_dir / category]
    else:
        search_dirs = [d for d in examples_dir.iterdir() if d.is_dir()]
    
    for dir_path in search_dirs:
        if not dir_path.exists():
            continue
        
        for file_path in dir_path.glob("*.example.md"):
            content = file_path.read_text()
            frontmatter = parse_frontmatter(content)
            
            # Filter by story_id if specified
            if story_id and frontmatter.get('id', '') != story_id:
                continue
            
            # Extract problem and solution sections
            problem = extract_section(content, "Problem")
            solution = extract_section(content, "Solution")
            key_techniques = extract_section(content, "Key Techniques")
            
            example = dspy.Example(
                id=frontmatter.get('id', file_path.stem),
                category=dir_path.name,
                source_story=frontmatter.get('source_story', ''),
                tags=frontmatter.get('tags', ''),
                problem=problem,
                solution=solution,
                key_techniques=key_techniques,
                full_content=content
            ).with_inputs('problem')
            
            examples.append(example)
    
    return examples


def extract_section(content: str, section_name: str) -> str:
    """Extract a markdown section by header name."""
    pattern = rf'## {section_name}\s*\n(.*?)(?=\n## |\Z)'
    match = re.search(pattern, content, re.DOTALL)
    return match.group(1).strip() if match else ""


def load_story_example_pairs(
    stories_dir: Path,
    examples_dir: Path
) -> List[Dict[str, str]]:
    """Load paired story + golden example for training."""
    pairs = []
    stories_dir = Path(stories_dir)
    examples_dir = Path(examples_dir)
    
    # cc-mirror categories
    story_categories = ['state-bridge', 'oauth', 'cli', 'translation']
    example_categories = ['backend', 'qa', 'security', 'devops']
    
    for story_cat in story_categories:
        story_cat_dir = stories_dir / story_cat
        if not story_cat_dir.exists():
            continue
        
        for story_path in story_cat_dir.glob("*.story.md"):
            story_content = story_path.read_text()
            story_id = story_path.stem.replace('.story', '')
            
            # Try to find matching example in any example category
            for ex_cat in example_categories:
                example_cat_dir = examples_dir / ex_cat
                if not example_cat_dir.exists():
                    continue
                
                for example_path in example_cat_dir.glob("*.example.md"):
                    pairs.append({
                        'story_id': story_id,
                        'story_category': story_cat,
                        'example_category': ex_cat,
                        'story_path': str(story_path),
                        'example_path': str(example_path),
                        'story_content': story_content,
                        'example_content': example_path.read_text()
                    })
                    break  # One example per story for now
    
    return pairs


def examples_to_demos(examples: List[dspy.Example]) -> List[str]:
    """Convert examples to demo strings for few-shot prompting."""
    demos = []
    for ex in examples:
        demo = f"## Problem\n{ex.problem}\n\n## Solution\n{ex.solution}"
        if ex.key_techniques:
            demo += f"\n\n## Key Techniques\n{ex.key_techniques}"
        demos.append(demo)
    return demos
