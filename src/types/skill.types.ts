// src/types/skill.types.ts

/**
 * Skill proficiency levels
 */
export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Skill categories for analysis
 */
export enum SkillCategory {
  CODING_PROFICIENCY = 'coding_proficiency',
  PROBLEM_SOLVING = 'problem_solving',
  FOCUS_CONSISTENCY = 'focus_consistency',
  CODE_QUALITY = 'code_quality',
  LANGUAGE_VERSATILITY = 'language_versatility'
}

/**
 * Skill score for a specific category
 */
export interface SkillScore {
  category: SkillCategory;
  score: number; // 0-100
  level: SkillLevel;
  description: string;
}

/**
 * Overall skill profile
 */
export interface SkillProfile {
  overallScore: number; // 0-100
  overallLevel: SkillLevel;
  categoryScores: SkillScore[];
  strengths: string[]; // Top 2 categories
  weaknesses: string[]; // Bottom 2 categories
  analyzedAt: string; // ISO timestamp
}

/**
 * Improvement recommendation
 */
export interface Recommendation {
  category: SkillCategory;
  priority: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
  learningResources: LearningResource[];
}

/**
 * Learning resource link
 */
export interface LearningResource {
  title: string;
  type: 'article' | 'video' | 'course' | 'documentation' | 'practice';
  url: string;
  description: string;
}

/**
 * Skill analysis result
 */
export interface SkillAnalysisResult {
  profile: SkillProfile;
  recommendations: Recommendation[];
  sessionId: string;
  totalActiveTime: number; // milliseconds
  totalKeystrokes: number;
  totalPastes: number;
}

/**
 * Behavioral metrics for skill analysis
 */
export interface BehavioralMetrics {
  // Typing metrics
  typingToTotalRatio: number;
  averageTypingSpeed: number; // chars per minute
  keystrokeCount: number;
  pasteCount: number;

  // Edit patterns
  editCount: number;
  linesAdded: number;
  linesDeleted: number;
  backspaceRatio: number;

  // Time patterns
  activeTimeMs: number;
  idleTimeMs: number;
  focusRatio: number;

  // Language diversity
  languages: string[];
  primaryLanguage: string;
  languageDistribution: Record<string, number>; // language -> percentage

  // Session patterns
  fileCount: number;
  averageFileActiveTime: number;
  fileSwitchCount: number;
}
