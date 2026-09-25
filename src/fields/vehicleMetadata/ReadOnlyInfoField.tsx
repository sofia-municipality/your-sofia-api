'use client'

import { FieldDescription, FieldLabel } from '@payloadcms/ui'
import type { NumberFieldClientProps, StaticDescription, StaticLabel } from 'payload'

/** Payload-styled read-only input that shows `text` in place of the field's raw value. */
export function ReadOnlyInfoField({
  field,
  path,
  text,
}: Pick<NumberFieldClientProps, 'field' | 'path'> & { text: string }) {
  return (
    <div className="field-type text read-only">
      <FieldLabel label={field.label as StaticLabel} path={path} />
      <div className="field-type__wrap">
        <input id={`field-${path}`} type="text" value={text} readOnly disabled />
      </div>
      <FieldDescription description={field.admin?.description as StaticDescription} path={path} />
    </div>
  )
}
