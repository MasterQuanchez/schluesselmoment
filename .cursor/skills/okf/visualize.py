"""Emit a self-contained OKF graph viewer at viz.html."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from okf_lib import Concept, find_bundle_root, find_workspace_root, iter_concepts, iter_workspace_concepts

TYPE_PALETTE = {
    "Strategy": "#8b5cf6",
    "Product": "#2563eb",
    "Process": "#f59e0b",
    "Team": "#10b981",
    "Reference": "#14b8a6",
    "Decision": "#ef4444",
    "Meeting Summary": "#64748b",
    "Skill": "#6366f1",
    "Data Product": "#0ea5e9",
}
DEFAULT_NODE_COLOR = "#94a3b8"


def _as_tags(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    if value:
        return [str(value)]
    return []


def _concept_node(concept: Concept) -> dict:
    concept_type = concept.type or "Concept"
    body_size = len(concept.body)
    return {
        "id": concept.concept_id,
        "label": concept.title,
        "type": concept_type,
        "bundle": concept.bundle,
        "description": concept.description,
        "resource": str(concept.frontmatter.get("resource") or "") if concept.frontmatter else "",
        "tags": _as_tags(concept.frontmatter.get("tags") if concept.frontmatter else []),
        "color": TYPE_PALETTE.get(concept_type, DEFAULT_NODE_COLOR),
        "size": 20 + min(40, body_size // 300),
    }


def _build_graph(concepts: list[Concept]) -> dict:
    concept_ids = {concept.concept_id for concept in concepts}
    seen_edges: set[tuple[str, str]] = set()
    edges: list[dict] = []
    for concept in concepts:
        for target in concept.links:
            if target == concept.concept_id or target not in concept_ids:
                continue
            key = (concept.concept_id, target)
            if key in seen_edges:
                continue
            seen_edges.add(key)
            edges.append({"source": concept.concept_id, "target": target})
    return {
        "nodes": [_concept_node(concept) for concept in concepts],
        "edges": edges,
        "bodies": {concept.concept_id: concept.body for concept in concepts},
        "types": sorted({concept.type or "Concept" for concept in concepts}),
        "bundles": sorted({concept.bundle for concept in concepts if concept.bundle}),
    }


def _json_for_script(value: object) -> str:
    return json.dumps(value, ensure_ascii=False).replace("</", "<\\/")


def build_html(title: str, concepts: list[Concept], *, workspace_link: str | None = None) -> str:
    data = _json_for_script(_build_graph(concepts))
    nav_html = (
        f'  <a id="workspaceLink" href="{workspace_link}">&#8599; Workspace graph</a>\n'
        if workspace_link
        else ""
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
:root {{ --detail-width: clamp(280px, 25vw, 560px); }}
* {{ box-sizing: border-box; }}
html, body {{ height: 100%; }}
body {{ margin: 0; font: 14px system-ui, sans-serif; color: #0f172a; background: #f8fafc; display: flex; flex-direction: column; overflow: hidden; }}
header {{ flex: 0 0 auto; display: flex; gap: 12px; align-items: center; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }}
input, select, button {{ padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; }}
button {{ cursor: pointer; }}
main {{ flex: 1 1 auto; min-height: 0; display: flex; }}
#graph {{ flex: 1 1 auto; min-width: 0; position: relative; overflow: hidden; cursor: grab; touch-action: none; }}
#graph.panning {{ cursor: grabbing; }}
#canvas {{ position: absolute; top: 0; left: 0; transform-origin: 0 0; will-change: transform; }}
#zoomControls {{ position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; gap: 4px; z-index: 5; }}
#zoomControls button {{ width: 32px; height: 32px; padding: 0; font-size: 18px; line-height: 1; display: grid; place-items: center; background: #fff; box-shadow: 0 1px 3px #0003; }}
#zoomControls button:hover {{ background: #eff6ff; border-color: #2563eb; }}
#resizer {{ flex: 0 0 6px; cursor: col-resize; background: #e2e8f0; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; }}
#resizer:hover, #resizer.dragging {{ background: #94a3b8; }}
#detailPanel {{ flex: 0 0 var(--detail-width); min-width: 0; display: flex; flex-direction: column; background: #fff; border-left: 1px solid #e2e8f0; overflow: hidden; }}
body.detail-collapsed #resizer, body.detail-collapsed #detailPanel {{ display: none; }}
#detail {{ flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 18px; }}
.node {{ position: absolute; display: grid; place-items: center; border-radius: 999px; color: #fff; cursor: grab; text-align: center; padding: 8px; box-shadow: 0 1px 3px #0002; border: none; touch-action: none; }}
.node.dragging {{ cursor: grabbing; box-shadow: 0 4px 12px #0004; }}
.node span {{ color: #0f172a; position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); transform-origin: top center; width: 150px; font-size: 11px; line-height: 1.2; text-align: center; pointer-events: none; text-shadow: 0 0 3px #f8fafc, 0 0 3px #f8fafc, 0 0 3px #f8fafc; }}
svg {{ position: absolute; left: 0; top: 0; pointer-events: none; }}
.muted {{ color: #64748b; font-size: 12px; }}
.chip {{ display: inline-block; padding: 2px 6px; border-radius: 999px; background: #e2e8f0; margin-right: 4px; font-size: 11px; }}
pre {{ white-space: pre-wrap; font: inherit; line-height: 1.5; }}
a#workspaceLink {{ margin-left: auto; white-space: nowrap; text-decoration: none; color: #2563eb; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 4px; }}
a#workspaceLink:hover {{ background: #eff6ff; border-color: #2563eb; }}
</style>
</head>
<body>
<header>
  <strong>{title}</strong>
  <input id="search" type="search" placeholder="Search title / id / tag">
  <select id="bundle"><option value="">All bundles</option></select>
  <select id="type"><option value="">All types</option></select>
  <button id="detailToggle" type="button">Hide details</button>
  <span class="muted" id="stats"></span>
{nav_html}</header>
<main>
  <section id="graph"><div id="canvas"><svg id="edges"></svg></div><div id="zoomControls"><button id="zoomIn" type="button" aria-label="Zoom in" title="Zoom in">+</button><button id="zoomOut" type="button" aria-label="Zoom out" title="Zoom out">&#8722;</button><button id="zoomReset" type="button" aria-label="Fit to view" title="Fit to view">&#10530;</button></div></section>
  <div id="resizer" role="separator" aria-orientation="vertical" aria-label="Resize detail panel"></div>
  <aside id="detailPanel">
    <section id="detail"><p class="muted">Click a node to inspect it.</p></section>
  </aside>
</main>
<script>
const graph = {data};
const bodyEl = document.body;
const graphEl = document.getElementById("graph");
const canvasEl = document.getElementById("canvas");
const detailEl = document.getElementById("detail");
const resizerEl = document.getElementById("resizer");
const detailToggleEl = document.getElementById("detailToggle");
const typeEl = document.getElementById("type");
const bundleEl = document.getElementById("bundle");
const searchEl = document.getElementById("search");
const zoomInEl = document.getElementById("zoomIn");
const zoomOutEl = document.getElementById("zoomOut");
const zoomResetEl = document.getElementById("zoomReset");
document.getElementById("stats").textContent = `${{graph.nodes.length}} concepts, ${{graph.edges.length}} links`;
for (const type of graph.types) typeEl.append(new Option(type, type));
for (const bundle of graph.bundles) bundleEl.append(new Option(bundle, bundle));

const CANVAS_W = 6000, CANVAS_H = 4500;
const CENTER_X = CANVAS_W / 2, CENTER_Y = CANVAS_H / 2;
canvasEl.style.width = `${{CANVAS_W}}px`;
canvasEl.style.height = `${{CANVAS_H}}px`;
const svg = document.getElementById("edges");
svg.setAttribute("width", CANVAS_W);
svg.setAttribute("height", CANVAS_H);

const SETTINGS = {{
  charge: 9000, chargeCap: 60, linkDistance: 110, linkStrength: 0.04, gravity: 0.012,
  friction: 0.85, collidePad: 16, collideIterations: 2, alphaMin: 0.02, alphaDecay: 0.99, reheat: 0.7,
}};

const sim = {{ nodes: [], links: [], byId: new Map(), alpha: 0 }};
let hubDegree = Infinity;
let viewScale = 1, viewX = 0, viewY = 0;
let userInteracted = false;
let running = false;

// ---------- view transform (pan / zoom) ----------
function applyTransform() {{
  canvasEl.style.transform = `translate(${{viewX}}px, ${{viewY}}px) scale(${{viewScale}})`;
  updateLabelLOD();
}}
function clampScale(value) {{ return Math.min(6, Math.max(0.05, value)); }}

function contentBounds() {{
  if (!sim.nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of sim.nodes) {{
    const pad = node.r + 30;
    minX = Math.min(minX, node.x - pad); minY = Math.min(minY, node.y - pad);
    maxX = Math.max(maxX, node.x + pad); maxY = Math.max(maxY, node.y + pad);
  }}
  return {{ minX, minY, width: maxX - minX, height: maxY - minY }};
}}

function fitView() {{
  const bounds = contentBounds();
  const cw = graphEl.clientWidth, ch = graphEl.clientHeight;
  if (!bounds || !cw || !ch) return;
  viewScale = clampScale(Math.min(cw / bounds.width, ch / bounds.height, 1.5));
  viewX = (cw - bounds.width * viewScale) / 2 - bounds.minX * viewScale;
  viewY = (ch - bounds.height * viewScale) / 2 - bounds.minY * viewScale;
  applyTransform();
}}

function zoomAt(clientX, clientY, factor) {{
  userInteracted = true;
  const rect = graphEl.getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  const px = (mx - viewX) / viewScale, py = (my - viewY) / viewScale;
  viewScale = clampScale(viewScale * factor);
  viewX = mx - px * viewScale;
  viewY = my - py * viewScale;
  applyTransform();
}}

graphEl.addEventListener("wheel", event => {{
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 1 / 1.12);
}}, {{ passive: false }});

let panning = false, panStartX = 0, panStartY = 0, panOriginX = 0, panOriginY = 0;
graphEl.addEventListener("pointerdown", event => {{
  if (event.target.closest(".node") || event.target.closest("#zoomControls")) return;
  panning = true; userInteracted = true;
  panStartX = event.clientX; panStartY = event.clientY;
  panOriginX = viewX; panOriginY = viewY;
  graphEl.classList.add("panning");
  graphEl.setPointerCapture(event.pointerId);
}});
graphEl.addEventListener("pointermove", event => {{
  if (!panning) return;
  viewX = panOriginX + (event.clientX - panStartX);
  viewY = panOriginY + (event.clientY - panStartY);
  applyTransform();
}});
function endPan(event) {{
  if (!panning) return;
  panning = false;
  graphEl.classList.remove("panning");
  try {{ graphEl.releasePointerCapture(event.pointerId); }} catch (err) {{}}
}}
graphEl.addEventListener("pointerup", endPan);
graphEl.addEventListener("pointercancel", endPan);

function zoomFromCenter(factor) {{
  const rect = graphEl.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}}
zoomInEl.addEventListener("click", () => zoomFromCenter(1.25));
zoomOutEl.addEventListener("click", () => zoomFromCenter(1 / 1.25));
zoomResetEl.addEventListener("click", () => {{ userInteracted = false; fitView(); }});

// ---------- level-of-detail labels (constant screen size, fade by zoom) ----------
function updateLabelLOD() {{
  for (const node of sim.nodes) {{
    const label = node.labelEl;
    if (!label) continue;
    const radiusOnScreen = node.r * viewScale;
    const show = radiusOnScreen > 14 || node.degree >= hubDegree;
    if (show) {{
      label.style.display = "block";
      label.style.transform = `translateX(-50%) scale(${{1 / viewScale}})`;
    }} else {{
      label.style.display = "none";
    }}
  }}
}}

// ---------- detail panel chrome ----------
function setDetailCollapsed(collapsed) {{
  bodyEl.classList.toggle("detail-collapsed", collapsed);
  detailToggleEl.textContent = collapsed ? "Show details" : "Hide details";
  detailToggleEl.setAttribute("aria-expanded", String(!collapsed));
  requestAnimationFrame(() => {{ if (!userInteracted) fitView(); }});
}}
function setDetailWidth(width) {{
  const maxWidth = Math.max(300, Math.floor(window.innerWidth * 0.75));
  const next = Math.min(Math.max(width, 260), maxWidth);
  document.documentElement.style.setProperty("--detail-width", `${{next}}px`);
  requestAnimationFrame(() => {{ if (!userInteracted) fitView(); }});
}}
detailToggleEl.addEventListener("click", () => setDetailCollapsed(!bodyEl.classList.contains("detail-collapsed")));
window.addEventListener("resize", () => requestAnimationFrame(() => {{ if (!userInteracted) fitView(); }}));
resizerEl.addEventListener("pointerdown", event => {{
  event.preventDefault();
  resizerEl.classList.add("dragging");
  resizerEl.setPointerCapture(event.pointerId);
  const onMove = moveEvent => setDetailWidth(window.innerWidth - moveEvent.clientX);
  const onUp = upEvent => {{
    resizerEl.classList.remove("dragging");
    resizerEl.releasePointerCapture(upEvent.pointerId);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }};
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}});

// ---------- force simulation ----------
function simulateOnce() {{
  const nodes = sim.nodes, alpha = sim.alpha, cfg = SETTINGS;
  for (const node of nodes) {{ node.fx = 0; node.fy = 0; }}
  for (let i = 0; i < nodes.length; i++) {{
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {{
      const b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let dist2 = dx * dx + dy * dy;
      if (dist2 < 1e-4) {{ dx = (Math.random() - 0.5) * 0.5; dy = (Math.random() - 0.5) * 0.5; dist2 = dx * dx + dy * dy + 1e-4; }}
      const dist = Math.sqrt(dist2);
      const ux = dx / dist, uy = dy / dist;
      const rep = Math.min(cfg.charge / dist2, cfg.chargeCap);
      a.fx += ux * rep; a.fy += uy * rep;
      b.fx -= ux * rep; b.fy -= uy * rep;
    }}
  }}
  for (const link of sim.links) {{
    const a = link.source, b = link.target;
    let dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - cfg.linkDistance) * cfg.linkStrength;
    const ux = dx / dist, uy = dy / dist;
    a.fx += ux * force; a.fy += uy * force;
    b.fx -= ux * force; b.fy -= uy * force;
  }}
  for (const node of nodes) {{
    if (node.pinned) {{ node.vx = 0; node.vy = 0; continue; }}
    node.fx += (CENTER_X - node.x) * cfg.gravity;
    node.fy += (CENTER_Y - node.y) * cfg.gravity;
    node.vx = (node.vx + node.fx * alpha) * cfg.friction;
    node.vy = (node.vy + node.fy * alpha) * cfg.friction;
    node.x += node.vx;
    node.y += node.vy;
  }}
  resolveCollisions();
}}

function resolveCollisions() {{
  const nodes = sim.nodes, cfg = SETTINGS;
  for (let iteration = 0; iteration < cfg.collideIterations; iteration++) {{
    for (let i = 0; i < nodes.length; i++) {{
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {{
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist2 = dx * dx + dy * dy;
        const minDist = a.r + b.r + cfg.collidePad;
        if (dist2 >= minDist * minDist) continue;
        if (dist2 < 1e-4) {{ dx = (Math.random() - 0.5) * 0.5; dy = (Math.random() - 0.5) * 0.5; dist2 = dx * dx + dy * dy + 1e-4; }}
        const dist = Math.sqrt(dist2);
        const ux = dx / dist, uy = dy / dist;
        const push = (minDist - dist) * 0.5;
        if (!a.pinned) {{ a.x += ux * push; a.y += uy * push; }}
        if (!b.pinned) {{ b.x -= ux * push; b.y -= uy * push; }}
      }}
    }}
  }}
}}

function updatePositions() {{
  for (const node of sim.nodes) {{
    node.el.style.left = `${{node.x - node.r}}px`;
    node.el.style.top = `${{node.y - node.r}}px`;
  }}
  for (const link of sim.links) {{
    link.el.setAttribute("x1", link.source.x);
    link.el.setAttribute("y1", link.source.y);
    link.el.setAttribute("x2", link.target.x);
    link.el.setAttribute("y2", link.target.y);
  }}
  updateLabelLOD();
}}

function step() {{
  if (sim.alpha > SETTINGS.alphaMin) {{
    simulateOnce();
    sim.alpha *= SETTINGS.alphaDecay;
  }} else {{
    sim.alpha = 0;
  }}
  updatePositions();
  if (!userInteracted) fitView();
  if (sim.alpha > 0 || dragging) {{
    requestAnimationFrame(step);
  }} else {{
    running = false;
  }}
}}

function reheat(value) {{
  sim.alpha = Math.max(sim.alpha, value);
  if (!running) {{ running = true; requestAnimationFrame(step); }}
}}

// ---------- node interactions (click to inspect, drag to reposition) ----------
let dragging = false;
function attachNodeInteractions(el, node) {{
  let down = false, moved = false, startX = 0, startY = 0;
  el.addEventListener("pointerdown", event => {{
    event.stopPropagation();
    down = true; moved = false;
    startX = event.clientX; startY = event.clientY;
    el.setPointerCapture(event.pointerId);
  }});
  el.addEventListener("pointermove", event => {{
    if (!down) return;
    if (!moved && Math.abs(event.clientX - startX) + Math.abs(event.clientY - startY) > 4) {{
      moved = true; dragging = true; userInteracted = true;
      node.pinned = true; el.classList.add("dragging");
    }}
    if (!moved) return;
    const rect = graphEl.getBoundingClientRect();
    node.x = (event.clientX - rect.left - viewX) / viewScale;
    node.y = (event.clientY - rect.top - viewY) / viewScale;
    node.vx = 0; node.vy = 0;
    reheat(0.3);
  }});
  el.addEventListener("pointerup", event => {{
    if (!down) return;
    down = false;
    try {{ el.releasePointerCapture(event.pointerId); }} catch (err) {{}}
    if (moved) {{
      dragging = false; node.pinned = false; el.classList.remove("dragging");
      reheat(0.15);
    }} else {{
      show(node.data);
    }}
  }});
}}

// ---------- build / rebuild the scene from current filters ----------
function buildScene() {{
  const q = searchEl.value.trim().toLowerCase();
  const type = typeEl.value;
  const bundle = bundleEl.value;
  const visible = graph.nodes.filter(node => {{
    const hay = `${{node.id}} ${{node.label}} ${{node.type}} ${{node.bundle}} ${{node.tags.join(" ")}}`.toLowerCase();
    return (!q || hay.includes(q)) && (!type || node.type === type) && (!bundle || node.bundle === bundle);
  }});
  const ids = new Set(visible.map(node => node.id));
  const links = graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));

  const degree = new Map(visible.map(node => [node.id, 0]));
  for (const edge of links) {{
    degree.set(edge.source, degree.get(edge.source) + 1);
    degree.set(edge.target, degree.get(edge.target) + 1);
  }}
  const sortedDegrees = [...degree.values()].sort((a, b) => b - a);
  hubDegree = sortedDegrees.length ? Math.max(2, sortedDegrees[Math.floor(sortedDegrees.length * 0.15)]) : Infinity;

  const previous = sim.byId;
  const simNodes = visible.map(node => {{
    const old = previous.get(node.id);
    return {{
      id: node.id, data: node, r: node.size / 2 + 13, degree: degree.get(node.id) || 0,
      x: old ? old.x : CENTER_X + (Math.random() - 0.5) * 700,
      y: old ? old.y : CENTER_Y + (Math.random() - 0.5) * 700,
      vx: 0, vy: 0, pinned: false,
    }};
  }});
  const byId = new Map(simNodes.map(node => [node.id, node]));
  const simLinks = links.map(edge => ({{ source: byId.get(edge.source), target: byId.get(edge.target) }}));

  sim.nodes = simNodes;
  sim.links = simLinks;
  sim.byId = byId;

  svg.innerHTML = "";
  for (const link of sim.links) {{
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", "#cbd5e1");
    line.setAttribute("stroke-width", "1.2");
    svg.append(line);
    link.el = line;
  }}
  canvasEl.querySelectorAll(".node").forEach(el => el.remove());
  for (const node of sim.nodes) {{
    const el = document.createElement("button");
    el.className = "node";
    const diameter = node.r * 2;
    el.style.width = `${{diameter}}px`;
    el.style.height = `${{diameter}}px`;
    el.style.background = node.data.color;
    el.title = node.id;
    const span = document.createElement("span");
    span.textContent = node.data.label;
    el.append(span);
    attachNodeInteractions(el, node);
    canvasEl.append(el);
    node.el = el;
    node.labelEl = span;
  }}

  reheat(1);
}}

function show(node) {{
  const incoming = graph.edges.filter(edge => edge.target === node.id).map(edge => edge.source);
  const outgoing = graph.edges.filter(edge => edge.source === node.id).map(edge => edge.target);
  detailEl.innerHTML = `
    <div class="chip">${{node.type}}</div><div class="chip">${{node.bundle || "bundle"}}</div>
    <h1>${{node.label}}</h1>
    <p class="muted">${{node.id}}</p>
    <p>${{node.description || ""}}</p>
    <h2>Links</h2>
    <p><strong>Out:</strong> ${{outgoing.join(", ") || "none"}}</p>
    <p><strong>In:</strong> ${{incoming.join(", ") || "none"}}</p>
    <h2>Body</h2>
    <pre>${{graph.bodies[node.id] || ""}}</pre>
  `;
}}

searchEl.addEventListener("input", buildScene);
typeEl.addEventListener("change", buildScene);
bundleEl.addEventListener("change", buildScene);
buildScene();
</script>
</body>
</html>
"""


