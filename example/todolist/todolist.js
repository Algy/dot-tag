// Poor man's JSX 

var TODOItem = React.createClass({
    getInitialState: function () {
        return {
            done: this.props.done
        }
    },
    onChange: function (ev) {
        this.setState({done: !this.state.done});
    },
    render: function () {
        return DotTag.React()
            .li()
                .input({
                    type: "checkbox",
                    checked: this.state.done? "checked": "",
                    className: this.state.done? "done": "",
                    onChange: this.onChange,
                    ref: 'doneCheckBox'
                })
                .a({href: this.props.url})(this.props.name)._a()
                .a({href: 'javascript:;', onClick: this.props.handleItemRemove})
                    ("Remove")
                ._a()
            ._li()
        .toElement()
    }
});

var TODOList = React.createClass({
    getInitialState: function () {
        return {
            items: []
        }
    },
    add: function (name, url, done) {
        done = done || false;
        url = url || "#";
        this.setState({items: this.state.items.concat({name: name, url: url, done: done}) });
    },

    handleItemRemove: function (index) {
        var allItems = this.state.items;
        allItems.splice(index, 1);
        this.setState({items: allItems});
    },
    render: function () {
        var that = this;
        return DotTag.React()
            .ul()
                .For(this.state.items, function (item, index) {this
                    .R(TODOItem, {
                        name: item.name,
                        url: item.url,
                        done: item.done,
                        key: index + "",
                        handleItemRemove: that.handleItemRemove.bind(that, index)
                    })
                    ._R()
                })
            ._ul()
        .toElement()
    }
});

var TODOPanel = React.createClass({
    getInitialState: function () {
        return {inputText: ""}
    },
    handleAdd: function () {
        this.refs.todoList.add(this.state.inputText, "#", false);
        this.setState({inputText: ""});
    },
    onChange: function (ev) {
        this.setState({
            inputText: ev.target.value
        });
    },
    render: function () {
        return DotTag.React()
            .div({className: "todolist"})
                .h2()("My TODO List")._h2()
                .R(TODOList, {ref: "todoList"})._R()
                .div()
                    .input({
                        type: "text",
                        value: this.state.inputText,
                        onChange: this.onChange,
                        onKeyDown: function (ev) {
                            if (ev.keyCode === 13 && this.state.inputText)
                                this.handleAdd();
                        }.bind(this)
                    })
                    .button({onClick: this.handleAdd})("Add")._button()
                ._div()
            ._div()
        .toElement()
    }
});

document.addEventListener("DOMContentLoaded", function () {
    DotTag.React()
        .R(TODOPanel)._R()
    .renderTo(document.getElementById("root"));
});


