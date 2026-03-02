import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import type { ResumeAnalysisResult } from '../ai/resume-analyzer'

interface ResumeAnalysisRow {
  id: string
  resume_name: string
  resume_path: string
  extracted_text: string
  analysis: string
  analyzed_at: string
  created_at: string
  updated_at: string
}

export interface ResumeAnalysis {
  id: string
  resumeName: string
  resumePath: string
  extractedText: string
  analysis: ResumeAnalysisResult
  analyzedAt: string
  createdAt: string
  updatedAt: string
}

export class ResumeAnalysisRepo {
  constructor(private db: Database.Database) {}

  upsert(
    resumeName: string,
    resumePath: string,
    extractedText: string,
    analysis: ResumeAnalysisResult
  ): ResumeAnalysis {
    const now = new Date().toISOString()
    const existing = this.getByName(resumeName)
    const id = existing?.id ?? uuid()

    this.db
      .prepare(
        `INSERT INTO resume_analyses (id, resume_name, resume_path, extracted_text, analysis, analyzed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(resume_name) DO UPDATE SET
           resume_path = excluded.resume_path,
           extracted_text = excluded.extracted_text,
           analysis = excluded.analysis,
           analyzed_at = excluded.analyzed_at,
           updated_at = excluded.updated_at`
      )
      .run(id, resumeName, resumePath, extractedText, JSON.stringify(analysis), now, now, now)

    return this.getByName(resumeName)!
  }

  getByName(resumeName: string): ResumeAnalysis | null {
    const row = this.db
      .prepare(`SELECT * FROM resume_analyses WHERE resume_name = ?`)
      .get(resumeName) as ResumeAnalysisRow | undefined
    return row ? this.rowToAnalysis(row) : null
  }

  list(): ResumeAnalysis[] {
    const rows = this.db
      .prepare(`SELECT * FROM resume_analyses ORDER BY analyzed_at DESC`)
      .all() as ResumeAnalysisRow[]
    return rows.map((r) => this.rowToAnalysis(r))
  }

  delete(resumeName: string): void {
    this.db.prepare(`DELETE FROM resume_analyses WHERE resume_name = ?`).run(resumeName)
  }

  private rowToAnalysis(row: ResumeAnalysisRow): ResumeAnalysis {
    let analysis: ResumeAnalysisResult
    try {
      analysis = JSON.parse(row.analysis)
    } catch {
      analysis = {
        name: row.resume_name,
        summary: '',
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
    return {
      id: row.id,
      resumeName: row.resume_name,
      resumePath: row.resume_path,
      extractedText: row.extracted_text,
      analysis,
      analyzedAt: row.analyzed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}
