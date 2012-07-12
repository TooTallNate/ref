#!/bin/sh

DIR=`dirname $0`

npm run docs \
  && rm -rf /tmp/ref_docs \
  && mkdir -p /tmp/ref_docs \
  && cp -Lrf {"$DIR/index.html","$DIR/images","$DIR/scripts","$DIR/stylesheets"} /tmp/ref_docs \
  && git checkout gh-pages \
  && cp -Lrf /tmp/ref_docs/* . \
  && echo "done"
