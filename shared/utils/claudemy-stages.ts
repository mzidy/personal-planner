import type { ClaudemyStage } from '../types/claudemy'

/** The pipeline in order, with what the learner sees while each step runs. */
export const CLAUDEMY_STAGES: { stage: ClaudemyStage; label: string; working: string }[] = [
  { stage: 'mapping', label: 'Map the topic', working: 'Searching how the topic is usually taught' },
  { stage: 'sourcing', label: 'Build the reading list', working: 'Searching the web for pages worth learning from' },
  { stage: 'fetching', label: 'Fetch the pages', working: 'Fetching and saving the pages' },
  { stage: 'reading', label: 'Read and take notes', working: 'Reading the pages and taking cited notes' },
  { stage: 'clustering', label: 'Agreement map', working: 'Working out what the sources agree on, and where they split' },
  { stage: 'planning', label: 'Lesson plan', working: 'Planning the lessons' },
  { stage: 'sample', label: 'Sample lesson', working: 'Writing and checking lesson 1' },
  { stage: 'feedback', label: 'Your feedback', working: 'Waiting for you to listen to lesson 1' },
  { stage: 'writing', label: 'The rest', working: 'Writing and checking the remaining lessons' },
  { stage: 'done', label: 'Ready', working: 'The course is ready' }
]

const WORKING = new Set<ClaudemyStage>(['mapping', 'sourcing', 'fetching', 'reading', 'clustering', 'planning', 'sample', 'writing'])

/** A stage the pipeline advances by itself, as opposed to one that waits for the learner. */
export function isClaudemyWorking(stage: ClaudemyStage) {
  return WORKING.has(stage)
}

export function claudemyStageIndex(stage: ClaudemyStage) {
  return CLAUDEMY_STAGES.findIndex(entry => entry.stage === stage)
}
