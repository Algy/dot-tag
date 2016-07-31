"use strict";
(function (DotTag, global) {
//
// Polyfills 
// 

if (!Array.isArray) {
  Array.isArray = function(arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
  };
}

if (typeof Object.create != 'function') {
  Object.create = (function(undefined) {
    var Temp = function() {};
    return function (prototype, propertiesObject) {
      if(prototype !== Object(prototype) && prototype !== null) {
        throw TypeError('Argument must be an object, or null');
      }
      Temp.prototype = prototype || {};
      if (propertiesObject !== undefined) {
        Object.defineProperties(Temp.prototype, propertiesObject);
      } 
      var result = new Temp(); 
      Temp.prototype = null;
      // to imitate the case of Object.create(null)
      if(prototype === null) {
         result.__proto__ = null;
      } 
      return result;
    };
  })();
}

//
// Utilities
//

function update(dest, obj) {
    for (var key in obj) {
        dest[key] = obj[key];
    }
}

// see if it looks and smells like an iterable object, and do accept length === 0
// http://stackoverflow.com/questions/24048547/checking-if-an-object-is-array-like
function isArrayLike(item) {
    return (
        Array.isArray(item) || 
        (!!item &&
          typeof item === "object" &&
          typeof (item.length) === "number" && 
          (item.length === 0 ||
             (item.length > 0 && 
             (item.length - 1) in item)
          )
        )
    );
}

// http://stackoverflow.com/questions/7753448/how-do-i-escape-quotes-in-html-attribute-values
function quoteattr(s, preserveCR) {
    preserveCR = preserveCR ? '&#13;' : '\n';
    return ('' + s) /* Forces the conversion to string. */
        .replace(/&/g, '&amp;') /* This MUST be the 1st replacement. */
        .replace(/'/g, '&apos;') /* The 4 other predefined entities, required. */
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        /*
        You may add other replacements here for HTML only 
        (but it's not necessary).
        Or for XML, only if the named entities are defined in its DTD.
        */ 
        .replace(/\r\n/g, preserveCR) /* Must be before the next replacement. */
        .replace(/[\r\n]/g, preserveCR);
}

//
// Define base handler & tag function
//

function BaseHandler() {
    this.frameStack = [];
    // {tagName: string, tagInfo: Any object, currentState: {}, prevFrame: FrameStack} or null
    this.currentFrame = null;
    this.tagnameMap = {}; // tagName |-> {tagInfo: tagInfo, tagName: tagName, closable: true or false}

    this.pushFrame(null, null); // push a sentinel
}

BaseHandler.prototype = {
    pushFrame: function (tagName, tagInfo) {
        var curState = this.getCurState();
        var newFrame = {
            tagName: tagName,
            tagInfo: tagInfo,
            currentState: Object.create(curState)
        };
        newFrame.prevFrame = this.currentFrame;
        this.frameStack.push(newFrame);
        this.currentFrame = newFrame;
        this.initState(newFrame.currentState);
    },
    isTopFrame: function () {
        return !this.currentFrame.prevFrame;
    },
    prevIsTopFrame: function () {
        var prevFrame = this.currentFrame.prevFrame;
        return !!prevFrame && !prevFrame.prevFrame;
    },
    popFrame: function () {
        this.currentFrame = this.currentFrame.prevFrame;
        this.frameStack.pop();
    },
    checkTopFrame: function () {
        if (!this.isTopFrame()) {
            throw TypeError("The current frame of parser is not top-level. Did you properly close all tags? (near " + this.currentPositionRepr() + ")");
        }
    },
    initState: function (state) {
        state.dbgSibling = "";
    },
    willMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {},
    didMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {},
    willMeetClosingTag: function (tagName, tagInfo, closingArgs, tagFn) {},
    didMeetClosingTag: function (tagName, tagInfo, closingArgs, tagFn) {},
    didMeetText: function (text, tagFn) {},

    willPutContent: function (rawContent) {},
    didPutContent: function (rawContent) {},
    putText: function (text, tagFn) {
        this.didMeetText(text, tagFn);
    },

    putContent: function (arg, tagFn) {
        var precond = this.willPutContent(arg);
        if (precond === false)
            return;

        if (isArrayLike(arg)) {
            for (var idx = 0; idx < arg.length; idx++) {
                this.putContent(arg[idx], tagFn);
            }
        }

        switch (typeof arg) {
        case "string":
            this.putText(arg, tagFn);
            break;
        case "function":
            arg.apply(tagFn);
            break;
        case "undefined":
            break;
        case "object":
            if (arg === null || arg.sig === "DotTag__tf") {
                break;
            }
            // falling through
        default:
            this.putText(arg + "", tagFn);
            break;
        }
        this.didPutContent(arg);
    },

    currentPositionRepr: function () {
        var acc = [];
        var curFrame = this.currentFrame;
        while (curFrame && curFrame.prevFrame) {
            var dbgSibling = curFrame.currentState.dbgSibling;
            acc.push(dbgSibling);
            curFrame = curFrame.prevFrame;
        }
        acc.reverse();

        return acc.join(" > ");
    },

    getCurState: function () {
        var currentFrame = this.currentFrame;
        return currentFrame && currentFrame.currentState;
    },

    getPrevState: function () {
        var currentFrame = this.currentFrame;
        var prevFrame = currentFrame && currentFrame.prevFrame;
        if (prevFrame) {
            return prevFrame.currentState;
        } else {
            return null;
        }
    },
    
    openTag: function (tagName, tagInfo, args, tagFn) {
        this.willMeetOpeningTag(tagName, tagInfo, args, tagFn); 
        this.pushFrame(tagName, tagInfo);
        this.didMeetOpeningTag(tagName, tagInfo, args, tagFn);
    },

    closeTag: function (tagName, closingArgs, tagFn) {
        if (this.isTopFrame()) {
            throw TypeError('Unexpected closing tag' + (tagName? "(" + tagName + ")": "")  + ' near ' + this.currentPositionRepr());
        }

        var openingTagName = this.currentFrame.tagName, tagInfo = this.currentFrame.tagInfo;
        if (tagName && tagName !== openingTagName) {
            throw TypeError('tag name mismatch: ' + openingTagName + ' != ' + tagName + ' near ' + this.currentPositionRepr() + ' (the former is the opening tag)');
        }

        this.willMeetClosingTag(openingTagName, tagInfo, closingArgs, tagFn);
        this.popFrame();
        this.didMeetClosingTag(openingTagName, tagInfo, closingArgs, tagFn);

        var curState = this.getCurState();
        if (curState.dbgSibling) {
            curState.dbgSibling += "+";
        }
        curState.dbgSibling += openingTagName;
    },

    getProxyMethodNames: function () {
        return [];
    },

    addTagName: function (tagName, tagInfo, closable) {
        if (closable == null) closable = true;
        if (tagName in this.tagnameMap) {
            throw TypeError("Tag name conflict(in " + this + "): " + tagName);
        }

        this.tagnameMap[tagName] = {
            tagName: tagName,
            tagInfo: tagInfo,
            closable: closable
        };
        return this;
    }
};

function makeOpener(handler, tagName, tagInfo, closable) {
    var that = this;
    return function opener() {
        var args = Array.prototype.slice.apply(arguments);
        handler.openTag(tagName, tagInfo, args, that);
        if (!closable)
            handler.closeTag(tagName, args, that);
        return that;
    };
}

function makeCloser(handler, tagName) {
    var that = this;
    return function closer() {
        handler.closeTag(tagName, Array.prototype.slice.apply(arguments), that);
        return that;
    };
}

function makeProxyMethod(handler, funcName) {
    var that = this;
    if (!handler[funcName]) {
        return function UnsupportedOperation() {
            throw TypeError((handler.constructor && handler.constructor.name || 'The handler ') + "doesn't support operation '" + funcName + "'");
        };
    }

    return (new Function(
        "impl",
        "return function proxy_" + funcName + "() { return impl.apply(this, arguments) }"
    ))(function () {
        var retval = handler[funcName].apply(handler, arguments);
        if (retval === handler) {
            return that;
        }
        return retval;
    });
}

function initTagFunction(handler) {
    this.sig = "DotTag__tf";
    for (var tagName in handler.tagnameMap) {
        var tagObj = handler.tagnameMap[tagName];
        var tagInfo = tagObj.tagInfo, closable = tagObj.closable;
        this[tagName] = makeOpener.call(this, handler, tagName, tagInfo, closable);
        var closerFn = makeCloser.call(this, handler, tagName);
        this["_" + tagName] = closerFn;
        this["end" + tagName] = closerFn;
    }
    var generalCloserFn = makeCloser.call(this, handler, null);
    this._ = generalCloserFn;
    this.end = generalCloserFn;

    var names = handler.getProxyMethodNames();
    for (var idx = 0; idx < names.length; idx++) {
        var methodName = names[idx];
        this[methodName] = makeProxyMethod.call(this, handler, methodName);
    }
}

function buildTagFunction(handler) {
    function TagBuilder() {
        for (var idx = 0; idx < arguments.length; idx++) { 
            var arg = arguments[idx];
            handler.putContent(arg, TagBuilder);
        }
        return TagBuilder;
    }
    initTagFunction.call(TagBuilder, handler);
    return TagBuilder;
}

function makeBuilder(name, handlerFactory) { 
    return (new Function(
        "impl",
        "return function DotTag_" + name + "() { return impl.apply(this) }"
    ))(function () {
        var handler = handlerFactory();
        return buildTagFunction(handler);
    });
}

DotTag.addSpec = function (spec) {
    var name = spec.name,
        handlerFactory = spec.handlerFactory;
    if (name == null)
        throw TypeError("name is undefined");
    if (handlerFactory == null)
        throw TypeError("handlerFactory is undefined");

    if (name in DotTag) {
        throw TypeError('there is already a name "' + name + '"');
    }
    DotTag[name] = makeBuilder(name, handlerFactory);
};

//
// Base stuffs are done. Now let's define DOM/HTML/ReactJS Handler.
//

var VOID_TAGS = {
    area: 0, base: 0, br: 0, col: 0,
    command: 0, embed: 0, hr: 0, img: 0,
    input: 0, keygen: 0, link: 0, meta: 0,
    param: 0, source: 0, track: 0, wbr: 0
};
var HTML5_TAGS = {
    a: 0, abbr: 0, acronym: 0, address: 0, applet: 0,
    area: 0, article: 0, aside: 0, audio: 0, b: 0,
    base: 0, basefont: 0, bdi: 0, bdo: 0, big: 0,
    blockquote: 0, body: 0, br: 0, button: 0, canvas: 0,
    caption: 0, center: 0, cite: 0, code: 0, col: 0,
    colgroup: 0, command: 0, datalist: 0, dd: 0, del: 0,
    details: 0, dfn: 0, dir: 0, div: 0, dl: 0, dt: 0,
    em: 0, embed: 0, fieldset: 0, figcaption: 0,
    figure: 0, font: 0, footer: 0, form: 0, frame: 0,
    frameset: 0, h1: 0, h2: 0, h3: 0, h4: 0, h5: 0,
    h6: 0, head: 0, header: 0, hgroup: 0, hr: 0,
    html: 0, i: 0, iframe: 0, img: 0, input: 0,
    ins: 0, kbd: 0, keygen: 0, label: 0, legend: 0,
    li: 0, link: 0, map: 0, mark: 0, menu: 0, meta: 0,
    meter: 0, nav: 0, noframes: 0, noscript: 0,
    object: 0, ol: 0, optgroup: 0, option: 0, output: 0,
    p: 0, param: 0, pre: 0, progress: 0, q: 0, rp: 0,
    rt: 0, ruby: 0, s: 0, samp: 0, script: 0,
    section: 0, select: 0, small: 0, source: 0, span: 0,
    strike: 0, strong: 0, style: 0, sub: 0, summary: 0,
    sup: 0, table: 0, tbody: 0, td: 0, textarea: 0,
    tfoot: 0, th: 0, thead: 0, time: 0, title: 0,
    tr: 0, track: 0, tt: 0, u: 0, ul: 0, "var": 0,
    video: 0, wbr: 0
};

function BaseHTMLHandler() {
    BaseHandler.apply(this);
    for (var htmlTagName in HTML5_TAGS) {
        var isVoidTag = htmlTagName in VOID_TAGS;
        this.addTagName(htmlTagName, {type: "html", isVoid: isVoidTag}, !isVoidTag);
    }
}

BaseHTMLHandler.prototype = Object.create(BaseHandler.prototype);
update(BaseHTMLHandler.prototype, { 
    parseAttrs: function (args, startIndex) {
        var attrs = {};
        var idx = startIndex || 0;
        var length = args.length;
        while (idx < length) {
            var arg = args[idx];
            if (typeof arg === "string" || typeof arg === "number") {
                // assume that a key-value pair should be comsumed
                // That is, the next argument must be the corresponding value of the key
                var key = arg + ""; // coerce the type of 'arg' to string
                idx++;
                var value = args[idx]; // we don't have to check if idx is out of bound. In the case, we get 'undefined' and it's okay.
                idx++;
                attrs[key] = value;
            } else if (typeof arg === "object") {
                // In this case, assume the argument is an object that represents key-value mappings to be updated
                update(attrs, arg);
                idx++;
            } else {
                throw TypeError("Bad argument near " + this.currentPositionRepr());
            }
        }

        if (attrs.className) {
            if (attrs["class"]) {
                attrs["class"] += " " + attrs.className;
            } else {
                attrs["class"] = attrs.className;
            }
            delete attrs.className;
        }

        if (attrs.classList) {
            var classList = attrs.classList;
            if (!isArrayLike(classList)) {
                throw TypeError("Expected an array-like object for 'classList' attribute (near " + this.currentPositionRepr() + ")");
            }
            for (idx = 0; idx < classList.length; idx++) {
                var className = classList[idx];
                if (attrs["class"]) {
                    attrs["class"] += " " + className;
                } else {
                    attrs["class"] = className;
                }
            }
            delete attrs.classList;
        }
        return attrs;
    }
});


// Add If & For statements for templating
function BaseSyntacticHTMLHandler() {
    BaseHTMLHandler.apply(this);
    this.addTagName('For', {type: 'htmlSyntax', syntax: 'for', syntype: 'iteration'}, false);
    this.addTagName('If', {type: 'htmlSyntax', syntax: 'if', syntype: 'condition'}, false);
    this.addTagName('ElseIf', {type: 'htmlSyntax', syntax: 'elseif', syntype: 'condition'}, false);
    this.addTagName('Else', {type: 'htmlSyntax', syntax: 'else', syntype: 'condition'}, false);
    
    this.passingIfStmt = null;
}

BaseSyntacticHTMLHandler.prototype = Object.create(BaseHTMLHandler.prototype);
update(BaseSyntacticHTMLHandler.prototype, {
    _evaluateCond: function (c, tagFn) {
        if (typeof c === "function")
            return c.apply(tagFn); // do lazy evaluation for predicate expression
        else
            return c;
    },
    initState: function (state) {
        BaseHTMLHandler.prototype.initState.apply(this, arguments);
        state.passedCondStmt = null;
    },
    willMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {
        BaseHTMLHandler.prototype.willMeetOpeningTag.apply(this, arguments);

        var curState = this.getCurState();
        if (tagInfo.type !== "htmlSyntax" || tagInfo.syntype !== 'condition') {
            curState.passedCondStmt = null;
        } 
        if (tagInfo.type !== "htmlSyntax") {
            return;
        }

        switch (tagInfo.syntax) {
        case "for":
            var arr = args[0];
            var iterFn = args[1];
            if (!isArrayLike(arr))
                throw TypeError("For statement should accept an array-like object as the first argument (near " + this.currentPositionRepr() + ")");

            for (var idx = 0; idx < arr.length; idx++) {
                var elem = arr[idx];
                iterFn.call(tagFn, elem, idx, arr);
            }
            break;
        case "elseif":
        case "else":
            if (curState.passedCondStmt === null) {
                throw TypeError('Unexpected tag ' + tagName + '. Did you mean If() tag? (near ' + this.currentPositionRepr() + ")");
            }
            // falling through
        case "if":
            if (tagInfo.syntax === "else") {
                if (curState.passedCondStmt === false) {
                    var elseFn = args[0];
                    if (elseFn) elseFn.apply(tagFn);
                }
                curState.passedCondStmt = null;
            } else if (tagInfo.syntax === "if" || !curState.passedCondStmt) {
                var condExpr = args[0], condFn = args[1];
                if (this._evaluateCond(condExpr, tagFn)) {
                    curState.passedCondStmt = null;
                    if (condFn) condFn.apply(tagFn);
                    curState.passedCondStmt = true;
                } else {
                    curState.passedCondStmt = false;
                }
            }
            break;
        }
    }
});

function DOMHandler() {
    BaseSyntacticHTMLHandler.apply(this);
    this._htmlRoots = [];

}

DOMHandler.prototype = Object.create(BaseSyntacticHTMLHandler.prototype);
update(DOMHandler.prototype, {
    didMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetOpeningTag.apply(this, arguments);
        if (tagInfo.type === 'html') {
            var elt = document.createElement(tagName);
            var attrs = this.parseAttrs(args);
            for (var attrname in attrs) {
                elt.setAttribute(attrname, attrs[attrname]);
            }
            this.getCurState().htmlEltContainer = elt;
        }
    },
    willMeetClosingTag: function (tagName, tagInfo, closingArgs, tagFn) {
        BaseSyntacticHTMLHandler.prototype.willMeetClosingTag.apply(this, arguments);
        if (tagInfo.type === "html") {
            var eltContainer = this.getCurState().htmlEltContainer;
            var prevState = this.getPrevState();
            var parentElt = prevState.htmlEltContainer;

            if (parentElt) {
                parentElt.appendChild(eltContainer);
            } else {
                this._htmlRoots.push(eltContainer); // top-level
            }
        }
    },
    didMeetText: function (text, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetText(this, arguments);
        var textNode = document.createTextNode(text);
        var curState = this.getCurState();
        if (!this.isTopFrame()) {
            curState.htmlEltContainer.appendChild(textNode);
        } else {
            this._htmlRoots.push(textNode);
        }
    },
    getHTMLRoots: function () {
        this.checkTopFrame();
        return this._htmlRoots;
    },
    appendTo: function (destElt) {
        var roots = this.getHTMLRoots();
        for (var idx = 0; idx < roots.length; idx++) {
            var rootElt = roots[idx];
            destElt.appendChild(rootElt);
        }
    },

    renderTo: function (destElt) {
        while (destElt.firstChild) {
            destElt.removeChild(destElt.firstChild);
        }
        this.appendTo(destElt);
    },

    getProxyMethodNames: function () {
        var supers = BaseSyntacticHTMLHandler.prototype.getProxyMethodNames.apply(this, arguments);
        return supers.concat(["appendTo", "renderTo", "getHTMLRoots"]);
    }
});

function HTMLStringHandler() {
    BaseSyntacticHTMLHandler.apply(this);
    this.buffer = "";
}

HTMLStringHandler.prototype = Object.create(BaseSyntacticHTMLHandler.prototype);
update(HTMLStringHandler.prototype, {
    didMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetOpeningTag.apply(this, arguments);
        if (tagInfo.type === "html") {
            this.buffer += "<" + tagName;
            var attrs = this.parseAttrs(args);
            for (var attrname in attrs) {
                var attrvalue = attrs[attrname];
                this.buffer += " " + quoteattr(attrname) + "='" + quoteattr(attrvalue) + "'";
            }
            this.buffer += ">";
        }
    },
    didMeetClosingTag: function (tagName, tagInfo, args, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetClosingTag.apply(this, arguments);
        if (tagInfo.type === "html" && !tagInfo.isVoid) {
            this.buffer += "</" + tagName + ">";
        }
    },
    didMeetText: function (text, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetText(this, arguments);
        this.buffer += quoteattr(text);
    },

    toHTML: function () {
        this.checkTopFrame();
        return this.buffer;
    },

    appendTo: function (destElt) {
        destElt.insertAdjacentHTML('beforeend', this.toHTML());
    },

    renderTo: function (destElt) {
        destElt.innerHTML = this.toHTML();
    },

    writeHere: function () {
        document.write(this.toHTML());
    },

    getProxyMethodNames: function () {
        var supers = BaseSyntacticHTMLHandler.prototype.getProxyMethodNames.apply(this, arguments);
        return supers.concat(["appendTo", "renderTo", "toHTML", "writeHere"]);
    }
});

function ReactJSHandler() {
    BaseSyntacticHTMLHandler.apply(this);

    if (!global.React) {
        throw TypeError("React is not found");
    }
    if (!global.ReactDOM) {
        throw TypeError("ReactDOM is not found");
    }

    var componentTagInfo = {type: 'reactComponent'};
    this.addTagName("R", componentTagInfo, componentTagInfo);
    this.addTagName("Comp", componentTagInfo, componentTagInfo);
    this.addTagName("Component", componentTagInfo, componentTagInfo);

    this._bakedComponent = null;
}

ReactJSHandler.prototype = Object.create(BaseSyntacticHTMLHandler.prototype);
update(ReactJSHandler.prototype, {
    didMeetOpeningTag: function (tagName, tagInfo, args, tagFn) {
        BaseSyntacticHTMLHandler.prototype.didMeetOpeningTag.apply(this, arguments);

        var componentObj, attrs;
        if (tagInfo.type === "html") {
            componentObj = tagName;
            attrs = this.parseAttrs(args);
        } else if (tagInfo.type === 'reactComponent') {
            componentObj = args[0];
            attrs = this.parseAttrs(args, 1);
        } else
            return;
        if (attrs["class"]) {
            attrs.className = attrs["class"];
            delete attrs["class"];
        }
        this.getCurState().createrArguments = [componentObj, attrs];
    },
    willMeetClosingTag: function (tagName, tagInfo, args, tagFn) {
        BaseSyntacticHTMLHandler.prototype.willMeetClosingTag.apply(this, arguments);
        if (tagInfo.type !== "html" && tagInfo.type !== "reactComponent") {
            return;
        }

        var curState = this.getCurState(), prevState = this.getPrevState();
        var prevCreaterArguments = prevState.createrArguments;
        var bakedComponent = React.createElement.apply(React, curState.createrArguments);
        if (prevCreaterArguments) {
            prevCreaterArguments.push(bakedComponent);
        } else if (!this.bakedComponent) {
            this.bakedComponent = bakedComponent;
        } else {
            if ("console" in global) {
                console.warn("Currently ReactJS doesn't support multiple root elements. By this reason, all root elements except the first one have been ignored and not built.");
            }
        }
    },
    didMeetText: function (text, tagFn) {
        var createrArguments = this.getCurState().createrArguments;
        if (createrArguments)
            createrArguments.push(text);
    },
    toElement: function () {
        this.checkTopFrame();
        return this.bakedComponent;
    },
    endReact: function () {
        return this.toElement();
    },
    renderTo: function (destElt) {
        return ReactDOM.render(this.toElement(), destElt);
    },
    getProxyMethodNames: function () {
        var supers = BaseSyntacticHTMLHandler.prototype.getProxyMethodNames.apply(this, arguments);
        return supers.concat(["appendTo", "renderTo", "toElement", "endReact"]);
    }
});


DotTag.addSpec({
    name: "DOM",
    handlerFactory: function () { return new DOMHandler(); }
});

DotTag.addSpec({
    name: "HTML",
    handlerFactory: function () { return new HTMLStringHandler(); }
});

DotTag.addSpec({
    name: "React",
    handlerFactory: function () { return new ReactJSHandler(); }
});

})(((typeof exports === "undefined"? this: exports).DotTag = {}), (typeof global === "undefined"? this:global));
