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
                    .li()(this.props.itemName)._li()
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
                return DotTag.React()
                .div()
                    .h2()("Heading2")._h2()
                    .hr()
                    .ol()
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
    // Let's do this
    // https://pankajparashar.com/posts/todo-app-react-js/
});