def _stats(concepts: list[Concept]) -> tuple[int, int]:
    concept_ids = {concept.concept_id for concept in concepts}
    edge_count = len(
        {
            (concept.concept_id, target)
            for concept in concepts
            for target in concept.links
            if target != concept.concept_id and target in concept_ids
        }
    )
    return len(concepts), edge_count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", help="Bundle root. Defaults to this skill's repository root.")
    parser.add_argument("--workspace", action="store_true", help="Aggregate all sibling bundles under the workspace root.")
    parser.add_argument("--workspace-root", help="Workspace folder containing sibling bundle clones.")
    parser.add_argument("--out", help="Output path. Defaults to <root>/viz.html or <workspace-root>/viz.html.")
    args = parser.parse_args()
    workspace_link: str | None = None
    if args.workspace:
        root = find_workspace_root(args.workspace_root)
        out = Path(args.out).resolve() if args.out else root / "viz.html"
        concepts = iter_workspace_concepts(root)
        title = f"{root.name} OKF Workspace"
    else:
        root = find_bundle_root(args.root)
        out = Path(args.out).resolve() if args.out else root / "viz.html"
        concepts = iter_concepts(root)
        title = f"{root.name} OKF Bundle"
        workspace_viz = root.parent / "viz.html"
        if workspace_viz.exists():
            workspace_link = Path(os.path.relpath(workspace_viz, out.parent)).as_posix()
    out.write_text(build_html(title, concepts, workspace_link=workspace_link), encoding="utf-8")
    concept_count, edge_count = _stats(concepts)
    print(f"Wrote {out} ({concept_count} concepts, {edge_count} edges).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
