# Archived visualizers (Skeleton β · Anatomical Legacy)

Production UI (2026-06-06) uses **Stick viewer only**.

Source files remain under `src/modules/` for reference and future QA:

| File | Role |
|------|------|
| `rig_driver.js` | Landmark → anatomical bone pose (PoC) |
| `anatomical_skeleton_viewer.js` | GLB async skeleton beta |
| `skeleton_pro_renderer.js` | Skeleton β procedural renderer |
| `skeleton_pro_renderer_legacy.js` | Anatomical Legacy volume rig |

These modules are **excluded from `_manifest.json`** and are not bundled into production HTML.

Do not re-enable without explicit approval and full stick+overlay QA.
