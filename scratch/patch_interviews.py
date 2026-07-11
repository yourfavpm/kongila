import re

file_path = 'apps/kongila-web/components/ClientDashboard.tsx'
new_code_path = 'scratch/new_interviews.tsx'

with open(file_path, 'r') as f:
    content = f.read()

with open(new_code_path, 'r') as f:
    new_code = f.read()

start_marker = "  // ─── Interview State (inside component) ─────────────────────────────────────"
end_marker = "  const renderCompany = () => {"

# We find the indices
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: Could not find markers. start_idx={start_idx}, end_idx={end_idx}")
else:
    # Replace the block
    modified = content[:start_idx] + new_code + "\n" + content[end_idx:]
    with open(file_path, 'w') as f:
        f.write(modified)
    print("Patch successful!")
