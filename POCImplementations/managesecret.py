#!/usr/bin/env python3
"""
Manage Secret - Update ANTHROPIC_API_KEY in .env file
Usage: python managesecret.py
"""

import os
import sys
import shutil
from pathlib import Path
from datetime import datetime


def validate_api_key(api_key: str) -> bool:
    """
    Validate Anthropic API key format.
    Expected format: sk-ant-api03-...
    """
    if not api_key:
        return False
    
    # Check minimum length (Anthropic keys are typically long)
    if len(api_key) < 20:
        return False
    
    # Check if starts with expected prefix
    if api_key.startswith("sk-ant-api03-"):
        return True
    
    # Also accept sk-ant- prefix (older format)
    if api_key.startswith("sk-ant-"):
        return True
    
    return False


def get_env_file_path() -> Path:
    """
    Get the path to the .env file in POCDemoImplementation directory.
    """
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    
    # .env file should be in POCDemoImplementation directory
    env_file = script_dir / "POCDemoImplementation" / ".env"
    
    # If not found, check if we're already in POCDemoImplementation
    if not env_file.exists():
        env_file = script_dir / ".env"
    
    return env_file


def backup_env_file(env_file: Path) -> Path:
    """
    Create a backup of the .env file.
    Returns the backup file path.
    """
    if not env_file.exists():
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = env_file.parent / f".env.backup_{timestamp}"
    shutil.copy2(env_file, backup_file)
    return backup_file


def update_env_file(env_file: Path, api_key: str) -> bool:
    """
    Update ANTHROPIC_API_KEY in .env file.
    If file doesn't exist, create it based on env.example.
    """
    # Create .env from example if it doesn't exist
    if not env_file.exists():
        example_file = env_file.parent / "env.example"
        if example_file.exists():
            shutil.copy2(example_file, env_file)
            print(f"✅ Created .env file from env.example")
        else:
            # Create minimal .env file
            env_file.write_text(f"# Environment Configuration\nANTHROPIC_API_KEY={api_key}\n")
            print(f"✅ Created new .env file")
            return True
    
    # Read current .env file
    try:
        lines = env_file.read_text().splitlines()
    except Exception as e:
        print(f"❌ Error reading .env file: {e}")
        return False
    
    # Update or add ANTHROPIC_API_KEY
    updated = False
    new_lines = []
    api_key_found = False
    
    for line in lines:
        stripped = line.strip()
        # Check if this line contains ANTHROPIC_API_KEY
        if stripped.startswith("ANTHROPIC_API_KEY=") or stripped.startswith("# ANTHROPIC_API_KEY"):
            # Update existing line
            if not stripped.startswith("#"):
                new_lines.append(f"ANTHROPIC_API_KEY={api_key}")
                api_key_found = True
                updated = True
            else:
                # Uncomment and update if it was commented
                new_lines.append(f"ANTHROPIC_API_KEY={api_key}")
                api_key_found = True
                updated = True
        else:
            new_lines.append(line)
    
    # Add ANTHROPIC_API_KEY if it wasn't found
    if not api_key_found:
        # Add at the beginning after any comments
        insert_pos = 0
        for i, line in enumerate(new_lines):
            if line.strip() and not line.strip().startswith("#"):
                insert_pos = i
                break
        
        new_lines.insert(insert_pos, f"ANTHROPIC_API_KEY={api_key}")
        updated = True
    
    # Write updated content
    try:
        env_file.write_text("\n".join(new_lines) + "\n")
        return True
    except Exception as e:
        print(f"❌ Error writing .env file: {e}")
        return False


def main():
    """
    Main function to update ANTHROPIC_API_KEY.
    """
    print("=" * 60)
    print("🔐 Anthropic API Key Configuration Tool")
    print("=" * 60)
    print()
    
    # Get .env file path
    env_file = get_env_file_path()
    
    if not env_file.parent.exists():
        print(f"❌ Error: Directory not found: {env_file.parent}")
        print(f"   Please run this script from the POCImplementations directory")
        sys.exit(1)
    
    print(f"📁 .env file location: {env_file}")
    print()
    
    # Check if .env exists
    env_exists = env_file.exists()
    if env_exists:
        print(f"✅ Found existing .env file")
        
        # Show current API key (masked)
        try:
            current_key = None
            with open(env_file, 'r') as f:
                for line in f:
                    if line.strip().startswith("ANTHROPIC_API_KEY="):
                        current_key = line.split("=", 1)[1].strip()
                        break
            
            if current_key and current_key != "your_anthropic_api_key_here":
                masked = current_key[:15] + "..." + current_key[-10:] if len(current_key) > 25 else current_key[:15] + "..."
                print(f"   Current API key: {masked}")
            else:
                print(f"   Current API key: Not set or placeholder")
        except Exception as e:
            print(f"   ⚠️  Could not read current API key: {e}")
    else:
        print(f"⚠️  .env file not found. Will create new one.")
    
    print()
    
    # Get API key from user
    print("Please enter your Anthropic API key:")
    print("   (Get one at: https://console.anthropic.com/)")
    print("   (Key should start with 'sk-ant-api03-' or 'sk-ant-')")
    print()
    
    api_key = input("API Key: ").strip()
    
    if not api_key:
        print("❌ Error: API key cannot be empty")
        sys.exit(1)
    
    # Validate API key format
    if not validate_api_key(api_key):
        print()
        print("⚠️  Warning: API key format might be incorrect.")
        print(f"   Your key starts with: {api_key[:15]}...")
        print("   Expected format: sk-ant-api03-... or sk-ant-...")
        print()
        
        response = input("Continue anyway? (y/n): ").strip().lower()
        if response != 'y':
            print("❌ Aborted by user")
            sys.exit(0)
    
    # Create backup if .env exists
    if env_exists:
        backup_file = backup_env_file(env_file)
        if backup_file:
            print(f"✅ Created backup: {backup_file.name}")
    
    # Update .env file
    print()
    print("📝 Updating .env file...")
    
    if update_env_file(env_file, api_key):
        print("✅ Successfully updated ANTHROPIC_API_KEY in .env")
        
        # Verify update
        try:
            with open(env_file, 'r') as f:
                for line in f:
                    if line.strip().startswith("ANTHROPIC_API_KEY="):
                        updated_key = line.split("=", 1)[1].strip()
                        masked = updated_key[:15] + "..." + updated_key[-10:] if len(updated_key) > 25 else updated_key[:15] + "..."
                        print(f"   Updated key: {masked}")
                        break
        except Exception:
            pass
        
        print()
        print("=" * 60)
        print("✅ Configuration Complete!")
        print("=" * 60)
        print()
        print("📋 Next steps:")
        print("   1. Restart Docker containers (if running):")
        print("      docker-compose restart python-ai ai-chatbot")
        print()
        print("   2. Or start services:")
        print("      docker-compose up -d")
        print()
        print("   3. Verify the configuration:")
        print("      cat .env | grep ANTHROPIC_API_KEY")
        print()
    else:
        print("❌ Failed to update .env file")
        if backup_file:
            print(f"   Backup available at: {backup_file}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Aborted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)


