# Makefile: build, upload, and monitor solver firmware via portmap.json
SHELL := bash

SOLVERS = 3sat ksat ldpc
PORTMAP = portmap.json

.PHONY: all build-solvers upload-solvers monitor-solvers clean

all: build-solvers upload-solvers monitor-solvers

build-solvers:
	@echo "Building solver firmware..."
	@for s in $(SOLVERS); do \
		echo "  Building $$s"; \
		(cd $$s && platformio run --environment teensy41); \
	done

upload-solvers:
	@echo "Uploading solver firmware..."
	@for s in $(SOLVERS); do \
		port=$$(jq -r '.solvers[] | select(.name == "'"$$s"'") | .port' $(PORTMAP)); \
		if [ -z "$$port" ]; then \
			echo "  No port for $$s, skipping"; \
		else \
			echo "  Uploading $$s to $$port"; \
			(cd $$s && platformio run --target upload --environment teensy41 --upload-port $$port); \
			sleep 3; \
		fi; \
	done

monitor-solvers:
	@echo "Launching serial monitors..."
	@for s in $(SOLVERS); do \
		port=$$(jq -r '.solvers[] | select(.name == "'"$$s"'") | .port' $(PORTMAP)); \
		baud=$$(jq -r '.solvers[] | select(.name == "'"$$s"'") | .baudRate' $(PORTMAP)); \
		if [ -n "$$port" ]; then \
			osascript -e "tell application \"Terminal\" to do script \"cd $(CURDIR)/$$s && platformio device monitor --port $$port --baud $$baud\""; \
		fi; \
	done

clean:
	@echo "Cleaning build artifacts..."
	@rm -f *.o *.elf *.bin *.dump *.hex