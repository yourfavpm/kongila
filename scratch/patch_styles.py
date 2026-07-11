import re

file_path = 'apps/kongila-web/components/ClientDashboard.tsx'

with open(file_path, 'r') as f:
    content = f.read()

styles = """
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, marginBottom: '8px' };
  const inputStyle = { width: '100%', height: '40px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' as const };
"""

# Insert right after const ClientDashboard = ({ ... }) => {
match = re.search(r'const ClientDashboard\s*=\s*\(\{.*?\}\)\s*=>\s*\{', content, re.DOTALL)
if match:
    insert_pos = match.end()
    modified = content[:insert_pos] + "\n" + styles + content[insert_pos:]
    with open(file_path, 'w') as f:
        f.write(modified)
    print("Styles patched.")
else:
    print("Could not find ClientDashboard component definition.")
