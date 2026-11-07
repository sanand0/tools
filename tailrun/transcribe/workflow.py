#!/usr/bin/env python3
"""Convert an uploaded recording to Opus and transcribe with ~/code/scripts/call."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

DEST = Path.home() / "Dropbox" / "COPY" / "transcribe"
CALL = Path.home() / "code" / "scripts" / "call"
SYSTEM_PROMPT = Path.home() / "code" / "blog" / "pages" / "prompts" / "transcribe-call-recording.md"

def opus_command(source: Path, output: Path) -> list[str]:
    """Match the 'opus' function in ~/code/scripts/setup.fish, including VBR."""
    return [
        "ffmpeg", "-hide_banner", "-stats", "-v", "warning", "-n",
        "-i", str(source), "-c:a", "libopus", "-b:a", "12k",
        "-ac", "1", "-application", "voip", "-vbr", "on",
        "-compression_level", "10", str(output)
    ]

def call_command(audio: Path, output_dir: Path, prompt: str) -> list[str]:
    """Let call choose its default prompt when the extra prompt is blank."""
    cmd = ["uv", "run", "--script", str(CALL), str(audio), "--out", str(output_dir)]
    # call has a Linux default prompt-file path; point Windows at the same file.
    if SYSTEM_PROMPT.is_file():
        cmd.extend(["--system-prompt", str(SYSTEM_PROMPT)])
    if prompt.strip():
        cmd.extend(["--prompt", prompt.strip()])
    return cmd

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("name")
    parser.add_argument("--prompt", default="")
    args = parser.parse_args()
    source = args.source.resolve()
    job_dir = Path(os.environ["TAILRUN_JOB_DIR"])
    destination = Path(os.environ.get("TAILRUN_TRANSCRIBE_DEST", str(DEST)))
    destination.mkdir(parents=True, exist_ok=True)
    audio = destination / f"{args.name}.opus"
    transcript = destination / f"{args.name}.md"
    if audio.exists() or transcript.exists():
        raise FileExistsError(f"Output already exists: {audio} or {transcript}. Pick another name.")
    if not CALL.is_file():
        raise FileNotFoundError(f"Missing call script: {CALL}")
    staging = job_dir / "converted.opus"
    try:
        print(f"Converting to Opus: {source.name}", flush=True)
        subprocess.run(opus_command(source, staging), check=True)
        # Save audio first: even if transcription fails, the Opus survives.
        shutil.copy2(staging, audio)
        shutil.copy2(audio, job_dir / audio.name)
        print(f"Saved {audio}", flush=True)
        print("Transcribing with call (using its default system prompt)…", flush=True)
        subprocess.run(call_command(audio, destination, args.prompt), check=True)
        if not transcript.is_file():
            raise FileNotFoundError(f"call did not create {transcript}")
        shutil.copy2(transcript, job_dir / transcript.name)
        print(f"Saved {transcript}", flush=True)
    finally:
        staging.unlink(missing_ok=True)
        # call can write an incomplete note even on failure; preserve it as an artifact.
        incomplete = destination / f"{args.name}.incomplete.md"
        if incomplete.is_file():
            shutil.copy2(incomplete, job_dir / incomplete.name)

if __name__ == "__main__":
    main()
