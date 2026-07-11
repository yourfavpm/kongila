import re

file_path = 'apps/kongila-web/components/ClientDashboard.tsx'
new_code_path = 'scratch/new_team.tsx'

with open(file_path, 'r') as f:
    content = f.read()

with open(new_code_path, 'r') as f:
    new_code = f.read()

start_marker = "  const renderContracts = () => {"
end_marker = "  const renderBilling = () => {"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: Could not find markers. start_idx={start_idx}, end_idx={end_idx}")
else:
    # Insert new_code where start_marker was, and preserve from end_marker onwards
    modified = content[:start_idx] + new_code + "\n" + content[end_idx:]
    with open(file_path, 'w') as f:
        f.write(modified)
    print("Patch successful!")
