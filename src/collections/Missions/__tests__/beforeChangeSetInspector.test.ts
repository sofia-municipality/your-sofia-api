import { beforeChangeSetInspector } from '../hooks/beforeChangeSetInspector'

type MissionData = { title?: string; inspector?: number }
type HookArgs = {
  data: MissionData
  operation: 'create' | 'update'
  user?: { id: number } | null
}

const runHook = ({ data, operation, user = { id: 7 } }: HookArgs): MissionData =>
  beforeChangeSetInspector({
    data,
    operation,
    req: { user, payload: { logger: { info: jest.fn() } } },
  } as unknown as Parameters<typeof beforeChangeSetInspector>[0])

describe('beforeChangeSetInspector hook (unit)', () => {
  it('sets the inspector to the user who creates the mission', () => {
    const data = { title: 'Clean the park' }

    const result = runHook({ data, operation: 'create' })

    expect(result).toEqual({ title: 'Clean the park', inspector: 7 })
    expect(data).not.toHaveProperty('inspector')
  })

  it('keeps an explicitly chosen inspector', () => {
    const data = { title: 'Clean the park', inspector: 3 }
    expect(runHook({ data, operation: 'create' })).toBe(data)
  })

  it('does nothing without an authenticated user', () => {
    const data = { title: 'Clean the park' }
    expect(runHook({ data, operation: 'create', user: null })).toBe(data)
  })

  it('does nothing on update', () => {
    const data = { title: 'Clean the park' }
    expect(runHook({ data, operation: 'update' })).toBe(data)
  })
})
