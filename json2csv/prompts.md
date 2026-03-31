# Prompts

## Nested structures, 31 Mar 2026

<!-- codex --yolo --model gpt-5.4 --config model_reasoning_effort=xhigh -->

In json2csv/ denormalize nested JSON objects into columns using a dot notation. For example:

[
  {
    "user_id": 1034891,
    "challenges": [
      {
        "name": "Crack the Gate 1",
        "choices": {
          "a": true,
          "b": false
        }
      },
      {
        "name": "Power Cookie",
        "choices": {
          "a": true,
          "b": false
        }
      }
   ]
  }
]

would have columns: user_id, challenges.name, challenges.choices.a, challenges.choices.b by repeating the user_id for each challenge.

<!-- codex resume 019d4394-cd22-7783-b9c9-fe99cd53a836 -->
