module.exports = {
  "require": "ts-node/register",
  "loader": "ts-node/esm",
  "extensions": ["ts"],
  "spec": [
    "src/**/*.spec.ts",
  ],
  "watch-files": [
    "src",
  ]
}
