# AMOS GLB Editor - Development Notes

## 작업 범위 원칙

- 이 `glb-editor` 저장소 작업에서는 `../domain/docs/`를 objectType, metadata, ontology-linked constraint를 해석하기 위한 참고/source-of-truth 문맥으로만 사용한다.
- 사용자가 명시적으로 요청하지 않으면 `domain` 저장소 문서를 직접 수정하거나, 정리 대상을 다른 저장소까지 확장하지 않는다.
- 편집기 동작, import/export, collision guidance, metadata mapping 문서는 기본적으로 `glb-editor` 저장소 범위 안에서 유지한다.

## domain reference guide 사용

- 구현 정렬이 필요하면 먼저 `../domain/docs/programs/implementation-repo-reference-guide.md` 를 읽는다.
- 그 다음 이 저장소의 `README.md`, `docs/concept-code-mapping.md`, 실제 editor/store/lib/component 구조를 기준으로 로컬 반영 위치를 확인한다.
- domain은 semantic reference를 제공하고, `glb-editor` 저장소는 scene editing/object metadata/collision ownership을 가진다.
- domain 문서 내용을 이 저장소에 중복 복제하지 말고, glb-editor 관점의 대응 범위와 gap만 기록한다.

## 구현 정렬 원칙

- `glb-editor`는 AMOS runtime orchestration 저장소가 아니라 scene/domain entity editor라는 점을 항상 유지한다.
- `../domain/docs/ontology/minimal-runtime-model.md` 는 직접 구현 기준이 아니라 경계 확인용 reference로 본다.
- 이 저장소에서는 `Request`, `Task`, `Policy`, `ExecutionTrace`를 runtime 엔진처럼 억지로 구현하려 하지 말고, 편집 세션 액션 / collision / history / metadata constraint와의 대응 범위를 명확히 적는다.
- ontology-linked constraint, objectType 재분류, parent inference, editable metadata 범위는 문서와 코드에서 함께 관리한다.

## Archived docs handling

- `docs/archive/` 아래 파일이 있다면 normal development의 active 기준으로 읽거나 인용하지 않는다.
- archive/reference 메모보다 현재 README, `docs/concept-code-mapping.md`, 실제 편집 코드(`src/store`, `src/lib`, `src/components`)를 우선한다.
