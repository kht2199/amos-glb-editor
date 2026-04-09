import { lazy, Suspense, useEffect, useRef } from 'react'
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

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { fileName, loadFile, openDemoScene } = useEditorStore(useShallow((state) => ({
    fileName: state.fileName,
    loadFile: state.loadFile,
    openDemoScene: state.openDemoScene,
  })))

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        fileInputRef.current?.click()
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        useEditorStore.getState().saveSession()
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
    <div className="relative flex min-h-screen flex-col text-slate-100">
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

      <Toolbar onOpenFile={() => fileInputRef.current?.click()} />

      <main className="relative flex flex-1 flex-col overflow-auto lg:grid lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:overflow-hidden">
        {fileName ? (
          <>
            <StructurePanel />
            <TopViewCanvas />
            <div className="flex min-h-0 flex-col lg:min-h-0">
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
