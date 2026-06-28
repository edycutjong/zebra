#!/usr/bin/env python3
import os
import sys

def check_readiness():
    print("==========================================================")
    print("ZEBRA SUBMISSION READINESS CHECKER")
    print("==========================================================")

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    errors = 0

    # Rules to search
    forbidden_words = ["TODO", "FIXME", "PLACEHOLDER", "lorem", "example.com"]
    localhost_words = ["localhost", "127.0.0.1"]

    print("Checking for forbidden placeholder text...")
    for root, dirs, files in os.walk(base_dir):
        if "node_modules" in root or ".next" in root or ".git" in root or "temp_assets" in root:
            continue
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.sql', '.nr', '.toml')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                        for i, line in enumerate(lines):
                            # Forbidden words check
                            for word in forbidden_words:
                                if word in line:
                                    # Allow TODO/FIXME inside this check script
                                    if "check_submission_readiness" in file_path:
                                        continue
                                    # Allow in specific docs
                                    if "GOAL.md" in file_path or "PROGRESS.md" in file_path:
                                        continue
                                    print(f"❌ Found '{word}' in {os.path.relpath(file_path)}:L{i+1}: {line.strip()}")
                                    errors += 1
                            
                            # Localhost check for source files
                            if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                                for host in localhost_words:
                                    if host in line:
                                        # Skip webpack/config templates and test runner configs
                                        if "next.config" in file_path or "playwright.config" in file_path or "lighthouserc" in file_path:
                                            continue
                                        print(f"❌ Found '{host}' in source file {os.path.relpath(file_path)}:L{i+1}: {line.strip()}")
                                        errors += 1
                except Exception as e:
                    # Ignore binary files or read errors
                    pass

    print("----------------------------------------------------------")
    if errors == 0:
        print("✅ Ready! No forbidden placeholders or localhost found.")
        print("==========================================================")
        return True
    else:
        print(f"❌ Failed! Found {errors} issues. Please fix them before submitting.")
        print("==========================================================")
        return False

if __name__ == "__main__":
    if check_readiness():
        sys.exit(0)
    else:
        sys.exit(1)
