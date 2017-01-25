TESTS = test/file.js
test:
	mocha --timeout 5000 $(TESTS)

.PHONY: test
