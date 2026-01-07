"""
Skill-specific metrics for cc-mirror State Bridge personas.

- TypeScriptMetric: Validates TypeScript code output (backend-engineer)
- TestDocMetric: Validates test documentation (qa-engineer)
"""

import re
from typing import Optional, Any
import dspy


class TypeScriptMetric:
    """Metric for validating TypeScript code output.
    
    Checks:
    1. Has valid TypeScript structure (interfaces, types, exports)
    2. Contains implementation code (functions, classes)
    3. Has proper error handling patterns
    """
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
    
    def __call__(
        self,
        example: dspy.Example,
        prediction: dspy.Prediction,
        trace: Optional[Any] = None
    ) -> float:
        code = getattr(prediction, 'code_output', '')
        
        if not code or not code.strip():
            return self._score_result(0.0, "No content generated")
        
        checks = []
        feedback = []
        
        # Check 1: Has TypeScript keywords (interface, type, export)
        ts_keywords = ['interface', 'type', 'export', 'import', 'async', 'await', 'Promise']
        keyword_count = sum(1 for kw in ts_keywords if kw in code)
        has_ts_syntax = keyword_count >= 2
        checks.append(1.0 if has_ts_syntax else 0.3)
        feedback.append(f"{'✓' if has_ts_syntax else '△'} TypeScript keywords: {keyword_count}")
        
        # Check 2: Has function/class definitions
        has_functions = bool(re.search(r'(function\s+\w+|const\s+\w+\s*=\s*async?\s*\(|class\s+\w+)', code))
        checks.append(1.0 if has_functions else 0.0)
        feedback.append(f"{'✓' if has_functions else '✗'} Functions/classes found")
        
        # Check 3: Has error handling (try/catch or Result types)
        has_error_handling = bool(re.search(r'(try\s*\{|catch\s*\(|Error|throw\s+new)', code))
        checks.append(1.0 if has_error_handling else 0.5)
        feedback.append(f"{'✓' if has_error_handling else '△'} Error handling: {'found' if has_error_handling else 'missing'}")
        
        # Check 4: Has exports
        has_exports = bool(re.search(r'export\s+(default\s+)?(function|const|class|interface|type)', code))
        checks.append(1.0 if has_exports else 0.5)
        feedback.append(f"{'✓' if has_exports else '△'} Exports: {'found' if has_exports else 'missing'}")
        
        score = sum(checks) / len(checks) if checks else 0.0
        return self._score_result(score, "\n".join(feedback))
    
    def _score_result(self, score: float, feedback: str) -> float:
        result = type('Score', (float,), {'feedback': feedback})(score)
        return result


class TestDocMetric:
    """Metric for validating test documentation.
    
    Checks:
    1. Has test structure (describe/it blocks or Given/When/Then)
    2. Contains test-related keywords
    3. Has proper markdown formatting
    """
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
    
    def __call__(
        self,
        example: dspy.Example,
        prediction: dspy.Prediction,
        trace: Optional[Any] = None
    ) -> float:
        code = getattr(prediction, 'code_output', '')
        
        if not code or not code.strip():
            return self._score_result(0.0, "No content generated")
        
        checks = []
        feedback = []
        
        # Check 1: Has test structure (describe/it or Given/When/Then)
        has_test_structure = bool(re.search(
            r'(describe\s*\(|it\s*\(|test\s*\(|Given|When|Then|beforeEach|afterEach)', 
            code, re.IGNORECASE
        ))
        checks.append(1.0 if has_test_structure else 0.0)
        feedback.append(f"{'✓' if has_test_structure else '✗'} Test structure found")
        
        # Check 2: Has test-related keywords
        test_keywords = ['test', 'verify', 'check', 'assert', 'expect', 'mock', 
                        'fixture', 'coverage', 'edge case', 'error', 'should']
        keyword_count = sum(1 for kw in test_keywords if kw.lower() in code.lower())
        has_test_content = keyword_count >= 3
        checks.append(1.0 if has_test_content else 0.5)
        feedback.append(f"{'✓' if has_test_content else '△'} Test keywords: {keyword_count}")
        
        # Check 3: Has markdown headers
        has_headers = bool(re.search(r'^#+\s+\w', code, re.MULTILINE))
        checks.append(1.0 if has_headers else 0.5)
        feedback.append(f"{'✓' if has_headers else '△'} Headers: {'found' if has_headers else 'none'}")
        
        # Check 4: Has lists or code blocks
        has_structure = bool(re.search(r'(^[\s]*[-*]\s+\w|```)', code, re.MULTILINE))
        checks.append(1.0 if has_structure else 0.5)
        feedback.append(f"{'✓' if has_structure else '△'} Lists/code blocks: {'found' if has_structure else 'none'}")
        
        score = sum(checks) / len(checks) if checks else 0.0
        return self._score_result(score, "\n".join(feedback))
    
    def _score_result(self, score: float, feedback: str) -> float:
        result = type('Score', (float,), {'feedback': feedback})(score)
        return result


def get_metric_for_skill(skill_name: str, verbose: bool = False):
    """Return appropriate metric based on skill type."""
    if skill_name == 'backend-engineer':
        return TypeScriptMetric(verbose=verbose)
    elif skill_name == 'qa-engineer':
        return TestDocMetric(verbose=verbose)
    else:
        # Default to TypeScript metric
        return TypeScriptMetric(verbose=verbose)
