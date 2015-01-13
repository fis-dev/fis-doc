/**
 * use sass
 */

var path = require('path');
var url = require('url');

fis.config.set('project.exclude',
    [
        '**/_*.scss', 
        '*/node_modules/**'
    ]
);
fis.config.set('modules.parser.scss', 'sass');  //启用fis-parser-sass插件
fis.config.set('roadmap.ext.scss', 'css');      //scss文件编译后产出为css文件
fis.config.set('framework', '{%FRAMEWORK%}');
fis.config.set('roadmap.domain', '{%DOMAIN%}');
fis.config.set('macro', {
    'namespace': '{%FRAMEWORK%}'
});

fis.config.set('roadmap.path', [
    {
        reg: '*\.min\.(?:js|css)$',
        useOptimizer: false,
        release: '/static/${framework}/$&'
    },
    {
        reg: '**/_Sidebar.md',
        isNav: true
    },
    {
        reg: '**.md'
    },
    {
        reg: '/document.html',
        isDocumentPage: true
    },
    {
        reg: '**.html'
    },
    {
        reg: '**',
        release: '/static/${framework}/$&'
    }
]);

fis.config.set('settings.parser.sass', {
    'include_paths': [__dirname, path.join(__dirname, 'lib', 'bootstrap', 'stylesheets')]
});

// 获取导航需要编译加`-c`或者`-u`，因为我偷懒了，没有处理缓存
var gLinks = {};
var gNavRef = [];
fis.config.set('roadmap.ext.md', 'html');

fis.config.set('modules.parser.md', [function (content, file, conf) {
    var include_reg = /<!--include\[([^\]]+)\]-->|<!--(?!\[)([\s\S]*?)(-->|$)/ig;
    var processed = [];
    function _process(content, file) {
        processed[file.realpath] = true;
        return content.replace(include_reg, function (all, $1) {
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
function (content, file, conf) {
    var marked = require('marked');
    var renderer = new marked.Renderer();
    var navs = [];
    var links = [];

    if (file.isNav) {
        renderer.link = function(href, title, text) {
            var info = url.parse(href);
            if (!~navs.indexOf(info.pathname)) {
                //check file exist?
                var refFile = fis.file(file.dirname + '/' + info.pathname + '.md');
                gNavRef.push(refFile.toString());
                navs.push(info.pathname);
            }
        };
    }

    renderer.heading = function (text, level) {
        var link = {};
        link.text = text;
        link.level = level;
        var escapedText = text;
        
        links.push(link);

        if (level != 1) level += 1;
        return '<h' + level + ' class="' + (level == 1 ? 'page-header' : '') + 
                (level == 3 ? '" id="' + text  : '') + 
                '"><a name="' +
                    escapedText +
                     '" class="anchor" href="#' +
                     escapedText +
                     '"><span class="header-link"></span></a>' +
                      text + '</h' + level + '>';
    };

    marked.setOptions({
        renderer: renderer,
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
        return navs.map(function(path) {
            return '<div class="bs-docs-section"><!--inline[' + path + '.md]--></div>';
        }).join('\n');
    }
    return content;
}]);

function getLinksHtml(links) {
    var ret = '';
    var flag = false;
    var levels = [];
    links.forEach(function (link) {
        if (link.level == 1) {
            if (flag) {
                ret += '</ul></li>';
            }
            flag = true;
            ret += '<li><a href="#' + link.text + '">' + link.text + '</a><ul class="nav">';
        } else if (link.level == 2) {
            ret += '<li><a href="#' + link.text + '">' + link.text + '</a>';
        }
    });
    ret += '</ul></li>';
    return ret;
}

fis.config.set('modules.postpackager', function (ret, settings, conf, opt) {
    fis.util.map(ret.src, function (subpath, file) {
        if (file.isDocumentPage) {
            var useLinks = [];
            fis.util.map(gLinks, function (realpath, links) {
                if (gNavRef.indexOf(realpath) != -1) {
                    useLinks = useLinks.concat(links);
                }
            });
            console.log(useLinks);
            file.setContent(file.getContent().replace('<document_links>', getLinksHtml(useLinks)));
            gLinks = []; //reset
        }
        if (file.isHtmlLike) {
            var macro = fis.config.get('macro');
            var content = file.getContent();
            fis.util.map(macro, function(key, value) {
                content = content.replace(new RegExp('<#' + key + '#>', 'g'), function (all) {
                    return value;
                });
            });
            file.setContent(content);
        }
    });
});
