import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { EmptyState } from './components/EmptyState'
import { ExportFeedbackModal } from './components/ExportFeedbackModal'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { StatusBar } from './components/StatusBar'
import { StructurePanel } from './components/StructurePanel'
import { Toolbar } from './components/Toolbar'
import { TopViewCanvas } from './components/TopViewCanvas'
import { ValidationDrawer } from './components/ValidationDrawer'
import { useEditorStore } from './store/editor-store'

const PreviewOverlay = lazy(async () => import('./components/PreviewOverlay').then((module) => ({ default: module.PreviewOverlay })))

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable
    || tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const { fileName, loadFile, importFile, openDemoScene } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    loadFile: state.loadFile,
    importFile: state.importFile,
    openDemoScene: state.openDemoScene,
  })))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        fileInputRef.current?.click()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault()
        useEditorStore.getState().undo()
      }
      if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') || ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'z')) {
        event.preventDefault()
        useEditorStore.getState().redo()
      }
      if (event.key.toLowerCase() === 'p' && fileName) {
        event.preventDefault()
        useEditorStore.getState().setPreviewOpen(true)
      }
      if (event.key.toLowerCase() === 'v' && fileName) useEditorStore.getState().setMode('select')
      if (event.key.toLowerCase() === 'm' && fileName) useEditorStore.getState().setMode('move')
      if (event.key.toLowerCase() === 'd' && fileName) {
        event.preventDefault()
        useEditorStore.getState().duplicateSelectedObject()
      }
      if (event.key === 'Escape') {
        useEditorStore.getState().setPreviewOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fileName])

  return (
    <div
      data-testid="app-shell"
      className="relative flex min-h-screen flex-col text-slate-100"
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragActive(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setIsDragActive(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragActive(false)
        const file = event.dataTransfer.files?.[0]
        if (!file) return
        if (fileName) {
          void importFile(file)
          return
        }
        void loadFile(file)
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void loadFile(file)
          event.currentTarget.value = ''
        }}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".glb"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importFile(file)
          event.currentTarget.value = ''
        }}
      />

      <Toolbar onOpenFile={() => fileInputRef.current?.click()} onImportFile={() => importInputRef.current?.click()} />

      {isDragActive ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-slate-100">
          {fileName ? 'Drop a GLB to import it into the current scene' : 'Drop a GLB to open it'}
        </div>
      ) : null}

      <main className="relative flex flex-1 flex-col overflow-auto lg:grid lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:overflow-hidden">
        {fileName ? (
          <>
            <TopViewCanvas />
            <StructurePanel />
            <div className="order-3 flex min-h-0 flex-col lg:order-3 lg:min-h-0">
              <div className="min-h-0 flex-1">
                <InspectorPanel />
              </div>
              <PreviewPanel />
            </div>
          </>
        ) : (
          <div className="lg:col-span-3">
            <EmptyState onOpenFile={() => fileInputRef.current?.click()} onOpenDemo={openDemoScene} />
          </div>
        )}

        <ValidationDrawer />
        <Suspense fallback={null}>
          <PreviewOverlay />
        </Suspense>
        <ExportFeedbackModal />
      </main>

      <StatusBar />
    </div>
  )
}
