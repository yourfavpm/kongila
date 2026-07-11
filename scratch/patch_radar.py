import sys

def patch():
    file_path = "apps/kongila-web/components/ClientDashboard.tsx"
    with open(file_path, "r") as f:
        content = f.read()

    start_str = "  const renderContracts = () => {"
    start_idx = content.find(start_str)

    if start_idx == -1:
        print("Could not find start string")
        sys.exit(1)

    with open("scratch/radar.tsx", "r") as f:
        radar_content = f.read()

    patched = content[:start_idx] + radar_content + "\n" + content[start_idx:]

    with open(file_path, "w") as f:
        f.write(patched)
    print("Patched successfully")

if __name__ == "__main__":
    patch()
