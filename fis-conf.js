/**
 * use sass
 */

var path = require('path');
var url = require('url');

fis.config.set('project.exclude', [
    '**/_*.scss',
    '*/node_modules/**',
    'Makefile',
    'build.sh',
    'README.md',
    'trigger.js',
    'changelog/**'
]);

fis.config.set('modules.parser.scss', 'sass'); //启用fis-parser-sass插件
fis.config.set('roadmap.ext.scss', 'css'); //scss文件编译后产出为css文件
fis.config.set('framework', '{%FRAMEWORK%}');
fis.config.set('roadmap.domain', '{%DOMAIN%}');
fis.config.set('macro', {
    'namespace': '{%FRAMEWORK%}',
    'class-warning': 'bs-callout bs-callout-warning',
    'class-danger': 'bs-callout bs-callout-danger',
    'class-info': 'bs-callout bs-callout-info'
});

fis.config.set('roadmap.path', [{
    reg: '*\.min\.(?:js|css)$',
    useOptimizer: false,
    release: '/static/${framework}/$&'
}, {
    reg: '**/_Sidebar.md',
    isNav: true
}, {
    reg: '**.md',
    useCache: false
}, {
    reg: '/pages/${framework}/document.html',
    release: '/document.html',
    isDocumentPage: true
}, {
    // pages下的所有结构移至根目录
    reg: new RegExp('^\\/pages\\/' + fis.config.get('framework') + '\\/(.*\\.html)$'),
    release: '/$1'
}, {
    // 所有pages/,static/,widget/下的结构都相同，为./[repo-name]/[dirs/files]
    reg: new RegExp('^\\/(.*)\\/' + fis.config.get('framework') + '\\/(.*)$'),
    release: '/$1/$2'
}, {
    reg: 'lib/**'
}, {
    reg: 'map.json'
}, {
    reg: '**',
    // release: '/static/${framework}/$&'
    release: '/static/$&'
}]);

fis.config.set('settings.parser.sass', {
    'include_paths': [__dirname, path.join(__dirname, 'lib', 'bootstrap', 'stylesheets')]
});

// 获取导航需要编译加`-c`或者`-u`，因为我偷懒了，没有处理缓存
var gLinks = {};
var gNavRef = [];
var gLinkContent = '';

fis.config.set('roadmap.ext.md', 'html');

fis.config.set('modules.parser.md', [function(content, file, conf) {
        var include_reg = /<!--include\[([^\]]+)\]-->|<!--(?!\[)([\s\S]*?)(-->|$)/ig;
        var processed = [];

        function _process(content, file) {
            processed[file.realpath] = true;
            return content.replace(include_reg, function(all, $1) {
                if ($1) {
                    var f = fis.file(path.join(file.dirname, $1));
                    if (processed.indexOf(f.realpath) == -1) {
                        return _process(f.getContent(), f);
                    }
                    return f.getContent();
                }
                return all;
            });
        }
        return _process(content, file);
    },
    function(content, file, conf) {
        var marked = require('marked');
        var renderer = new marked.Renderer();
        var navs = [];
        var links = [];

        renderer.heading = function(text, level) {
            var link = {};
            link.text = text;
            link.level = level;
            var escapedText = encodeURI(text);

            links.push(link);

            if (level != 1) level += 1;
            return '<h' + level + ' class="' + (level == 1 ? 'page-header' : '') +
                (level == 3 ? '" id="' + text : '') +
                '"><a name="' +
                escapedText +
                '" href="#' +
                escapedText +
                '">'+ text + '</a>' +
                '</h' + level + '>';
        };

        renderer.paragraph = function(text) {
            return '<p>' + (require('pangunode'))(text) + '</p>\n';
        };

        renderer.link = function(href, title, text) {
            text = (require('pangunode'))(text);
            if (file.isNav) {
                var info = url.parse(href);
                if (!~navs.indexOf(info.pathname)) {
                    //check file exist?
                    var refFile = fis.file(file.dirname + '/' + info.pathname + '.md');
                    gNavRef.push(refFile.toString());
                    navs.push(info.pathname);
                }
                href = '#' + encodeURI(text);
            }

            var out = '<a href="' + href + '"';

            if (href.indexOf('#') != -1 && href.indexOf('http') != 0) {
                out = '<a href="' + encodeURI(href.substr(href.indexOf('#'))) + '"';
            }

            if (title) {
                out += ' title="' + title + '"';
            }

            out += '>' + text + '</a>';
            return out;
        };

        marked.setOptions({
            renderer: renderer,
            highlight: function(code) {
                return require('highlight.js').highlightAuto(code).value;
            },
            langPrefix: 'hljs lang-',
            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            sanitize: false,
            smartLists: true,
            smartypants: false
        });

        content = marked(content);

        gLinks[file.realpath] = links;

        if (file.isNav) {
            gLinkContent = content;
            return navs.map(function(path) {
                return '<div class="bs-docs-section"><!--inline[' + path + '.md]--></div>';
            }).join('\n');
        }
        return content;
    }
]);

function getLinksHtml(links) {
    var ret = '';
    var flag = false;
    var levels = [];
    links.forEach(function(link) {
        if (link.level == 1) {
            if (flag) {
                ret += '</ul></li>';
            }
            flag = true;
            ret += '<li><a href="#' + encodeURI(link.text) + '">' + link.text + '</a><ul class="nav">';
        } else if (link.level == 2) {
            ret += '<li><a href="#' + encodeURI(link.text) + '">' + link.text + '</a>';
        }
    });
    ret += '</ul></li>';
    return ret;
}

fis.config.set('modules.postpackager', [function(ret, settings, conf, opt) {
        fis.util.map(ret.src, function(subpath, file) {
            if (file.isDocumentPage) {
                var useLinks = [];
                fis.util.map(gLinks, function(realpath, links) {
                    if (gNavRef.indexOf(realpath) != -1) {
                        useLinks = useLinks.concat(links);
                    }
                });
                console.log(gLinkContent);
                file.setContent(file.getContent().replace('<document_links>', gLinkContent)); //getLinksHtml(useLinks)));
                gLinks = []; //reset
            }
            if (file.isHtmlLike) {
                var macro = fis.config.get('macro');
                var content = file.getContent();
                fis.util.map(macro, function(key, value) {
                    content = content.replace(new RegExp('<#' + key + '#>', 'g'), function(all) {
                        return value;
                    });
                });
                file.setContent(content);
            }
        });
    },
    'simple' //pack
]);

fis.config.set('settings.postpackager.simple.autoCombine', true);
fis.config.set('settings.postpackager.simple.autoReflow', true);