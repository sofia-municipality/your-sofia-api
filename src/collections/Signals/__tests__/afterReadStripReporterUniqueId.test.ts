import { afterReadStripReporterUniqueId } from '../hooks/afterReadStripReporterUniqueId'

type SignalDoc = { id: number; reporterUniqueId?: string }

const runHook = (doc: SignalDoc, user: { role: string } | null): SignalDoc =>
  afterReadStripReporterUniqueId({ doc, req: { user } } as unknown as Parameters<
    typeof afterReadStripReporterUniqueId
  >[0])

describe('afterReadStripReporterUniqueId hook (unit)', () => {
  it('hides the reporter id from non-admin users and anonymous visitors', () => {
    for (const user of [
      null,
      { role: 'user' },
      { role: 'inspector' },
      { role: 'containerAdmin' },
    ]) {
      expect(runHook({ id: 1, reporterUniqueId: 'R1' }, user).reporterUniqueId).toBeUndefined()
    }
  })

  it('keeps the reporter id for admins', () => {
    expect(runHook({ id: 1, reporterUniqueId: 'R1' }, { role: 'admin' }).reporterUniqueId).toBe(
      'R1'
    )
  })
})
