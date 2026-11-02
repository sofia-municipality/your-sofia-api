import { beforeChangeSetReporter } from '../hooks/beforeChangeSetReporter'

type SignalData = { title?: string; reporter?: number }
type HookArgs = { data: SignalData; operation: 'create' | 'update'; user?: { id: number } | null }

const runHook = ({ data, operation, user = { id: 7 } }: HookArgs): SignalData =>
  beforeChangeSetReporter({ data, operation, req: { user } } as unknown as Parameters<
    typeof beforeChangeSetReporter
  >[0])

describe('beforeChangeSetReporter hook (unit)', () => {
  it('sets the reporter to the authenticated user on create', () => {
    const data = { title: 'Full container' }

    expect(runHook({ data, operation: 'create' })).toEqual({ title: 'Full container', reporter: 7 })
    expect(data).not.toHaveProperty('reporter')
  })

  it('leaves anonymous signals without a reporter', () => {
    const data = { title: 'Full container' }
    expect(runHook({ data, operation: 'create', user: null })).toBe(data)
  })

  it('does not change the reporter on update', () => {
    const data = { title: 'Full container', reporter: 3 }
    expect(runHook({ data, operation: 'update' })).toBe(data)
  })
})
