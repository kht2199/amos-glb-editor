import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'
import type { BackgroundObjectEntity, Face, LiftEntity, ObjectKind, PortEntity, PortSemanticRole, PortType } from '../types'

const FACE_OPTIONS: Face[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT']
const PORT_TYPE_OPTIONS: PortType[] = ['IN', 'OUT', 'INOUT']
const PORT_ROLE_OPTIONS: PortSemanticRole[] = ['LIFT_DOCK', 'STOCKER_ACCESS', 'TOOL_LOAD', 'BUFFER_HANDOFF']
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400'
const dangerButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/20'

export function InspectorPanel() {
  const { selectedId, draftLifts, draftPorts, draftBackgroundObjects, objectTypeDefinitions, updateLift, updatePort, updateBackgroundObject, setObjectType, deletePort, validationIssues } = useEditorStore(useShallow((state) => ({
    selectedId: state.selectedId,
    draftLifts: state.draftLifts,
    draftPorts: state.draftPorts,
    draftBackgroundObjects: state.draftBackgroundObjects,
    objectTypeDefinitions: state.objectTypeDefinitions,
    updateLift: state.updateLift,
    updatePort: state.updatePort,
    updateBackgroundObject: state.updateBackgroundObject,
    setObjectType: state.setObjectType,
    deletePort: state.deletePort,
    validationIssues: state.validationIssues,
  })))

  const selectedLift = draftLifts.find((item) => item.editorId === selectedId) ?? null
  const selectedPort = draftPorts.find((item) => item.editorId === selectedId && !item.deleted) ?? null
  const selectedReadonly = draftBackgroundObjects.find((item) => item.editorId === selectedId) ?? null
  const issues = useMemo(() => validationIssues.filter((issue) => issue.targetId === selectedId), [selectedId, validationIssues])
  const objectTypeOptions = objectTypeDefinitions.map((definition) => definition.name as ObjectKind)

  return (
    <aside className="flex min-h-[220px] flex-col border-t border-slate-800 bg-slate-950/40 lg:h-full lg:min-h-0 lg:border-t-0 lg:border-l">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Inspector</h2>
        <p className="mt-1 text-xs text-slate-500">Selection-aware editing with inline rules.</p>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4 text-sm">
        {!selectedLift && !selectedPort && !selectedReadonly ? <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-slate-400"><p className="font-medium text-slate-200">선택된 객체가 없습니다.</p><p className="mt-2 text-sm leading-6">객체를 선택하면 우측에서 속성과 좌표를 수정할 수 있습니다.</p></div> : null}

        {selectedLift ? (
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <HeaderBadge title={selectedLift.id} badge="Lift" />
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedLift.objectType} onChange={(event) => setObjectType(selectedLift.editorId, event.target.value as ObjectKind)}>{objectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedLift.id} onChange={(event) => updateLift(selectedLift.editorId, { id: event.target.value, nodeName: event.target.value })} /></Field>
            <DoubleField>
              <NumberField label="X" value={selectedLift.position.x} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, x: value } })} />
              <NumberField label="Y" value={selectedLift.position.y} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, y: value } })} />
            </DoubleField>
            <DoubleField>
              <NumberField label="Z" value={selectedLift.position.z} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, z: value } })} />
              <Field label="Rotation"><select className={fieldClass} value={selectedLift.rotation} onChange={(event) => updateLift(selectedLift.editorId, { rotation: Number(event.target.value) as LiftEntity['rotation'] })}>{[0, 90, 180, 270].map((value) => <option key={value} value={value}>{value}°</option>)}</select></Field>
            </DoubleField>
            <ScaleField value={scalePercent(selectedLift)} onChange={(value) => updateLift(selectedLift.editorId, { scale: uniformScaleFromPercent(value) })} />
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Animation</p>
              <DoubleField>
                <Field label="Enabled"><select className={fieldClass} value={selectedLift.animation.enabled ? 'true' : 'false'} onChange={(event) => updateLift(selectedLift.editorId, { animation: { ...selectedLift.animation, enabled: event.target.value === 'true' } })}><option value="true">ON</option><option value="false">OFF</option></select></Field>
                <NumberField label="Speed" value={selectedLift.animation.speed} onChange={(value) => updateLift(selectedLift.editorId, { animation: { ...selectedLift.animation, speed: value } })} />
              </DoubleField>
              <DoubleField>
                <NumberField label="Min Z" value={selectedLift.animation.minZ} onChange={(value) => updateLift(selectedLift.editorId, { animation: { ...selectedLift.animation, minZ: value } })} />
                <NumberField label="Max Z" value={selectedLift.animation.maxZ} onChange={(value) => updateLift(selectedLift.editorId, { animation: { ...selectedLift.animation, maxZ: value } })} />
              </DoubleField>
            </div>
            <IssueList issues={issues} />
          </section>
        ) : null}

        {selectedPort ? (
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <HeaderBadge title={selectedPort.id} badge="Port" />
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedPort.objectType} onChange={(event) => setObjectType(selectedPort.editorId, event.target.value as ObjectKind)}>{objectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedPort.id} onChange={(event) => updatePort(selectedPort.editorId, { id: event.target.value, nodeName: event.target.value })} /></Field>
            <Field label="Domain Parent"><input className={fieldClass} value={`${selectedPort.domainParentType} · ${selectedPort.domainParentId}`} disabled /></Field>
            <p className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs leading-5 text-slate-400">포트 높이는 <code className="rounded bg-slate-900 px-1 py-0.5 text-slate-200">Z</code> 값으로 직접 관리합니다.</p>
            <Field label="Semantic Role"><select className={fieldClass} value={selectedPort.semanticRole} onChange={(event) => updatePort(selectedPort.editorId, { semanticRole: event.target.value as PortSemanticRole })}>{PORT_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <DoubleField>
              <Field label="Face"><select className={fieldClass} value={selectedPort.face} onChange={(event) => updatePort(selectedPort.editorId, { face: event.target.value as Face })}>{FACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
              <NumberField label="Slot" value={selectedPort.slot} onChange={(value) => updatePort(selectedPort.editorId, { slot: value })} />
            </DoubleField>
            <DoubleField>
              <NumberField label="X" value={selectedPort.position.x} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, x: value } })} />
              <NumberField label="Y" value={selectedPort.position.y} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, y: value } })} />
            </DoubleField>
            <DoubleField>
              <NumberField label="Z" value={selectedPort.position.z} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, z: value } })} />
              <Field label="Type"><select className={fieldClass} value={selectedPort.portType} onChange={(event) => updatePort(selectedPort.editorId, { portType: event.target.value as PortType })}>{PORT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            </DoubleField>
            <ScaleField value={scalePercent(selectedPort)} onChange={(value) => updatePort(selectedPort.editorId, { scale: uniformScaleFromPercent(value) })} />
            <IssueList issues={issues} />
            <button type="button" className={dangerButton} onClick={() => deletePort(selectedPort.editorId)}><Trash2 className="h-4 w-4" />Delete Port</button>
          </section>
        ) : null}

        {selectedReadonly ? (
          <section className="space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <HeaderBadge title={selectedReadonly.id} badge={selectedReadonly.objectType} />
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedReadonly.objectType} onChange={(event) => setObjectType(selectedReadonly.editorId, event.target.value as ObjectKind)}>{objectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedReadonly.id} onChange={(event) => updateBackgroundObject(selectedReadonly.editorId, { id: event.target.value, nodeName: event.target.value })} /></Field>
            <DoubleField>
              <NumberField label="X" value={selectedReadonly.position.x} onChange={(value) => updateBackgroundObject(selectedReadonly.editorId, { position: { ...selectedReadonly.position, x: value } })} />
              <NumberField label="Y" value={selectedReadonly.position.y} onChange={(value) => updateBackgroundObject(selectedReadonly.editorId, { position: { ...selectedReadonly.position, y: value } })} />
            </DoubleField>
            <NumberField label="Z" value={selectedReadonly.position.z} onChange={(value) => updateBackgroundObject(selectedReadonly.editorId, { position: { ...selectedReadonly.position, z: value } })} />
            <ScaleField value={scalePercent(selectedReadonly)} onChange={(value) => updateBackgroundObject(selectedReadonly.editorId, { scale: uniformScaleFromPercent(value) })} />
            <p className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">배경 오브젝트도 Move 모드와 Inspector에서 좌표를 조정하고 objectType을 재분류할 수 있습니다.</p>
            <IssueList issues={issues} />
          </section>
        ) : null}
      </div>
    </aside>
  )
}

function HeaderBadge({ title, badge }: { title: string; badge: string }) {
  return <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-100">{title}</h3><span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">{badge}</span></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{label}</span>{children}</label>
}

function DoubleField({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input className={fieldClass} type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></Field>
}

function ScaleField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <NumberField label="Scale (%)" value={value} onChange={onChange} />
}

function scalePercent(entity: Pick<LiftEntity | PortEntity | BackgroundObjectEntity, 'scale'>) {
  return Math.round((entity.scale?.x ?? 1) * 100)
}

function uniformScaleFromPercent(value: number) {
  const normalized = Math.max(value || 0, 10) / 100
  return { x: normalized, y: normalized, z: normalized }
}

function IssueList({ issues }: { issues: Array<{ id: string; message: string }> }) {
  if (!issues.length) return <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">Validation: OK</p>
  return <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100"><p className="font-medium">Validation issues</p><ul className="list-disc space-y-1 pl-5">{issues.map((issue) => <li key={issue.id}>{issue.message}</li>)}</ul></div>
}
