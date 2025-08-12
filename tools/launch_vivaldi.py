#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Launch Vivaldi with this extension loaded for testing.")
    parser.add_argument("--ext-path", dest="ext_path", default=None, help="Path to the extension root (folder with manifest.json)")
    parser.add_argument("--vivaldi-bin", dest="vivaldi_bin", default="vivaldi", help="Path to Vivaldi executable (default: vivaldi in PATH)")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    ext_root = Path(args.ext_path) if args.ext_path else repo_root
    manifest = ext_root / "manifest.json"
    if not manifest.exists():
        print(f"manifest.json not found in {ext_root}", file=sys.stderr)
        sys.exit(1)

    cmd = [
        args.vivaldi_bin,
        f"--load-extension={ext_root}",
        "--window-size=1920,1080",
        "--disable-dev-shm-usage",
        "--disable-features=UserAgentClientHint",
    ]

    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        print("Vivaldi binary not found. Provide --vivaldi-bin path or ensure it's in PATH.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Vivaldi exited with non-zero status: {e.returncode}", file=sys.stderr)
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()