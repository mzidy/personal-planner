export type ClaudemyLevel = 'beginner' | 'intermediate' | 'advanced'

/**
 * Where a course is in the pipeline. Everything up to `sample` and `writing`
 * is worked through one bounded step at a time; `feedback` waits for the
 * learner to approve the sample lesson before the rest is written.
 */
export type ClaudemyStage =
  | 'mapping'
  | 'sourcing'
  | 'fetching'
  | 'reading'
  | 'clustering'
  | 'planning'
  | 'sample'
  | 'feedback'
  | 'writing'
  | 'done'

export type ClaudemyEnergy = 'Quick Win' | 'Deep Focus' | 'People' | 'Admin'
export type ClaudemyIdeaLevel = 'foundation' | 'core' | 'advanced'
export type ClaudemyNoteKind =
  | 'technique'
  | 'rule of thumb'
  | 'mistake'
  | 'number'
  | 'story'
  | 'definition'
  | 'template'
  | 'test'

export interface ClaudemySubtopic {
  /** T01 to T18. Every note is filed under one, so sources can be compared. */
  id: string
  name: string
  covers: string
}

export interface ClaudemyNote {
  /** S07.N2: the second note taken from source 7. */
  id: string
  subtopic: string
  also: string[]
  idea: string
  quote: string
  kind: ClaudemyNoteKind
  level: ClaudemyIdeaLevel
  bias: string
}

export interface ClaudemyTheme {
  /** TH01 and up. */
  id: string
  /** The idea, written as an instruction. */
  idea: string
  subtopics: string[]
  noteIds: string[]
  /** N: distinct sources that support the idea. Counted in code, not by the model. */
  agree: number
  /** M: distinct sources that covered this ground at all. */
  of: number
  /** Fewer than three sources covered it. */
  thin: boolean
  disagreements: { source: number; claim: string }[]
  level: ClaudemyIdeaLevel
  bestStory: { source: number; line: string } | null
}

export interface ClaudemySplit {
  question: string
  sides: { position: string; sources: number[] }[]
  howToDecide: string
}

export interface ClaudemyArc {
  title: string
  why: string
  finish: string
}

export interface ClaudemyTryIt {
  energy: ClaudemyEnergy
  minutes: number
  what: string
}

/** One lesson's block in the plan. The written lesson expands it and never contradicts it. */
export interface ClaudemyPlanBlock {
  themeIds: string[]
  agree: number
  of: number
  idea: string
  whyItMatters: string
  story: { line: string; source: number | null }
  tryIt: ClaudemyTryIt
  rule: string
}

export interface ClaudemyTurn {
  speaker: 'A' | 'B'
  text: string
}

export interface ClaudemyCard {
  ideaLines: string[]
  impact: string
  whoSaysIt: string
  tryIt: { energy: ClaudemyEnergy; minutes: number; steps: string }
  rule: string
  deeper: { label: string; url: string }[]
}

export type ClaudemyLessonStatus = 'planned' | 'written' | 'failed'

export interface ClaudemyLessonRecord {
  id: string
  courseId: string
  number: number
  /** Index into the course's arcs. */
  arc: number
  handle: string
  status: ClaudemyLessonStatus
  plan: ClaudemyPlanBlock
  script: ClaudemyTurn[] | null
  card: ClaudemyCard | null
  words: number
  attempts: number
  /** What the checker refused on the last attempt. Empty once a lesson passes. */
  problems: string[]
  heardAt: string | null
  triedAt: string | null
  ruleKept: boolean
  createdAt: string
  updatedAt: string
}

export type ClaudemyPageStatus = 'pending' | 'saved' | 'failed'

export interface ClaudemyPageSummary {
  id: string
  /** S-number the notes and themes cite. */
  seq: number
  url: string
  title: string
  kind: string
  subtopics: string[]
  status: ClaudemyPageStatus
  failReason: string
  words: number
  read: boolean
  skipReason: string
  noteCount: number
}

export interface ClaudemyCourseRecord {
  id: string
  topic: string
  level: ClaudemyLevel
  lessonCount: number
  /** Set in person mode: the class is built from this person's own published work. */
  person: string
  stage: ClaudemyStage
  /** The last step's failure, cleared when a step succeeds. */
  error: string
  sourcingRound: number
  sourcingCursor: number
  subtopics: ClaudemySubtopic[]
  themes: ClaudemyTheme[]
  splits: ClaudemySplit[]
  gaps: string[]
  arcs: ClaudemyArc[]
  disagreements: { sources: number[]; on: string }[]
  stories: { source: number; story: string }[]
  feedback: string
  inputTokens: number
  outputTokens: number
  webSearches: number
  createdAt: string
  updatedAt: string
}

export interface ClaudemyCourseSummary {
  id: string
  topic: string
  level: ClaudemyLevel
  person: string
  stage: ClaudemyStage
  error: string
  lessonCount: number
  lessonsWritten: number
  lessonsHeard: number
  updatedAt: string
}

export interface ClaudemyCourseView {
  course: ClaudemyCourseRecord
  pages: ClaudemyPageSummary[]
  lessons: ClaudemyLessonRecord[]
}
