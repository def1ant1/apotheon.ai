/**
 * Conventional Commits keep our changelog automation and release tooling consistent.
 * This tiny wrapper simply forwards to the official shareable configuration.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
