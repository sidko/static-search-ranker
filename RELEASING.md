# Releasing

After `main` CI passes, create and push the matching version tag over SSH:

```sh
git tag v<version>
git push origin v<version>
```

`release.yml` checks out the event commit by immutable SHA, checks the tag against
`package.json`, runs tests, and packs the exact npm tarball. It publishes only
when that version is absent; an existing version must have the same tarball SHA-1.
After success, the workflow creates the GitHub Release with its built-in token.
