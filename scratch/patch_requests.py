import sys

def patch():
    file_path = "apps/kongila-web/components/ClientDashboard.tsx"
    with open(file_path, "r") as f:
        content = f.read()

    start_str = "  const renderRequests = () => {"
    end_str = "  const renderContracts = () => {"

    start_idx = content.find(start_str)
    end_idx = content.find(end_str)

    if start_idx == -1 or end_idx == -1:
        print("Could not find start or end strings")
        sys.exit(1)

    with open("scratch/new_requests_functions.tsx", "r") as f:
        new_content = f.read()

    patched = content[:start_idx] + new_content + "\n" + content[end_idx:]

    with open(file_path, "w") as f:
        f.write(patched)
    print("Patched successfully")

if __name__ == "__main__":
    patch()
