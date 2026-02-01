// src/services/CodeFeatureExtractor.ts

import { CodeFeatures, FileMetrics } from '../types';
import { LanguageDetector } from '../utils/languageDetector';
import { Logger } from '../utils/logger';

/**
 * Version of the feature extraction algorithm
 * Increment when extraction logic changes significantly
 */
const EXTRACTION_VERSION = '1.0.0';

/**
 * Language-specific comment patterns
 */
interface CommentPatterns {
  singleLine: RegExp[];
  blockStart: RegExp;
  blockEnd: RegExp;
  docstring?: RegExp;
}

const COMMENT_PATTERNS: Record<string, CommentPatterns> = {
  default: {
    singleLine: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//
  },
  python: {
    singleLine: [/^\s*#/],
    blockStart: /'''/,
    blockEnd: /'''/,
    docstring: /^\s*"""/
  },
  ruby: {
    singleLine: [/^\s*#/],
    blockStart: /=begin/,
    blockEnd: /=end/
  },
  html: {
    singleLine: [],
    blockStart: /<!--/,
    blockEnd: /-->/
  },
  css: {
    singleLine: [],
    blockStart: /\/\*/,
    blockEnd: /\*\//
  },
  shell: {
    singleLine: [/^\s*#/],
    blockStart: /: '/,
    blockEnd: /'/
  }
};

/**
 * Language-specific patterns for code structure detection
 */
const FUNCTION_PATTERNS: Record<string, RegExp[]> = {
  default: [
    /function\s+\w+/,
    /\w+\s*=\s*function/,
    /\w+\s*=\s*\([^)]*\)\s*=>/,
    /\w+\s*:\s*function/
  ],
  python: [
    /^\s*def\s+\w+/,
    /^\s*async\s+def\s+\w+/
  ],
  java: [
    /\b(public|private|protected|static)?\s*(void|int|String|boolean|\w+)\s+\w+\s*\(/
  ],
  csharp: [
    /\b(public|private|protected|internal|static)?\s*(void|int|string|bool|\w+)\s+\w+\s*\(/
  ],
  go: [
    /^\s*func\s+(\([^)]+\)\s*)?\w+/
  ],
  rust: [
    /^\s*(pub\s+)?fn\s+\w+/
  ],
  ruby: [
    /^\s*def\s+\w+/
  ]
};

const CLASS_PATTERNS: Record<string, RegExp[]> = {
  default: [
    /\bclass\s+\w+/
  ],
  python: [
    /^\s*class\s+\w+/
  ],
  java: [
    /\b(public|private|protected)?\s*class\s+\w+/,
    /\binterface\s+\w+/
  ],
  go: [
    /^\s*type\s+\w+\s+struct/
  ],
  rust: [
    /^\s*(pub\s+)?struct\s+\w+/,
    /^\s*(pub\s+)?enum\s+\w+/
  ]
};

const IMPORT_PATTERNS: Record<string, RegExp[]> = {
  default: [
    /^\s*import\s+/,
    /^\s*from\s+.+\s+import/,
    /\brequire\s*\(/
  ],
  python: [
    /^\s*import\s+/,
    /^\s*from\s+.+\s+import/
  ],
  java: [
    /^\s*import\s+/,
    /^\s*package\s+/
  ],
  go: [
    /^\s*import\s+/
  ],
  rust: [
    /^\s*use\s+/,
    /^\s*extern\s+crate/
  ],
  csharp: [
    /^\s*using\s+/
  ]
};

/**
 * Control flow keywords for complexity estimation
 */
const CONTROL_FLOW_KEYWORDS = [
  'if', 'else', 'elif', 'for', 'while', 'switch', 'case',
  'try', 'catch', 'except', 'finally', 'with', 'match',
  '&&', '||', '?', '??'
];

/**
 * CodeFeatureExtractor - Extracts privacy-safe features from code
 *
 * IMPORTANT: This service processes code TEMPORARILY in memory.
 * The raw code is NEVER stored - only the extracted features are returned.
 */
export class CodeFeatureExtractor {

  /**
   * Extract features from code content
   *
   * @param code - The raw code content (processed in memory, not stored)
   * @param filePath - Path to the file (for language detection)
   * @param trackingMetrics - Optional behavioral metrics from tracking
   * @returns CodeFeatures object (privacy-safe, no raw code)
   */
  static extract(
    code: string,
    filePath: string,
    trackingMetrics?: FileMetrics
  ): CodeFeatures {
    Logger.debug(`Extracting features from ${filePath}`);

    const language = LanguageDetector.detectLanguage(filePath);
    const extension = LanguageDetector.getExtension(filePath);
    const lines = code.split('\n');

    // Get language-specific patterns
    const langKey = this.getLanguageKey(language);

    // Extract all features
    const basicMetrics = this.extractBasicMetrics(lines, langKey);
    const structuralMetrics = this.extractStructuralMetrics(lines);
    const commentMetrics = this.extractCommentMetrics(lines, langKey, basicMetrics.codeLines);
    const codeStructure = this.extractCodeStructure(lines, langKey);
    const complexityMetrics = this.extractComplexityMetrics(lines);
    const namingMetrics = this.extractNamingMetrics(code, langKey);
    const qualityMetrics = this.extractQualityMetrics(lines);
    const temporalMetrics = this.extractTemporalMetrics(trackingMetrics);

    const features: CodeFeatures = {
      // Basic metrics
      ...basicMetrics,

      // Structural metrics
      ...structuralMetrics,

      // Comment metrics
      ...commentMetrics,

      // Code structure
      ...codeStructure,

      // Complexity
      ...complexityMetrics,

      // Naming patterns
      ...namingMetrics,

      // Quality indicators
      ...qualityMetrics,

      // Temporal features
      ...temporalMetrics,

      // Metadata
      language,
      fileExtension: extension,
      extractionTimestamp: Date.now(),
      extractionVersion: EXTRACTION_VERSION
    };

    Logger.debug(`Features extracted for ${filePath}`, {
      totalLines: features.totalLines,
      codeLines: features.codeLines,
      complexity: features.cyclomaticComplexity
    });

    // CODE IS NOT STORED - only features are returned
    return features;
  }

  /**
   * Get language key for pattern lookup
   */
  private static getLanguageKey(language: string): string {
    const langLower = language.toLowerCase();

    if (langLower.includes('python')) return 'python';
    if (langLower.includes('java') && !langLower.includes('javascript')) return 'java';
    if (langLower.includes('c#')) return 'csharp';
    if (langLower.includes('go')) return 'go';
    if (langLower.includes('rust')) return 'rust';
    if (langLower.includes('ruby')) return 'ruby';
    if (langLower.includes('html')) return 'html';
    if (langLower.includes('css') || langLower.includes('scss') || langLower.includes('sass')) return 'css';
    if (langLower.includes('shell') || langLower.includes('bash')) return 'shell';

    return 'default';
  }

  /**
   * Extract basic line metrics
   */
  private static extractBasicMetrics(
    lines: string[],
    langKey: string
  ): Pick<CodeFeatures, 'totalLines' | 'codeLines' | 'commentLines' | 'blankLines'> {
    const patterns = COMMENT_PATTERNS[langKey] || COMMENT_PATTERNS.default;

    let blankLines = 0;
    let commentLines = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Blank line
      if (trimmed.length === 0) {
        blankLines++;
        continue;
      }

      // Check block comment state
      if (inBlockComment) {
        commentLines++;
        if (patterns.blockEnd.test(trimmed)) {
          inBlockComment = false;
        }
        continue;
      }

      // Check for block comment start
      if (patterns.blockStart.test(trimmed)) {
        commentLines++;
        if (!patterns.blockEnd.test(trimmed.replace(patterns.blockStart, ''))) {
          inBlockComment = true;
        }
        continue;
      }

      // Check for single-line comment
      const isSingleLineComment = patterns.singleLine.some(p => p.test(trimmed));
      if (isSingleLineComment) {
        commentLines++;
        continue;
      }
    }

    const totalLines = lines.length;
    const codeLines = totalLines - blankLines - commentLines;

    return {
      totalLines,
      codeLines: Math.max(0, codeLines),
      commentLines,
      blankLines
    };
  }

  /**
   * Extract structural metrics
   */
  private static extractStructuralMetrics(
    lines: string[]
  ): Pick<CodeFeatures, 'averageLineLength' | 'maxLineLength' | 'indentationConsistency' | 'indentationStyle' | 'indentationSize'> {
    // Line length metrics
    const lineLengths = lines.map(l => l.length);
    const avgLength = lineLengths.length > 0
      ? lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length
      : 0;
    const maxLength = Math.max(...lineLengths, 0);

    // Indentation analysis
    const indentedLines = lines.filter(l => l.length > 0 && /^\s+/.test(l));
    let tabCount = 0;
    let spaceCount = 0;
    const indentSizes: number[] = [];

    for (const line of indentedLines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        const indent = match[1];
        if (indent.includes('\t')) {
          tabCount++;
        } else {
          spaceCount++;
          indentSizes.push(indent.length);
        }
      }
    }

    // Determine indentation style
    let indentationStyle: 'spaces' | 'tabs' | 'mixed' = 'spaces';
    if (tabCount > 0 && spaceCount > 0) {
      indentationStyle = 'mixed';
    } else if (tabCount > spaceCount) {
      indentationStyle = 'tabs';
    }

    // Calculate indentation size (most common)
    let indentationSize = 2;
    if (indentSizes.length > 0) {
      // Find GCD of indent sizes for base indent
      const minIndent = Math.min(...indentSizes.filter(s => s > 0));
      indentationSize = minIndent > 0 ? Math.min(minIndent, 8) : 2;
    }

    // Calculate indentation consistency
    let consistentIndents = 0;
    for (const size of indentSizes) {
      if (size % indentationSize === 0) {
        consistentIndents++;
      }
    }
    const indentationConsistency = indentSizes.length > 0
      ? consistentIndents / indentSizes.length
      : 1;

    return {
      averageLineLength: Math.round(avgLength * 100) / 100,
      maxLineLength: maxLength,
      indentationConsistency: Math.round(indentationConsistency * 100) / 100,
      indentationStyle,
      indentationSize
    };
  }

  /**
   * Extract comment-related metrics
   */
  private static extractCommentMetrics(
    lines: string[],
    langKey: string,
    codeLines: number
  ): Pick<CodeFeatures, 'commentDensity' | 'blockCommentCount' | 'inlineCommentCount' | 'docstringCount'> {
    const patterns = COMMENT_PATTERNS[langKey] || COMMENT_PATTERNS.default;

    let blockCommentCount = 0;
    let inlineCommentCount = 0;
    let docstringCount = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (inBlockComment) {
        if (patterns.blockEnd.test(trimmed)) {
          inBlockComment = false;
        }
        continue;
      }

      // Check for docstrings (Python)
      if (patterns.docstring && patterns.docstring.test(trimmed)) {
        docstringCount++;
        continue;
      }

      // Check for block comment start
      if (patterns.blockStart.test(trimmed)) {
        blockCommentCount++;
        if (!patterns.blockEnd.test(trimmed.replace(patterns.blockStart, ''))) {
          inBlockComment = true;
        }
        continue;
      }

      // Check for single-line/inline comments
      const hasInlineComment = patterns.singleLine.some(p => p.test(trimmed));
      if (hasInlineComment) {
        inlineCommentCount++;
      }
    }

    const totalComments = blockCommentCount + inlineCommentCount + docstringCount;
    const commentDensity = codeLines > 0 ? totalComments / codeLines : 0;

    return {
      commentDensity: Math.round(commentDensity * 100) / 100,
      blockCommentCount,
      inlineCommentCount,
      docstringCount
    };
  }

  /**
   * Extract code structure metrics
   */
  private static extractCodeStructure(
    lines: string[],
    langKey: string
  ): Pick<CodeFeatures, 'functionCount' | 'classCount' | 'importCount'> {
    const functionPatterns = FUNCTION_PATTERNS[langKey] || FUNCTION_PATTERNS.default;
    const classPatterns = CLASS_PATTERNS[langKey] || CLASS_PATTERNS.default;
    const importPatterns = IMPORT_PATTERNS[langKey] || IMPORT_PATTERNS.default;

    let functionCount = 0;
    let classCount = 0;
    let importCount = 0;

    for (const line of lines) {
      // Count functions
      if (functionPatterns.some(p => p.test(line))) {
        functionCount++;
      }

      // Count classes
      if (classPatterns.some(p => p.test(line))) {
        classCount++;
      }

      // Count imports
      if (importPatterns.some(p => p.test(line))) {
        importCount++;
      }
    }

    return {
      functionCount,
      classCount,
      importCount
    };
  }

  /**
   * Extract complexity metrics
   */
  private static extractComplexityMetrics(
    lines: string[]
  ): Pick<CodeFeatures, 'cyclomaticComplexity' | 'nestingDepth'> {
    let complexity = 1; // Base complexity
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Count control flow keywords
      for (const keyword of CONTROL_FLOW_KEYWORDS) {
        // Use word boundary for keywords
        const regex = keyword.length <= 2
          ? new RegExp(`\\${keyword}`, 'g')  // Escape operators
          : new RegExp(`\\b${keyword}\\b`, 'g');
        const matches = trimmed.match(regex);
        if (matches) {
          complexity += matches.length;
        }
      }

      // Track nesting depth via braces
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;

      currentNesting += openBraces - closeBraces;
      maxNesting = Math.max(maxNesting, currentNesting);
    }

    return {
      cyclomaticComplexity: complexity,
      nestingDepth: maxNesting
    };
  }

  /**
   * Extract naming pattern metrics
   */
  private static extractNamingMetrics(
    code: string,
    langKey: string
  ): Pick<CodeFeatures, 'averageVariableNameLength' | 'camelCaseRatio' | 'snake_caseRatio' | 'singleCharVarCount'> {
    // Extract potential variable/identifier names
    // This is an approximation - matches common identifier patterns
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const identifiers: string[] = [];
    let match;

    while ((match = identifierPattern.exec(code)) !== null) {
      const name = match[1];
      // Filter out common keywords and short names
      if (name.length > 1 && !this.isKeyword(name, langKey)) {
        identifiers.push(name);
      }
    }

    if (identifiers.length === 0) {
      return {
        averageVariableNameLength: 0,
        camelCaseRatio: 0,
        snake_caseRatio: 0,
        singleCharVarCount: 0
      };
    }

    // Calculate metrics
    const totalLength = identifiers.reduce((sum, id) => sum + id.length, 0);
    const avgLength = totalLength / identifiers.length;

    // Detect naming conventions
    let camelCaseCount = 0;
    let snakeCaseCount = 0;
    let singleCharCount = 0;

    // Also count single-char identifiers in original code
    const singleCharPattern = /\b([a-zA-Z])\b/g;
    while ((match = singleCharPattern.exec(code)) !== null) {
      const name = match[1];
      if (!this.isKeyword(name, langKey)) {
        singleCharCount++;
      }
    }

    for (const name of identifiers) {
      // camelCase: has lowercase followed by uppercase
      if (/[a-z][A-Z]/.test(name)) {
        camelCaseCount++;
      }
      // snake_case: has underscore between lowercase letters
      if (/[a-z]_[a-z]/.test(name)) {
        snakeCaseCount++;
      }
    }

    return {
      averageVariableNameLength: Math.round(avgLength * 100) / 100,
      camelCaseRatio: Math.round((camelCaseCount / identifiers.length) * 100) / 100,
      snake_caseRatio: Math.round((snakeCaseCount / identifiers.length) * 100) / 100,
      singleCharVarCount: singleCharCount
    };
  }

  /**
   * Check if a word is a common keyword
   */
  private static isKeyword(word: string, langKey: string): boolean {
    const commonKeywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'return', 'function', 'class', 'const', 'let', 'var', 'import', 'export',
      'from', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
      'public', 'private', 'protected', 'static', 'void', 'int', 'string',
      'boolean', 'true', 'false', 'null', 'undefined', 'async', 'await',
      'def', 'self', 'None', 'True', 'False', 'and', 'or', 'not', 'in',
      'fn', 'let', 'mut', 'pub', 'impl', 'struct', 'enum', 'trait',
      'func', 'package', 'type', 'interface', 'map', 'range', 'defer'
    ];

    return commonKeywords.includes(word.toLowerCase()) || commonKeywords.includes(word);
  }

  /**
   * Extract code quality metrics
   */
  private static extractQualityMetrics(
    lines: string[]
  ): Pick<CodeFeatures, 'duplicateLineRatio' | 'longLineRatio' | 'emptyBlockCount'> {
    // Duplicate line detection (normalized)
    const normalizedLines = lines
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const lineCount: Record<string, number> = {};
    for (const line of normalizedLines) {
      lineCount[line] = (lineCount[line] || 0) + 1;
    }

    let duplicateCount = 0;
    for (const count of Object.values(lineCount)) {
      if (count > 1) {
        duplicateCount += count - 1;
      }
    }

    const duplicateLineRatio = normalizedLines.length > 0
      ? duplicateCount / normalizedLines.length
      : 0;

    // Long line detection (>100 characters)
    const longLines = lines.filter(l => l.length > 100).length;
    const longLineRatio = lines.length > 0 ? longLines / lines.length : 0;

    // Empty block detection (e.g., {}, empty functions)
    let emptyBlockCount = 0;
    const fullCode = lines.join('\n');

    // Match empty braces with only whitespace
    const emptyBraces = fullCode.match(/\{\s*\}/g);
    if (emptyBraces) {
      emptyBlockCount += emptyBraces.length;
    }

    // Match pass statements (Python)
    const passStatements = fullCode.match(/^\s*pass\s*$/gm);
    if (passStatements) {
      emptyBlockCount += passStatements.length;
    }

    return {
      duplicateLineRatio: Math.round(duplicateLineRatio * 100) / 100,
      longLineRatio: Math.round(longLineRatio * 100) / 100,
      emptyBlockCount
    };
  }

  /**
   * Extract temporal metrics from tracking data
   */
  private static extractTemporalMetrics(
    trackingMetrics?: FileMetrics
  ): Pick<CodeFeatures, 'typingSpeed' | 'editFrequency' | 'pasteRatio'> {
    if (!trackingMetrics) {
      return {
        typingSpeed: 0,
        editFrequency: 0,
        pasteRatio: 0
      };
    }

    // Typing speed: characters per second (based on active time)
    const activeTimeSeconds = trackingMetrics.activeTimeMs / 1000;
    const typingSpeed = activeTimeSeconds > 0
      ? trackingMetrics.keystrokeCount / activeTimeSeconds
      : 0;

    // Edit frequency: edits per minute
    const activeTimeMinutes = trackingMetrics.activeTimeMs / 60000;
    const editFrequency = activeTimeMinutes > 0
      ? trackingMetrics.editCount / activeTimeMinutes
      : 0;

    // Paste ratio: pastes / total inputs
    const totalInputs = trackingMetrics.keystrokeCount + trackingMetrics.pasteCount;
    const pasteRatio = totalInputs > 0
      ? trackingMetrics.pasteCount / totalInputs
      : 0;

    return {
      typingSpeed: Math.round(typingSpeed * 100) / 100,
      editFrequency: Math.round(editFrequency * 100) / 100,
      pasteRatio: Math.round(pasteRatio * 100) / 100
    };
  }

  /**
   * Check if file should be analyzed
   * Filters out files that are too small, too large, or non-code
   */
  static shouldAnalyze(filePath: string, codeLength: number): boolean {
    // Skip non-code files
    if (!LanguageDetector.isCodeFile(filePath)) {
      return false;
    }

    // Skip very small files (< 10 lines worth)
    if (codeLength < 100) {
      return false;
    }

    // Skip very large files (> 1MB)
    if (codeLength > 1024 * 1024) {
      return false;
    }

    return true;
  }
}
