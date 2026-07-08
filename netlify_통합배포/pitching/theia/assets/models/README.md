# Skeleton GLB assets

| 파일 | 용도 |
|------|------|
| `skeleton.glb` | **표시용** — Mixamo/Blender rigged humanoid (권장 ≤3MB) |
| `skeleton.gltf` | 매핑 검증용 placeholder (화면에는 **박스 procedural** 사용) |

## 동작

- `assets/models/skeleton.glb`가 **실제 humanoid**이면 Skeleton β가 GLB로 자동 전환
- 저장소 placeholder(`biomotion-poc-placeholder`)는 박스가 더 깔끔 → **procedural 유지**
- 강제 GLB 테스트: 브라우저 콘솔 `localStorage.setItem('bm_anatomical_mesh','glb')` 후 새로고침
- 박스 고정: `localStorage.setItem('bm_anatomical_mesh','procedural')` (기본 auto와 동일)

## Mixamo 교체

1. T-pose humanoid export → `skeleton.glb`로 이 폴더에 저장
2. `python3 build.py` · 배포 동기화
3. bone 이름 불일치 시 `src/modules/anatomical_skeleton_viewer.js` `glbNames` alias 추가

`scripts/gltf_to_glb.py` — placeholder gltf → glb 변환 (배포·로더 검증용)
