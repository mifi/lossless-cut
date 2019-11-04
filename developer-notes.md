## Release

### Release new version
```
# Commit changes
npm version ...
# Push with tag
# Wait for Travis
```

With travis deploy:
```
Go to github releases and release the created draft
```


## Travis setup

https://github.com/travis-ci/travis-ci/issues/6132
https://github.com/bkimminich/juice-shop/blob/master/.travis.yml

https://stackoverflow.com/questions/12343452/how-to-publish-artifacts-in-travis-ci
https://docs.travis-ci.com/user/deployment/releases/
https://octokit.github.io/octokit.rb/Octokit/Client/Releases.html#create_release-instance_method

npm install -g pwmckenna/node-travis-encrypt
echo GITHUB_KEY | travis-encrypt -r mifi/lossless-cut
