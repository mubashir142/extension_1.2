// src/utils/languageDetector.ts

/**
 * Language detection utility
 * Maps file extensions to programming language names
 */
export class LanguageDetector {
  private static readonly EXTENSION_MAP: Record<string, string> = {
    // JavaScript/TypeScript
    '.js': 'JavaScript',
    '.jsx': 'JavaScript React',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript React',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',

    // Python
    '.py': 'Python',
    '.pyw': 'Python',
    '.pyx': 'Python',

    // Java
    '.java': 'Java',
    '.class': 'Java Bytecode',
    '.jar': 'Java Archive',

    // C/C++
    '.c': 'C',
    '.cpp': 'C++',
    '.cxx': 'C++',
    '.cc': 'C++',
    '.h': 'C Header',
    '.hpp': 'C++ Header',
    '.hxx': 'C++ Header',

    // C#
    '.cs': 'C#',
    '.csx': 'C# Script',

    // Go
    '.go': 'Go',

    // Rust
    '.rs': 'Rust',

    // Ruby
    '.rb': 'Ruby',
    '.erb': 'Ruby ERB',

    // PHP
    '.php': 'PHP',
    '.phtml': 'PHP',

    // Web
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',

    // Shell
    '.sh': 'Shell',
    '.bash': 'Bash',
    '.zsh': 'Zsh',
    '.fish': 'Fish',

    // Swift
    '.swift': 'Swift',

    // Kotlin
    '.kt': 'Kotlin',
    '.kts': 'Kotlin Script',

    // Scala
    '.scala': 'Scala',

    // Haskell
    '.hs': 'Haskell',

    // Lua
    '.lua': 'Lua',

    // R
    '.r': 'R',
    '.R': 'R',

    // Dart
    '.dart': 'Dart',

    // SQL
    '.sql': 'SQL',

    // Config/Data
    '.json': 'JSON',
    '.xml': 'XML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.ini': 'INI',

    // Markdown
    '.md': 'Markdown',
    '.markdown': 'Markdown',

    // Other
    '.txt': 'Plain Text',
    '.log': 'Log File',
    '.vue': 'Vue',
    '.svelte': 'Svelte'
  };

  /**
   * Detect language from file path
   */
  static detectLanguage(filePath: string): string {
    // Get file extension
    const match = filePath.match(/\.([^.]+)$/);
    if (!match) {
      return 'Unknown';
    }

    const extension = '.' + match[1].toLowerCase();
    return this.EXTENSION_MAP[extension] || 'Unknown';
  }

  /**
   * Get file extension
   */
  static getExtension(filePath: string): string {
    const match = filePath.match(/\.([^.]+)$/);
    return match ? match[1].toLowerCase() : '';
  }

  /**
   * Check if file is a code file (not binary, config, etc.)
   */
  static isCodeFile(filePath: string): boolean {
    const language = this.detectLanguage(filePath);
    const nonCodeLanguages = ['Unknown', 'JSON', 'XML', 'YAML', 'TOML', 'INI', 'Plain Text', 'Log File', 'Markdown'];
    return !nonCodeLanguages.includes(language);
  }
}
