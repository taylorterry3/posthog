import { PluginEvent } from '@posthog/plugin-scaffold'
import { mocked } from 'ts-jest/utils'

import { PreIngestionEvent } from '../../../../src/types'
import { createEventStep } from '../../../../src/worker/ingestion/event-pipeline/createEventStep'
import { determineShouldBufferStep } from '../../../../src/worker/ingestion/event-pipeline/determineShouldBufferStep'
import { pluginsProcessEventStep } from '../../../../src/worker/ingestion/event-pipeline/pluginsProcessEventStep'
import { prepareEventStep } from '../../../../src/worker/ingestion/event-pipeline/prepareEventStep'
import { runAsyncHandlersStep } from '../../../../src/worker/ingestion/event-pipeline/runAsyncHandlersStep'
import {
    EventPipelineRunner,
    EventPipelineStepsType,
    StepParameters,
    StepResult,
    StepType,
} from '../../../../src/worker/ingestion/event-pipeline/runner'
import { generateEventDeadLetterQueueMessage } from '../../../../src/worker/ingestion/utils'

jest.mock('../../../../src/utils/status')
jest.mock('../../../../src/worker/ingestion/event-pipeline/createEventStep')
jest.mock('../../../../src/worker/ingestion/event-pipeline/determineShouldBufferStep')
jest.mock('../../../../src/worker/ingestion/event-pipeline/pluginsProcessEventStep')
jest.mock('../../../../src/worker/ingestion/event-pipeline/prepareEventStep')
jest.mock('../../../../src/worker/ingestion/event-pipeline/runAsyncHandlersStep')
jest.mock('../../../../src/worker/ingestion/utils')

class TestEventPipelineRunner extends EventPipelineRunner {
    steps: Array<string> = []
    stepsWithArgs: Array<[string, any[]]> = []

    protected runStep<Step extends StepType, ArgsType extends StepParameters<EventPipelineStepsType[Step]>>(
        name: Step,
        ...args: ArgsType
    ): Promise<StepResult> {
        this.steps.push(name)
        this.stepsWithArgs.push([name, args])
        return super.runStep(name, ...args)
    }
}

const pluginEvent: PluginEvent = {
    distinct_id: 'my_id',
    ip: '127.0.0.1',
    site_url: 'http://localhost',
    team_id: 2,
    now: '2020-02-23T02:15:00Z',
    timestamp: '2020-02-23T02:15:00Z',
    event: 'default event',
    properties: {},
}

const preIngestionEvent: PreIngestionEvent = {
    eventUuid: 'uuid1',
    distinctId: 'my_id',
    ip: '127.0.0.1',
    siteUrl: 'example.com',
    teamId: 2,
    timestamp: '2020-02-23T02:15:00Z',
    event: '$pageview',
    properties: {},
    elementsList: [],
}

