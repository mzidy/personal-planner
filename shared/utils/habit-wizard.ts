/**
 * Wizard steps for designing a habit, following the method in James Clear's
 * "Atomic Habits": identity first (ch. 2), then the Four Laws of Behavior
 * Change and their tactics as listed in the book's own "How to Create a Good
 * Habit" summary — make it obvious, attractive, easy, satisfying.
 *
 * Prompts are written here in our own words; the two bracket templates are the
 * book's named formats for implementation intentions and habit stacking.
 *
 * Field keys are permanent — answers are stored against them.
 */
export type HabitLaw = 'identity' | 'obvious' | 'attractive' | 'easy' | 'satisfying'

export interface HabitWizardField {
  key: string
  label: string
  placeholder: string
  /** Long answers get a textarea, short ones a single line. */
  multiline?: boolean
  optional?: boolean
}

export interface HabitWizardStep {
  key: string
  law: HabitLaw
  lawLabel: string
  title: string
  intro: string
  /** Where this comes from in the book, shown as a small source note. */
  source: string
  fields: HabitWizardField[]
}

export const HABIT_LAW_LABELS: Record<HabitLaw, string> = {
  identity: 'Identity',
  obvious: '1st Law — Make it obvious',
  attractive: '2nd Law — Make it attractive',
  easy: '3rd Law — Make it easy',
  satisfying: '4th Law — Make it satisfying'
}

export const HABIT_WIZARD_STEPS: HabitWizardStep[] = [
  {
    key: 'identity',
    law: 'identity',
    lawLabel: HABIT_LAW_LABELS.identity,
    title: 'Who are you trying to become?',
    intro:
      'Start with the person, not the outcome. A habit sticks when it is evidence of an identity you want to hold, and every repetition is another piece of proof.',
    source: 'Chapter 2 — How Your Habits Shape Your Identity',
    fields: [
      {
        key: 'identityStatement',
        label: 'The type of person I want to be',
        placeholder: 'e.g. Someone who is strong and moves every day'
      },
      {
        key: 'evidence',
        label: 'What would prove it?',
        placeholder: 'e.g. Training three times a week, without needing to be in the mood',
        multiline: true
      }
    ]
  },
  {
    key: 'habit',
    law: 'identity',
    lawLabel: HABIT_LAW_LABELS.identity,
    title: 'Name the habit',
    intro:
      'One specific, repeatable behaviour that casts a vote for that identity. Keep it small enough that it is hard to argue with.',
    source: 'Chapter 1 — The Surprising Power of Atomic Habits',
    fields: [
      {
        key: 'habitName',
        label: 'The habit',
        placeholder: 'e.g. Strength training'
      },
      {
        key: 'frequency',
        label: 'How often',
        placeholder: 'e.g. Every weekday'
      }
    ]
  },
  {
    key: 'obvious',
    law: 'obvious',
    lawLabel: HABIT_LAW_LABELS.obvious,
    title: 'Make it obvious',
    intro:
      'Most people fail for lack of clarity rather than motivation. Fix the time and place in advance, and anchor the habit to something you already do.',
    source: 'Chapters 4–6 — implementation intentions, habit stacking, environment design',
    fields: [
      {
        key: 'implementationIntention',
        label: 'I will [behaviour] at [time] in [location]',
        placeholder: 'e.g. I will train at 07:00 in the home gym'
      },
      {
        key: 'habitStack',
        label: 'After [current habit], I will [new habit]',
        placeholder: 'e.g. After I pour my morning coffee, I will change into training clothes'
      },
      {
        key: 'environment',
        label: 'How will you make the cue visible?',
        placeholder: 'e.g. Kit laid out by the door the night before',
        multiline: true,
        optional: true
      }
    ]
  },
  {
    key: 'attractive',
    law: 'attractive',
    lawLabel: HABIT_LAW_LABELS.attractive,
    title: 'Make it attractive',
    intro:
      'Pair the thing you need to do with something you want to do, and give yourself a short ritual that reliably precedes it.',
    source: 'Chapters 8–9 — temptation bundling, motivation rituals, culture',
    fields: [
      {
        key: 'temptationBundle',
        label: 'What will you pair it with?',
        placeholder: 'e.g. Only listen to my favourite podcast while training'
      },
      {
        key: 'ritual',
        label: 'A small ritual right before',
        placeholder: 'e.g. Same warm-up track every time',
        optional: true
      },
      {
        key: 'culture',
        label: 'Who around you already does this?',
        placeholder: 'e.g. Train with a colleague who never skips',
        optional: true
      }
    ]
  },
  {
    key: 'easy',
    law: 'easy',
    lawLabel: HABIT_LAW_LABELS.easy,
    title: 'Make it easy',
    intro:
      'Scale the habit down until starting takes two minutes or less. You are mastering the act of showing up first; the size comes later.',
    source: 'Chapters 11–14 — the Two-Minute Rule, reducing friction',
    fields: [
      {
        key: 'twoMinuteVersion',
        label: 'The two-minute version',
        placeholder: 'e.g. Put on training shoes and do one set'
      },
      {
        key: 'friction',
        label: 'What friction can you remove?',
        placeholder: 'e.g. Cancel the far-away gym, train at home',
        multiline: true,
        optional: true
      }
    ]
  },
  {
    key: 'satisfying',
    law: 'satisfying',
    lawLabel: HABIT_LAW_LABELS.satisfying,
    title: 'Make it satisfying',
    intro:
      'What is rewarded gets repeated. Give yourself something immediate, keep the streak visible, and agree the rule now: never miss twice.',
    source: 'Chapters 15–17 — reinforcement, habit tracking, accountability',
    fields: [
      {
        key: 'reward',
        label: 'Immediate reward when you finish',
        placeholder: 'e.g. Tick the routine off and take the long shower'
      },
      {
        key: 'tracking',
        label: 'How will you track it?',
        placeholder: 'e.g. As a Daily routine item in this app'
      },
      {
        key: 'missedPlan',
        label: 'What happens when you miss a day?',
        placeholder: 'e.g. Do the two-minute version tomorrow, no matter what',
        multiline: true,
        optional: true
      }
    ]
  }
]

export const HABIT_WIZARD_FIELD_KEYS = HABIT_WIZARD_STEPS.flatMap(step =>
  step.fields.map(field => field.key)
)

export function isHabitWizardFieldKey(value: string) {
  return HABIT_WIZARD_FIELD_KEYS.includes(value)
}

/** The habit's display name, falling back so a draft is still identifiable. */
export function habitPlanTitle(answers: Record<string, string>) {
  return (answers.habitName || answers.identityStatement || '').trim() || 'Untitled habit'
}
