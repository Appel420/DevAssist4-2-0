#!/usr/bin/env python3
"""Offline chatbot rules builder.

This utility works only with local training data. It does not download
third-party datasets or models.
"""

from __future__ import annotations

import json
import os
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable

DATA_CANDIDATES = [
    Path("training_data.jsonl"),
    Path("training_data.json"),
    Path("data/training_data.jsonl"),
    Path("data/training_data.json"),
]
OUTPUT_DIR = Path("./devassist_model")
RULES_FILE = OUTPUT_DIR / "chat_rules.json"
WORD_RE = re.compile(r"[a-z0-9']+")


class OfflineChatbotTrainer:
    def __init__(self) -> None:
        self.rules: dict[str, object] = {}

    def _load_local_pairs(self) -> list[dict[str, str]]:
        for candidate in DATA_CANDIDATES:
            if not candidate.exists():
                continue
            if candidate.suffix == ".jsonl":
                return self._load_jsonl(candidate)
            return self._load_json(candidate)
        raise FileNotFoundError(
            "No local training data found. Add training_data.jsonl or training_data.json in this directory."
        )

    def _load_jsonl(self, path: Path) -> list[dict[str, str]]:
        pairs: list[dict[str, str]] = []
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            item = json.loads(line)
            prompt = str(item.get("prompt", "")).strip()
            response = str(item.get("response", "")).strip()
            if prompt and response:
                pairs.append({"prompt": prompt, "response": response})
        return pairs

    def _load_json(self, path: Path) -> list[dict[str, str]]:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            payload = payload.get("pairs", [])
        pairs: list[dict[str, str]] = []
        for item in payload:
            prompt = str(item.get("prompt", "")).strip()
            response = str(item.get("response", "")).strip()
            if prompt and response:
                pairs.append({"prompt": prompt, "response": response})
        return pairs

    def _tokenize(self, text: str) -> list[str]:
        return WORD_RE.findall(text.lower())

    def build_rules(self, pairs: Iterable[dict[str, str]]) -> dict[str, object]:
        exact = {}
        keywords: dict[str, Counter[str]] = defaultdict(Counter)
        for pair in pairs:
            prompt = pair["prompt"]
            response = pair["response"]
            exact[prompt.lower()] = response
            for token in set(self._tokenize(prompt)):
                keywords[token][response] += 1
        return {
            "exact": exact,
            "keywords": {token: counts.most_common() for token, counts in keywords.items()},
        }

    def save_rules(self, rules: dict[str, object]) -> None:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        RULES_FILE.write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")

    def setup_model(self) -> None:
        self.rules = self._load_rules()

    def train_model(self) -> None:
        pairs = self._load_local_pairs()
        if not pairs:
            raise RuntimeError("Training data is empty.")
        self.rules = self.build_rules(pairs)
        self.save_rules(self.rules)

    def _load_rules(self) -> dict[str, object]:
        if RULES_FILE.exists():
            return json.loads(RULES_FILE.read_text(encoding="utf-8"))
        self.train_model()
        return json.loads(RULES_FILE.read_text(encoding="utf-8"))

    def chat_with_bot(self, prompt: str) -> str:
        if not self.rules:
            self.setup_model()

        text = prompt.strip().lower()
        if not text:
            return ""

        exact = self.rules.get("exact", {})
        if isinstance(exact, dict) and text in exact:
            return str(exact[text])

        keywords = self.rules.get("keywords", {})
        if isinstance(keywords, dict):
            scores: Counter[str] = Counter()
            for token in self._tokenize(text):
                matches = keywords.get(token, [])
                for response, count in matches:
                    scores[str(response)] += int(count)
            if scores:
                return scores.most_common(1)[0][0]

        return "I need a matching local rule to answer that."


def main() -> None:
    trainer = OfflineChatbotTrainer()
    command = (os.environ.get("CHATBOT_COMMAND") or "train").strip().lower()

    if command == "chat":
        prompt = os.environ.get("CHATBOT_PROMPT", "")
        print(trainer.chat_with_bot(prompt))
        return

    trainer.train_model()
    print(f"Saved offline rules to {RULES_FILE}")


if __name__ == "__main__":
    main()
