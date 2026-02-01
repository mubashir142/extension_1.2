// src/services/SkillAnalysisService.ts

import {
  SkillLevel,
  SkillCategory,
  SkillScore,
  SkillProfile,
  Recommendation,
  SkillAnalysisResult,
  BehavioralMetrics,
  LearningResource
} from '../types/skill.types';
import { FileMetrics } from '../types/tracking.types';
import { Logger } from '../utils/logger';

/**
 * Service for analyzing developer skill from behavioral patterns
 */
export class SkillAnalysisService {
  /**
   * Analyze skill profile from session data
   */
  public analyzeSkill(
    fileMetrics: Record<string, FileMetrics>,
    sessionId: string,
    totalActiveTime: number,
    totalIdleTime: number
  ): SkillAnalysisResult {
    Logger.info('Starting skill analysis');

    // Step 1: Extract behavioral metrics
    const metrics = this.extractBehavioralMetrics(
      fileMetrics,
      totalActiveTime,
      totalIdleTime
    );

    // Step 2: Calculate category scores
    const categoryScores = this.calculateCategoryScores(metrics);

    // Step 3: Determine overall profile
    const profile = this.buildSkillProfile(categoryScores);

    // Step 4: Generate recommendations
    const recommendations = this.generateRecommendations(
      categoryScores,
      metrics
    );

    Logger.info(`Skill analysis complete: Overall score ${profile.overallScore}`);

    return {
      profile,
      recommendations,
      sessionId,
      totalActiveTime: metrics.activeTimeMs,
      totalKeystrokes: metrics.keystrokeCount,
      totalPastes: metrics.pasteCount
    };
  }

  /**
   * Extract behavioral metrics from file metrics
   */
  private extractBehavioralMetrics(
    fileMetrics: Record<string, FileMetrics>,
    totalActiveTime: number,
    totalIdleTime: number
  ): BehavioralMetrics {
    const files = Object.values(fileMetrics);

    // Aggregate counts
    const keystrokeCount = files.reduce((sum, f) => sum + f.keystrokeCount, 0);
    const pasteCount = files.reduce((sum, f) => sum + f.pasteCount, 0);
    const linesAdded = files.reduce((sum, f) => sum + f.linesAdded, 0);
    const linesDeleted = files.reduce((sum, f) => sum + f.linesDeleted, 0);
    const editCount = files.reduce((sum, f) => sum + f.editCount, 0);

    // Calculate ratios
    const totalInput = keystrokeCount + pasteCount;
    const typingToTotalRatio = totalInput > 0 ? keystrokeCount / totalInput : 0;
    const backspaceRatio = linesAdded > 0 ? linesDeleted / linesAdded : 0;
    const focusRatio = (totalActiveTime + totalIdleTime) > 0
      ? totalActiveTime / (totalActiveTime + totalIdleTime)
      : 0;

    // Language analysis
    const languageDistribution: Record<string, number> = {};
    files.forEach(f => {
      languageDistribution[f.language] = (languageDistribution[f.language] || 0) + 1;
    });

    const languages = Object.keys(languageDistribution);
    const primaryLanguage = languages.reduce((a, b) =>
      languageDistribution[a] > languageDistribution[b] ? a : b,
      languages[0] || 'unknown'
    );

    // Normalize language distribution to percentages
    const totalFiles = files.length;
    Object.keys(languageDistribution).forEach(lang => {
      languageDistribution[lang] = (languageDistribution[lang] / totalFiles) * 100;
    });

    // Typing speed (chars per minute)
    const activeMinutes = totalActiveTime / 60000;
    const averageTypingSpeed = activeMinutes > 0 ? keystrokeCount / activeMinutes : 0;

    // File switching patterns
    const fileSwitchCount = files.reduce((sum, f) => sum + f.switchToCount + f.switchFromCount, 0);
    const averageFileActiveTime = totalFiles > 0
      ? files.reduce((sum, f) => sum + f.activeTimeMs, 0) / totalFiles
      : 0;

    return {
      typingToTotalRatio,
      averageTypingSpeed,
      keystrokeCount,
      pasteCount,
      editCount,
      linesAdded,
      linesDeleted,
      backspaceRatio,
      activeTimeMs: totalActiveTime,
      idleTimeMs: totalIdleTime,
      focusRatio,
      languages,
      primaryLanguage,
      languageDistribution,
      fileCount: totalFiles,
      averageFileActiveTime,
      fileSwitchCount
    };
  }

