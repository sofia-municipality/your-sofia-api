// payload uses ESM — mock it so Jest can import the hook's APIError
jest.mock('payload', () => ({
  APIError: class APIError extends Error {
    status: number
    constructor(message: string, status = 500) {
      super(message)
      this.name = 'APIError'
      this.status = status
    }
  },
}))

import { beforeValidateLockTasks } from '../hooks/beforeValidateLockTasks'

type Task = { id?: string; title?: string }
type MissionData = { status?: string; tasks?: Task[] }
type HookArgs = { data?: MissionData; originalDoc?: MissionData; operation: 'create' | 'update' }

const LOCKED_STATUSES = ['in_progress', 'ready_for_review', 'returned_for_improvement', 'completed']

const runHook = ({ data, originalDoc, operation }: HookArgs): MissionData | undefined =>
  beforeValidateLockTasks({
    data,
    originalDoc,
    operation,
    req: { payload: { logger: { info: jest.fn() } } },
  } as unknown as Parameters<typeof beforeValidateLockTasks>[0])

const catchError = (fn: () => unknown): unknown => {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error('Expected the hook to throw')
}

const originalTasks: Task[] = [
  { id: 't1', title: 'Collect litter' },
  { id: 't2', title: 'Paint bench' },
]

describe('beforeValidateLockTasks hook (unit)', () => {
  it('ignores creates', () => {
    const data = { status: 'in_progress', tasks: [{ id: 'new' }] }
    expect(runHook({ data, operation: 'create' })).toBe(data)
  })

  it('ignores updates without the original doc or without incoming tasks', () => {
    const data = { tasks: [{ id: 'new' }] }
    expect(runHook({ data, operation: 'update' })).toBe(data)

    const dataWithoutTasks = { status: 'completed' }
    expect(
      runHook({
        data: dataWithoutTasks,
        originalDoc: { status: 'in_progress', tasks: originalTasks },
        operation: 'update',
      })
    ).toBe(dataWithoutTasks)
  })

  it('allows restructuring tasks before the mission has started', () => {
    for (const status of ['draft', 'open', 'cancelled', undefined]) {
      const data = { tasks: [{ id: 't2' }, { id: 't3' }] }
      expect(
        runHook({ data, originalDoc: { status, tasks: originalTasks }, operation: 'update' })
      ).toBe(data)
    }
  })

  it('allows editing task text once the mission has started', () => {
    for (const status of LOCKED_STATUSES) {
      const data = {
        tasks: [
          { id: 't1', title: 'Collect all litter' },
          { id: 't2', title: 'Paint bench' },
        ],
      }
      expect(
        runHook({ data, originalDoc: { status, tasks: originalTasks }, operation: 'update' })
      ).toBe(data)
    }
  })

  it('rejects adding, removing, replacing or reordering tasks once the mission has started', () => {
    const changedTaskLists: Task[][] = [
      [...originalTasks, { id: 't3' }],
      [{ id: 't1' }],
      [{ id: 't1' }, { id: 'replaced' }],
      [{ id: 't2' }, { id: 't1' }],
    ]

    for (const status of LOCKED_STATUSES) {
      for (const tasks of changedTaskLists) {
        const error = catchError(() =>
          runHook({
            data: { tasks },
            originalDoc: { status, tasks: originalTasks },
            operation: 'update',
          })
        )
        expect(error).toMatchObject({
          name: 'APIError',
          status: 400,
          message: expect.stringContaining('Задачите не могат да бъдат добавяни'),
        })
      }
    }
  })

  it('treats a started mission without tasks as an empty task list', () => {
    const originalDoc = { status: 'in_progress' }

    const data = { tasks: [] }
    expect(runHook({ data, originalDoc, operation: 'update' })).toBe(data)

    const error = catchError(() =>
      runHook({ data: { tasks: [{ id: 't1' }] }, originalDoc, operation: 'update' })
    )
    expect(error).toMatchObject({ status: 400 })
  })
})
