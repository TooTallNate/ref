#!/bin/sh

npm run docs \
  && rm -rf /tmp/ref_docs \
  && mkdir -p /tmp/ref_docs \
  && cp -Lrf {index.html,images,scripts,stylesheets} /tmp/ref_docs \
  && git checkout gh-pages \
  && cp -Lrf /tmp/ref_docs/* . \
  && echo "done"
