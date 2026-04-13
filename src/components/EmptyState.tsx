interface EmptyStateProps {
  onOpenFile: () => void
  onOpenDemo: () => void
}

export function EmptyState({ onOpenFile, onOpenDemo }: EmptyStateProps) {
  return (
    <section className="flex h-full items-center justify-center p-8">
      <div className="max-w-2xl rounded-[32px] border border-slate-800 bg-slate-950/70 p-8 shadow-2xl">
        <div className="mb-6 inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-blue-200">GLB only · TypeScript editor</div>
        <h1 className="text-3xl font-semibold text-slate-50">GLB 파일을 열어 작업을 시작하세요.</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">scene object를 선택·복사·이동·수정한 뒤 Apply/Export까지 이어지는 상단뷰 편집기입니다. Apply는 preview/export 기준 상태를 갱신하고, Export는 수정된 위치/추가/삭제를 반영한 GLB를 다시 만듭니다.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenFile} className="rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-slate-950 hover:bg-blue-400">Open GLB</button>
          <button type="button" onClick={onOpenDemo} className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-200 hover:border-slate-500">Load Demo Scene</button>
        </div>
        <ul className="mt-8 space-y-2 text-sm text-slate-400">
          <li>• 좌표계: X 좌우 / Y 전후 / Z 상하</li>
          <li>• 편집 평면: XY plane</li>
          <li>• Validation: ID 중복, 슬롯 충돌, animation 범위 검사</li>
          <li>• Preview: applied scene 3D orbit view</li>
        </ul>
      </div>
    </section>
  )
}
