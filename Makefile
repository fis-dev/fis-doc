debug:
	sh ./build.sh preview dev
release:
	sh ./build.sh

.PHONY: debug release