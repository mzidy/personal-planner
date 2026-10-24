import { isSameDay, parseISO } from 'date-fns'
import { VOICE_COMMANDS } from '~~/shared/utils/voice-commands'
import { HELP_SPEECH, LINK_SPEECH, type AlexaResponse, confirmation, linkCodeFrom, speak, todaySpeech, weightFrom } from '~~/server/utils/alexa-speech'
import { useAlexaRepository } from '~~/server/utils/alexa-repository'
import { useRoutineRepository } from '~~/server/utils/routine-repository'
import { runVoiceAction } from '~~/server/utils/voice-actions'
import { type VacuumAction, runVacuumAction } from '~~/server/utils/alexa-vacuum'

/** The parts of an Alexa request envelope the skill reads. */
export interface AlexaEnvelope {
  session?: { user?: { userId?: string }; application?: { applicationId?: string } }
  context?: { System?: { user?: { userId?: string }; application?: { applicationId?: string } } }
  request?: {
    type?: string
    timestamp?: string
    intent?: { name?: string; slots?: Record<string, { value?: string }> }
  }
}

/** Intents that add something, and the Voice control command each one feeds. */
const ADD_INTENTS: Record<string, { command: string; slot: string; what: string }> = {
  ShoppingIntent: { command: 'shopping', slot: 'item', what: 'what to add to your shopping list' },
  TaskIntent: { command: 'task', slot: 'task', what: 'the task' },
  NoteIntent: { command: 'note', slot: 'note', what: 'the note' },
  DiaryIntent: { command: 'diary', slot: 'entry', what: 'the diary entry' },
  RoutineIntent: { command: 'routine', slot: 'routine', what: 'the routine item' }
}

const VACUUM_INTENTS: Record<string, VacuumAction> = {
  VacuumStartIntent: 'start',
  VacuumPauseIntent: 'pause',
  VacuumDockIntent: 'dock',
  VacuumFindIntent: 'find',
  VacuumStatusIntent: 'status'
}

export function applicationIdOf(envelope: AlexaEnvelope) {
  return envelope.context?.System?.application?.applicationId || envelope.session?.application?.applicationId || ''
}

async function today(userId: string) {
  const planner = usePlannerRepository()
  const [blocks, routine, objectives] = await Promise.all([
    planner.listTimeBlocks(userId),
    useRoutineRepository().getOverview(userId),
    planner.listObjectives(userId)
  ])
  const now = new Date()
  return todaySpeech({
    blocks: blocks.filter(block => isSameDay(parseISO(block.startsAt), now)).length,
    routineDone: routine.todayItems.filter(item => item.state === 'done').length,
    routineTotal: routine.todayItems.length,
    tasks: objectives.filter(objective => objective.status !== 'done').map(objective => ({ title: objective.title, urgency: objective.urgency }))
  })
}

async function runCommand(userId: string, key: string, text: string | null, what: string) {
  const command = VOICE_COMMANDS.find(entry => entry.key === key)!
  const action = text ? command.build(text, text) : null
  if (!action) {
    return speak(`Sorry, I did not catch ${what}.`)
  }
  await runVoiceAction(userId, action, 'alexa')
  return speak(confirmation(key, action))
}

/** Answers one verified request from the Serene planner skill. */
export async function handleAlexaRequest(envelope: AlexaEnvelope): Promise<AlexaResponse> {
  const request = envelope.request || {}
  const alexaUserId = envelope.context?.System?.user?.userId || envelope.session?.user?.userId || ''
  const repository = useAlexaRepository()

  if (request.type === 'SessionEndedRequest') {
    return { version: '1.0', response: {} }
  }

  const intent = request.intent?.name || ''
  const slot = (name: string) => request.intent?.slots?.[name]?.value?.trim() || undefined

  if (intent === 'AMAZON.StopIntent' || intent === 'AMAZON.CancelIntent' || intent === 'AMAZON.NavigateHomeIntent') {
    return speak('Okay.')
  }
  if (intent === 'AMAZON.HelpIntent') {
    return speak(HELP_SPEECH, { reprompt: 'What would you like to do?' })
  }

  if (intent === 'LinkIntent') {
    const code = linkCodeFrom(slot('code'))
    const userId = code && alexaUserId ? await repository.redeemLinkCode(code, alexaUserId) : null
    return userId
      ? speak('Linked. From now on I add things to your Serene planner.')
      : speak('That code did not work. In Serene, open Voice control and tap Link Alexa for a new one.')
  }

  const userId = alexaUserId ? await repository.findUserId(alexaUserId) : null
  if (!userId) {
    return speak(LINK_SPEECH)
  }

  try {
    if (request.type === 'LaunchRequest') {
      return speak('Agent Smith here. What would you like to do?', { reprompt: HELP_SPEECH })
    }
    if (intent === 'TodayIntent') {
      return speak(await today(userId))
    }
    const vacuum = VACUUM_INTENTS[intent]
    if (vacuum) {
      return speak(await runVacuumAction(userId, vacuum))
    }
    if (intent === 'WeightIntent') {
      return await runCommand(userId, 'weight', weightFrom(slot('kilos'), slot('decimal')), 'your weight')
    }
    const add = ADD_INTENTS[intent]
    if (add) {
      return await runCommand(userId, add.command, slot(add.slot) ?? null, add.what)
    }
    return speak(`Sorry, I can't do that yet. ${HELP_SPEECH}`, { reprompt: 'What would you like to do?' })
  } catch (error) {
    const message = (error as { statusMessage?: string })?.statusMessage
    return speak(message ? `That did not work: ${message}` : 'Something went wrong saving that. Please try again.')
  }
}