describe('EventPipelineRunner', () => {
    let runner: TestEventPipelineRunner
    let hub: any

    beforeEach(() => {
        hub = {
            db: {
                kafkaProducer: { queueMessage: jest.fn() },
                fetchPerson: jest.fn(),
            },
            statsd: {
                increment: jest.fn(),
                timing: jest.fn(),
            },
        }
        runner = new TestEventPipelineRunner(hub, pluginEvent)

        mocked(pluginsProcessEventStep).mockResolvedValue(['prepareEventStep', [pluginEvent]])
        mocked(prepareEventStep).mockResolvedValue(['determineShouldBufferStep', [preIngestionEvent]])
        mocked(determineShouldBufferStep).mockResolvedValue(['createEventStep', [preIngestionEvent]])
        mocked(createEventStep).mockResolvedValue(['runAsyncHandlersStep', [preIngestionEvent]])
        mocked(runAsyncHandlersStep).mockResolvedValue(null)
    })

    describe('runMainPipeline()', () => {
        it('runs all steps', async () => {
            await runner.runMainPipeline(pluginEvent)

            expect(runner.steps).toEqual([
                'pluginsProcessEventStep',
                'prepareEventStep',
                'determineShouldBufferStep',
                'createEventStep',
                'runAsyncHandlersStep',
            ])
            expect(runner.stepsWithArgs).toMatchSnapshot()
        })

        it('emits metrics for every step', async () => {
            await runner.runMainPipeline(pluginEvent)

            expect(hub.statsd.timing).toHaveBeenCalledTimes(5)
            expect(hub.statsd.increment).toBeCalledTimes(7)

            expect(hub.statsd.increment).toHaveBeenCalledWith('kafka_queue.event_pipeline.step', {
                step: 'createEventStep',
            })
            expect(hub.statsd.increment).toHaveBeenCalledWith('kafka_queue.event_pipeline.step.last', {
                step: 'runAsyncHandlersStep',
                team_id: '2',
            })
            expect(hub.statsd.increment).not.toHaveBeenCalledWith('kafka_queue.event_pipeline.step.error')
        })

        describe('early exits from pipeline', () => {
            beforeEach(() => {
                mocked(prepareEventStep).mockResolvedValue(null)
            })

            it('stops processing after step', async () => {
                await runner.runMainPipeline(pluginEvent)

                expect(runner.steps).toEqual(['pluginsProcessEventStep', 'prepareEventStep'])
            })

            it('reports metrics and last step correctly', async () => {
                await runner.runMainPipeline(pluginEvent)

                expect(hub.statsd.timing).toHaveBeenCalledTimes(2)
                expect(hub.statsd.increment).toHaveBeenCalledWith('kafka_queue.event_pipeline.step.last', {
                    step: 'prepareEventStep',
                    team_id: '2',
                })
                expect(hub.statsd.increment).not.toHaveBeenCalledWith('kafka_queue.event_pipeline.step.error')
            })
        })

        describe('errors during processing', () => {
            const error = new Error('testError')

            it('runs and increments metrics', async () => {
                mocked(prepareEventStep).mockRejectedValue(error)

                await runner.runMainPipeline(pluginEvent)

                expect(hub.statsd.increment).toHaveBeenCalledWith('kafka_queue.event_pipeline.step', {
                    step: 'pluginsProcessEventStep',
                })
                expect(hub.statsd.increment).not.toHaveBeenCalledWith('kafka_queue.event_pipeline.step', {
                    step: 'prepareEventStep',
                })
                expect(hub.statsd.increment).not.toHaveBeenCalledWith('kafka_queue.event_pipeline.step.last')
                expect(hub.statsd.increment).toHaveBeenCalledWith('kafka_queue.event_pipeline.step.error', {
                    step: 'prepareEventStep',
                })
            })

            it('emits failures to dead letter queue until createEvent', async () => {
                mocked(generateEventDeadLetterQueueMessage).mockReturnValue('DLQ event' as any)
                mocked(prepareEventStep).mockRejectedValue(error)

                await runner.runMainPipeline(pluginEvent)

                expect(hub.db.kafkaProducer.queueMessage).toHaveBeenCalledWith('DLQ event' as any)
                expect(hub.statsd.increment).toHaveBeenCalledWith('events_added_to_dead_letter_queue')
            })

            it('does not emit to dead letter queue for runAsyncHandlersStep', async () => {
                mocked(runAsyncHandlersStep).mockRejectedValue(error)

                await runner.runMainPipeline(pluginEvent)

                expect(hub.db.kafkaProducer.queueMessage).not.toHaveBeenCalled()
                expect(hub.statsd.increment).not.toHaveBeenCalledWith('events_added_to_dead_letter_queue')
            })
        })
    })

    describe('runBufferPipeline()', () => {
        it('runs remaining steps', async () => {
            await runner.runBufferPipeline(preIngestionEvent)

            expect(runner.steps).toEqual(['createEventStep', 'runAsyncHandlersStep'])
            expect(runner.stepsWithArgs).toMatchSnapshot()
        })
    })
})
