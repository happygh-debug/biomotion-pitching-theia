#!/usr/bin/env python3
"""skeleton.gltf → skeleton.glb (embedded buffer → GLB chunk)"""
import base64
import json
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
GLTF = HERE / "assets" / "models" / "skeleton.gltf"
GLB = HERE / "assets" / "models" / "skeleton.glb"


def main() -> None:
    if not GLTF.exists():
        sys.exit(f"missing {GLTF}")
    gltf = json.loads(GLTF.read_text(encoding="utf-8"))
    buffers = gltf.get("buffers") or []
    if not buffers or "data:" not in buffers[0].get("uri", ""):
        sys.exit("expected single embedded data URI buffer")
    b64 = buffers[0]["uri"].split(",", 1)[1]
    bin_data = base64.b64decode(b64)
    gltf["buffers"] = [{"byteLength": len(bin_data)}]
    json_bytes = json.dumps(gltf, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - (len(bin_data) % 4)) % 4
    bin_data += b"\x00" * bin_pad
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<I4s", len(json_bytes), b"JSON")
    out += json_bytes
    out += struct.pack("<I4s", len(bin_data), b"BIN\x00")
    out += bin_data
    GLB.parent.mkdir(parents=True, exist_ok=True)
    GLB.write_bytes(out)
    print(f"Wrote {GLB} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
