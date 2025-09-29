#!/bin/sh

find . -path ./node_modules -prune -o -path ./.netlify -prune -o -type f \( -iname \*.html -o -iname \*.js -o -iname \*.css \) -print | while read fname; do
    echo ${fname}
    npm x minify ${fname} > ${fname}.min
    mv ${fname}.min ${fname}
done
