#!/usr/bin/env bash

ROOT=$(pwd)
FIS_CONFIG_TEMPLATE="$ROOT/fis-conf.js"
FRAMEWORKS=(
    fis-plus
)

if [ "$1" = "" ];then
    output="output"
else
    output=$1
fi

domain=

if [ "$2" != "dev" ]; then
    domain="\/fis-plus"
fi


isDev=

if [ "$2" = "dev" ]; then
    isDev="dev"
    FRAMEWORKS=(
        fis-plus
    ) 
else
    export PATH=$ROOT/node_modules/.bin:$PATH
    export NODE_PATH=$ROOT/node_modules
fi


gitpush_gh () {
    framework=$1
    git clone https://github.com/fex-team/${framework}.git
    cd "$framework"
    
    git checkout gh-pages
    echo $GIT_NAME
    git config --global user.email "${GIT_EMAIL}"
    git config --global user.name "${GIT_NAME}"
    git config credential.helper "store --file=.git/credential"
    echo "https://${GH_TOKEN}:@github.com" > .git/credential

    rm -rf * #clear
    cp -rf ../output/* .


    git add -A -f
    git commit -m 'auto commit' -a
    git push origin gh-pages

    cd ..
    rm -rf "$framework"
}

for framework in "${FRAMEWORKS[@]}"; do
    echo $framework
    
    if [ "$isDev" = "" ]; then
        rm -rf $ROOT/doc
    fi

    subpath=$framework
    domain="\/${framework}"
    if [ "$isDev" != "" ]; then
        subpath="."
        domain=
    fi

    # concat files
    cat $FIS_CONFIG_TEMPLATE | sed s/{%FRAMEWORK%}/${subpath}/g > fis-conf-${framework}.js
    cat fis-conf-${framework}.js | sed s/{%DOMAIN%}/${domain}/g > fis-conf-${framework}_tmp.js
    mv fis-conf-${framework}_tmp.js fis-conf-${framework}.js
    
    if [ "$isDev" = "" ]; then
        echo 'test'
        git clone https://github.com/fex-team/${framework}.wiki.git $ROOT/doc
    fi
    
    fis release -cmpDd $output -f fis-conf-${framework}.js
    
    if [ "$?" = "0" -a -d "./output" ]; then
        gitpush_gh "$framework"
        rm -rf fis-conf-${framework}.js
        rm -rf output
        # 删除该项目的doc，以便下一个项目载入新的doc
        # rm -rf doc 此处作废
    fi
done
