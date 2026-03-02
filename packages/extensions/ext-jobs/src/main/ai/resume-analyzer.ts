import type { AIService } from '@openorbit/core/ai/provider-types'
import { createLegacyAIService } from '@openorbit/core/ai/compat'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('ResumeAnalyzer')

export interface ResumeAnalysisResult {
  name: string
  summary: string
  skills: string[]
  experience: {
    role: string
    company: string
    duration: string
    highlights: string[]
  }[]
  education: {
    degree: string
    school: string
    year: string
  }[]
  certifications: string[]
  targetRoles: string[]
  seniorityLevel: string
  yearsOfExperience: number
  industries: string[]
  keywords: string[]
}

const SYSTEM_PROMPT = `You are an AI assistant that analyzes resumes and extracts structured information. Analyze the resume and return ONLY valid JSON in this exact format:
{
  "name": "<candidate full name or empty string>",
  "summary": "<1-2 sentence professional summary>",
  "skills": ["<skill 1>", "<skill 2>"],
  "experience": [
    {
      "role": "<job title>",
      "company": "<company name>",
      "duration": "<e.g. 2021-2023 or 2 years>",
      "highlights": ["<achievement or responsibility 1>"]
    }
  ],
  "education": [
    {
      "degree": "<e.g. BS Computer Science>",
      "school": "<school name>",
      "year": "<graduation year>"
    }
  ],
  "certifications": ["<certification 1>"],
  "targetRoles": ["<inferred role 1>", "<inferred role 2>"],
  "seniorityLevel": "<junior|mid|senior|lead|principal|executive>",
  "yearsOfExperience": <number>,
  "industries": ["<industry 1>"],
  "keywords": ["<additional keyword 1>"]
}

Rules:
- skills: lowercase, normalized names (e.g. "react", "typescript", "aws"). Include all technical skills, tools, and frameworks.
- targetRoles: infer from the candidate's background what roles they are best suited for.
- seniorityLevel: estimate based on total experience and titles.
- yearsOfExperience: total professional experience in years (integer).
- keywords: additional searchable terms not already in skills (soft skills, methodologies, domain expertise).
- Return only the JSON — no markdown, no explanation.`

export class ResumeAnalyzer {
  private ai: AIService

  constructor(ai?: AIService) {
    this.ai = ai ?? createLegacyAIService()
  }

  async analyze(resumeText: string, resumeName: string): Promise<ResumeAnalysisResult> {
    const userMessage = `Analyze this resume and return the JSON assessment.

## Resume: ${resumeName}

${resumeText}`

    try {
      const result = await this.ai.complete({
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        tier: 'standard',
        maxTokens: 2048,
        task: 'score_job'
      })
      return this.parseAnalysis(result.content, resumeName)
    } catch (err) {
      log.error('Resume analysis failed', err)
      throw err
    }
  }

  private parseAnalysis(response: string, resumeName: string): ResumeAnalysisResult {
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)
      return {
        name: String(parsed.name || ''),
        summary: String(parsed.summary || ''),
        skills: this.normalizeStrings(parsed.skills),
        experience: Array.isArray(parsed.experience)
          ? parsed.experience.map((e: Record<string, unknown>) => ({
              role: String(e.role || ''),
              company: String(e.company || ''),
              duration: String(e.duration || ''),
              highlights: this.normalizeStrings(e.highlights)
            }))
          : [],
        education: Array.isArray(parsed.education)
          ? parsed.education.map((e: Record<string, unknown>) => ({
              degree: String(e.degree || ''),
              school: String(e.school || ''),
              year: String(e.year || '')
            }))
          : [],
        certifications: this.normalizeStrings(parsed.certifications),
        targetRoles: this.normalizeStrings(parsed.targetRoles),
        seniorityLevel: String(parsed.seniorityLevel || 'mid'),
        yearsOfExperience: Math.max(0, parseInt(String(parsed.yearsOfExperience || '0'), 10) || 0),
        industries: this.normalizeStrings(parsed.industries),
        keywords: this.normalizeStrings(parsed.keywords)
      }
    } catch {
      log.warn('Failed to parse resume analysis JSON for', resumeName)
      return {
        name: resumeName,
        summary: 'Could not parse resume analysis',
        skills: [],
        experience: [],
        education: [],
        certifications: [],
        targetRoles: [],
        seniorityLevel: 'mid',
        yearsOfExperience: 0,
        industries: [],
        keywords: []
      }
    }
  }

  private normalizeStrings(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []
    return raw.map((s) => String(s).trim()).filter(Boolean)
  }
}
