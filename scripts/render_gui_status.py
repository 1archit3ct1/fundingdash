#!/usr/bin/env python3
"""
Render a lightweight status board for fundingdash from task_status.json.

Usage:
  python3 scripts/render_gui_status.py
  python3 scripts/render_gui_status.py --commit "task: <what you did>"
"""
import argparse
import json
import os
import subprocess
from datetime import datetime, timezone


def status_class(value: str) -> str:
    if value == "green":
        return "green"
    if value == "partial":
        return "partial"
    return "red"


def render_html(data: dict) -> str:
    meta = data.get("_meta", {})
    steps = data.get("steps", {})
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    cards = []
    for step_id, step in steps.items():
        label = step.get("label", step_id)
        overall = step.get("overall", "red")
        items = step.get("items", {})
        rows = []
        for item_id, item in items.items():
            item_status = item.get("status", "red")
            note = item.get("note", "")
            rows.append(
                f"<tr><td>{item_id}</td><td><span class='pill {status_class(item_status)}'>{item_status}</span></td><td>{note}</td></tr>"
            )
        table = "".join(rows)
        cards.append(
            f"""
            <section class='card'>
              <div class='card-head'>
                <h2>{label}</h2>
                <span class='pill {status_class(overall)}'>{overall}</span>
              </div>
              <table>
                <thead><tr><th>Item</th><th>Status</th><th>Note</th></tr></thead>
                <tbody>{table}</tbody>
              </table>
            </section>
            """
        )

    return f"""<!doctype html>
<html lang='en'>
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='width=device-width, initial-scale=1' />
  <title>FundingDash Status</title>
  <style>
    :root {{
      --bg:#f6f6f3; --card:#ffffff; --text:#1f2328; --muted:#5e6873;
      --line:#d9dee4; --green:#1f883d; --red:#cf222e; --amber:#9a6700;
    }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; font:14px/1.45 Segoe UI, system-ui, sans-serif; background:var(--bg); color:var(--text); }}
    main {{ max-width:1200px; margin:0 auto; padding:24px; }}
    header {{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px; margin-bottom:16px; }}
    h1 {{ margin:0; font-size:28px; }}
    .meta {{ color:var(--muted); font-size:12px; }}
    .grid {{ display:grid; grid-template-columns:1fr; gap:14px; }}
    .card {{ background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
    .card-head {{ display:flex; justify-content:space-between; align-items:center; padding:12px 14px; border-bottom:1px solid var(--line); }}
    .card-head h2 {{ margin:0; font-size:16px; }}
    table {{ width:100%; border-collapse:collapse; }}
    th, td {{ text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }}
    th {{ font-size:12px; color:var(--muted); }}
    .pill {{ border-radius:999px; padding:2px 10px; font-size:12px; font-weight:600; text-transform:uppercase; }}
    .pill.green {{ background:#dafbe1; color:var(--green); }}
    .pill.partial {{ background:#fff8c5; color:var(--amber); }}
    .pill.red {{ background:#ffebe9; color:var(--red); }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>FundingDash Agent Status</h1>
      <div class='meta'>Updated: {updated}<br/>Agent task: {meta.get('agent_current_task')} | Agent step: {meta.get('agent_current_step')}</div>
    </header>
    <div class='grid'>
      {''.join(cards)}
    </div>
  </main>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", type=str, default=None)
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    status_path = os.path.join(root, "task_status.json")
    html_path = os.path.join(root, "gui_status.html")

    with open(status_path, "r", encoding="utf-8") as f:
      data = json.load(f)

    with open(html_path, "w", encoding="utf-8") as f:
      f.write(render_html(data))

    print(f"[render] Wrote {html_path}")

    if args.commit:
      subprocess.run(["git", "add", "task_status.json", "gui_status.html"], cwd=root, check=False)
      subprocess.run(["git", "commit", "-m", args.commit], cwd=root, check=False)
      print(f"[render] Commit attempted: {args.commit}")


if __name__ == "__main__":
    main()