/* global Vue, mdc, fetch, confirm */

Vue.component('indeterminate-progress-bar', {
    render(createElement) {
        return createElement('div', { attrs: { role: 'progressbar' }, class: 'mdc-linear-progress mdc-linear-progress--indeterminate' }, [
            createElement('div', { class: 'mdc-linear-progress__buffering-dots' }),
            createElement('div', { class: 'mdc-linear-progress__buffer' }),
            createElement('div', { class: 'mdc-linear-progress__bar mdc-linear-progress__primary-bar' }, [
                createElement('span', { class: 'mdc-linear-progress__bar-inner' }),
            ]),
            createElement('div', { class: 'mdc-linear-progress__bar mdc-linear-progress__secondary-bar' }, [
                createElement('span', { class: 'mdc-linear-progress__bar-inner' }),
            ]),
        ]);
    },
    mounted() {
        mdc.linearProgress.MDCLinearProgress.attachTo(this.$el);
    },
});

Vue.component('text-fragment', {
    functional: true,
    props: {
        textContent: {
            type: String,
            required: false,
        },
    },
    render(createElement, context) {
        let content = context.props.textContent;
        if (content == null) {
            content = '';
        } else {
            content = '' + content;
        }
        let fragment = [];
        let first = true;
        for (let line of content.split(/\n|\r\n?/g)) {
            if (first) {
                first = false;
            } else {
                fragment.push(createElement('br'));
            }
            if (line) {
                fragment.push(line);
            }
        }

        return fragment;
    },
});

Vue.component('article-item', {
    props: {
        articleId: {
            type: Number,
            required: true,
        },
        firstKey: {
            type: String,
            required: false,
        },
        bodySummary: {
            type: String,
            required: false,
        },
    },
    render(createElement) {
        return createElement('li', { class: 'mdc-list-item', on: { click: () => loadArticle(this.articleId) } }, [
            createElement('span', { class: 'mdc-list-item__text' }, [
                this.firstKey,
                createElement('span', { class: 'mdc-list-item__secondary-text' },
                    this.bodySummary
                ),
            ]),
        ]);
    },
    mounted() {
        mdc.ripple.MDCRipple.attachTo(this.$el);
    },
});

Vue.component('text-field', {
    props: {
        value: {
            type: String,
            default: '',
        },
        inputId: {
            type: String,
            required: true,
        },
        placeholder: {
            type: String,
            required: false,
        },
        maxlength: {
            type: Number,
            required: false,
        },
    },
    render(createElement) {
        return createElement('div', { class: 'mdc-text-field mdc-text-field--box' }, [
            createElement('input', { attrs: { id: this.inputId, type: 'text', value: this.value, maxlength: this.maxlength }, class: 'mdc-text-field__input', on: { input: event => this.$emit('input', event.target.value) } }),
            this.placeholder ? createElement('label', { attrs: { for: this.inputId }, class: 'mdc-floating-label' }, this.placeholder) : null,
            createElement('div', { class: 'mdc-line-ripple' }),
            (this.maxlength != null) ? createElement('div', { class: { 'text-field__maxlength': true, 'text-field__maxlength--overflow': this.value.length > this.maxlength } }, this.value.length + ' / ' + this.maxlength) : null,
        ]);
    },
    mounted() {
        mdc.textField.MDCTextField.attachTo(this.$el);
    },
});

Vue.component('keys-fields', {
    props: {
        value: {
            type: Array,
            required: true,
        },
        inputIdPrefix: {
            type: String,
            required: true,
        },
        maxlength: {
            type: Number,
            required: false,
        },
    },
    render(createElement) {
        let keys = this.value;
        function updateArray(array, index, value) {
            return array.slice(0, index).concat([ value ], array.slice(index + 1));
        }
        return createElement('span', { class: 'keys-fields' }, keys.length ? keys.map((_, i) =>
            createElement('text-field', { class: [ this.inputIdPrefix + 'n-wrapper', this.inputIdPrefix + (i + 1) + '-wrapper' ], props: { value: keys[i + 1], maxlength: 191, inputId: this.inputIdPrefix + (i + 1) }, on: { input: value => this.$emit('input', updateArray(this.value, i + 1, value)) } })
        ) : [
            'N/A'
        ]);
    },
});

