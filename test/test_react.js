"use strict";
var expect = chai.expect;

describe("DotTag (ReactJS)", () => {
    var pg = null;
    before(function () {
        pg = document.createElement("div");
        document.body.appendChild(pg);
    });
    it("A simple component", () => {
        var ListItemComponent = React.createClass({
            render: function () {
                return DotTag
                .React()
                    .li({className: "A"})(this.props.itemName)._li()
                .endReact();
            }
        });
        var MainComponent = React.createClass({
            getInitialState: function () {
                return {
                    memos: [
                        'First',
                        'Second',
                        'Third'
                    ]
                }
            },
            render: function () {
                return DotTag.React().div()
                    .h2()("Heading2")._h2()
                    .hr()
                    .ol()
                        (this.state.memos.map(function (elem) {
                            return DotTag.React()
                                .R(ListItemComponent, {itemName: elem})
                                ._R()
                            .endReact();
                        }))
                        .For(this.state.memos, function (elem) {this
                            .R(ListItemComponent, {itemName: elem})._R()
                        })
                        ('Sel')
                    ._ol()
                ._div()
                .endReact();
            }
        });
        DotTag.React()
            .R(MainComponent)._R()
        .renderTo(pg);
    });

    describe("invariant tests", () => {
        var rootElt;
        beforeEach(function () {
            rootElt = document.createElement("div");
            rootElt.id = "react-root";
            document.body.appendChild(rootElt);
        });
        afterEach(function () {
            ReactDOM.unmountComponentAtNode(rootElt);
            rootElt.parentNode.removeChild(rootElt);
            rootElt = null;
        });

        it("className on root", () => {
            DotTag.React()
                .div({className: "a"})
                ._div()
            .renderTo(rootElt);
            expect(rootElt.firstChild.className).to.equal('a');
        });
        it("'class' attribute on root", () => {
            DotTag.React()
                .div({"class": "a"})
                ._div()
            .renderTo(rootElt);
            expect(rootElt.firstChild.className).to.equal('a');
        });
        it("classList attribute on root", () => {
            DotTag.React()
                .div({classList: ["a", "b", "c"]})
                ._div()
            .renderTo(rootElt);
            expect(rootElt.firstChild.className).to.equal('a b c');
        });
        it('className prop on root component', () => {
            var Main = React.createClass({
                render: function () {
                    return DotTag.React()
                        .div({className: "a"})
                        ._div()
                    .toElement();
                }
            });

            DotTag.React()
                .R(Main)
                ._R()
            .renderTo(rootElt);
            expect(rootElt.firstChild.className).to.equal('a');
        });
        it('injecting className prop on root component', () => {
            var Main = React.createClass({
                render: function () {
                    return DotTag.React()
                        .div()
                        ._div()
                    .toElement();
                }
            });

            DotTag.React()
                .R(Main, {className: 'a'})
                ._R()
            .renderTo(rootElt);
            expect(rootElt.firstChild.className).to.equal('a');
        });
    });
});