  /**
   * Calculate scores for each skill category
   */
  private calculateCategoryScores(metrics: BehavioralMetrics): SkillScore[] {
    const scores: SkillScore[] = [];

    // 1. Coding Proficiency (based on typing vs paste)
    const codingScore = Math.round(metrics.typingToTotalRatio * 100);
    scores.push({
      category: SkillCategory.CODING_PROFICIENCY,
      score: codingScore,
      level: this.scoreToLevel(codingScore),
      description: this.getCodingProficiencyDescription(metrics)
    });

    // 2. Problem Solving (based on edit efficiency)
    const activeMinutes = metrics.activeTimeMs / 60000;
    const editsPerMinute = activeMinutes > 0 ? metrics.editCount / activeMinutes : 0;
    // Lower edits per minute = better (less trial-and-error)
    // Cap at 10 edits/min as baseline for beginner
    const problemSolvingScore = Math.max(0, Math.round(100 - (editsPerMinute * 10)));
    scores.push({
      category: SkillCategory.PROBLEM_SOLVING,
      score: problemSolvingScore,
      level: this.scoreToLevel(problemSolvingScore),
      description: this.getProblemSolvingDescription(editsPerMinute, metrics)
    });

    // 3. Focus & Consistency (based on active vs idle time)
    const focusScore = Math.round(metrics.focusRatio * 100);
    scores.push({
      category: SkillCategory.FOCUS_CONSISTENCY,
      score: focusScore,
      level: this.scoreToLevel(focusScore),
      description: this.getFocusDescription(metrics)
    });

    // 4. Code Quality (based on delete-to-add ratio)
    const qualityScore = Math.max(0, Math.round((1 - metrics.backspaceRatio) * 100));
    scores.push({
      category: SkillCategory.CODE_QUALITY,
      score: qualityScore,
      level: this.scoreToLevel(qualityScore),
      description: this.getCodeQualityDescription(metrics)
    });

    // 5. Language Versatility (based on number of languages)
    const versatilityScore = Math.min(100, metrics.languages.length * 20);
    scores.push({
      category: SkillCategory.LANGUAGE_VERSATILITY,
      score: versatilityScore,
      level: this.scoreToLevel(versatilityScore),
      description: this.getVersatilityDescription(metrics)
    });

    return scores;
  }

