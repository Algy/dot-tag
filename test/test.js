"use strict";
var expect = chai.expect;

function jsonifyNode(node) {
    if (node.nodeType === 1) {
        var elt = node;
        var children = [];
        for (var idx = 0; idx < elt.childNodes.length; idx++) {
            children.push(jsonifyNode(elt.childNodes[idx]));
        }

        var attrs = {};
        for (var idx = 0; idx < elt.attributes.length; idx++) {
            var attrEntry = elt.attributes[idx];
            attrs[attrEntry.name] = attrEntry.value;
        }

        return {
            nodeType: "element",
            attrs: attrs,
            tagName: elt.tagName.toLowerCase(),
            children: children
        };
    } else if (node.nodeType === 3) {
        return {
            nodeType: "text",
            nodeValue: node.nodeValue
        };
    }

    return {nodeType: "unknown"};
}

describe('DotTag (HTML & DOM)', () => {
    var iframe = null;
    var testRootElt = null;
    beforeEach(() => {
        var elt = document.createElement("div");
        elt.id = "test-element";
        document.body.appendChild(elt);
        testRootElt = elt;

        iframe = document.createElement("iframe");
        testRootElt.appendChild(iframe);
        var iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write("<!doctype html><html><body></body></html>");
        iframeDoc.close();
    });

    afterEach(() => {
        var elt = testRootElt;
        elt.parentNode.removeChild(elt);
        testRootElt = null;
        iframe = null;
    });

    it('test the root element set up (preparation)', () => {
        var rootEltJson = jsonifyNode(testRootElt);
        var expectation = {
            tagName: "div",
            nodeType: "element",
            attrs: {"id": "test-element"},
            children: [{
                tagName: "iframe",
                nodeType: "element",
                attrs: {},
                children: []
            }]
        };
        expect(rootEltJson).to.deep.equal(expectation);
    });

    describe('Rendering tests for a simple structure', () => {
        var simpleStructureJson = {
            tagName: "section",
            nodeType: "element",
            attrs: {},
            children: [{
                tagName: "article",
                nodeType: "element",
                attrs: {},
                children: [{
                    tagName: "meta",
                    nodeType: "element",
                    attrs: {"charset": "utf-8"},
                    children: []
                }]
            }, {
                tagName: "section",
                nodeType: "element",
                attrs: {"class": "a b c"},
                children: [{
                    tagName: "div",
                    attrs: {"class": "row"},
                    nodeType: "element",
                    children: [{
                        tagName: "div",
                        attrs: {id: "very-first-div", "class": "col-xs-6"},
                        nodeType: "element",
                        children: [{
                            tagName: "a",
                            attrs: {href: "http://example.com", target: "_blank"},
                            nodeType: "element",
                            children: [{
                                nodeType: "text",
                                nodeValue: "Hello World!"
                            }]
                        }]
                    }]
                }]
            }]
        };
        var simpleStructure = {};
        var builderNames = ['DOM', 'HTML'];
        before(function () {
            builderNames.forEach(function (name) {
                simpleStructure[name] = DotTag[name]()
                .section()
                    .article()
                        .meta({charset: 'utf-8'})
                    .endarticle()
                    .section({classList: ['a', 'b', 'c']})
                        .div({className: "row"})
                            .div({id: "very-first-div",
                                  "class": "col-xs-6"})
                                .a({href: "http://example.com", target: "_blank"})
                                    ("Hello World!")
                                ._a()
                            ._()
                        .end()
                    .endsection()
                .endsection();
            });
        });
        builderNames.forEach(function (name) {
            describe("." + name + "()", () => {
                it('renderTo', () => {
                    simpleStructure[name].renderTo(iframe.contentWindow.document.body);
                    var bodyJson = jsonifyNode(iframe.contentWindow.document.body);
                    expect(bodyJson.children.length).to.equal(1);
                    var renderedRoot = bodyJson.children[0];
                    expect(renderedRoot).to.deep.equal(simpleStructureJson);
                });

                it('appendTo', () => {
                    iframe.contentWindow.document.body.appendChild(document.createTextNode("Dummy node"));
                    simpleStructure[name].appendTo(iframe.contentWindow.document.body);
                    var bodyJson = jsonifyNode(iframe.contentWindow.document.body);
                    expect(bodyJson.children.length).to.equal(2);
                    var renderedRoot = bodyJson.children[1];
                    expect(renderedRoot).to.deep.equal(simpleStructureJson);
                });
            });
        });
    });

    describe('A tag pair', () => {
        it("mismatches", () => {
            expect(() => {
                DotTag.DOM()
                .section()
                    ("Hello")
                .enddiv();
            }).to.throw(Error);
        });
        it("matches", () => {
            expect(() => {
                DotTag.DOM()
                .section()
                    ("Hi")
                .endsection();
            }).to.not.throw(Error);
        });
        it("matches with a general closer", () => {
            expect(() => {
                DotTag.DOM()
                .section()
                    ("Hi")
                .end();
            }).to.not.throw(Error);
        });
        it("when opening tags are not consumed completely", () =>  {
            expect(() => {
                DotTag.DOM()
                .section()
                .section() // accidently misspelled endsection()
                .appendTo(testRootElt);
            }).to.throw(Error);
        });
        it("is not required for a void tag", () => {
            expect(() => {
                DotTag.DOM()
                .link()
                .appendTo(testRootElt);
            }).to.not.throw(Error);
        });
    });

    describe("multiple roots", () => {
        it("rendered properly", () => {
            DotTag.DOM()
            .section()._section()
            .section()._section()
            .section()._section() // triple section tags
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.childNodes.length).to.equal(3);
        });
    });

    describe("Content body", () => {
        it("includes number", () => {
            DotTag.DOM()
            .div()(42)._div()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>42</div>");
        });
        it("includes an array-like object", () => {
            DotTag.DOM()
            .div()(42)._div()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>42</div>");
        });
        it("includes and call a function with no argument, as part of content body", () => {
            DotTag.DOM()
            .div()
                (function () {
                    this
                    (42)
                })
            ._div()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>42</div>");
        });

        it("doesn't include builder itself", () => {
            var builder = DotTag.DOM();

            builder
            .div()
                (builder.a()._a())
            .enddiv()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div><a></a></div>");
        });
        it("is able to accept multiple arguments", () => {
            DotTag.DOM()
            .div()
                (1, 2, 3, 4)
            .enddiv()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>1234</div>");
        });
    });

    describe("Syntax For", () => {
        it("iterates through an array", () => {
            var array = [1,2];
            DotTag.DOM()
            .div()
                .For(array, function (elem, index, myarray) {
                    this
                    ("array[" + index + "]" + " == " + elem + ";")
                    expect(myarray).to.equal(array);
                })
            .enddiv()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>array[0] == 1;array[1] == 2;</div>");
        });

        it("iterates through an array-like object", () => {
            var arrobj = {'0': 1, '1': 2, 'length': 2};
            DotTag.DOM()
            .div()
                .For(arrobj, function (elem, index, myarray) {
                    this
                    ("array[" + index + "]" + " == " + elem + ";")
                    expect(myarray).to.equal(arrobj);
                })
            .enddiv()
            .renderTo(iframe.contentWindow.document.body);
            expect(iframe.contentWindow.document.body.innerHTML)
            .to.equal("<div>array[0] == 1;array[1] == 2;</div>");
        });

        it("test multiple for loops", () => {
            var h = DotTag.HTML()
            .For([1, 2, 3], function (a) {this
                .ul({id: a})
                .For([2, 3, 4], function (b) {this
                    .li()
                        (a * b)
                    ._li()
                })
                .endul()
            })
            .toHTML();
            expect(h).to.equal("<ul id='1'><li>2</li><li>3</li><li>4</li></ul><ul id='2'><li>4</li><li>6</li><li>8</li></ul><ul id='3'><li>6</li><li>9</li><li>12</li></ul>");
        });
    });

    describe("Syntax If", () => {
        it("ElseIf & Else followed by no If stmt", () => {
            expect(() => {
                DotTag.HTML()
                .Else(function () {})
            }).to.throw(Error);

            expect(() => {
                DotTag.HTML()
                .Elif(true, function () {})
            }).to.throw(Error);

            expect(() => {
                var handler = DotTag.HTML()
                .If(true, function () {})
                .ElseIf(true, function () {})
                .Else(function () {});
            }).to.not.throw(Error);
        });

        it("ElseIf sequence", () => {
            function filter(x) {
                return DotTag.HTML()
                .If(x == 1, function (){this
                    ('A')
                })
                .ElseIf(x == 2, function (){this
                    ('B')
                })
                .ElseIf(x == 3, function (){this
                    ('C')
                })
                .Else(function (){this
                    ('D')
                })
                .If(x == 5, function () {this
                    ('E')
                })
                .toHTML();
            }

            expect(filter(1)).to.equal("A");
            expect(filter(2)).to.equal("B");
            expect(filter(3)).to.equal("C");
            expect(filter(4)).to.equal("D");
            expect(filter(5)).to.equal("DE");
            expect(filter(6)).to.equal("D");
        });

        it("If sequence", () => {
            function filter(x) {
                return DotTag.HTML()
                .If(x == 1, function (){this
                    ('A')
                })
                .If(x >= 1, function (){this
                    ('B')
                })
                .If(x == 3, function (){this
                    ('C')
                })
                .If(x >= 4, function (){this
                    ('D')
                })
                .If(x == 5, function () {this
                    ('E')
                })
                .toHTML();
            }
            expect(filter(1)).to.equal("AB");
            expect(filter(2)).to.equal("B");
            expect(filter(3)).to.equal("BC");
            expect(filter(4)).to.equal("BD");
            expect(filter(5)).to.equal("BDE");
        });

        it("2-depth If stmts", () => {
            var h = DotTag.HTML()
            .If(true, function () {this
                (1)
                .If(false, function () {this
                    (2)
                })
            })
            .Else(function () {this
                (3)
            })
            .toHTML();
            expect(h).to.equal("1");

            var h2 = DotTag.HTML()
            .If(true, function () {this
                (1)
                .If(true, function () {this
                    (2)
                })
            })
            .Else(function () {this
                (3)
            })
            .toHTML();

            expect(h2).to.equal("12");

            expect(() => {
                DotTag.HTML()
                .If(true, function () {this
                    (1)
                    .ElseIf(true, function () {})
                })
                .Else(function () {});
            }).to.throw(Error);

        });

        it("a if statement", () => {
            var h = DotTag.HTML()
            .div()
                .If(function () { return true; }, function () {this
                    ("OK")
                })
                .If(function () { return false; }, function () {this
                    ("ERROR")
                })
            .enddiv()
            .div()
                .If(true, function () {this
                    ("OK")
                })
                .If(false, function () {this
                    ("ERROR")
                })
            .enddiv()
            .toHTML();
            expect(h).to.equal('<div>OK</div><div>OK</div>');
        });

        it("lazy evaluation on predicate", () => {
            expect(() => {
                var x = null;
                DotTag.HTML()
                .If(x == null, function () {})
                .ElseIf(x.a >= 2, function () {})
            }).to.throw(TypeError);

            expect(() => {
                var x = null;
                DotTag.HTML()
                .If(x == null, function () {})
                .ElseIf(() => { return x.a >= 2 }, function () {})
            }).to.not.throw(TypeError);

            var x = {a: 3};
            expect(
                DotTag.HTML()
                .If(x == null, function () {})
                .ElseIf(x.a >= 2, function () {this('A') })
                .toHTML()
            ).to.equal('A');
        });
    });
});

