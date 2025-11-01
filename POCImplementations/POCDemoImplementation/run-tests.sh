#!/bin/bash

# Test Runner Script for POCDemoImplementation
# Runs all tests and generates coverage reports

set -e  # Exit on error

echo "========================================="
echo "POCDemoImplementation Test Suite"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print section header
print_section() {
    echo ""
    echo "========================================="
    echo "$1"
    echo "========================================="
}

# Function to run Python tests
run_python_tests() {
    print_section "Running Python Tests"
    
    cd backend/python
    
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    source venv/bin/activate || true
    pip install -q -r requirements.txt
    
    echo "Running pytest..."
    if pytest --cov=app --cov-report=term-missing --cov-report=html -v; then
        echo -e "${GREEN}✓ Python tests passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ Python tests failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    deactivate
    cd ../..
}

# Function to run Node.js tests
run_nodejs_tests() {
    print_section "Running Node.js Tests"
    
    cd backend/nodejs
    
    if [ ! -d "node_modules" ]; then
        echo "Installing Node.js dependencies..."
        npm install
    fi
    
    echo "Running Jest..."
    if npm test -- --coverage --silent; then
        echo -e "${GREEN}✓ Node.js tests passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ Node.js tests failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    cd ../..
}

# Function to run E2E tests
run_e2e_tests() {
    print_section "Running E2E Tests"
    
    cd e2e
    
    if [ ! -d "node_modules" ]; then
        echo "Installing E2E test dependencies..."
        npm install
    fi
    
    echo "Running Playwright..."
    if npm test; then
        echo -e "${GREEN}✓ E2E tests passed${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ E2E tests failed${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
    
    cd ..
}

# Check if pytest is available
check_python() {
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 not found${NC}"
        exit 1
    fi
}

# Check if node/npm is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js not found${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm not found${NC}"
        exit 1
    fi
}

# Main execution
main() {
    echo "Starting test suite..."
    echo ""
    
    # Check prerequisites
    check_python
    check_nodejs
    
    # Run tests
    run_python_tests || true
    run_nodejs_tests || true
    run_e2e_tests || true
    
    # Print summary
    print_section "Test Summary"
    echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        echo "Coverage reports generated:"
        echo "  - Python: backend/python/htmlcov/index.html"
        echo "  - Node.js: backend/nodejs/coverage/lcov-report/index.html"
        echo "  - E2E: e2e/playwright-report/index.html"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Parse arguments
case "${1:-all}" in
    python)
        check_python
        run_python_tests
        ;;
    nodejs|node)
        check_nodejs
        run_nodejs_tests
        ;;
    all)
        main
        ;;
    e2e)
        check_nodejs
        run_e2e_tests
        ;;
    *)
        echo "Usage: $0 [python|nodejs|e2e|all]"
        echo "  python  - Run Python tests only"
        echo "  nodejs  - Run Node.js tests only"
        echo "  e2e     - Run E2E tests only"
        echo "  all     - Run all tests (default)"
        exit 1
        ;;
esac

