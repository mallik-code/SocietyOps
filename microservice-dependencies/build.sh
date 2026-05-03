#!/bin/bash
# build.sh - Linux/macOS Build Script for societyops-dependencies

# 1. Load version from .env or environment
if [ -f .env ]; then
    echo "Loading environment variables from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# 2. Check if the specific SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION is set
if [ -z "$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION" ]; then
    echo "Error: SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION is not set. Please set it in your environment or .env file."
    exit 1
fi

echo "Building societyops-dependencies version: $SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION"

# 3. Replace placeholder and generate pyproject.toml
sed "s/\$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION/$SOCIETYOPS_DEPENDENCIES_PACKAGE_VERSION/g" pyproject.template.toml > pyproject.toml

# 4. Build the package
echo "Running python build..."
python3 -m build

echo "Build complete! Artifacts are in the dist/ directory."
