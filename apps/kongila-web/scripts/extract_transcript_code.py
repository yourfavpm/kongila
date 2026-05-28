import json

TRANSCRIPT_PATH = "/Users/oluwadammilola/.gemini/antigravity-ide/brain/23a2bf47-64e2-45dc-9fe6-793a5219d8f7/.system_generated/logs/transcript.jsonl"

def extract():
    print(f"Reading transcript from {TRANSCRIPT_PATH}...")
    with open(TRANSCRIPT_PATH, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                step = data.get("step_index")
                tool_calls = data.get("tool_calls", [])
                
                # Check for step 1878 or 1758
                if step in (1758, 1878):
                    print(f"Found step {step}!")
                    for tc in tool_calls:
                        if tc.get("name") in ("replace_file_content", "multi_replace_file_content"):
                            args = tc.get("args", {})
                            if isinstance(args, str):
                                args = json.loads(args)
                            
                            rep_content = args.get("ReplacementContent")
                            chunks = args.get("ReplacementChunks")
                            
                            if rep_content:
                                print(f"Writing replacement content from step {step}...")
                                with open(f"extracted_step_{step}.txt", "w") as out:
                                    out.write(rep_content)
                                print(f"Successfully wrote extracted_step_{step}.txt!")
                            elif chunks:
                                print(f"Writing chunks from step {step}...")
                                with open(f"extracted_step_{step}_chunks.json", "w") as out:
                                    json.dump(chunks, out, indent=2)
                                print(f"Successfully wrote extracted_step_{step}_chunks.json!")
            except Exception as e:
                # ignore malformed lines
                pass

if __name__ == "__main__":
    extract()
