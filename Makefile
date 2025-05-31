# Makefile for Dacroq monorepo

.PHONY: init deps start daemon ui stop

# Initialize git submodules
init:
	git submodule update --init --recursive

# Install dependencies for Daemon and UI
deps: init
	# Python dependencies in a virtual environment
	[ -d .venv ] || python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r Daemon/requirements.txt
	# Frontend dependencies
	cd UI && pnpm install

# Start backend daemon
daemon:
	cd Daemon && ../.venv/bin/python3 app.py

# Start frontend UI
ui:
	cd UI && pnpm run dev

# Start both services
start: deps
	@echo "Starting Daemon in background..."
	$(MAKE) daemon &
	@echo "Starting UI..."
	$(MAKE) ui

start-docs:
	@echo "Starting documentation server..."
	cd Docs && npm install && npm run dev

# Stop services
stop:
	pkill -f "python3.*app.py" || true
	pkill -f "next dev" || true

clean:
	@echo \"Cleaning build artifacts...\"
	cd UI && rm -rf .next
	cd Docs && rm -rf .vitepress/dist
	find . -type d -name \"pycache\" -exec rm -rf {} +
	"