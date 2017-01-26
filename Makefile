TESTS = test/*.js
test:
	mocha --preserve-symlinks  --timeout 5000 $(TESTS)

.PHONY: test
