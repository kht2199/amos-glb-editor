import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useEditorStore } from '../store/editor-store'
import type { DomainParentType, Face, LiftEntity, ObjectKind, PortLevel, PortSemanticRole, PortType } from '../types'

const FACE_OPTIONS: Face[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT']
const LEVEL_OPTIONS: PortLevel[] = ['TOP', 'BOTTOM']
const LEVEL_LABELS: Record<PortLevel, string> = { TOP: 'Higher Z', BOTTOM: 'Lower Z' }
const PORT_TYPE_OPTIONS: PortType[] = ['IN', 'OUT', 'INOUT']
const PORT_ROLE_OPTIONS: PortSemanticRole[] = ['LIFT_DOCK', 'STOCKER_ACCESS', 'TOOL_LOAD', 'BUFFER_HANDOFF']
const DOMAIN_PARENT_OPTIONS: DomainParentType[] = ['Lift', 'Stocker', 'Transport', 'Bridge', 'Rail']
const OBJECT_TYPE_OPTIONS: ObjectKind[] = ['Lift', 'Port', 'Bridge', 'Rail', 'Stocker', 'Transport']
const fieldClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-400'
const primaryButton = 'rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400'
const secondaryButton = 'rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500'
const dangerButton = 'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 hover:bg-rose-500/20'

export function InspectorPanel() {
  const { selectedId, lifts, ports, readonlyObjects, updateLift, updatePort, setObjectType, deletePort, addPortDraft, updateAddPortDraft, confirmAddPort, cancelAddPort, validationIssues } = useEditorStore(useShallow((state) => ({
    selectedId: state.selectedId,
    lifts: state.lifts,
    ports: state.ports,
    readonlyObjects: state.readonlyObjects,
    updateLift: state.updateLift,
    updatePort: state.updatePort,
    setObjectType: state.setObjectType,
    deletePort: state.deletePort,
    addPortDraft: state.addPortDraft,
    updateAddPortDraft: state.updateAddPortDraft,
    confirmAddPort: state.confirmAddPort,
    cancelAddPort: state.cancelAddPort,
    validationIssues: state.validationIssues,
  })))

  const selectedLift = lifts.find((item) => item.editorId === selectedId) ?? null
  const selectedPort = ports.find((item) => item.editorId === selectedId && !item.deleted) ?? null
  const selectedReadonly = readonlyObjects.find((item) => item.editorId === selectedId) ?? null
  const issues = useMemo(() => validationIssues.filter((issue) => issue.targetId === selectedId), [selectedId, validationIssues])

  return (
    <aside className="flex h-full flex-col border-l border-slate-800 bg-slate-950/40">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Inspector</h2>
        <p className="mt-1 text-xs text-slate-500">Selection-aware editing with inline rules.</p>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-4 text-sm">
        {addPortDraft ? (
          <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="font-semibold text-emerald-100">Add Port Mode</h3>
            <Field label="Port ID"><input className={fieldClass} value={addPortDraft.id} onChange={(event) => updateAddPortDraft({ id: event.target.value })} /></Field>
            <Field label="Parent Lift"><select className={fieldClass} value={addPortDraft.parentLiftId} onChange={(event) => updateAddPortDraft({ parentLiftId: event.target.value })}>{lifts.map((lift) => <option key={lift.editorId} value={lift.editorId}>{lift.id}</option>)}</select></Field>
            <DoubleField>
              <Field label="Level"><select className={fieldClass} value={addPortDraft.level} onChange={(event) => updateAddPortDraft({ level: event.target.value as PortLevel })}>{LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{LEVEL_LABELS[option]}</option>)}</select></Field>
              <Field label="Type"><select className={fieldClass} value={addPortDraft.portType} onChange={(event) => updateAddPortDraft({ portType: event.target.value as PortType })}>{PORT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            </DoubleField>
            <DoubleField>
              <Field label="Semantic Role"><select className={fieldClass} value={addPortDraft.semanticRole} onChange={(event) => updateAddPortDraft({ semanticRole: event.target.value as PortSemanticRole })}>{PORT_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
              <Field label="Domain Parent"><select className={fieldClass} value={addPortDraft.domainParentType} onChange={(event) => updateAddPortDraft({ domainParentType: event.target.value as DomainParentType })}>{DOMAIN_PARENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            </DoubleField>
            <DoubleField>
              <Field label="Face"><select className={fieldClass} value={addPortDraft.face} onChange={(event) => updateAddPortDraft({ face: event.target.value as Face })}>{FACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
              <Field label="Slot"><input className={fieldClass} type="number" min={1} value={addPortDraft.slot} onChange={(event) => updateAddPortDraft({ slot: Number(event.target.value) || 1 })} /></Field>
            </DoubleField>
            <div className="flex gap-2 pt-1"><button type="button" className={primaryButton} onClick={confirmAddPort}>Confirm Add</button><button type="button" className={secondaryButton} onClick={cancelAddPort}>Cancel</button></div>
          </section>
        ) : null}

        {!selectedLift && !selectedPort && !selectedReadonly && !addPortDraft ? <div className="rounded-2xl border border-dashed border-slate-700 p-4 text-slate-400"><p className="font-medium text-slate-200">선택된 객체가 없습니다.</p><p className="mt-2 text-sm leading-6">Lift 또는 Port를 선택하면 우측에서 속성을 수정할 수 있습니다.</p></div> : null}

        {selectedLift ? (
          <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <HeaderBadge title={selectedLift.id} badge="Lift" />
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedLift.objectType} onChange={(event) => setObjectType(selectedLift.editorId, event.target.value as ObjectKind)}>{OBJECT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedLift.id} onChange={(event) => updateLift(selectedLift.editorId, { id: event.target.value, nodeName: event.target.value })} /></Field>
            <DoubleField>
              <NumberField label="X" value={selectedLift.position.x} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, x: value } })} />
              <NumberField label="Y" value={selectedLift.position.y} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, y: value } })} />
            </DoubleField>
            <DoubleField>
              <NumberField label="Z" value={selectedLift.position.z} onChange={(value) => updateLift(selectedLift.editorId, { position: { ...selectedLift.position, z: value } })} />
              <Field label="Rotation"><select className={fieldClass} value={selectedLift.rotation} onChange={(event) => updateLift(selectedLift.editorId, { rotation: Number(event.target.value) as LiftEntity['rotation'] })}>{[0, 90, 180, 270].map((value) => <option key={value} value={value}>{value}°</option>)}</select></Field>
            </DoubleField>
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
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedPort.objectType} onChange={(event) => setObjectType(selectedPort.editorId, event.target.value as ObjectKind)}>{OBJECT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedPort.id} onChange={(event) => updatePort(selectedPort.editorId, { id: event.target.value, nodeName: event.target.value })} /></Field>
            <Field label="Domain Parent"><input className={fieldClass} value={`${selectedPort.domainParentType} · ${selectedPort.domainParentId}`} disabled /></Field>
            <DoubleField>
              <Field label="Level"><select className={fieldClass} value={selectedPort.level} onChange={(event) => updatePort(selectedPort.editorId, { level: event.target.value as PortLevel })}>{LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{LEVEL_LABELS[option]}</option>)}</select></Field>
              <Field label="Type"><select className={fieldClass} value={selectedPort.portType} onChange={(event) => updatePort(selectedPort.editorId, { portType: event.target.value as PortType })}>{PORT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            </DoubleField>
            <Field label="Semantic Role"><select className={fieldClass} value={selectedPort.semanticRole} onChange={(event) => updatePort(selectedPort.editorId, { semanticRole: event.target.value as PortSemanticRole })}>{PORT_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <DoubleField>
              <Field label="Face"><select className={fieldClass} value={selectedPort.face} onChange={(event) => updatePort(selectedPort.editorId, { face: event.target.value as Face })}>{FACE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
              <NumberField label="Slot" value={selectedPort.slot} onChange={(value) => updatePort(selectedPort.editorId, { slot: value })} />
            </DoubleField>
            <DoubleField>
              <NumberField label="X" value={selectedPort.position.x} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, x: value } })} />
              <NumberField label="Y" value={selectedPort.position.y} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, y: value } })} />
            </DoubleField>
            <NumberField label="Z" value={selectedPort.position.z} onChange={(value) => updatePort(selectedPort.editorId, { position: { ...selectedPort.position, z: value } })} />
            <IssueList issues={issues} />
            <button type="button" className={dangerButton} onClick={() => deletePort(selectedPort.editorId)}><Trash2 className="h-4 w-4" />Delete Port</button>
          </section>
        ) : null}

        {selectedReadonly ? (
          <section className="space-y-3 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <HeaderBadge title={selectedReadonly.id} badge={`${selectedReadonly.objectType} · RO`} />
            <Field label="Object Type"><select aria-label="Object Type" className={fieldClass} value={selectedReadonly.objectType} onChange={(event) => setObjectType(selectedReadonly.editorId, event.target.value as ObjectKind)}>{OBJECT_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
            <Field label="ID"><input className={fieldClass} value={selectedReadonly.id} disabled /></Field>
            <Field label="Position"><input className={fieldClass} value={`X ${selectedReadonly.position.x} · Y ${selectedReadonly.position.y} · Z ${selectedReadonly.position.z}`} disabled /></Field>
            <p className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">이 객체는 읽기 전용입니다. 선택 및 조회만 가능합니다.</p>
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
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><input className={fieldClass} type="number" value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} /></Field>
}

function IssueList({ issues }: { issues: Array<{ id: string; message: string }> }) {
  if (!issues.length) return <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">Validation: OK</p>
  return <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100"><p className="font-medium">Validation issues</p><ul className="list-disc space-y-1 pl-5">{issues.map((issue) => <li key={issue.id}>{issue.message}</li>)}</ul></div>
}