  /**
   * Build overall skill profile from category scores
   */
  private buildSkillProfile(categoryScores: SkillScore[]): SkillProfile {
    // Calculate weighted average (all categories equal weight)
    const overallScore = Math.round(
      categoryScores.reduce((sum, s) => sum + s.score, 0) / categoryScores.length
    );

    // Identify strengths (top 2) and weaknesses (bottom 2)
    const sorted = [...categoryScores].sort((a, b) => b.score - a.score);
    const strengths = sorted.slice(0, 2).map(s => this.categoryToString(s.category));
    const weaknesses = sorted.slice(-2).map(s => this.categoryToString(s.category));

    return {
      overallScore,
      overallLevel: this.scoreToLevel(overallScore),
      categoryScores,
      strengths,
      weaknesses,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Generate personalized improvement recommendations
   */
  private generateRecommendations(
    categoryScores: SkillScore[],
    metrics: BehavioralMetrics
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Sort by score (lowest first = highest priority)
    const sorted = [...categoryScores].sort((a, b) => a.score - b.score);

    sorted.forEach((scoreData, index) => {
      // Only recommend for categories below 70
      if (scoreData.score >= 70) {
        return;
      }

      const priority = index === 0 ? 'high' : index === 1 ? 'medium' : 'low';

      switch (scoreData.category) {
        case SkillCategory.CODING_PROFICIENCY:
          if (metrics.typingToTotalRatio < 0.5) {
            recommendations.push({
              category: scoreData.category,
              priority,
              issue: 'High paste-to-typing ratio indicates over-reliance on external code',
              suggestion: 'Practice writing code from scratch. Start with small algorithms and gradually increase complexity.',
              learningResources: [
                {
                  title: 'LeetCode - Easy Problems',
                  type: 'practice',
                  url: 'https://leetcode.com/problemset/all/?difficulty=EASY',
                  description: 'Practice coding fundamentals with guided problems'
                },
                {
                  title: 'The Odin Project - Foundations',
                  type: 'course',
                  url: 'https://www.theodinproject.com/paths/foundations/courses/foundations',
                  description: 'Build coding proficiency from the ground up'
                }
              ]
            });
          }
          break;

        case SkillCategory.PROBLEM_SOLVING:
          recommendations.push({
            category: scoreData.category,
            priority,
            issue: 'High edit frequency suggests trial-and-error approach',
            suggestion: 'Plan before coding. Break problems into smaller steps. Practice pseudocode and flowcharts.',
            learningResources: [
              {
                title: 'Problem-Solving Techniques',
                type: 'article',
                url: 'https://www.freecodecamp.org/news/how-to-think-like-a-programmer-lessons-in-problem-solving-d1d8bf1de7d2/',
                description: 'Learn systematic problem-solving approaches'
              },
              {
                title: 'Algorithmic Thinking',
                type: 'course',
                url: 'https://www.coursera.org/learn/algorithmic-thinking-1',
                description: 'Develop structured thinking for complex problems'
              }
            ]
          });
          break;

        case SkillCategory.FOCUS_CONSISTENCY:
          recommendations.push({
            category: scoreData.category,
            priority,
            issue: 'High idle time indicates focus or workflow issues',
            suggestion: 'Use Pomodoro technique (25-min focus sessions). Minimize context switching. Set clear goals before starting.',
            learningResources: [
              {
                title: 'Deep Work Principles',
                type: 'article',
                url: 'https://blog.doist.com/deep-work/',
                description: 'Strategies for maintaining focus while coding'
              },
              {
                title: 'Pomodoro Timer',
                type: 'practice',
                url: 'https://pomofocus.io/',
                description: 'Time management technique for better focus'
              }
            ]
          });
          break;

        case SkillCategory.CODE_QUALITY:
          recommendations.push({
            category: scoreData.category,
            priority,
            issue: 'High delete-to-add ratio suggests frequent corrections',
            suggestion: 'Review code standards for your language. Use linters (ESLint, Pylint). Write tests first (TDD).',
            learningResources: [
              {
                title: 'Clean Code Principles',
                type: 'article',
                url: 'https://github.com/ryanmcdermott/clean-code-javascript',
                description: 'Best practices for writing maintainable code'
              },
              {
                title: 'Test-Driven Development',
                type: 'video',
                url: 'https://www.youtube.com/watch?v=Jv2uxzhPFl4',
                description: 'Write tests first to catch errors early'
              }
            ]
          });
          break;

        case SkillCategory.LANGUAGE_VERSATILITY:
          recommendations.push({
            category: scoreData.category,
            priority,
            issue: 'Limited language exposure may restrict career opportunities',
            suggestion: 'Learn a second language in a different paradigm (e.g., if you know JavaScript, try Python or Go).',
            learningResources: [
              {
                title: 'Python for Beginners',
                type: 'course',
                url: 'https://www.python.org/about/gettingstarted/',
                description: 'Official Python tutorial for new learners'
              },
              {
                title: 'Go by Example',
                type: 'documentation',
                url: 'https://gobyexample.com/',
                description: 'Hands-on introduction to Go programming'
              }
            ]
          });
          break;
      }
    });

    return recommendations;
  }

  /**
   * Convert score (0-100) to skill level
   */
  private scoreToLevel(score: number): SkillLevel {
    if (score >= 80) return SkillLevel.EXPERT;
    if (score >= 60) return SkillLevel.ADVANCED;
    if (score >= 40) return SkillLevel.INTERMEDIATE;
    return SkillLevel.BEGINNER;
  }

  /**
   * Helper: Get coding proficiency description
   */
  private getCodingProficiencyDescription(metrics: BehavioralMetrics): string {
    const ratio = Math.round(metrics.typingToTotalRatio * 100);
    if (ratio >= 80) {
      return `Excellent! ${ratio}% of code is typed from scratch, showing strong fundamentals.`;
    } else if (ratio >= 60) {
      return `Good typing ratio (${ratio}%). Consider reducing paste reliance for better retention.`;
    } else if (ratio >= 40) {
      return `Moderate typing ratio (${ratio}%). Practice writing more code from memory.`;
    } else {
      return `Low typing ratio (${ratio}%). Over-reliance on pasting may hinder skill development.`;
    }
  }

  /**
   * Helper: Get problem-solving description
   */
  private getProblemSolvingDescription(
    editsPerMinute: number,
    metrics: BehavioralMetrics
  ): string {
    if (editsPerMinute < 2) {
      return `Efficient problem-solving with ${editsPerMinute.toFixed(1)} edits/min. You plan well before coding.`;
    } else if (editsPerMinute < 5) {
      return `Decent efficiency (${editsPerMinute.toFixed(1)} edits/min). Room for improvement in planning.`;
    } else {
      return `High edit frequency (${editsPerMinute.toFixed(1)} edits/min) suggests trial-and-error approach. Plan before coding.`;
    }
  }

  /**
   * Helper: Get focus description
   */
  private getFocusDescription(metrics: BehavioralMetrics): string {
    const focusPercent = Math.round(metrics.focusRatio * 100);
    if (focusPercent >= 80) {
      return `Excellent focus! ${focusPercent}% active time shows strong concentration.`;
    } else if (focusPercent >= 60) {
      return `Good focus (${focusPercent}% active). Consider using focus techniques for improvement.`;
    } else {
      return `Low focus (${focusPercent}% active). High idle time may indicate distractions or workflow issues.`;
    }
  }

  /**
   * Helper: Get code quality description
   */
  private getCodeQualityDescription(metrics: BehavioralMetrics): string {
    const deleteRatio = Math.round(metrics.backspaceRatio * 100);
    if (deleteRatio <= 20) {
      return `High quality code with only ${deleteRatio}% deletions. Few corrections needed.`;
    } else if (deleteRatio <= 40) {
      return `Moderate quality (${deleteRatio}% deletions). Consider using linters to catch errors early.`;
    } else {
      return `High deletion rate (${deleteRatio}%) suggests frequent corrections. Review code standards.`;
    }
  }

  /**
   * Helper: Get versatility description
   */
  private getVersatilityDescription(metrics: BehavioralMetrics): string {
    const count = metrics.languages.length;
    const langs = metrics.languages.slice(0, 3).join(', ');

    if (count >= 5) {
      return `Excellent versatility! Working with ${count} languages: ${langs}, and more.`;
    } else if (count >= 3) {
      return `Good versatility with ${count} languages: ${langs}.`;
    } else if (count === 2) {
      return `Moderate versatility. Working with ${langs}. Consider learning a third language.`;
    } else {
      return `Limited to ${langs}. Expanding to other languages can boost career opportunities.`;
    }
  }

  /**
   * Helper: Convert category enum to readable string
   */
  private categoryToString(category: SkillCategory): string {
    switch (category) {
      case SkillCategory.CODING_PROFICIENCY:
        return 'Coding Proficiency';
      case SkillCategory.PROBLEM_SOLVING:
        return 'Problem Solving';
      case SkillCategory.FOCUS_CONSISTENCY:
        return 'Focus & Consistency';
      case SkillCategory.CODE_QUALITY:
        return 'Code Quality';
      case SkillCategory.LANGUAGE_VERSATILITY:
        return 'Language Versatility';
      default:
        return category;
    }
  }
}