Vue.component('text-area', {
    props: {
        value: {
            type: String,
            default: '',
        },
        inputId: {
            type: String,
            required: true,
        },
        placeholder: {
            type: String,
            required: false,
        },
        maxlength: {
            type: Number,
            required: false,
        },
    },
    render(createElement) {
        return createElement('div', { class: 'mdc-text-field mdc-text-field--textarea' }, [
            createElement('textarea', { attrs: { id: this.inputId, maxlength: this.maxlength }, class: 'mdc-text-field__input', on: { input: event => this.$emit('input', event.target.value) } }, [
                this.value,
            ]),
            this.placeholder ? createElement('label', { attrs: { for: this.inputId }, class: 'mdc-floating-label' }, this.placeholder) : null,
            (this.maxlength != null) ? createElement('div', { class: { 'text-field__maxlength': true, 'text-field__maxlength--overflow': this.value.length > this.maxlength } }, this.value.length + ' / ' + this.maxlength) : null,
        ]);
    },
    mounted() {
        mdc.textField.MDCTextField.attachTo(this.$el);
    },
});

let searchRefreshTimeout = null;

let vm = new Vue({
    el: '#app',
    data: {
        search: '',

        articlesLoading: true,
        articles: [],

        articleLoading: false,
        articleEditing: false,
        article: null,
        showKeys: true,

        userLoading: true,
        user: null,
    },
    methods: {
        logOut,
        createArticle,
        editArticle,
        deleteArticle,
        cancelEditArticle,
        saveArticle,
        closeArticle,
    },
    watch: {
        search() {
            if (searchRefreshTimeout != null) {
                clearTimeout(searchRefreshTimeout);
            }
            searchRefreshTimeout = setTimeout(refreshSearch, 300);
        },
    }
});

function refreshSearch() {
    vm.articlesLoading = true;
    let search = vm.search;
    return fetch('/api/articles' + (search ? ('?search=' + encodeURIComponent(search)) : ''))
        .then(response => response.json())
        .then(({ articles }) => {
            vm.articles = articles;
        })
        .catch(err => {
            console.error(err);
            vm.articles = [];
        })
        .then(() => {
            vm.articlesLoading = false;
        });
}

function refreshUser() {
    vm.userLoading = true;
    return fetch('/api/me', { credentials: 'same-origin' })
        .then(response => response.json())
        .then(user => {
            vm.user = user;
        })
        .catch(err => {
            console.error(err);
            vm.user = null;
        })
        .then(() => {
            vm.userLoading = false;
        });
}

function logOut() {
    return fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
        .then(refreshUser);
}

function loadArticle(articleId) {
    vm.articleEditing = false;
    vm.articleLoading = true;
    return fetch('/api/articles/' + encodeURIComponent(articleId))
        .then(response => response.json())
        .then(article => {
            vm.article = article;
        })
        .catch(err => {
            console.error(err);
            vm.article = null;
        })
        .then(() => {
            vm.articleLoading = false;
        });
}

function createArticle() {
    vm.article = {
        id: null,
        body: '',
        keys: [],
    };
    vm.articleLoading = false;
    vm.articleEditing = true;
}

function editArticle() {
    vm.articleEditing = true;
}

function deleteArticle() {
    if (!vm.article) {
        return;
    }
    let articleId = vm.article.id;
    if (!articleId) {
        return;
    }
    if (!confirm('Voulez-vous vraiment supprimer cet article ?')) {
        return;
    }
    vm.article = null;
    return fetch('/api/articles/' + encodeURIComponent(articleId), { method: 'DELETE', credentials: 'same-origin' })
        .then(refreshSearch);
}

function cancelEditArticle() {
    if (!vm.article) {
        return;
    }
    vm.articleEditing = false;
    if (!vm.article.id) {
        vm.article = null;
    } else {
        return loadArticle(vm.article.id);
    }
}

function saveArticle() {
    vm.articleLoading = true;
    vm.articleEditing = false;
    let article = vm.article;
    let articleId = article.id;
    article = {
        body: article.body.trim(),
        keys: article.keys.map(k => k.trim()).filter(k => !!k),
    };
    let method = articleId ? 'PUT' : 'POST';
    let uri = articleId ? ('/api/articles/' + encodeURIComponent(articleId)) : '/api/articles';
    fetch(uri, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(article) })
        .then(response => response.json())
        .then(article => {
            vm.article = article;
        })
        .catch(err => {
            console.error(err);
            if (articleId) {
                loadArticle(articleId);
            } else {
                vm.article = null;
            }
        })
        .then(() => {
            vm.articleLoading = false;
            refreshSearch();
        });
}

function closeArticle() {
    vm.article = null;
    vm.articleEditing = false;
    vm.articleLoading = false;
}

mdc.autoInit();

refreshSearch();
refreshUser();
