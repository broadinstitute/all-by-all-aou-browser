#!/usr/bin/env python3
"""Plot cold start benchmark results as waterfall charts.

Usage:
    python3 scripts/plot-cold-start.py scripts/bench-results/
    python3 scripts/plot-cold-start.py scripts/bench-results/ --ids baseline,tuned
    python3 scripts/plot-cold-start.py scripts/bench-results/ --latest 3
    python3 scripts/plot-cold-start.py scripts/bench-results/ --out cold-start-report.png
"""

import argparse
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np


# Phase colors for waterfall segments
SEGMENT_COLORS = {
    "dns": "#4CAF50",      # green
    "connect": "#2196F3",  # blue
    "tls": "#9C27B0",      # purple
    "server": "#FF9800",   # orange (ttfb - tls)
    "download": "#607D8B", # grey (total - ttfb)
}

PHASE_LABELS = {
    "backend_cold": "Backend (cold)",
    "frontend_chain": "Frontend chain",
    "warm": "Warm",
}


def load_runs(results_dir: Path, ids: list[str] | None = None, latest: int = 0) -> list[dict]:
    """Load benchmark result JSON files, optionally filtered by id."""
    runs = []
    for json_file in sorted(results_dir.rglob("*.json")):
        with open(json_file) as f:
            run = json.load(f)
        run["_file"] = str(json_file)
        runs.append(run)

    if ids:
        runs = [r for r in runs if r["id"] in ids]

    if latest > 0:
        # Group by id, take latest N from each
        by_id: dict[str, list[dict]] = {}
        for r in runs:
            by_id.setdefault(r["id"], []).append(r)
        runs = []
        for id_runs in by_id.values():
            id_runs.sort(key=lambda r: r["timestamp"])
            runs.extend(id_runs[-latest:])

    runs.sort(key=lambda r: (r["id"], r["timestamp"]))
    return runs


def compute_segments(req: dict) -> list[tuple[str, float, float]]:
    """Break a request into waterfall segments: [(name, start, duration), ...]."""
    dns_end = req["dns"]
    connect_end = req["connect"]
    tls_end = req["tls"]
    ttfb = req["ttfb"]
    total = req["total"]

    segments = []
    segments.append(("dns", 0, dns_end))
    segments.append(("connect", dns_end, connect_end - dns_end))
    segments.append(("tls", connect_end, tls_end - connect_end))
    segments.append(("server", tls_end, ttfb - tls_end))
    segments.append(("download", ttfb, total - ttfb))
    return segments


def plot_waterfall_single(run: dict, ax: plt.Axes):
    """Plot a single run as a horizontal waterfall / Gantt chart."""
    results = run["results"]
    labels = [r["label"] for r in results]
    y_positions = list(range(len(results) - 1, -1, -1))

    for i, (req, y) in enumerate(zip(results, y_positions)):
        segments = compute_segments(req)
        for seg_name, start, duration in segments:
            if duration <= 0:
                continue
            ax.barh(y, duration, left=start, height=0.6,
                    color=SEGMENT_COLORS[seg_name], edgecolor="white", linewidth=0.5)

        # Annotate total time
        ax.text(req["total"] + 0.05, y, f'{req["total"]:.2f}s',
                va="center", fontsize=8, color="#333")

    ax.set_yticks(y_positions)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Time (seconds)")

    title = f'{run["id"]} — {run["timestamp"]}'
    if run.get("force_cold"):
        title += " (forced cold)"
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.set_xlim(left=0)
    ax.grid(axis="x", alpha=0.3)


def plot_waterfall_comparison(runs: list[dict], out_path: str | None = None):
    """Plot one waterfall per run, stacked vertically."""
    n = len(runs)
    fig, axes = plt.subplots(n, 1, figsize=(14, 3.5 * n + 1), squeeze=False)

    for run, ax in zip(runs, axes[:, 0]):
        plot_waterfall_single(run, ax)

    # Shared legend
    legend_patches = [mpatches.Patch(color=c, label=n.upper())
                      for n, c in SEGMENT_COLORS.items()]
    fig.legend(handles=legend_patches, loc="upper right", ncol=len(SEGMENT_COLORS),
               fontsize=9, frameon=True, fancybox=True)

    fig.suptitle("Cloud Run Cold Start Waterfall", fontsize=14, fontweight="bold", y=1.01)
    fig.tight_layout()

    if out_path:
        fig.savefig(out_path, dpi=150, bbox_inches="tight")
        print(f"Saved waterfall chart to {out_path}")
    else:
        plt.show()


def plot_ttfb_comparison(runs: list[dict], out_path: str | None = None):
    """Bar chart comparing TTFB across runs, grouped by endpoint."""
    # Collect unique labels preserving order from first run
    all_labels = []
    for r in runs[0]["results"]:
        if r["label"] not in all_labels:
            all_labels.append(r["label"])

    run_ids = [f'{r["id"]} ({r["timestamp"][:8]})' for r in runs]
    n_labels = len(all_labels)
    n_runs = len(runs)
    x = np.arange(n_labels)
    width = 0.8 / n_runs

    fig, ax = plt.subplots(figsize=(14, 6))
    cmap = plt.cm.Set2

    for i, run in enumerate(runs):
        ttfbs = []
        for label in all_labels:
            match = next((r for r in run["results"] if r["label"] == label), None)
            ttfbs.append(match["ttfb"] if match else 0)

        bars = ax.bar(x + i * width - (n_runs - 1) * width / 2, ttfbs, width,
                       label=run_ids[i], color=cmap(i / max(n_runs - 1, 1)),
                       edgecolor="white", linewidth=0.5)

        for bar, val in zip(bars, ttfbs):
            if val > 0:
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                        f"{val:.1f}s", ha="center", va="bottom", fontsize=7)

    ax.set_xticks(x)
    ax.set_xticklabels(all_labels, rotation=30, ha="right", fontsize=9)
    ax.set_ylabel("TTFB (seconds)")
    ax.set_title("TTFB Comparison Across Runs", fontsize=13, fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()

    if out_path:
        stem = Path(out_path).stem
        comparison_path = str(Path(out_path).with_name(f"{stem}-ttfb-comparison.png"))
        fig.savefig(comparison_path, dpi=150, bbox_inches="tight")
        print(f"Saved TTFB comparison chart to {comparison_path}")
    else:
        plt.show()


def main():
    parser = argparse.ArgumentParser(description="Plot cold start benchmark results")
    parser.add_argument("results_dir", help="Path to bench-results/ directory")
    parser.add_argument("--ids", help="Comma-separated run IDs to include (e.g., baseline,tuned)")
    parser.add_argument("--latest", type=int, default=0,
                        help="Only use the latest N runs per ID")
    parser.add_argument("--out", help="Output image path (e.g., cold-start.png). "
                        "If omitted, displays interactively.")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    if not results_dir.exists():
        print(f"ERROR: {results_dir} does not exist")
        sys.exit(1)

    ids = args.ids.split(",") if args.ids else None
    runs = load_runs(results_dir, ids=ids, latest=args.latest)

    if not runs:
        print("No benchmark results found.")
        sys.exit(1)

    print(f"Loaded {len(runs)} run(s): {', '.join(r['id'] + '/' + r['timestamp'] for r in runs)}")

    # Always show waterfall
    plot_waterfall_comparison(runs, out_path=args.out)

    # If multiple runs, also show TTFB comparison
    if len(runs) > 1:
        plot_ttfb_comparison(runs, out_path=args.out)


if __name__ == "__main__":
    main()
